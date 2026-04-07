import os
import io
import re
import uuid
import zipfile
import shutil
import unicodedata
from typing import List

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import uvicorn
import pdf2image
import pytesseract
from pypdf import PdfReader, PdfWriter

app = FastAPI(title="PDF AI Splitter API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Constants for local binary paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
POPPLER_PATH = os.path.join(BASE_DIR, "poppler", "poppler-24.08.0", "Library", "bin")
TESSERACT_CMD = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")

os.makedirs(UPLOADS_DIR, exist_ok=True)
pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD

# Serve uploads folder to frontend as static files so frontend can show thumbnails
app.mount("/api/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

def check_dependencies():
    missing = []
    if not os.path.exists(TESSERACT_CMD):
        missing.append(f"Tesseract nieznaleziony w {TESSERACT_CMD}")
    if not os.path.exists(POPPLER_PATH):
        missing.append(f"Poppler bin folder nieznaleziony w {POPPLER_PATH}")
    return missing

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Backend is running"}

@app.get("/api/health")
def health_check():
    missing = check_dependencies()
    if missing:
        return {"status": "error", "missing_dependencies": missing}
    return {"status": "ok", "message": "All dependencies available"}

# Modele Pydantic na żądanie podziału
class SectionDef(BaseModel):
    id: str
    title: str
    pages: List[int] # nowa logika: przyjmujemy rowniez z nieciągłymi nr stron (1-indexed)

class SplitRequest(BaseModel):
    file_id: str
    sections: List[SectionDef]

KEYWORDS = [
    "Umowa cesji", 
    "Załącznik nr 1", 
    "Załącznik nr 2", 
    "UMOWA CESJI WIERZYTELNOŚCI NA SZKODĘ", 
    "ANEKS DO UMOWY CESJI", 
    "UPOWAŻNIENIE", 
    "ZAWIADOMIENIE DŁUŻNIKA O PRZELEWIE WIERZYTELNOŚCI", 
    "OŚWIADCZENIE POSZKODOWANEGO", 
    "RODO"
]

def normalize_text(text: str) -> str:
    if not text:
        return ""
    return unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('utf-8')

REGEX_PATTERN = "(?i)(" + "|".join([normalize_text(k).replace(" ", r"\s+") for k in KEYWORDS]) + ")"


@app.post("/api/analyze")
async def analyze_pdf(file: UploadFile = File(...)):
    """
    Krok 1: Wgrywa PDF, konwertuje na obrazy.
    Zwraca ścieżki do obrazów dla lewego panelu frontendowego.
    """
    missing = check_dependencies()
    if missing:
        raise HTTPException(status_code=500, detail=f"Brakujące zależności: {', '.join(missing)}")

    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Plik musi być w formacie PDF")

    file_id = str(uuid.uuid4())
    file_dir = os.path.join(UPLOADS_DIR, file_id)
    os.makedirs(file_dir, exist_ok=True)
    
    pdf_path = os.path.join(file_dir, "doc.pdf")
    
    # Zapis
    content = await file.read()
    with open(pdf_path, "wb") as f:
        f.write(content)

    # Konwersja na obrazy JPEG (do miniatur)
    try:
        images = pdf2image.convert_from_path(pdf_path, poppler_path=POPPLER_PATH)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Błąd konwersji PDF do obrazów: {str(e)}")

    total_pages = len(images)
    detected_sections = []
    page_urls = []
    
    for i, img in enumerate(images):
        page_num = i + 1 # 1-indexed
        
        # Zapis do JPEG dla frontend preview
        jpg_filename = f"page_{page_num}.jpg"
        jpg_path = os.path.join(file_dir, jpg_filename)
        img.save(jpg_path, "JPEG")
        page_urls.append(f"http://localhost:8000/api/uploads/{file_id}/{jpg_filename}")
        
        section_found = False
        try:
            try:
                text = pytesseract.image_to_string(img, lang="pol")
            except:
                text = pytesseract.image_to_string(img)
                
            norm_text = normalize_text(text)
            match = re.search(REGEX_PATTERN, norm_text)
            if match:
                clean_title = re.sub(r'\s+', ' ', match.group(0)).strip()
                matched_nice_title = clean_title.title()
                for kw in KEYWORDS:
                    if normalize_text(kw).lower().replace(" ", "") == clean_title.lower().replace(" ", ""):
                        matched_nice_title = kw
                        break

                detected_sections.append({
                    "id": str(uuid.uuid4()),
                    "title": matched_nice_title,
                    "pages": [page_num] 
                })
                section_found = True
        except Exception as e:
            print(f"Błąd OCR strona {page_num}: {e}")
            pass
            
        if not section_found and len(detected_sections) > 0:
            detected_sections[-1]["pages"].append(page_num)

    return {
        "file_id": file_id,
        "original_filename": file.filename,
        "total_pages": total_pages,
        "page_urls": page_urls,
        "sections": detected_sections
    }

@app.post("/api/split")
async def split_pdf(request: SplitRequest):
    """
    Krok 2: Tnie wg tablic `pages` wskazanych przez użytkownika
    """
    file_dir = os.path.join(UPLOADS_DIR, request.file_id)
    pdf_path = os.path.join(file_dir, "doc.pdf")
    
    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail="Plik nie istnieje lub sesja wygasła.")

    reader = PdfReader(pdf_path)
    total_pdf_pages = len(reader.pages)
    zip_buffer = io.BytesIO()
    
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for idx, sec in enumerate(request.sections):
            writer = PdfWriter()
            valid_pages = sorted([p for p in sec.pages if 1 <= p <= total_pdf_pages])
            if not valid_pages:
                continue
                
            for page_num in valid_pages:
                writer.add_page(reader.pages[page_num - 1]) 
                
            safe_title = re.sub(r'[<>:"/\\|?*]', '_', sec.title)
            safe_title = safe_title[:50]
            part_filename = f"{idx+1}_{safe_title}.pdf"
            
            pdf_bytes = io.BytesIO()
            writer.write(pdf_bytes)
            zip_file.writestr(part_filename, pdf_bytes.getvalue())

    zip_buffer.seek(0)
    
    # Czyszczenie całego folderu sesji
    try:
        shutil.rmtree(file_dir)
    except:
        pass
        
    return StreamingResponse(
        iter([zip_buffer.getvalue()]), 
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=Podzielone_Dokumenty.zip"}
    )

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

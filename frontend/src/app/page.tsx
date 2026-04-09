"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Download,
  Plus,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Kolory zdefiniowane jako klasy Tailwind i odpowiadające im stylizacje
const SECTION_COLORS = [
  { border: "border-orange-500", bg: "bg-orange-500", shadow: "shadow-[0_0_15px_rgba(249,115,22,0.3)]" },
  { border: "border-blue-500", bg: "bg-blue-500", shadow: "shadow-[0_0_15px_rgba(59,130,246,0.3)]" },
  { border: "border-emerald-500", bg: "bg-emerald-500", shadow: "shadow-[0_0_15px_rgba(16,185,129,0.3)]" },
  { border: "border-purple-500", bg: "bg-purple-500", shadow: "shadow-[0_0_15px_rgba(168,85,247,0.3)]" },
  { border: "border-rose-500", bg: "bg-rose-500", shadow: "shadow-[0_0_15px_rgba(244,63,94,0.3)]" },
  { border: "border-yellow-500", bg: "bg-yellow-500", shadow: "shadow-[0_0_15px_rgba(234,179,8,0.3)]" },
  { border: "border-cyan-500", bg: "bg-cyan-500", shadow: "shadow-[0_0_15px_rgba(6,182,212,0.3)]" },
  { border: "border-pink-500", bg: "bg-pink-500", shadow: "shadow-[0_0_15px_rgba(236,72,153,0.3)]" },
];

interface Section {
  id: string;
  title: string;
  colorIndex: number;
}

type Step = "upload" | "analyzing" | "review" | "splitting" | "done" | "error";

export default function Home() {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [fileId, setFileId] = useState<string>("");
  const [pageUrls, setPageUrls] = useState<string[]>([]);
  
  // Zmapowanie która strona należy do której sekcji (pageIndex z 1-indexed do id sekcji)
  const [pageAssignments, setPageAssignments] = useState<Record<number, string>>({});
  
  const [sections, setSections] = useState<Section[]>([]);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // --- UPLOAD HANDLERS ---
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(true);
  }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
  }, []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files?.[0]?.type === "application/pdf") {
      setFile(e.dataTransfer.files[0]);
    } else {
      showError("Tylko pliki PDF są obsługiwane.");
    }
  }, []);
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]?.type === "application/pdf") {
      setFile(e.target.files[0]);
    } else {
      showError("Tylko pliki PDF są obsługiwane.");
    }
  };

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setStep("error");
  };

  // Krok 1: WIZUALIZACJA I ANALIZA
  useEffect(() => {
    if (file && step === "upload") {
      startAnalysis();
    }
  }, [file, step]);

  // Zablokowanie powiększania ekranu zapobiegające błędom w widoku aplikacji na PC
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => { if (e.ctrlKey) e.preventDefault(); };
    const handleKeyDown = (e: KeyboardEvent) => { 
      if (e.ctrlKey && (e.key === '=' || e.key === '-' || e.key === '+' || e.key === '0')) e.preventDefault(); 
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const startAnalysis = async () => {
    if (!file) return;
    setStep("analyzing");
    setErrorMessage("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("http://localhost:8000/api/analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Błąd podczas analizowania układu pliku.");
      }

      const data = await response.json();
      setFileId(data.file_id);
      setPageUrls(data.page_urls || []);
      
      const initialSections: Section[] = [];
      const assignments: Record<number, string> = {};
      
      if (data.sections && data.sections.length > 0) {
        data.sections.forEach((sec: any, idx: number) => {
           initialSections.push({
             id: sec.id,
             title: sec.title,
             colorIndex: idx % SECTION_COLORS.length
           });
           
           if (sec.pages && sec.pages.length > 0) {
             sec.pages.forEach((p: number) => {
               assignments[p] = sec.id;
             });
           }
        });
      }

      setSections(initialSections);
      setPageAssignments(assignments);
      if (initialSections.length > 0) setActiveSectionId(initialSections[initialSections.length - 1].id);
      
      setStep("review");
    } catch (err: any) {
      showError(err.message || "Błąd połączenia z serwerem.");
    }
  };

  // Krok 2: ZARZĄDZANIE SEKCJAMI I PRZYPISYWANIE STRON
  const addSection = () => {
    addSectionAt(sections.length);
  };

  const addSectionAt = (index: number) => {
    const newId = Math.random().toString(36).substring(7);
    const newColorIndex = sections.length % SECTION_COLORS.length;
    const newSections = [...sections];
    newSections.splice(index, 0, {
      id: newId,
      title: "",
      colorIndex: newColorIndex
    });
    setSections(newSections);
    setActiveSectionId(newId);
  };

  const updateSectionTitle = (id: string, title: string) => {
    setSections(sections.map(s => s.id === id ? { ...s, title } : s));
  };

  const removeSection = (id: string) => {
    setSections(sections.filter(s => s.id !== id));
    const newAssignments = { ...pageAssignments };
    Object.keys(newAssignments).forEach(key => {
      if (newAssignments[Number(key)] === id) delete newAssignments[Number(key)];
    });
    setPageAssignments(newAssignments);
    if (activeSectionId === id) setActiveSectionId(null);
  };

  const assignPageToActiveSection = (pageNum: number) => {
    if (!activeSectionId) {
      alert("Najpierw powołaj nową sekcję lub kliknij wybraną po prawej stronie!");
      return;
    }
    setPageAssignments(prev => {
      const next = { ...prev };
      if (next[pageNum] === activeSectionId) {
        delete next[pageNum];
      } else {
        next[pageNum] = activeSectionId;
      }
      return next;
    });
  };

  // Krok 3: CIĘCIE
  const startSplit = async () => {
    const sectionsPayload = sections.map(sec => {
      const pagesForSec = Object.entries(pageAssignments)
        .filter(([_, secId]) => secId === sec.id)
        .map(([pageNumStr, _]) => Number(pageNumStr));
      
      return {
        id: sec.id,
        title: sec.title || "Bez_Tytułu",
        pages: pagesForSec
      };
    }).filter(sec => sec.pages.length > 0);

    if (sectionsPayload.length === 0) {
      alert("Żadna sekcja nie ma przypisanych stron! Kliknij w lewym panelu odpowiednie strony.");
      return;
    }

    setStep("splitting");
    try {
      const response = await fetch("http://localhost:8000/api/split", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_id: fileId,
          sections: sectionsPayload
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Błąd podziału dokumentu.");
      }

      const blob = await response.blob();
      setDownloadUrl(window.URL.createObjectURL(blob));
      setStep("done");
    } catch (err: any) {
      showError(err.message || "Błąd połączenia z serwerem podczas cięcia.");
    }
  };

  const reset = () => {
    setStep("upload");
    setFile(null);
    setFileId("");
    setSections([]);
    setPageUrls([]);
    setPageAssignments({});
    setActiveSectionId(null);
    setDownloadUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const getPageSectionColor = (pageNum: number) => {
    const secId = pageAssignments[pageNum];
    if (!secId) return null;
    const sec = sections.find(s => s.id === secId);
    if (!sec) return null;
    return SECTION_COLORS[sec.colorIndex];
  };

  return (
    <main className="flex flex-col md:flex-row h-screen w-full bg-black text-white p-4 gap-4 font-sans overflow-hidden">
      
      {/* LEWA STRONA - GŁÓWNA */}
      <div className="flex-1 flex flex-col bg-neutral-900 border border-neutral-800 rounded-3xl pt-8 px-6 pb-6 relative overflow-hidden h-full">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight">PDF AI Splitter</h1>
          {step !== "upload" && (
            <button
              onClick={reset}
              title="Przerwij i zacznij od nowa z nowym plikiem"
              className="flex items-center gap-2 px-4 py-2 bg-red-600/90 hover:bg-red-500 text-white font-bold text-sm rounded-xl transition-all shadow-[0_0_15px_rgba(220,38,38,0.2)] active:scale-95"
            >
              <RotateCcw size={18} /> Zacznij od nowa
            </button>
          )}
        </div>
        
        <div className="flex-1 relative overflow-y-auto custom-scrollbar pr-4 pb-12 rounded-xl">
          <AnimatePresence mode="wait">
            
            {/* UPLOAD VIEW */}
            {(step === "upload" || step === "error") && (
              <motion.div
                key="upload"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex flex-col items-center justify-center p-4"
              >
                <div
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "w-full max-w-xl mx-auto border-2 border-dashed rounded-3xl flex flex-col items-center justify-center py-24 px-6 text-center cursor-pointer transition-all duration-300",
                    isDragging
                      ? "border-white bg-white/5"
                      : "border-neutral-700 hover:border-neutral-500 hover:bg-neutral-800/50"
                  )}
                >
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="application/pdf" className="hidden" />
                  <UploadCloud size={64} className="text-neutral-500 mb-6" />
                  <h3 className="text-2xl font-semibold mb-2">Wgraj swój plik PDF</h3>
                  <p className="text-neutral-500 text-lg">Przeciągnij i upuść lub kliknij, aby wybrać.</p>
                </div>

                {step === "error" && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8 flex items-center gap-3 p-4 bg-red-950/30 border border-red-900/50 text-red-500 rounded-xl max-w-xl w-full">
                    <AlertCircle className="shrink-0" size={24} />
                    <p className="font-medium">{errorMessage}</p>
                    <button onClick={reset} className="ml-auto underline text-sm hover:text-red-400">Zamknij</button>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* ANALYZING VIEW */}
            {step === "analyzing" && (
              <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col items-center justify-center">
                <Loader2 size={48} className="animate-spin text-white mb-6" />
                <h3 className="text-xl font-medium">Analizowanie dokumentu...</h3>
                <p className="text-neutral-500 mt-2">Przygotowujemy układ wizualny dokumentu i podział.</p>
              </motion.div>
            )}

            {/* REVIEW VIEW (PAGES GRID) */}
            {step === "review" && (
              <motion.div 
                key="review" 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {(pageUrls || []).map((url, i) => {
                  const pageNum = i + 1;
                  const colorConfig = getPageSectionColor(pageNum);
                  
                  return (
                    <motion.div 
                      key={pageNum}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => assignPageToActiveSection(pageNum)}
                      className={cn(
                        "relative flex flex-col items-center cursor-pointer transition-all duration-200 group bg-neutral-950 p-2 rounded-xl",
                        colorConfig ? `ring-4 ring-offset-4 ring-offset-neutral-900 ${colorConfig.border.replace('border-','ring-')} scale-[1.02] z-10 ${colorConfig.shadow}` : "hover:scale-[1.02] border border-neutral-800"
                      )}
                    >
                      <div className="w-full aspect-[1/1.41] bg-white rounded-lg overflow-hidden relative shadow-lg">
                        <img 
                          src={url} 
                          alt={`Page ${pageNum}`} 
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute bottom-2 left-2 bg-black/80 backdrop-blur-sm text-white px-2 py-1 rounded text-xs font-bold font-mono">
                          {pageNum}
                        </div>
                        {colorConfig && (
                          <div className={cn("absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-black border-2 border-black/10", colorConfig.bg)}>
                             <CheckCircle2 size={16} />
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}

            {/* SPLITTING VIEW */}
            {step === "splitting" && (
              <motion.div key="splitting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col items-center justify-center">
                <Loader2 size={48} className="animate-spin text-white mb-6" />
                <h3 className="text-xl font-medium">Wycinanie i kompresja...</h3>
                <p className="text-neutral-500 mt-2">Dzielenie PDF i generowanie pliku ZIP ze skonfigurowanymi sekcjami.</p>
              </motion.div>
            )}

            {/* DONE VIEW */}
            {step === "done" && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto">
                <div className="mb-8 bg-neutral-800 p-6 rounded-full shadow-[0_0_40px_rgba(255,255,255,0.1)]">
                  <CheckCircle2 size={64} className="text-white" />
                </div>
                <h2 className="text-4xl font-extrabold mb-4">Ukończono sukcesem!</h2>
                <p className="text-neutral-400 mb-10 text-lg">Strony z dokumentu zostały rozdzielone zgodnie z Twoimi preferencjami.</p>

                <div className="flex flex-col sm:flex-row gap-4 w-full">
                  <a href={downloadUrl} download="Podzielone_Dokumenty.zip" onClick={() => { setTimeout(reset, 2000) }} className="flex-1 flex items-center justify-center gap-2 px-8 py-5 bg-white text-black font-bold text-lg rounded-xl shadow-xl transition-all hover:scale-105 active:scale-95">
                    <Download size={24} /> Pobierz Plik ZIP
                  </a>
                  <button onClick={reset} className="px-8 py-5 bg-transparent hover:bg-neutral-800 text-neutral-300 font-semibold text-lg rounded-xl transition-all active:scale-95 border-2 border-neutral-700">
                    Nowy Plik
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Copyright */}
        <div className="absolute bottom-6 left-6 text-xs text-neutral-500 font-medium bg-black/40 px-3 py-1.5 rounded-full backdrop-blur z-20">
          &copy; {new Date().getFullYear()} Artur Gilowski all rights reserved
        </div>
      </div>

      {/* PRAWA STRONA - ZARZĄDZANIE SEKCJAMI */}
      <div className="w-full md:w-[450px] shrink-0 flex flex-col bg-neutral-900 border border-neutral-800 rounded-3xl p-6 h-[50vh] md:h-full relative">
        <div className="flex items-center justify-between mb-6 border-b border-neutral-800 pb-4 shrink-0">
          <div>
            <h2 className="text-xl font-bold">Podziały dokumentu</h2>
            <p className="text-neutral-500 text-xs mt-1">Zaznacz podział i wybierz strony z lewej</p>
          </div>
          {(step === "review" || step === "upload" || step === "analyzing") && (
            <button 
              onClick={addSection} 
              disabled={step !== "review"}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed border border-neutral-700 text-white text-sm font-semibold rounded-lg transition-all active:scale-95"
            >
              <Plus size={16} /> Dodaj Podział
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
          {sections.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-50 px-4">
              <FileText size={48} className="mb-4 text-neutral-600" />
              <p>Wgraj plik PDF,<br/>aby rozpocząć.</p>
            </div>
          ) : (
             <AnimatePresence>
               {sections.map((sec, idx) => {
                 const pagesCount = Object.values(pageAssignments).filter(id => id === sec.id).length;
                 const isActive = activeSectionId === sec.id;
                 const colorClass = SECTION_COLORS[sec.colorIndex].border;

                 return (
                   <motion.div
                     key={sec.id}
                     layout
                     initial={{ opacity: 0, y: 10, scale: 0.95 }}
                     animate={{ opacity: 1, y: 0, scale: 1 }}
                     exit={{ opacity: 0, scale: 0.9, height: 0, marginBottom: 0, overflow: "hidden" }}
                     onClick={() => setActiveSectionId(sec.id)}
                     className={cn(
                       "relative group flex flex-col p-5 rounded-2xl border-2 transition-all cursor-pointer shadow-lg",
                       isActive ? `bg-neutral-950 ${colorClass}` : "bg-neutral-800 border-neutral-700 hover:border-neutral-600"
                     )}
                   >
                     <div className={cn("absolute left-0 top-0 bottom-0 w-2 transition-all rounded-l-xl", SECTION_COLORS[sec.colorIndex].bg, isActive ? "w-2" : "w-1 group-hover:w-2")} />

                     <div className="pl-3 flex flex-col gap-4">
                       <div className="flex items-start justify-between gap-3">
                         <div className="flex-1">
                           <label className={cn("text-[11px] uppercase tracking-wider font-bold mb-1.5 block", isActive ? colorClass.replace('border-', 'text-') : "text-neutral-400")}>
                             Nazwa Pliku po pobraniu
                           </label>
                           <input
                             type="text"
                             value={sec.title}
                             onChange={(e) => updateSectionTitle(sec.id, e.target.value)}
                             onClick={(e) => e.stopPropagation()}
                             className="w-full bg-transparent border-b-2 border-transparent hover:border-neutral-600 focus:border-white px-0 py-1 text-white text-lg focus:outline-none transition-all font-semibold"
                             placeholder="Wpisz nazwę podziału..."
                           />
                         </div>
                         <button
                           onClick={(e) => { e.stopPropagation(); removeSection(sec.id); }}
                           className="p-2.5 text-neutral-400 hover:text-white hover:bg-neutral-700 rounded-xl transition-all"
                           title="Usuń sekcję"
                         >
                           <Trash2 size={20} />
                         </button>
                       </div>
                       
                       <div className="flex items-center justify-between">
                         <div className={cn("px-3 py-1.5 rounded-md text-xs font-bold ring-1", pagesCount > 0 ? "bg-white text-black ring-white" : "bg-neutral-900 text-neutral-400 ring-neutral-700")}>
                           {pagesCount} STRON(Y)
                         </div>
                         {isActive ? (
                           <div className="text-xs font-bold text-white flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                             Klikaj na strony
                           </div>
                         ) : (
                           <div className="text-xs font-semibold text-neutral-500">Kliknij by aktywować</div>
                         )}
                       </div>
                     </div>

                     <button
                       onClick={(e) => { e.stopPropagation(); addSectionAt(idx + 1); }}
                       className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 w-7 h-7 flex items-center justify-center bg-neutral-900 border border-neutral-700 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-all shadow-xl opacity-0 group-hover:opacity-100 z-20 scale-75 group-hover:scale-100"
                       title="Dodaj nową sekcję poniżej"
                     >
                       <Plus size={14} />
                     </button>
                   </motion.div>
                 );
               })}
             </AnimatePresence>
          )}
        </div>

        {/* BOTTOM AKCJE */}
        <div className="pt-6 mt-4 border-t border-neutral-800 flex flex-col gap-3 shrink-0">
           <div className="text-xs text-neutral-500 font-medium text-center pb-2 px-4">
             Wszystkie sekcje mające minimum 1 przypisaną stronę zostaną eksportowane w jednym pliku ZIP.
           </div>
           <button 
             onClick={startSplit} 
             disabled={step !== "review"}
             className={cn(
               "w-full py-5 font-bold text-lg rounded-xl transition-all shadow-[0_0_30px_rgba(255,255,255,0.05)]",
               step === "review" 
                 ? "bg-white hover:bg-neutral-200 text-black active:scale-[0.98]" 
                 : "bg-neutral-800 text-neutral-500 cursor-not-allowed"
             )}
           >
             Podziel Dokumenty
           </button>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #52525b; }
      `}} />
    </main>
  );
}

from PIL import Image
import os

def convert_to_ico(input_path, output_path):
    if not os.path.exists(input_path):
        print(f"Error: {input_path} not found.")
        return
    
    img = Image.open(input_path)
    
    # Standard ICO sizes for Windows
    icon_sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    
    # If the image is not square, we should center crop it
    width, height = img.size
    if width != height:
        size = min(width, height)
        left = (width - size) / 2
        top = (height - size) / 2
        right = (width + size) / 2
        bottom = (height + size) / 2
        img = img.crop((left, top, right, bottom))
    
    img.save(output_path, format='ICO', sizes=icon_sizes)
    print(f"Successfully created: {output_path}")

if __name__ == "__main__":
    hero_path = r"c:\Users\artug\OneDrive\Pulpit\appspliterv2\docs\hero.png"
    
    # Save as favicon
    convert_to_ico(hero_path, r"c:\Users\artug\OneDrive\Pulpit\appspliterv2\docs\favicon.ico")
    
    # Save as app-icon
    convert_to_ico(hero_path, r"c:\Users\artug\OneDrive\Pulpit\appspliterv2\docs\app-icon.ico")

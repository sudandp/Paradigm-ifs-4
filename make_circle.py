from PIL import Image, ImageDraw, ImageOps
import sys

def make_circle(path, out_path):
    try:
        img = Image.open(path).convert("RGBA")
        
        # Calculate the bounding box for the largest circle
        size = min(img.size)
        mask = Image.new('L', img.size, 0)
        draw = ImageDraw.Draw(mask)
        
        # We want to crop from the center
        offset_x = (img.size[0] - size) // 2
        offset_y = (img.size[1] - size) // 2
        
        # Make the ellipse slightly smaller to clip the red border perfectly if needed, 
        # but the user just wants no white corners, so the exact size is fine.
        draw.ellipse((offset_x, offset_y, offset_x + size, offset_y + size), fill=255)
        
        result = Image.new('RGBA', img.size, (0, 0, 0, 0))
        result.paste(img, (0, 0), mask)
        
        # Crop to the circle size to remove excess transparent padding if it was rectangular
        result = result.crop((offset_x, offset_y, offset_x + size, offset_y + size))
        
        result.save(out_path)
        print(f"Success: {out_path}")
    except Exception as e:
        print(f"Error processing {path}: {e}")

make_circle(r"e:\backup\onboarding all files\Paradigm Office 4\public\southwall-favicon.png", 
            r"e:\backup\onboarding all files\Paradigm Office 4\public\southwall-favicon.png")
make_circle(r"e:\backup\onboarding all files\Paradigm Office 4\public\South-Wall-Logo.png", 
            r"e:\backup\onboarding all files\Paradigm Office 4\public\South-Wall-Logo.png")
make_circle(r"e:\backup\onboarding all files\Paradigm Office 4\public\southwall-icon.jpg", 
            r"e:\backup\onboarding all files\Paradigm Office 4\public\southwall-icon.png")

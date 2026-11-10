#!/usr/bin/env python3
"""
compress_images.py - Batch compressor for 360 panorama images.

Usage:
    python compress_images.py                          # Compress images/streetview/
    python compress_images.py path/to/folder           # Compress a custom folder
    python compress_images.py --quality 80             # Custom quality (default: 85)
    python compress_images.py --max-width 8192         # Custom max width (default: 4096)
    python compress_images.py --no-backup              # Don't backup originals
    python compress_images.py --skip-threshold 3.0     # Skip files under 3 MB (default: 3.0)

Designed to be re-run safely:
- Skips files smaller than --skip-threshold (already compressed)
- Backs up originals to an 'originals/' subfolder
- Only processes .jpg/.jpeg/.png files
"""

import os
import sys
import argparse
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("ERROR: Pillow is not installed. Run: pip install Pillow")
    sys.exit(1)


def safe_print(msg):
    """Print with fallback for non-ASCII chars (Thai filenames on Windows cp1252)."""
    try:
        print(msg)
    except UnicodeEncodeError:
        print(msg.encode('ascii', errors='replace').decode('ascii'))


def get_size_mb(path):
    """Get file size in megabytes."""
    return os.path.getsize(path) / (1024 * 1024)


def compress_image(src_path, quality=85, max_width=4096, max_height=2048):
    """
    Compress a single image in-place.
    Returns (original_size_mb, new_size_mb) or None if skipped.
    """
    img = Image.open(src_path)
    
    # Convert to RGB if necessary (handles RGBA PNGs, etc.)
    if img.mode in ('RGBA', 'P', 'LA'):
        img = img.convert('RGB')
    
    # Resize if larger than max dimensions (maintaining aspect ratio)
    w, h = img.size
    if w > max_width or h > max_height:
        ratio = min(max_width / w, max_height / h)
        new_w = int(w * ratio)
        new_h = int(h * ratio)
        img = img.resize((new_w, new_h), Image.LANCZOS)
        safe_print(f"    Resized: {w}x{h} -> {new_w}x{new_h}")
    
    # Save as progressive JPEG with specified quality
    img.save(src_path, 'JPEG', quality=quality, optimize=True, progressive=True)
    img.close()


def main():
    parser = argparse.ArgumentParser(description='Batch compress 360° panorama images for web.')
    parser.add_argument('folder', nargs='?', default='images/streetview',
                        help='Folder containing images to compress (default: images/streetview)')
    parser.add_argument('--quality', type=int, default=85,
                        help='JPEG quality 1-95 (default: 85)')
    parser.add_argument('--max-width', type=int, default=4096,
                        help='Maximum image width in pixels (default: 4096)')
    parser.add_argument('--max-height', type=int, default=2048,
                        help='Maximum image height in pixels (default: 2048)')
    parser.add_argument('--skip-threshold', type=float, default=3.0,
                        help='Skip files smaller than this size in MB (default: 3.0)')
    parser.add_argument('--no-backup', action='store_true',
                        help='Do not backup original files')
    parser.add_argument('--recursive', '-r', action='store_true',
                        help='Scan subdirectories recursively')
    
    args = parser.parse_args()
    
    # Resolve folder path relative to script location
    script_dir = Path(__file__).parent
    folder = script_dir / args.folder
    
    if not folder.exists():
        print(f"ERROR: Folder '{folder}' does not exist.")
        sys.exit(1)
    
    # Find all image files
    extensions = {'.jpg', '.jpeg', '.png'}
    if args.recursive:
        image_files = [f for f in folder.rglob('*') 
                       if f.is_file() and f.suffix.lower() in extensions 
                       and 'originals' not in f.parts]
    else:
        image_files = [f for f in folder.iterdir() 
                       if f.is_file() and f.suffix.lower() in extensions 
                       and f.parent.name != 'originals']
    
    if not image_files:
        print(f"No image files found in '{folder}'.")
        return
    
    print(f"+{'=' * 50}+")
    print(f"|     360 Panorama Image Compressor                |")
    print(f"+{'=' * 50}+")
    print(f"  Folder:         {folder}")
    print(f"  Quality:        {args.quality}")
    print(f"  Max resolution: {args.max_width}x{args.max_height}")
    print(f"  Skip threshold: {args.skip_threshold} MB")
    print(f"  Backup:         {'No' if args.no_backup else 'Yes'}")
    print(f"  Images found:   {len(image_files)}")
    print(f"  {'-' * 50}")
    
    # Create backup folder
    backup_dir = folder / 'originals'
    if not args.no_backup:
        backup_dir.mkdir(exist_ok=True)
    
    total_original = 0
    total_compressed = 0
    skipped = 0
    processed = 0
    errors = 0
    
    for i, img_path in enumerate(sorted(image_files), 1):
        original_size = get_size_mb(img_path)
        total_original += original_size
        
        # Skip already-compressed files
        if original_size < args.skip_threshold:
            safe_print(f"  [{i}/{len(image_files)}] SKIP {img_path.name} ({original_size:.1f} MB - already small)")
            total_compressed += original_size
            skipped += 1
            continue
        
        safe_print(f"  [{i}/{len(image_files)}] Compressing {img_path.name} ({original_size:.1f} MB)...")
        
        try:
            # Backup original
            if not args.no_backup:
                import shutil
                backup_path = backup_dir / img_path.name
                if not backup_path.exists():  # Don't overwrite existing backups
                    shutil.copy2(img_path, backup_path)
            
            # Compress
            compress_image(img_path, quality=args.quality, 
                          max_width=args.max_width, max_height=args.max_height)
            
            new_size = get_size_mb(img_path)
            total_compressed += new_size
            reduction = (1 - new_size / original_size) * 100
            print(f"    Done: {original_size:.1f} MB -> {new_size:.1f} MB ({reduction:.0f}% smaller)")
            processed += 1
            
        except Exception as e:
            safe_print(f"    ERROR: {e}")
            total_compressed += original_size
            errors += 1
    
    # Summary
    print(f"\n  {'=' * 50}")
    print(f"  SUMMARY")
    print(f"  {'-' * 50}")
    print(f"  Processed:  {processed} images")
    print(f"  Skipped:    {skipped} images (already small)")
    print(f"  Errors:     {errors}")
    print(f"  Before:     {total_original:.1f} MB")
    print(f"  After:      {total_compressed:.1f} MB")
    if total_original > 0:
        print(f"  Saved:      {total_original - total_compressed:.1f} MB ({(1 - total_compressed/total_original)*100:.0f}%)")
    if not args.no_backup:
        print(f"  Backups in: {backup_dir}")
    print(f"  {'=' * 50}")


if __name__ == '__main__':
    main()

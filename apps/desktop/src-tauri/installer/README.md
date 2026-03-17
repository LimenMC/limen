# Limen NSIS Installer

Custom NSIS installer for Limen with modern design matching the app's aesthetic.

## Required Images

Create these images with Limen's branding (dark theme, blue accent):

### 1. Welcome/Sidebar Image (`sidebar.bmp`)
- **Size**: 164x314 pixels
- **Format**: 24-bit BMP
- **Design**: 
  - Dark background (#0a0a0a)
  - Limen logo at top
  - Blue gradient accent
  - Minimal, modern design

### 2. Header Image (`header.bmp`)
- **Size**: 150x57 pixels
- **Format**: 24-bit BMP
- **Design**:
  - Dark background (#0a0a0a)
  - Limen logo or text
  - Blue accent line

## Image Creation Guide

### Using Photoshop/GIMP:

1. **Sidebar Image (164x314)**:
   ```
   - Background: #0a0a0a (solid)
   - Add Limen logo (centered, top 1/3)
   - Add blue gradient (#3b82f6 to #8b5cf6) at bottom
   - Add subtle glow effect
   - Save as 24-bit BMP
   ```

2. **Header Image (150x57)**:
   ```
   - Background: #0a0a0a (solid)
   - Add "Limen" text or small logo (centered)
   - Add thin blue line at bottom (#3b82f6)
   - Save as 24-bit BMP
   ```

### Quick Template (ImageMagick):

```bash
# Sidebar
convert -size 164x314 xc:"#0a0a0a" \
  -gravity North -pointsize 32 -fill "#3b82f6" \
  -annotate +0+50 "Limen" \
  -gravity South -size 164x100 gradient:"#3b82f6"-"#8b5cf6" \
  -composite sidebar.bmp

# Header
convert -size 150x57 xc:"#0a0a0a" \
  -gravity Center -pointsize 20 -fill "#ffffff" \
  -annotate +0+0 "Limen" \
  -gravity South -size 150x2 xc:"#3b82f6" \
  -composite header.bmp
```

## Building

The installer will be automatically generated when building for Windows:

```bash
npm run tauri build -- --target x86_64-pc-windows-msvc
```

Output: `src-tauri/target/release/bundle/nsis/Limen_0.1.0_x64-setup.exe`

## Features

- ✅ Multi-language support (EN, TR, DE, ZH)
- ✅ Custom branding matching app design
- ✅ Desktop shortcut creation
- ✅ Start menu integration
- ✅ Proper uninstaller
- ✅ Registry integration
- ✅ Admin privileges handling
- ✅ LZMA compression for smaller size

## Customization

Edit `installer.nsi` to customize:
- Installation directory
- Shortcuts
- Registry keys
- Welcome/finish page text
- Additional components

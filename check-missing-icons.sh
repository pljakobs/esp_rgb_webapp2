#!/bin/bash

# Configuration
SRC_DIR="./src"
ICONS_DIR="./public/icons"

echo "🔍 Checking for missing icons in svgIcon components..."
echo

# Check if directories exist
if [ ! -d "$SRC_DIR" ]; then
    echo "❌ Source directory not found: $SRC_DIR"
    exit 1
fi

if [ ! -d "$ICONS_DIR" ]; then
    echo "❌ Icons directory not found: $ICONS_DIR"
    exit 1
fi

# Create temporary files
USED_ICONS_FILE=$(mktemp)
AVAILABLE_ICONS_FILE=$(mktemp)
MISSING_ICONS_FILE=$(mktemp)

# Cleanup function
cleanup() {
    rm -f "$USED_ICONS_FILE" "$AVAILABLE_ICONS_FILE" "$MISSING_ICONS_FILE"
}
trap cleanup EXIT

# Extract icon names from svgIcon components
echo "📁 Scanning source files for svgIcon usages..."
find "$SRC_DIR" -type f \( -name "*.vue" -o -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" \) -print0 | \
while IFS= read -r -d '' file; do
    # Extract icon names from various svgIcon patterns
    grep -oP '<svgIcon[^>]+name\s*=\s*["\047]([^"\047]+)["\047]' "$file" | \
    sed -n 's/.*name\s*=\s*["\047]\([^"\047]*\)["\047].*/\1/p'
done | \
grep -v '^:' | \
grep -v '\.' | \
grep -v '{' | \
grep -v '\[' | \
sort -u > "$USED_ICONS_FILE"

# Get available icons (remove extensions)
echo "📂 Scanning icons directory..."
find "$ICONS_DIR" -type f \( -name "*.svg" -o -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.gif" -o -name "*.webp" \) -printf "%f\n" | \
sed 's/\.[^.]*$//' | \
sort -u > "$AVAILABLE_ICONS_FILE"

# Find missing icons
comm -23 "$USED_ICONS_FILE" "$AVAILABLE_ICONS_FILE" > "$MISSING_ICONS_FILE"

# Count results
USED_COUNT=$(wc -l < "$USED_ICONS_FILE")
AVAILABLE_COUNT=$(wc -l < "$AVAILABLE_ICONS_FILE")
MISSING_COUNT=$(wc -l < "$MISSING_ICONS_FILE")

echo "📊 Found $USED_COUNT unique icons used in svgIcon components"
echo "📂 Found $AVAILABLE_COUNT icon files in $ICONS_DIR"
echo

# Display results
echo "============================================================"

if [ "$MISSING_COUNT" -gt 0 ]; then
    echo
    echo "❌ MISSING ICONS ($MISSING_COUNT):"
    echo "The following icons are used in svgIcon components but not found in the icons directory:"
    while IFS= read -r icon; do
        echo "  • $icon"
    done < "$MISSING_ICONS_FILE"
    
    echo
    echo "💡 To fix these missing icons:"
    echo "1. Add the icon files to $ICONS_DIR/"
    echo "2. Make sure the filename matches the name attribute (without extension)"
    echo "3. Supported formats: .svg, .png, .jpg, .jpeg, .gif, .webp"
    
    EXIT_CODE=1
else
    echo
    echo "✅ All icons are available! No missing icons found."
    EXIT_CODE=0
fi

# Find unused icons
UNUSED_ICONS_FILE=$(mktemp)
comm -13 "$USED_ICONS_FILE" "$AVAILABLE_ICONS_FILE" > "$UNUSED_ICONS_FILE"
UNUSED_COUNT=$(wc -l < "$UNUSED_ICONS_FILE")

if [ "$UNUSED_COUNT" -gt 0 ]; then
    echo
    echo "📋 UNUSED ICONS ($UNUSED_COUNT):"
    echo "The following icon files are not referenced by any svgIcon component:"
    head -20 "$UNUSED_ICONS_FILE" | while IFS= read -r icon; do
        echo "  • $icon"
    done
    if [ "$UNUSED_COUNT" -gt 20 ]; then
        echo "  ... and $((UNUSED_COUNT - 20)) more"
    fi
fi

echo
echo "============================================================"
echo
echo "📈 SUMMARY:"
echo "  Used icons: $USED_COUNT"
echo "  Available icons: $AVAILABLE_COUNT"
echo "  Missing icons: $MISSING_COUNT"
echo "  Unused icons: $UNUSED_COUNT"

rm -f "$UNUSED_ICONS_FILE"
exit $EXIT_CODE
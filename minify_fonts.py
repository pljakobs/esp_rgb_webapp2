#!/usr/bin/python3
import os
import os
import re
from fontTools.subset import Subsetter, Options
from fontTools.ttLib import TTFont

# Define the project directory and the patterns to match
project_dir = '/home/pjakobs/devel/esp_rgb_webapp2/dist/spa'
# font_pattern = re.compile(r"url\(['\"]?(.+?\.woff)['\"]?\)")
font_pattern = re.compile(r'url\((/assets/[^)]+)\)')
char_pattern = re.compile(r'[\w\s]', re.UNICODE)
icon_pattern = re.compile(r'\bmaterial-icons\b.*?>(.*?)<')

# Collect all used fonts and characters
used_fonts = set()
used_chars = set()
print("start directory walk")
# Walk through the project directory
for root, dirs, files in os.walk(project_dir):
    for file in files:
        if file.endswith(('.html', '.css', '.js', '.vue', '.json')):
          print (file)
          # Open each file
          with open(os.path.join(root, file), 'r', encoding='utf-8') as f:
              content = f.read()

              # Collect used fonts
              for match in font_pattern.findall(content):
                  used_fonts.add(match)

              # Collect used characters
              used_chars.update(char_pattern.findall(content))

              # Collect used Material Icons
              for match in icon_pattern.findall(content):
                  used_chars.update(match)

# Convert the characters to Unicode code points
code_points = {ord(char) for char in used_chars}

for code_point in code_points:
    print(code_point)

for font in used_fonts:
    print(font)

# Minify each used font
for font_path in used_fonts:
    font_path = font_path.lstrip('/')
    print("procect dir:",project_dir)
    print("font partial path:",font_path)
    fontfile=os.path.join(project_dir, font_path)
    print("font full path:",fontfile)
    font = TTFont(fontfile)

    print("Number of glyphs before subsetting:", len(font.getGlyphSet()))
    # Define the options
    options = Options()
    options.flavor = 'woff'
    options.desubroutinize = True

    # Create an instance of the Subsetter class
    subsetter = Subsetter(options=options)

    # Get the glyph names for the code points
    glyph_names = {font.getGlyphName(code_point) for code_point in code_points}

    # Subset the font
    subsetter.populate(glyphs=glyph_names)
    subsetter.subset(font)

    print("Number of glyphs after subsetting:", len(font.getGlyphSet()))
    glyphs_after_subsetting = font.getGlyphNames()
    print("Glyphs after subsetting:", glyphs_after_subsetting)

    # Convert the glyph names to Unicode characters
    unicode_chars_after_subsetting = {chr(int(glyph[3:], 16)) for glyph in glyphs_after_subsetting if glyph.startswith('uni')}
    print("Unicode characters after subsetting:", unicode_chars_after_subsetting)

    # Save the subsetted font
    font.save(fontfile.replace('.woff', '.woff'))

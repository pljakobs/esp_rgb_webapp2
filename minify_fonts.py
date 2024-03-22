import os
import re
from fontTools.subset import Subsetter, Options
from fontTools.ttLib import TTFont

# Define the project directory and the patterns to match
project_dir = 'path/to/your/project'
font_pattern = re.compile(r"url\(['\"]?(.+?\.woff)['\"]?\)")
char_pattern = re.compile(r'[\w\s]', re.UNICODE)
icon_pattern = re.compile(r'\bmaterial-icons\b.*?>(.*?)<')

# Collect all used fonts and characters
used_fonts = set()
used_chars = set()

# Walk through the project directory
for root, dirs, files in os.walk(project_dir):
    for file in files:
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

# Minify each used font
for font_path in used_fonts:
    # Load the font
    font = TTFont(font_path)

    # Define the options
    options = Options()
    options.flavor = 'woff'
    options.desubroutinize = True

    # Define the subsetter
    subsetter = Subsetter(options=options)

    # Subset the font
    subsetter.populate(unicodes=code_points)
    subsetter.subset(font)

    # Save the subsetted font
    font.save(font_path.replace('.woff', '_subset.woff'))

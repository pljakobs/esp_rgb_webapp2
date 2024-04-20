#!/usr/bin/python3
import os
import re
from fontTools.subset import Subsetter, Options
from fontTools.ttLib import TTFont

import requests

import requests

# Define the URL of the Material Icons codepoints file
url = 'https://raw.githubusercontent.com/google/material-design-icons/master/font/MaterialIcons-Regular.codepoints'

# Send a GET request to the URL
response = requests.get(url)

# Get the content of the response
codepoints_content = response.text

# Split the content into lines
lines = codepoints_content.split('\n')

# Create the material_icon_mapping dictionary
material_icon_mapping = {}
for line in lines:
    # Split the line into the icon name and the Unicode code point
    parts = line.split(' ')
    if len(parts) == 2:
        icon_name, unicode_code_point = parts

        # Convert the Unicode code point to an integer
        unicode_character = int(unicode_code_point, 16)

        # Add the icon name and Unicode character to the material_icon_mapping dictionary
        material_icon_mapping[icon_name] = unicode_character
        print (icon_name,": ",unicode_character)
# Now you can use material_icon_mapping to translate icon names to their respective code points   print(icon_name,": ",unicode_code_point)

# Define the project directory and the patterns to match
project_dir = '/home/pjakobs/devel/esp_rgb_webapp2/dist/spa'
# font_pattern = re.compile(r"url\(['\"]?(.+?\.woff)['\"]?\)")
font_pattern = re.compile(r'url\((/assets/[^)]+)\)')
char_pattern = re.compile(r'[\w\s]', re.UNICODE)
icon_pattern = re.compile(r'\bmaterial-icons\b.*?>(.*?)<')
icon_json_pattern = re.compile(r'icon:\s*"([^"]+)"')

# Collect all used fonts and characters
used_fonts = set()
used_chars = set([
  'check_circle',
  'warning',
  'info',
  'priority_high',
  'arrow_upward',
  'arrow_forward',
  'arrow_downward',
  'arrow_back',
  'arrow_drop_down',
  'chevron_left',
  'chevron_right',
  'gradient',
  'tune',
  'style',
  'refresh',
  'lens',
  'cancel',
  'check',
  'access_time',
  'today',
  'format_bold',
  'format_italic',
  'strikethrough_s',
  'format_underlined',
  'format_list_bulleted',
  'format_list_numbered',
  'vertical_align_bottom',
  'vertical_align_top',
  'link',
  'fullscreen',
  'format_quote',
  'format_align_left',
  'format_align_center',
  'format_align_right',
  'format_align_justify',
  'print',
  'format_indent_decrease',
  'format_indent_increase',
  'format_clear',
  'text_format',
  'format_size',
  'font_download',
  'code',
  'keyboard_arrow_down',
  'arrow_drop_down',
  'add',
  'close',
  'error',
  'first_page',
  'keyboard_arrow_left',
  'keyboard_arrow_right',
  'last_page',
  'grade',
  'edit',
  'play_arrow',
  'done',
  'clear',
  'add_box',
  'cloud_upload',
  'clear_all',
  'done_all'
])
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
                  if len(match) == 1 or match in material_icon_mapping:
                    used_chars.update(match)

              for match in icon_json_pattern.findall(content):
                  if len(match) == 1 or match in material_icon_mapping:
                    print("found json icon ", match)
                    used_chars.update(match)

# Convert the characters to Unicode code points
# Define the valid Unicode code points range
valid_code_points = set(range(0x0000, 0x10FFFF))
print (used_chars)

# Now used_chars_code_points only contains valid Unicode code pointscode_points = used_chars_code_points


for font in used_fonts:
    print(font)

# Minify each used font
for font_path in used_fonts:
    font_path = font_path.lstrip('/')
    print("project dir:",project_dir)
    print("font partial path:",font_path)
    fontfile=os.path.join(project_dir, font_path)
    print("font full path:",fontfile)
    font = TTFont(fontfile)

    glyph_set=font.getGlyphSet()
    print("Number of glyphs before subsetting:", len(font.getGlyphSet()))
    for glyph in glyph_set:
      print(glyph)
    # Convert the Material Icon names and single Unicode characters in used_glyphs to glyph names
    used_glyph_names = set()
    for glyph in used_chars:
      print("adding glyph ", glyph)
      if glyph in material_icon_mapping:
        # If the glyph is a Material Icon name, get its Unicode character and then convert it to the 'uniXXXX' format
        unicode_character = material_icon_mapping[glyph]
        glyph_name = 'uni{:04X}'.format(unicode_character)
        print(glyph_name)
        # Check if the glyph_name is a valid glyph name in the font
        if glyph_name in glyph_set:
            print("-> is ", glyph_name)
            used_glyph_names.add(glyph_name)
        else:
            print("-> is not a valid glyph name in the font")
      elif len(glyph) == 1:
        # If the glyph is a single Unicode character, convert it to the 'uniXXXX' format
        glyph_name = 'uni{:04X}'.format(ord(glyph))
        print(glyph_name)
        # Check if the glyph_name is a valid glyph name in the font
        if glyph_name in glyph_set:
            print("-> is ", glyph_name)
            used_glyph_names.add(glyph_name)
        else:
            print("-> is not a valid glyph name in the font")
    # Convert all glyph names to the 'uniXXXX' format
    #used_glyph_names = {'uni{:04X}'.format(font.getGlyphID(glyph_name)) for glyph_name in used_glyph_names}
    print (used_glyph_names)
    print("reducing font to ", len(used_glyph_names)," code points")

    # Define the options
    options = Options()
    options.flavor = 'woff'
    options.desubroutinize = True

    # Create an instance of the Subsetter class
    subsetter = Subsetter(options=options)

    # Get the glyph names for the code points
    # glyph_names = {font.getGlyphName(code_point) for code_point in code_points}

    # Subset the font
    subsetter.populate(glyphs=used_glyph_names)
    subsetter.subset(font)

    print("Number of glyphs after subsetting:", len(font.getGlyphSet()))
    #glyphs_after_subsetting = font.getGlyphNames()
    #print("Glyphs after subsetting:", glyphs_after_subsetting)

    # Save the subsetted font
    font.save(fontfile.replace('.woff', '.woff'))

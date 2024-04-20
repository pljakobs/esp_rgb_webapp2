#!/usr/bin/python3
from fontTools.ttLib import TTFont
#font = TTFont("./node_modules/@quasar/extras/material-icons/web-font/flUhRq6tzZclQEJ-Vdg-IuiaDsNa.woff")
#font = TTFont("./dist/spa/assets/flUhRq6tzZclQEJ-Vdg-IuiaDsNa.woff")
font = TTFont("./dist/spa/assets/font1.woff")
glyph_set = font.getGlyphSet()
for glyph_name in glyph_set.keys():
    print(glyph_name)

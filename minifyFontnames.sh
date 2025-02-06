#!/bin/bash
font1_long=flUhRq6tzZclQEJ-Vdg-IuiaDsNa.woff
font1_short=font1.woff

font2_long=flUhRq6tzZclQEJ-Vdg-IuiaDsNcIhQ8tQ.woff2
font2_short=font2.woff2

sed <dist/spa/assets/index.css >dist/spa/assets/index.css.tmp \
    -e "s/$font1_long/$font1_short/g" \
    -e "s/$font2_long/$font2_short/g"

mv dist/spa/assets/$font1_long dist/spa/assets/$font1_short
mv dist/spa/assets/$font2_long dist/spa/assets/$font2_short
mv dist/spa/assets/index.css.tmp dist/spa/assets/index.css

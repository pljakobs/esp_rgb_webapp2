pushd dist/spa
gzip *.html
cd assets
gzip -9 *.js
gzip -9 *.css
gzip -9 *.map
popd

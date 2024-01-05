pushd dist/spa
gzip *.html
cd assets
gzip *.js
gzip *.css
popd

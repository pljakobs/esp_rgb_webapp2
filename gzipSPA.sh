pushd dist/spa
gzip *.html
cd assets
gzip -9 *.js
gzip -9 *.css
if [ -f *.map ]
then
	gzip -9 *.map
fi
cd ../icons
gzip -9 *.svg
if [ -d lights ]
then
	cd lights
	gzip -9 *.svg
	cd ..
fi
popd


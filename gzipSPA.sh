pushd dist/spa
gzip -f *.html
cd assets
gzip -9f *.js
gzip -9f *.css
if [ -f *.map ]
then
	gzip -9f *.map
fi
cd ../icons
gzip -9f *.svg
if [ -d lights ]
then
	cd lights
	gzip -9f *.svg
	cd ..
fi
cd ..
if [ -d locales ]
then
	cd locales
	gzip -9f *.json
	cd ..
fi
popd


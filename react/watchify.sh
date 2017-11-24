#/bin/sh
watchify -t [ babelify --presets [ env react ] ] src/*.js* -o $1/app/js/build/app.js

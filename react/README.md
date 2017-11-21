run:

for chrome
```bash
watchify -t [ babelify --presets [ env react ] ] src/*.js* -o chrome/app/js/build/app.js
```

for ff
```bash
watchify -t [ babelify --presets [ env react ] ] src/*.js* -o firefox/app/js/build/app.js
```

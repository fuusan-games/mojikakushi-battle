import pathlib
s=pathlib.Path(__file__).parent/'src'
h=(s/'index.src.html').read_text()
for k,f in [('PEERJS','peerjs.min.js'),('QRCODE','qrcode.js'),('TOPICS','topics.js'),('ENGINE','engine.js'),('APP','app.js')]:
    h=h.replace('/*%s*/'%k,(s/f).read_text().replace('</script','<\\/script'))
(s.parent/'index.html').write_text(h)
print(len(h))

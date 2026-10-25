/* Nachbarräume der Jumbo-Halle nach dem Grundriss (docs/grundriss.png).
   Die Daten (window.RAEUME) erzeugt tools/grundriss.py als cad/raeume_data.js; dieses Skript baut daraus Wände,
   Türstürze, Boden, Decke und Raumnummern. Die Räume sind vorerst leer und haben offene Türöffnungen.
   Einbinden nach cad/raeume_data.js; aufrufen mit baueRaeume(THREE, scene, cols, cadMeshes), sobald Szene und Kollisionsliste stehen.
   Spielkoordinaten: x nach Osten (Hallentor), z nach Süden zu den Räumen hin, y nach oben; Meter. */
window.baueRaeume = function(THREE, scene, cols, cadMeshes){
  const R = window.RAEUME; if (!R) return;
  const HR = 3.0;                                     // Raumhöhe (angenommen, bis Fotos etwas anderes zeigen)

  // Halle: Außenwände als Kollision (ersetzt die frühere feste Begrenzung); in der Wand zu den Räumen bleibt die Tür nach 09 offen
  const HD = R.doors[R.doors.length-1];               // letzter Eintrag: Tür von 09 in die Halle
  cols.push({x0:-16, x1:-15.35, z0:-7, z1:6.3, y0:-1, y1:99}, {x0:-0.32, x1:1, z0:-7, z1:6.3, y0:-1, y1:99},
            {x0:-16, x1:1, z0:-7, z1:-5.98, y0:-1, y1:99},
            {x0:-16, x1:HD[0], z0:5.98, z1:6.3, y0:-1, y1:99}, {x0:HD[1], x1:1, z0:5.98, z1:6.3, y0:-1, y1:99});

  // Flächen sammeln und in wenige gemeinsame Netze packen (wenige Zeichenaufrufe). UV in Metern, je nach Flächenrichtung projiziert.
  function flaechen(){
    const pos = [], nor = [], uv = [], idx = [];
    return { add(n, v){ const b = pos.length/3;
        for (const p of v) { pos.push(...p); nor.push(...n); uv.push(n[0] ? p[2] : p[0], n[1] ? p[2] : p[1]); }
        idx.push(b, b+1, b+2, b, b+2, b+3); },
      geo(){ const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); return g; } };
  }
  function kasten(F, x0, x1, y0, y1, z0, z1){
    F.add([1,0,0], [[x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1]]); F.add([-1,0,0], [[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0]]);
    F.add([0,1,0], [[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0]]); F.add([0,-1,0], [[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]]);
    F.add([0,0,1], [[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]]); F.add([0,0,-1], [[x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0]]);
  }
  // Flure (05 mit Treppenhaus 020, 08, 08b) haben glatt gestrichene, weiße Wände mit schwarzer Sockelleiste und gesprenkelten Boden.
  // Jede Wandseite wird in Stücke von höchstens 0,5 m zerlegt; zeigt ein Stück in einen Flur, bekommt es den Flur-Anstrich (und unten die Leiste).
  const FL = R.flure || [], imFlur = (x, z) => FL.some(([a, b, c, d]) => x > a && x < b && z > c && z < d);
  const beton = flaechen(), flurW = flaechen(), leiste = flaechen();
  const SH = 0.07, SD = 0.012;                       // Sockelleiste: Höhe und Stärke
  function teile(a, b, fn){ const n = Math.max(1, Math.ceil((b - a)/0.5)); for (let i = 0; i < n; i++) fn(a + (b-a)*i/n, a + (b-a)*(i+1)/n); }
  function wand(x0, x1, y0, y1, z0, z1, sockel){
    beton.add([0,1,0], [[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0]]); beton.add([0,-1,0], [[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]]);
    teile(z0, z1, (a, b) => {
      let f = imFlur(x1 + 0.05, (a+b)/2); (f ? flurW : beton).add([1,0,0], [[x1,y0,b],[x1,y0,a],[x1,y1,a],[x1,y1,b]]); if (f && sockel) kasten(leiste, x1, x1+SD, 0, SH, a, b);
      f = imFlur(x0 - 0.05, (a+b)/2); (f ? flurW : beton).add([-1,0,0], [[x0,y0,a],[x0,y0,b],[x0,y1,b],[x0,y1,a]]); if (f && sockel) kasten(leiste, x0-SD, x0, 0, SH, a, b); });
    teile(x0, x1, (a, b) => {
      let f = imFlur((a+b)/2, z1 + 0.05); (f ? flurW : beton).add([0,0,1], [[a,y0,z1],[b,y0,z1],[b,y1,z1],[a,y1,z1]]); if (f && sockel) kasten(leiste, a, b, 0, SH, z1, z1+SD);
      f = imFlur((a+b)/2, z0 - 0.05); (f ? flurW : beton).add([0,0,-1], [[b,y0,z0],[a,y0,z0],[a,y1,z0],[b,y1,z0]]); if (f && sockel) kasten(leiste, a, b, 0, SH, z0-SD, z0); });
  }
  for (const [x0, x1, z0, z1] of R.walls) wand(x0, x1, 0, HR, z0, z1, true);
  for (const [x0, x1, z0, z1, u] of R.doors) wand(x0, x1, u || 2.1, HR, z0, z1, false);

  const tex = (key, w, h, nahtlos) => { if (!window.TEX || !window.TEX[key]) return null;      // nahtlos: Textur kachelt ohne Spiegeln (fototex.py, nahtlos)
    const t = new THREE.TextureLoader().load(window.TEX[key]); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    t.wrapS = t.wrapT = nahtlos ? THREE.RepeatWrapping : THREE.MirroredRepeatWrapping; t.repeat.set(1/w, 1/h); return t; };
  // Leicht selbstleuchtende Flächen, weil die Räume keine eigenen Lampen haben und die Decke kein Licht wirft
  const mats = (color, emissive, map = null) => [new THREE.MeshLambertMaterial({color, emissive, map, emissiveMap:map}),
                                          new THREE.MeshStandardMaterial({color, emissive, map, emissiveMap:map, roughness:0.92, metalness:0})];
  const mesh = (geo, m) => { const o = new THREE.Mesh(geo, m[1]); o.userData.mats = m; cadMeshes.push(o); scene.add(o); return o; };   // castShadow/receiveShadow bleiben aus
  // Räume: Wände wie in der Halle, weiß gestrichener, brettgeschalter Beton (Textur 'wand', Kachel 1,3 m)
  mesh(beton.geo(), mats(0xf4f4f0, 0x2e2e2c, tex('wand', 1.3, 1.3)));
  // Flure: glatter, weißer Anstrich mit leichter Struktur (Textur 'flurwand' nach dem Foto am Ende von Flur 05), schwarze Sockelleiste
  mesh(flurW.geo(), mats(0xf6f7f7, 0x303131, tex('flurwand', 0.8, 1.2, true)));
  mesh(leiste.geo(), [new THREE.MeshLambertMaterial({color:0x161616}), new THREE.MeshStandardMaterial({color:0x161616, roughness:0.5, metalness:0})]);
  for (const [x0, x1, z0, z1] of R.walls) cols.push({x0, x1, z0, z1, y0:-1, y1:HR});

  // Boden und Decke über das ganze Gebäude neben der Halle. Boden: graubrauner Belag nach Foto (docs/fotos/textur_boden_aussen,
  // Textur 'aussen' aus cad/tex_lite.js), eine Kachel 0,7 m breit und 1,6 m lang, Streifen längs der Flure (z)
  const [bx0, bx1, bz0, bz1] = R.floor, w = bx1-bx0, d = bz1-bz0;
  let bodenM = mats(0x8f8a80, 0x141412);
  if (window.TEX && window.TEX.aussen) {
    const t = new THREE.TextureLoader().load(window.TEX.aussen); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping; t.repeat.set(w/0.7, d/1.6);
    bodenM = [new THREE.MeshLambertMaterial({map:t, color:0x9a9a9a}), new THREE.MeshStandardMaterial({map:t, color:0x8a8a8a, roughness:0.75, metalness:0})];   // abgedunkelt: die Räume bekommen volles Sonnenlicht ohne Schatten
  }
  const boden = mesh(new THREE.PlaneGeometry(w, d), bodenM); boden.rotation.x = -Math.PI/2; boden.position.set((bx0+bx1)/2, 0.002, (bz0+bz1)/2);
  // Flurboden: hellgrauer Belag mit dunklen Sprenkeln (Textur 'flurboden', Kachel 1,0 x 0,5 m), knapp über dem Raumboden
  { const F = flaechen(), y = 0.004; for (const [x0, x1, z0, z1] of FL) F.add([0,1,0], [[x0,y,z1],[x1,y,z1],[x1,y,z0],[x0,y,z0]]);
    const t = tex('flurboden', 1.0, 0.5, true);
    mesh(F.geo(), [new THREE.MeshLambertMaterial({map:t, color:0x9a9a9a}), new THREE.MeshStandardMaterial({map:t, color:0x8c8c8c, roughness:0.75, metalness:0})]); }
  const decke = mesh(new THREE.PlaneGeometry(w, d), mats(0xe6e6e2, 0x9a9a96)); decke.rotation.x = Math.PI/2; decke.position.set((bx0+bx1)/2, HR, (bz0+bz1)/2);

  // Ostende von Flur 05 (vor 014): verglaste Tür nach draußen, Textur 'tuer05' aus dem Foto docs/fotos/tuer_flur05 (tools/tuertex.py).
  // Die Tür bleibt zu; die Tueranlage ist 2,7 m breit und sitzt rechts in der Ecke, wie auf dem Foto. Unbeleuchtet, damit das Tageslicht hell bleibt.
  if (window.TEX && window.TEX.tuer05) {
    const t = new THREE.TextureLoader().load(window.TEX.tuer05); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    const XW = 0.446, Z1 = 19.385, B = 2.7, Ht = 2.25;                       // Wandfläche (x) und rechte Ecke (z) aus raeume_data.js
    const tuer = new THREE.Mesh(new THREE.PlaneGeometry(B, Ht), new THREE.MeshBasicMaterial({map:t, toneMapped:false}));
    tuer.rotation.y = -Math.PI/2; tuer.position.set(XW - 0.015, Ht/2, Z1 - B/2); scene.add(tuer);   // vor der Sockelleiste
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96; const g = cv.getContext('2d');
    g.fillStyle = '#18a558'; g.fillRect(0, 0, 256, 96); g.strokeStyle = '#f4f4f0'; g.lineWidth = 4; g.strokeRect(6, 6, 244, 84);
    g.fillStyle = '#f4f4f0'; g.font = 'bold 30px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('NOTAUSGANG', 128, 50);
    const st = new THREE.CanvasTexture(cv); st.colorSpace = THREE.SRGBColorSpace;
    const schild = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.42), [0,1,2,3,4,5].map(i => i === 1 ? new THREE.MeshBasicMaterial({map:st}) : new THREE.MeshBasicMaterial({color:0x8a8f94})));
    schild.position.set(XW - 0.03, 2.42, Z1 - 0.45); scene.add(schild);
  }

  // Raumnummern auf dem Boden, lesbar beim Blick von der Halle aus (nach +z, im Plan: nach links)
  for (const [nr, [x, z]] of Object.entries(R.labels)) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const g = cv.getContext('2d');
    g.fillStyle = 'rgba(245,245,240,0.9)'; g.font = 'bold 84px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(nr, 128, 68);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9), new THREE.MeshBasicMaterial({map:t, transparent:true, depthWrite:false}));
    m.rotation.set(-Math.PI/2, 0, Math.PI); m.position.set(x + 0.3, 0.01, z - 0.6); scene.add(m);
  }
};

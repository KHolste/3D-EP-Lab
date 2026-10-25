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

  // Treppenhaus 020: zweiläufige Podesttreppe nach dem Grundriss (je 10 Stufen à 17 cm, Geschosshöhe 3,4 m). Ohne Foto: graue Betonstufen
  // mit dunklem Belag, Trennwand zwischen den Läufen, Stahlhandlauf. Lauf 1 (Seite 06) beginnt am Vorplatz vor 09 und steigt nach Westen
  // zum Podest an der Außenwand, Lauf 2 (Seite 05) steigt zurück nach Osten aufs Obergeschoss, das oben an einer geschlossenen Tür endet.
  // Über dem Treppenhaus ist die Decke offen; der Treppenraum reicht bis 6,8 m.
  const T = {xW:-15.54, xP:-13.74, xA:-10.69, xB:-11.01, xO:-10.37, zN:13.231, zT0:14.54, zT1:14.74, zS:16.103, h:1.7, H:3.4, oben:6.8};
  window.raeumeBoden = (x, z) => {                     // Laufflächen der Treppe für groundAt (Rampen über die Stufenkanten)
    const v = [];
    if (z > T.zN && z < T.zS && x >= T.xW && x <= T.xP) v.push(T.h);                                       // Podest
    if (z > T.zN && z < T.zT0 && x >= T.xP && x <= T.xA) v.push(T.h*(T.xA - x)/(T.xA - T.xP));             // Lauf 1
    if (z > T.zT1 && z < T.zS && x >= T.xP && x <= T.xB) v.push(T.h + (T.H - T.h)*(x - T.xP)/(T.xB - T.xP)); // Lauf 2
    if (z > T.zT1 && z < T.zS && x >= T.xB && x <= T.xO) v.push(T.H);                                       // Austritt oben
    return v;
  };
  wand(T.xW - 0.27, T.xW, HR, T.oben, T.zN - 0.41, T.zS + 0.41, false);          // Treppenraum über der Decke: Westen,
  wand(T.xW, T.xO + 0.17, HR, T.oben, T.zN - 0.41, T.zN, false);                 // Norden (06),
  wand(T.xW, T.xO + 0.17, HR, T.oben, T.zS, T.zS + 0.41, false);                 // Süden (05)
  wand(T.xO, T.xO + 0.17, HR, T.oben, T.zN, T.zS, false);                        // und Osten über dem Vorplatz, darin oben die Tür
  wand(T.xP, T.xA, 0, T.H + 0.95, T.zT0, T.zT1, false);                          // Trennwand zwischen den Läufen
  cols.push({x0:T.xP, x1:T.xA, z0:T.zT0, z1:T.zT1, y0:-1, y1:99},                // Trennwand
            {x0:T.xP, x1:T.xB, z0:T.zT1, z1:T.zS, y0:-1, y1:T.h - 0.1},          // unter Lauf 2 kommt man vom Vorplatz aus nicht hinein
            {x0:T.xO, x1:T.xO + 0.17, z0:T.zN, z1:T.zS, y0:HR, y1:99},           // Wand oben am Austritt (unten geht man darunter durch)
            {x0:T.xA, x1:T.xO, z0:T.zT0, z1:T.zT1, y0:HR, y1:99});               // Geländer oben am Austritt

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
  // Decke: überall auf 3 m, über dem Treppenhaus offen; der Treppenraum hat seine Decke auf 6,8 m
  { const F = flaechen(), unten = (x0, x1, y, z0, z1) => F.add([0,-1,0], [[x0,y,z0],[x1,y,z0],[x1,y,z1],[x0,y,z1]]);
    unten(bx0, bx1, HR, bz0, T.zN); unten(bx0, bx1, HR, T.zS, bz1); unten(bx0, T.xW, HR, T.zN, T.zS); unten(T.xO, bx1, HR, T.zN, T.zS);
    unten(T.xW, T.xO, T.oben, T.zN, T.zS);
    mesh(F.geo(), mats(0xe6e6e2, 0x9a9a96)); }
  // Stufen, Podest und Austritt: Betonkörper bis zum Boden, darauf ein dunkler Belag
  { const K = flaechen(), B = flaechen(), n = 10;
    const stufe = (x0, x1, y, z0, z1) => { kasten(K, x0, x1, 0, y - 0.02, z0, z1); kasten(B, x0, x1, y - 0.02, y, z0, z1); };
    for (let i = 0; i < n; i++) { const a = T.xA - (T.xA - T.xP)*i/n, b = T.xA - (T.xA - T.xP)*(i+1)/n; stufe(b, a, T.h*(i+1)/n, T.zN, T.zT0); }
    for (let i = 0; i < n; i++) { const a = T.xP + (T.xB - T.xP)*i/n, b = T.xP + (T.xB - T.xP)*(i+1)/n; stufe(a, b, T.h + (T.H - T.h)*(i+1)/n, T.zT1, T.zS); }
    stufe(T.xW, T.xP, T.h, T.zN, T.zS);
    kasten(K, T.xB, T.xO, T.H - 0.27, T.H - 0.02, T.zT1, T.zS); kasten(B, T.xB, T.xO, T.H - 0.02, T.H, T.zT1, T.zS);   // Austritt als Platte
    mesh(K.geo(), mats(0xb3b2ac, 0x2a2a28)); mesh(B.geo(), mats(0x44474c, 0x101112)); }
  // Handläufe aus Stahlrohr an beiden Seiten der Trennwand, 0,9 m über den Stufen, und ein Geländer oben am Austritt
  { const stahl = mats(0x9aa0a6, 0x1a1c1e), R0 = 0.02;
    const rohr = (a, b) => { const A = new THREE.Vector3(...a), D = new THREE.Vector3(...b).sub(A), L = D.length();
      const m = new THREE.Mesh(new THREE.CylinderGeometry(R0, R0, L, 8), stahl[1]); m.userData.mats = stahl; cadMeshes.push(m);
      m.position.copy(A).addScaledVector(D, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), D.normalize()); scene.add(m); };
    const z1 = T.zT0 - 0.06, z2 = T.zT1 + 0.06, hl = 0.9, zm = (T.zT0 + T.zT1)/2;
    rohr([T.xA, hl, z1], [T.xP, T.h + hl, z1]); rohr([T.xP, T.h + hl, z2], [T.xB, T.H + hl, z2]); rohr([T.xB, T.H + hl, z2], [T.xO, T.H + hl, z2]);
    for (const x of [T.xA, (T.xA + T.xO)/2, T.xO]) rohr([x, T.H, zm], [x, T.H + 1.0, zm]);
    rohr([T.xA, T.H + 1.0, zm], [T.xO, T.H + 1.0, zm]); rohr([T.xA, T.H + 0.5, zm], [T.xO, T.H + 0.5, zm]); }
  // Oben: geschlossene Holztür zum Obergeschoss mit Schild, Leuchte unter der Treppenraumdecke
  { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 512; const g = cv.getContext('2d');
    g.fillStyle = '#3a3d42'; g.fillRect(0, 0, 256, 512); g.fillStyle = '#b7895a'; g.fillRect(14, 14, 228, 498);
    for (let i = 0; i < 40; i++) { g.strokeStyle = 'rgba(90,55,25,' + (0.08 + (i % 5)*0.03) + ')'; g.lineWidth = 1 + (i % 3); g.beginPath(); g.moveTo(14 + i*5.7, 14); g.lineTo(18 + i*5.7, 512); g.stroke(); }
    g.fillStyle = '#c9ccce'; g.fillRect(196, 250, 34, 10); g.fillRect(212, 245, 10, 26);
    g.fillStyle = '#f4f4f0'; g.fillRect(78, 90, 100, 44); g.fillStyle = '#2b2e33'; g.font = 'bold 28px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('1. OG', 128, 113);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    const tuer = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.1), new THREE.MeshLambertMaterial({map:t})); tuer.rotation.y = -Math.PI/2;
    tuer.position.set(T.xO - 0.006, T.H + 1.05, (T.zT1 + T.zS)/2); scene.add(tuer);
    const lampe = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.3), new THREE.MeshBasicMaterial({color:0xffffff})); lampe.position.set((T.xW + T.xO)/2, T.oben - 0.03, (T.zN + T.zS)/2); scene.add(lampe); }

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

  // Flur 08b: Die ersten fünf Eingänge rechts (Westwand, aus 05 kommend: 04, 03, 02, 01a, 01) gehören nicht zur Arbeitsgruppe
  // und sind mit geschlossenen, rötlichen Türen verschlossen. Öffnungen aus raeume_data.js: Türstürze, deren Flurseite bei x -10.105
  // liegt, zwischen Flur 05 und der Durchgangstür nach 08. Breite Öffnungen bekommen zwei Flügel, schmale einen.
  { const XF = -10.105, XR = -10.424, D = 0.045, HT = 2.1;
    const zu = R.doors.filter(([x0, x1, z0, z1]) => Math.abs(x1 - XF) < 0.01 && z0 > 19.8 && z1 < 36.15).sort((a, b) => a[2] - b[2]).slice(0, 5);
    const blatt = (B) => { const cv = document.createElement('canvas'), s = 160; cv.width = Math.round(B*s); cv.height = Math.round(HT*s); const g = cv.getContext('2d');
      const W = cv.width, H = cv.height, f = 0.05*s, zwei = B > 1.5;
      g.fillStyle = '#5b5f63'; g.fillRect(0, 0, W, H);                                         // Stahlzarge
      const fl = zwei ? [[f, W/2 - 2], [W/2 + 2, W - f]] : [[f, W - f]];
      fl.forEach(([a, b], i) => {
        g.fillStyle = '#a5453a'; g.fillRect(a, f, b - a, H - f);                               // rötlicher Lack
        for (let k = 0; k < 18; k++) { g.fillStyle = 'rgba(' + (k % 2 ? '255,230,220' : '60,10,5') + ',0.035)'; g.fillRect(a, f + k*(H - f)/18, b - a, (H - f)/36); }
        g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(a, H - 0.25*s, b - a, 0.25*s);            // Trittschutz unten
        const links = zwei ? i === 1 : false, hx = links ? a + 0.09*s : b - 0.09*s, hy = H - 1.05*s;
        if (!zwei || i === 1) { g.fillStyle = '#cfd3d6'; g.fillRect(hx - 5, hy - 0.12*s, 10, 0.27*s);                // Langschild
          g.fillRect(links ? hx : hx - 0.14*s, hy - 4, 0.14*s, 8); g.fillStyle = '#2c2f33'; g.fillRect(hx - 2, hy + 0.06*s, 4, 9); }   // Drücker, Schloss
      });
      g.fillStyle = 'rgba(0,0,0,0.35)'; if (zwei) g.fillRect(W/2 - 2, f, 4, H - f);           // Mittelfuge
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
    for (const [, , z0, z1] of zu) {
      const B = z1 - z0, t = blatt(B), rot = 0x8f3a31;
      const flur = [new THREE.MeshLambertMaterial({map:t, emissive:0x2a2a2a, emissiveMap:t}), new THREE.MeshStandardMaterial({map:t, emissive:0x2a2a2a, emissiveMap:t, roughness:0.55, metalness:0})];
      const sonst = mats(rot, 0x1c0b09);
      const m = [0,1,2,3,4,5].map(i => i === 0 ? flur : sonst);                               // +x zeigt in den Flur
      const o = mesh(new THREE.BoxGeometry(D, HT, B), [m.map(p => p[0]), m.map(p => p[1])]);   // [einfach, hoch] wie mats()
      o.position.set(XF - 0.012 - D/2, HT/2, (z0 + z1)/2);
      cols.push({x0:XR, x1:XF, z0, z1, y0:-1, y1:HR});
    } }

  // Raumnummern auf dem Boden, lesbar beim Blick von der Halle aus (nach +z, im Plan: nach links)
  for (const [nr, [x, z]] of Object.entries(R.labels)) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const g = cv.getContext('2d');
    g.fillStyle = 'rgba(245,245,240,0.9)'; g.font = 'bold 84px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(nr, 128, 68);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9), new THREE.MeshBasicMaterial({map:t, transparent:true, depthWrite:false}));
    m.rotation.set(-Math.PI/2, 0, Math.PI); m.position.set(x + 0.3, 0.01, z - 0.6); scene.add(m);
  }
};

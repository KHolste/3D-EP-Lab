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
  const WS = R.weiss || [], imWeiss = (x, z) => WS.some(([a, b, c, d]) => x > a && x < b && z > c && z < d);   // eingerichtete Räume: weiß, ohne Leiste
  const beton = flaechen(), flurW = flaechen(), leiste = flaechen();
  const SH = 0.07, SD = 0.012;                       // Sockelleiste: Höhe und Stärke
  const imTreppe = (x, z) => x > -15.54 && x < -10.37 && z > 13.231 && z < 16.103;   // Treppenhaus 020 (Fotos: beiger Rauputz)
  const treppeW = flaechen();
  function teile(a, b, fn){ const n = Math.max(1, Math.ceil((b - a)/0.5)); for (let i = 0; i < n; i++) fn(a + (b-a)*i/n, a + (b-a)*(i+1)/n); }
  function wand(x0, x1, y0, y1, z0, z1, sockel){
    beton.add([0,1,0], [[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0]]); beton.add([0,-1,0], [[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]]);
    teile(z0, z1, (a, b) => {
      let x = x1 + 0.05, z = (a+b)/2, f = imFlur(x, z); (imTreppe(x, z) ? treppeW : f || imWeiss(x, z) ? flurW : beton).add([1,0,0], [[x1,y0,b],[x1,y0,a],[x1,y1,a],[x1,y1,b]]); if (f && sockel) kasten(leiste, x1, x1+SD, 0, SH, a, b);
      x = x0 - 0.05; f = imFlur(x, z); (imTreppe(x, z) ? treppeW : f || imWeiss(x, z) ? flurW : beton).add([-1,0,0], [[x0,y0,a],[x0,y0,b],[x0,y1,b],[x0,y1,a]]); if (f && sockel) kasten(leiste, x0-SD, x0, 0, SH, a, b); });
    teile(x0, x1, (a, b) => {
      let x = (a+b)/2, z = z1 + 0.05, f = imFlur(x, z); (imTreppe(x, z) ? treppeW : f || imWeiss(x, z) ? flurW : beton).add([0,0,1], [[a,y0,z1],[b,y0,z1],[b,y1,z1],[a,y1,z1]]); if (f && sockel) kasten(leiste, a, b, 0, SH, z1, z1+SD);
      z = z0 - 0.05; f = imFlur(x, z); (imTreppe(x, z) ? treppeW : f || imWeiss(x, z) ? flurW : beton).add([0,0,-1], [[b,y0,z0],[a,y0,z0],[a,y1,z0],[b,y1,z0]]); if (f && sockel) kasten(leiste, a, b, 0, SH, z0-SD, z0); });
  }
  for (const [x0, x1, z0, z1] of R.walls) wand(x0, x1, 0, HR, z0, z1, true);
  for (const [x0, x1, z0, z1, u] of R.doors) wand(x0, x1, u || 2.1, HR, z0, z1, false);
  // 014a ist vom Raum 014 durch eine Trennwand abgeteilt (etwa ein Drittel der Fläche, im Grundriss nicht eingezeichnet)
  wand(-4.72, -4.62, 0, HR, 13.231, 16.103, true); cols.push({x0:-4.72, x1:-4.62, z0:13.231, z1:16.103, y0:-1, y1:HR});

  // Treppenhaus 020: zweiläufige Podesttreppe nach dem Grundriss (je 10 Stufen à 17 cm, Geschosshöhe 3,4 m). Ohne Foto: graue Betonstufen
  // mit dunklem Belag, Trennwand zwischen den Läufen, Stahlhandlauf. Lauf 1 (Seite 06) beginnt am Vorplatz vor 09 und steigt nach Westen
  // zum Podest an der Außenwand, Lauf 2 (Seite 05) steigt zurück nach Osten aufs Obergeschoss, das oben an einer geschlossenen Tür endet.
  // Über dem Treppenhaus ist die Decke offen; der Treppenraum reicht bis 6,8 m.
  // Darunter geht es genauso in den Keller: Lauf A (unter Lauf 2) beginnt am Vorplatz neben der Trennwand und führt nach Westen hinunter
  // zum Kellerpodest, Lauf B (unter Lauf 1) zurück nach Osten bis vor die geschlossene Kellertür auf -3,4 m. Dafür ist der Boden
  // zwischen Außenwand und Treppenantritt offen, und die Läufe nach oben liegen frei (Platten statt Betonblock), mit 3,1 m Kopffreiheit.
  const T = {xW:-15.54, xP:-13.74, xA:-10.69, xB:-11.01, xO:-10.37, zN:13.231, zT0:14.54, zT1:14.74, zS:16.103, h:1.7, H:3.4, oben:6.8, K:-3.4};
  window.raeumeBoden = (x, z, feet) => {               // Laufflächen der Treppe für groundAt (Rampen über die Stufenkanten)
    const v = [];
    if (z > T.zN && z < T.zS && x > T.xW && x < T.xO && (x < T.xA || feet < -0.5)) v.loch = true;   // Bodenöffnung bzw. unten im Keller
    if (z > T.zT1 && z < T.zS && x >= T.xP && x <= T.xA) v.push(-T.h*(T.xA - x)/(T.xA - T.xP));             // Lauf A hinunter
    if (z > T.zN && z < T.zS && x >= T.xW && x <= T.xP) v.push(-T.h);                                       // Kellerpodest
    if (z > T.zN && z < T.zT0 && x >= T.xP && x <= T.xA) v.push(-T.h + (T.K + T.h)*(x - T.xP)/(T.xA - T.xP)); // Lauf B hinunter
    if (z > T.zN && z < T.zT0 && x >= T.xA && x <= T.xO) v.push(T.K);                                       // unten vor der Kellertür
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
  wand(T.xW - 0.27, T.xW, T.K, 0, T.zN - 0.41, T.zS + 0.41, false);              // Kellerschacht: Westen,
  wand(T.xW, T.xO + 0.17, T.K, 0, T.zN - 0.41, T.zN, false);                     // Norden,
  wand(T.xW, T.xO + 0.17, T.K, 0, T.zS, T.zS + 0.41, false);                     // Süden
  wand(T.xO, T.xO + 0.17, T.K, 0, T.zN, T.zS, false);                            // und Osten mit der Kellertür
  // zwischen den Läufen keine Wand, sondern ein offenes Treppenauge mit Geländer (unten); die Kollision bleibt
  cols.push({x0:T.xP, x1:T.xA, z0:T.zT0, z1:T.zT1, y0:-99, y1:99},               // Trennwand
            {x0:T.xW - 0.3, x1:T.xW, z0:T.zN - 0.4, z1:T.zS + 0.4, y0:-99, y1:0},  // Kellerschacht (die Wände darüber reichen nur bis -1)
            {x0:T.xW, x1:T.xO + 0.17, z0:T.zN - 0.4, z1:T.zN, y0:-99, y1:0}, {x0:T.xW, x1:T.xO + 0.17, z0:T.zS, z1:T.zS + 0.4, y0:-99, y1:0},
            {x0:T.xO, x1:T.xO + 0.17, z0:T.zN, z1:T.zS, y0:-99, y1:0}, {x0:T.xA, x1:T.xO, z0:T.zT0, z1:T.zS, y0:-99, y1:-0.3},   // Beton unter dem Vorplatz
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
  // Räume: auf allen Fotos glatt weiß gestrichen wie die Flure (früher Beton wie in der Halle), nur ohne schwarze Leiste
  mesh(beton.geo(), mats(0xf6f7f7, 0x9a9b9b, tex('flurwand', 0.8, 1.2, true)));   // hell wie auf den Fotos, auch auf der Schattenseite
  // Flure: glatter, weißer Anstrich mit leichter Struktur (Textur 'flurwand' nach dem Foto am Ende von Flur 05), schwarze Sockelleiste
  mesh(flurW.geo(), mats(0xf6f7f7, 0x9a9b9b, tex('flurwand', 0.8, 1.2, true)));
  { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#efe3c3'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 2500; i++) { const v = Math.random(); g.fillStyle = v < 0.5 ? 'rgba(150,130,90,0.16)' : 'rgba(255,255,245,0.3)'; g.fillRect(Math.random()*128, Math.random()*128, 1 + (v*2|0), 1 + (v*2|0)); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1/0.5, 1/0.5);
    mesh(treppeW.geo(), [new THREE.MeshLambertMaterial({map:t, emissive:0x5a5448, emissiveMap:t}), new THREE.MeshStandardMaterial({map:t, emissive:0x5a5448, emissiveMap:t, roughness:0.95, metalness:0})]); }
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
  // Böden als Rechtecke; über dem Kellerschacht (Außenwand bis Treppenantritt) bleibt eine Öffnung
  const LOCH = [T.xW, T.xA, T.zN, T.zS];
  const ohneLoch = ([x0, x1, z0, z1]) => { const [a, b, c, e] = LOCH;
    if (x1 <= a || x0 >= b || z1 <= c || z0 >= e) return [[x0, x1, z0, z1]];
    return [[x0, x1, z0, Math.max(z0, c)], [x0, x1, Math.min(z1, e), z1], [x0, Math.max(x0, a), Math.max(z0, c), Math.min(z1, e)], [Math.min(x1, b), x1, Math.max(z0, c), Math.min(z1, e)]]
      .filter(([p, q, r, t]) => q - p > 0.001 && t - r > 0.001); };
  const bodenFl = (F, y, rects) => { for (const r of rects) for (const [x0, x1, z0, z1] of ohneLoch(r)) F.add([0,1,0], [[x0,y,z1],[x1,y,z1],[x1,y,z0],[x0,y,z0]]); };
  { const F = flaechen(); bodenFl(F, 0.002, [[bx0, bx1, bz0, bz1]]);
    if (bodenM[0].map) { bodenM[0].map.repeat.set(1/0.7, 1/1.6); }       // Flächen haben UV in Metern
    mesh(F.geo(), bodenM); }
  // Flurboden: hellgrauer Belag mit dunklen Sprenkeln (Textur 'flurboden', Kachel 1,0 x 0,5 m), knapp über dem Raumboden
  { const F = flaechen(); bodenFl(F, 0.004, FL);
    const t = tex('flurboden', 1.0, 0.5, true);
    mesh(F.geo(), [new THREE.MeshLambertMaterial({map:t, color:0x9a9a9a}), new THREE.MeshStandardMaterial({map:t, color:0x8c8c8c, roughness:0.75, metalness:0})]); }
  // Eingerichtete Räume (019): heller, glatter Beschichtungsboden wie auf dem Foto
  { const F = flaechen(); bodenFl(F, 0.004, WS); mesh(F.geo(), [new THREE.MeshLambertMaterial({color:0xcfcdc4}), new THREE.MeshStandardMaterial({color:0xcfcdc4, roughness:0.55, metalness:0})]); }
  // Decke: überall auf 3 m, über dem Treppenhaus offen; der Treppenraum hat seine Decke auf 6,8 m
  { const F = flaechen(), unten = (x0, x1, y, z0, z1) => F.add([0,-1,0], [[x0,y,z0],[x1,y,z0],[x1,y,z1],[x0,y,z1]]);
    unten(bx0, bx1, HR, bz0, T.zN); unten(bx0, bx1, HR, T.zS, bz1); unten(bx0, T.xW, HR, T.zN, T.zS); unten(T.xO, bx1, HR, T.zN, T.zS);
    unten(T.xW, T.xO, T.oben, T.zN, T.zS);
    mesh(F.geo(), mats(0xe6e6e2, 0x9a9a96)); }
  // Deckenverkleidung nach den Fotos: in den Fluren weiße Paneele quer zur Laufrichtung, in 09 eine Rasterdecke (62,5 cm) mit Leuchtpaneel
  { const R09 = [-10.15, -7.44, 6.513, 12.82], innen = (r, q) => (r[0] + r[1])/2 > q[0] && (r[0] + r[1])/2 < q[1] && (r[2] + r[3])/2 > q[2] && (r[2] + r[3])/2 < q[3];
    const loch = [T.xW, T.xO, T.zN, T.zS];
    const clip = ([x0, x1, z0, z1], [a, b, c, e]) => (x1 <= a || x0 >= b || z1 <= c || z0 >= e) ? [[x0, x1, z0, z1]] :
      [[x0, x1, z0, Math.max(z0, c)], [x0, x1, Math.min(z1, e), z1], [x0, Math.max(x0, a), Math.max(z0, c), Math.min(z1, e)], [Math.min(x1, b), x1, Math.max(z0, c), Math.min(z1, e)]]
        .filter(([p, q, r, t]) => q - p > 0.001 && t - r > 0.001);
    const linien = (quer) => { const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d');
      g.fillStyle = '#f4f4f2'; g.fillRect(0, 0, 64, 64); g.fillStyle = 'rgba(120,122,124,0.55)'; if (quer) g.fillRect(0, 0, 2, 64); else g.fillRect(0, 0, 64, 2);
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(quer ? 1/0.15 : 1, quer ? 1 : 1/0.15); return t; };
    const raster = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 128; const g = c.getContext('2d');
      g.fillStyle = '#f2f2ef'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#c9cbcc'; g.fillRect(0, 0, 128, 3); g.fillRect(0, 0, 3, 128);
      for (let i = 0; i < 300; i++) { g.fillStyle = 'rgba(0,0,0,0.05)'; g.fillRect(Math.random()*128, Math.random()*128, 1, 1); }
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1/0.625, 1/0.625); return t; })();
    const Fx = flaechen(), Fz = flaechen(), F9 = flaechen(), y = HR - 0.004;
    const unten = (F, [x0, x1, z0, z1]) => F.add([0,-1,0], [[x0,y,z0],[x1,y,z0],[x1,y,z1],[x0,y,z1]]);
    for (const r of FL) for (const q of clip(r, loch)) { if (innen(q, R09)) unten(F9, q); else unten(q[1] - q[0] > q[3] - q[2] ? Fx : Fz, q); }
    const mm = t => [new THREE.MeshLambertMaterial({map:t, emissive:0x8a8a88, emissiveMap:t}), new THREE.MeshStandardMaterial({map:t, emissive:0x8a8a88, emissiveMap:t, roughness:0.9, metalness:0})];
    mesh(Fx.geo(), mm(linien(true))); mesh(Fz.geo(), mm(linien(false))); mesh(F9.geo(), mm(raster));
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.01, 0.6), new THREE.MeshBasicMaterial({color:0xffffff})); panel.position.set(-8.8, HR - 0.01, 8.7); scene.add(panel);
    const panel2 = panel.clone(); panel2.position.z = 11.2; scene.add(panel2); }
  // Stufen und Podeste: Beton mit dunklem Belag. Nach oben frei liegende Stufen (30 cm stark), in den Keller massiv bis zur Kellersohle
  { const K = flaechen(), B = flaechen(), n = 10;
    const stufe = (x0, x1, y, z0, z1, y0) => { kasten(K, x0, x1, y0, y - 0.02, z0, z1); kasten(B, x0, x1, y - 0.02, y, z0, z1); };
    for (let i = 0; i < n; i++) { const a = T.xA - (T.xA - T.xP)*i/n, b = T.xA - (T.xA - T.xP)*(i+1)/n, y = T.h*(i+1)/n; stufe(b, a, y, T.zN, T.zT0, y - 0.3); }
    for (let i = 0; i < n; i++) { const a = T.xP + (T.xB - T.xP)*i/n, b = T.xP + (T.xB - T.xP)*(i+1)/n, y = T.h + (T.H - T.h)*(i+1)/n; stufe(a, b, y, T.zT1, T.zS, y - 0.3); }
    stufe(T.xW, T.xP, T.h, T.zN, T.zS, T.h - 0.25);                                                                   // Zwischenpodest oben
    kasten(K, T.xB, T.xO, T.H - 0.27, T.H - 0.02, T.zT1, T.zS); kasten(B, T.xB, T.xO, T.H - 0.02, T.H, T.zT1, T.zS);   // Austritt als Platte
    for (let i = 0; i < n; i++) { const a = T.xA - (T.xA - T.xP)*i/n, b = T.xA - (T.xA - T.xP)*(i+1)/n; stufe(b, a, -T.h*(i+1)/n, T.zT1, T.zS, T.K); }        // Lauf A
    stufe(T.xW, T.xP, -T.h, T.zN, T.zS, T.K);                                                                       // Kellerpodest
    for (let i = 0; i < n; i++) { const a = T.xP + (T.xA - T.xP)*i/n, b = T.xP + (T.xA - T.xP)*(i+1)/n; stufe(a, b, -T.h + (T.K + T.h)*(i+1)/n, T.zN, T.zT0, T.K - 0.02); }   // Lauf B
    stufe(T.xA, T.xO, T.K, T.zN, T.zT0, T.K - 0.1);                                                                 // vor der Kellertür
    kasten(K, T.xA, T.xO, T.K, -0.25, T.zT0, T.zS);                                                                 // unter dem Vorplatz: Beton
    kasten(K, T.xA, T.xO, -0.25, 0, T.zN, T.zT0);                                                                   // Decke über dem Kellerabsatz
    const sp = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#86888b'; g.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 3000; i++) { const v = Math.random(); g.fillStyle = v < 0.45 ? '#55585c' : v < 0.8 ? '#a9abad' : '#d6d6d4'; g.fillRect(Math.random()*128, Math.random()*128, 1, 1); }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1/0.4, 1/0.4); return t; })();
    const N = flaechen();                                  // schwarze Stufenkanten an der Vorderseite jeder Stufe
    for (let i = 0; i < n; i++) { const x = T.xA - (T.xA - T.xP)*(i+1)/n; kasten(N, x - 0.012, x + 0.012, T.h*(i+1)/n - 0.05, T.h*(i+1)/n + 0.003, T.zN, T.zT0);
      const x2 = T.xP + (T.xB - T.xP)*(i)/n; kasten(N, x2 - 0.012, x2 + 0.012, T.h + (T.H - T.h)*(i+1)/n - 0.05, T.h + (T.H - T.h)*(i+1)/n + 0.003, T.zT1, T.zS);
      const x3 = T.xA - (T.xA - T.xP)*i/n; kasten(N, x3 - 0.012, x3 + 0.012, -T.h*(i+1)/n - 0.05, -T.h*(i+1)/n + 0.003, T.zT1, T.zS);
      const x4 = T.xP + (T.xA - T.xP)*i/n; kasten(N, x4 - 0.012, x4 + 0.012, -T.h + (T.K + T.h)*(i+1)/n - 0.05, -T.h + (T.K + T.h)*(i+1)/n + 0.003, T.zN, T.zT0); }
    mesh(K.geo(), mats(0xe2d6b6, 0x3a362c)); mesh(B.geo(), [new THREE.MeshLambertMaterial({map:sp}), new THREE.MeshStandardMaterial({map:sp, roughness:0.5, metalness:0})]);
    mesh(N.geo(), mats(0x141414, 0)); }
  // Handläufe aus Stahlrohr an beiden Seiten der Trennwand, 0,9 m über den Stufen, und ein Geländer oben am Austritt
  { const stahl = mats(0x9aa0a6, 0x1a1c1e), R0 = 0.02;
    const rohr = (a, b) => { const A = new THREE.Vector3(...a), D = new THREE.Vector3(...b).sub(A), L = D.length();
      const m = new THREE.Mesh(new THREE.CylinderGeometry(R0, R0, L, 8), stahl[1]); m.userData.mats = stahl; cadMeshes.push(m);
      m.position.copy(A).addScaledVector(D, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), D.normalize()); scene.add(m); };
    const z1 = T.zT0 - 0.06, z2 = T.zT1 + 0.06, hl = 0.9, zm = (T.zT0 + T.zT1)/2;
    rohr([T.xA, hl, z1], [T.xP, T.h + hl, z1]); rohr([T.xP, T.h + hl, z2], [T.xB, T.H + hl, z2]); rohr([T.xB, T.H + hl, z2], [T.xO, T.H + hl, z2]);
    for (const x of [T.xA, (T.xA + T.xO)/2, T.xO]) rohr([x, T.H, zm], [x, T.H + 1.0, zm]);
    rohr([T.xA, T.H + 1.0, zm], [T.xO, T.H + 1.0, zm]); rohr([T.xA, T.H + 0.5, zm], [T.xO, T.H + 0.5, zm]);
    rohr([T.xA, hl, z2], [T.xP, -T.h + hl, z2]); rohr([T.xP, -T.h + hl, z1], [T.xA, T.K + hl, z1]);       // in den Keller
    // Geländerstäbe unter den Handläufen am Treppenauge (Foto: Stahlstäbe, Handlauf aus dunklem Holz)
    const S = flaechen(), stab = (x, y0, z) => kasten(S, x - 0.007, x + 0.007, y0, y0 + hl, z - 0.007, z + 0.007);
    for (let k = 0; k <= 24; k++) { const f = k/24;
      stab(T.xA + (T.xP - T.xA)*f, T.h*f, z1); stab(T.xP + (T.xB - T.xP)*f, T.h + (T.H - T.h)*f, z2);
      stab(T.xA + (T.xP - T.xA)*f, -T.h*f, z2); stab(T.xP + (T.xA - T.xP)*f, -T.h + (T.K + T.h)*f, z1); }
    mesh(S.geo(), stahl); }
  { const holzG = mats(0x4a3626, 0x120c08);                     // die Handläufe am Treppenauge in dunklem Holz
    for (const o of cadMeshes.slice(-30)) if (o.geometry && o.geometry.type === 'CylinderGeometry' && o.geometry.parameters.radiusTop === 0.02 && Math.abs(o.position.z - (T.zT0 + T.zT1)/2) < 0.2) {
      o.geometry = new THREE.BoxGeometry(0.06, o.geometry.parameters.height, 0.045); o.userData.mats = holzG; o.material = holzG[1]; } }
  { const fe = window.TEX && window.TEX.poster_fenster020 ? (t => { t.colorSpace = THREE.SRGBColorSpace; return t; })(new THREE.TextureLoader().load(window.TEX.poster_fenster020)) : null;
    const zc = (T.zN + T.zS)/2, weissM = mats(0xf4f4f1, 0x3a3a38);
    for (const y of [T.h, -T.h]) {                                  // langes, liegendes Fenster an der Außenwand über den Podesten
      if (fe) { const m = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.52), new THREE.MeshBasicMaterial({map:fe, toneMapped:false})); m.rotation.y = Math.PI/2; m.position.set(T.xW + 0.006, y + 1.25, zc); scene.add(m); }
      const sb = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 2.4), weissM[1]); sb.userData.mats = weissM; cadMeshes.push(sb); sb.position.set(T.xW + 0.08, y + 0.98, zc); scene.add(sb);
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 1.0), new THREE.MeshBasicMaterial({color:0xfffbe8})); l.position.set(T.xO + 0.13, y + 2.1 + (y < 0 ? 0 : 0), (T.zN + T.zT0)/2); if (y > 0) l.position.set(T.xW + 0.04, y + 2.1, zc); scene.add(l); }
    // gelbes Warnschild „Rutschgefahr“ am Treppenkopf zwischen den Läufen
    const gelb = mats(0xf2c200, 0x3a2e00), c = document.createElement('canvas'); c.width = 64; c.height = 96; const g = c.getContext('2d');
    g.fillStyle = '#f2c200'; g.fillRect(0, 0, 64, 96); g.fillStyle = '#111'; g.beginPath(); g.moveTo(32, 18); g.lineTo(54, 56); g.lineTo(10, 56); g.closePath(); g.fill();
    g.fillStyle = '#f2c200'; g.beginPath(); g.moveTo(32, 26); g.lineTo(47, 52); g.lineTo(17, 52); g.closePath(); g.fill(); g.fillStyle = '#111'; g.fillRect(29, 34, 6, 12);
    const st = new THREE.CanvasTexture(c); st.colorSpace = THREE.SRGBColorSpace;
    for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.62, 0.3), [new THREE.MeshLambertMaterial({map:st}), new THREE.MeshLambertMaterial({map:st}), gelb[0], gelb[0], gelb[0], gelb[0]]);
      m.position.set(-10.42 + s*0.1, 0.31, (T.zT0 + T.zT1)/2); m.rotation.z = -s*0.18; scene.add(m); }
    cols.push({x0:-10.6, x1:-10.25, z0:(T.zT0 + T.zT1)/2 - 0.18, z1:(T.zT0 + T.zT1)/2 + 0.18, y0:-1, y1:0.65}); }
  // Oben: geschlossene Holztür zum Obergeschoss mit Schild, Leuchte unter der Treppenraumdecke
  { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 512; const g = cv.getContext('2d');
    g.fillStyle = '#3a3d42'; g.fillRect(0, 0, 256, 512); g.fillStyle = '#b7895a'; g.fillRect(14, 14, 228, 498);
    for (let i = 0; i < 40; i++) { g.strokeStyle = 'rgba(90,55,25,' + (0.08 + (i % 5)*0.03) + ')'; g.lineWidth = 1 + (i % 3); g.beginPath(); g.moveTo(14 + i*5.7, 14); g.lineTo(18 + i*5.7, 512); g.stroke(); }
    g.fillStyle = '#c9ccce'; g.fillRect(196, 250, 34, 10); g.fillRect(212, 245, 10, 26);
    const tuer = (text, y, z) => { const c = document.createElement('canvas'); c.width = 256; c.height = 512; const q = c.getContext('2d'); q.drawImage(cv, 0, 0);
      q.fillStyle = '#f4f4f0'; q.fillRect(78, 90, 100, 44); q.fillStyle = '#2b2e33'; q.font = 'bold 28px system-ui, sans-serif'; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillText(text, 128, 113);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.1), new THREE.MeshLambertMaterial({map:t})); m.rotation.y = -Math.PI/2;
      m.position.set(T.xO - 0.006, y + 1.05, z); scene.add(m); };
    tuer('1. OG', T.H, (T.zT1 + T.zS)/2); tuer('Keller', T.K, (T.zN + T.zT0)/2);
    const lampe = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.3), new THREE.MeshBasicMaterial({color:0xffffff})); lampe.position.set((T.xW + T.xO)/2, T.oben - 0.03, (T.zN + T.zS)/2); scene.add(lampe); }

  // Flur 08b, rechte Seite (von 05 aus gesehen, Räume 04 bis 01): die Räume gehören nicht zur Arbeitsgruppe, die Türen sind zu.
  // Rote Türblätter bündig zur Flurseite; Öffnungen aus dem Grundriss (Wand zwischen den Räumen und 08b, bis zur Mitteltür nach 08).
  // Die Türen links im Flur und die Türen zu 018 (dahinter) bleiben offen.
  { const X0 = -10.43, X1 = -10.1, Z0 = 19.6, Z1 = 36.1, oeff = [];
    for (const [x0, x1, z0, z1] of R.doors) if (x0 >= X0 && x1 <= X1 && z0 >= Z0 && z1 <= Z1 && z1 - z0 > 0.5) {
      const o = oeff.find(o => z0 < o[1] && z1 > o[0]); if (o) { o[0] = Math.min(o[0], z0); o[1] = Math.max(o[1], z1); } else oeff.push([z0, z1]); }
    const rot = new THREE.MeshStandardMaterial({color:0xb02a22, roughness:0.45, metalness:0.1});
    for (const [z0, z1] of oeff) {
      const B = z1 - z0, zwei = B > 1.5, c = document.createElement('canvas'); c.width = zwei ? 512 : 256; c.height = 512; const g = c.getContext('2d');
      g.fillStyle = '#b02a22'; g.fillRect(0, 0, c.width, 512);
      const blatt = (x, w, griff) => { const gr = g.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, 'rgba(255,255,255,0.06)'); gr.addColorStop(1, 'rgba(0,0,0,0.08)');
        g.fillStyle = gr; g.fillRect(x, 0, w, 512); g.strokeStyle = 'rgba(60,10,8,0.55)'; g.lineWidth = 4; g.strokeRect(x + 2, 2, w - 4, 508);
        g.fillStyle = '#c9ccce'; g.fillRect(griff - 18, 248, 36, 9); g.fillRect(griff - 5, 240, 10, 26); };
      if (zwei) { blatt(0, 256, 230); blatt(256, 256, 282); } else blatt(0, 256, 220);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const vorn = new THREE.MeshStandardMaterial({map:t, roughness:0.45, metalness:0.1});
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.1, B), [vorn, rot, rot, rot, rot, rot]);   // +x zeigt in den Flur
      m.position.set(X1 - 0.03, 1.05, (z0 + z1)/2); scene.add(m);
      cols.push({x0:X0, x1:X1, z0, z1, y0:-1, y1:2.1});
    }
  }

  // Raum 019 nach dem Foto docs/fotos/raum019.JPEG (Blick zur Außenwand): zwischen den Wandpfeilern je ein liegendes Fenster
  // (Textur 'fenster019', tools/fenstertex.py), darunter ein Arbeitstisch mit Buchenplatte auf grauem Gestell, rote Schubladen,
  // ein Elektrokanal mit Steckdosen, Heizkörper am Pfeiler; an der Decke Kabelpritschen und lange Leuchten. Ohne Personen und Kran.
  { const XW = 0.446, Z0 = 36.41, Z1 = 49.333, pf = [];
    for (const [x0, x1, z0, z1] of R.walls) if (x1 > 0.4 && x1 < 0.5 && x0 > -0.2 && z0 > Z0 && z1 < Z1) pf.push([z0, z1]);   // Wandpfeiler
    pf.sort((a, b) => a[0] - b[0]);
    const felder = []; let z = Z0; for (const [a, b] of pf) { felder.push([z, a]); z = b; } felder.push([z, Z1]);
    const XP = Math.min(...R.walls.filter(([x0, x1, z0, z1]) => x1 > 0.4 && x1 < 0.5 && x0 > -0.2 && z0 > Z0 && z1 < Z1).map(w => w[0]));   // Vorderkante der Pfeiler
    const mat = (color, o = {}) => { const m = [new THREE.MeshLambertMaterial({color, emissive:o.emissive || 0}), new THREE.MeshStandardMaterial({color, roughness:0.6, metalness:0.1, ...o})]; return m; };
    const box = (m, w, h, d, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m[1]); o.userData.mats = m; cadMeshes.push(o); o.position.set(x, y, z); scene.add(o); return o; };
    const buche = mat(0xc98f5c, {roughness:0.7, metalness:0}), grau = mat(0xb9bdc0, {roughness:0.55, metalness:0.25}), rot = mat(0xb8231b, {roughness:0.45, metalness:0.15}),
          weiss = mat(0xf2f2ef, {roughness:0.8, metalness:0}), dunkel = mat(0x2a2d31, {roughness:0.6}), holz = mat(0xd2b48a, {roughness:0.8, metalness:0}),
          alu = mat(0xc4c8cc, {roughness:0.35, metalness:0.7, emissive:0x45484b}), licht = [new THREE.MeshBasicMaterial({color:0xffffff}), new THREE.MeshBasicMaterial({color:0xffffff})];
    const ft = window.TEX && window.TEX.fenster019 ? (t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; })(new THREE.TextureLoader().load(window.TEX.fenster019)) : null;
    felder.forEach(([za, zb], i) => {
      const L = zb - za, zm = (za + zb)/2;
      // Fenster: Brüstung 1,5 m, Fensterhöhe 1,0 m; weiße Laibung als Rahmen, Fensterbank
      if (ft) { const f = new THREE.Mesh(new THREE.PlaneGeometry(L - 0.5, 1.0), new THREE.MeshBasicMaterial({map:ft, toneMapped:false}));
        f.rotation.y = -Math.PI/2; f.position.set(XW - 0.004, 2.05, zm); scene.add(f); }
      box(weiss, 0.16, 0.03, L - 0.4, XW - 0.08, 1.535, zm);
      // Arbeitstisch nur in den beiden mittleren Feldern: Platte 0,9 m hoch, 0,75 m tief; links ein Schubladenblock (rot), rechts ein grauer Unterschrank
      if (i > 0 && i < felder.length - 1) {
      const tl = L - 0.9, tz = za + 0.15 + tl/2, tx = XW - 0.375;
      box(buche, 0.75, 0.04, tl, tx, 0.88, tz);
      box(grau, 0.68, 0.84, 0.55, tx, 0.43, za + 0.15 + 0.3); for (let k = 0; k < 3; k++) box(rot, 0.02, k ? 0.24 : 0.16, 0.5, tx - 0.345, k ? 0.2 + (k-1)*0.27 : 0.73, za + 0.45);
      box(grau, 0.68, 0.84, 0.5, tx, 0.43, za + 0.15 + tl - 0.27); box(rot, 0.02, 0.7, 0.45, tx - 0.345, 0.42, za + 0.15 + tl - 0.27);
      cols.push({x0:XW - 0.76, x1:XW, z0:za + 0.15, z1:za + 0.15 + tl, y0:-1, y1:0.9});
      // auf dem Tisch: Kisten, Werkzeugkoffer, Gerät
      box(holz, 0.35, 0.14, 0.45, tx + 0.05, 0.97, tz - tl*0.3); box(dunkel, 0.4, 0.05, 0.6, tx - 0.05, 0.925, tz); box(holz, 0.3, 0.2, 0.3, tx + 0.1, 1.0, tz + tl*0.3);
      if (i === 1) { box(alu, 0.3, 0.22, 0.35, tx + 0.15, 1.01, za + 0.5); box(weiss, 0.06, 0.18, 0.06, tx + 0.18, 0.99, za + 0.8); }
      }
      // Elektrokanal mit Steckdosen und (im zweiten Feld) Not-Aus
      box(weiss, 0.07, 0.14, L - 0.1, XW - 0.035, 1.2, zm);
      for (let k = 0; k < Math.floor((L - 0.4)/0.7); k++) box(dunkel, 0.01, 0.07, 0.07, XW - 0.075, 1.2, za + 0.4 + k*0.7);
      if (i === 1) { box(mat(0xf0c000), 0.02, 0.1, 0.1, XW - 0.08, 1.2, zm); box(rot, 0.04, 0.05, 0.05, XW - 0.1, 1.2, zm); }
      // Heizkörper unter dem Fenster am Pfeiler (im letzten Feld kein Platz neben dem Tisch)
      if (i < felder.length - 1) { for (let k = 0; k < 8; k++) box(weiss, 0.08, 0.6, 0.03, XW - 0.12, 0.4, zb - 0.05 - k*0.075); }
    });
    // Decke: zwei Kabelpritschen längs, quer dazu Leuchten (lange Lichtbänder)
    for (const x of [-1.2, -4.6]) { box(alu, 0.4, 0.04, Z1 - Z0 - 0.2, x, 2.78, (Z0 + Z1)/2); box(alu, 0.02, 0.08, Z1 - Z0 - 0.2, x - 0.2, 2.8, (Z0 + Z1)/2); box(alu, 0.02, 0.08, Z1 - Z0 - 0.2, x + 0.2, 2.8, (Z0 + Z1)/2); }
    for (const zz of [38.4, 41.6, 44.6, 47.6]) for (const x of [-1.9, -5.3]) { box(weiss, 1.5, 0.08, 0.2, x, 2.86, zz); box(licht, 1.4, 0.01, 0.12, x, 2.815, zz); }
  }

  // Raum 019: zwei liegende Vakuumkammern (nach Fotos aus dem Labor): Edelstahl, 1,6 m Durchmesser, 3,2 m lang mit gewölbten Böden.
  // Die Türen (Flansch, blauer Schwenkarm mit JLU-Schild, Schauglas, KF-Stutzen, Griff) gehen zur Fensterseite auf, das hintere Ende steht
  // nah an der Gangwand (zwischen Wandpfeilern und hinterem Stutzen kommt man gerade noch durch). Oben Ventil und Messkopf, an der Seite
  // eine Durchführung mit Kabeln, daneben ein Geräteschrank mit Monitor; jeder Tank hat zwischen den Tanks seine eigene Unterverteilung.
  // Gebaut wird in einer Gruppe (Tür nach -x) und die Gruppe dann um 180° gedreht an ihren Platz gesetzt (A, B), samt Kollision.
  { const X0 = -4.8, X1 = -1.6, R0 = 0.8, YC = 1.0, KZ = [43.6, 46.0], A = -7.75, B = 87.6, G = new THREE.Group(), colsK = []; scene.add(G);
    const M = (color, o = {}) => [new THREE.MeshLambertMaterial({color, emissive:o.emissive || 0}), new THREE.MeshStandardMaterial({color, roughness:0.5, metalness:0.1, ...o})];
    const stahl = M(0xd3d6d8, {roughness:0.38, metalness:0.5, emissive:0x2a2c2e}), stahlD = M(0xb4b8bb, {roughness:0.35, metalness:0.6, emissive:0x1e2022}), blau = M(0x1f4fb0, {roughness:0.45, metalness:0.2}),
          schwarz = M(0x1b1d20, {roughness:0.5}), glas = M(0x0d1418, {roughness:0.1, metalness:0.6}), grau = M(0xd5d6d3, {roughness:0.7, metalness:0}),
          gestell = M(0x5d6266, {roughness:0.5, metalness:0.4}), alu = M(0xc4c8cc, {roughness:0.35, metalness:0.7}), weiss = M(0xf2f2ef, {roughness:0.6, metalness:0}),
          rot = M(0xb3261e), kabelS = M(0x222222), kabelR = M(0xb3261e), kabelG = M(0x9a9da0);
    const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m[1]); o.userData.mats = m; cadMeshes.push(o);
      o.position.set(x, y, z); o.rotation.set(rx, ry, rz); G.add(o); return o; };
    const kiste = (m, w, h, d, x, y, z) => add(new THREE.BoxGeometry(w, h, d), m, x, y, z);
    const zyl = (r, l, m, x, y, z, achse = 'y', seg = 24) => add(new THREE.CylinderGeometry(r, r, l, seg), m, x, y, z, achse === 'z' ? Math.PI/2 : 0, 0, achse === 'x' ? Math.PI/2 : 0);
    const kabel = (m, pts, r = 0.012) => add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), 40, r, 6), m, 0, 0, 0);
    const schild = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 128); g.strokeStyle = '#1f3f8f'; g.lineWidth = 4; g.strokeRect(4, 4, 248, 120);
      g.fillStyle = '#1f3f8f'; g.fillRect(16, 46, 44, 58); g.fillStyle = '#fff'; g.font = 'bold 44px system-ui, sans-serif'; g.fillText('T', 26, 92);
      g.fillStyle = '#111'; g.font = '20px system-ui, sans-serif'; g.fillText('JUSTUS-LIEBIG-', 12, 32); g.fillText('UNIVERSITÄT', 72, 70); g.fillText('GIESSEN', 72, 100);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    // Punkt auf dem gewölbten Türboden (Abstand dy, dz von der Achse) -> x der Oberfläche
    const kopfX = (dy, dz) => X0 + 0.4 - 0.4*Math.sqrt(Math.max(0, 1 - (dy*dy + dz*dz)/(R0*R0)));
    const kf = (x, y, z, r = 0.035) => { zyl(r, 0.1, stahl, x - 0.05, y, z, 'x', 12); zyl(r + 0.018, 0.025, stahlD, x - 0.1, y, z, 'x', 12); };

    KZ.forEach((zc, k) => {
      const xm = (X0 + X1)/2;
      add(new THREE.CylinderGeometry(R0, R0, X1 - X0 - 0.8, 48, 1, true), stahl, xm, YC, zc, 0, 0, Math.PI/2);                  // Mantel
      const kopf = new THREE.SphereGeometry(R0, 40, 14, 0, Math.PI*2, 0, Math.PI/2); kopf.scale(1, 0.5, 1);
      add(kopf, stahl, X1 - 0.4, YC, zc, 0, 0, -Math.PI/2); add(kopf, stahl, X0 + 0.4, YC, zc, 0, 0, Math.PI/2);                // Böden (hinten, Tür)
      zyl(R0 + 0.055, 0.12, stahlD, X0 + 0.4, YC, zc, 'x', 48); zyl(R0 + 0.03, 0.06, stahlD, X1 - 0.4, YC, zc, 'x', 48);         // Türflansch, hinterer Flansch
      zyl(R0 + 0.004, 0.015, stahlD, xm + 0.2, YC, zc, 'x', 48);                                                                // Schweißnaht
      // Tür: Schauglas, großer Stutzen oben, KF-Stutzen, Griff
      const sx = kopfX(-0.05, 0.05);
      zyl(0.17, 0.2, stahl, sx - 0.08, YC - 0.05, zc + 0.05, 'x', 28); zyl(0.21, 0.035, schwarz, sx - 0.19, YC - 0.05, zc + 0.05, 'x', 28);
      zyl(0.12, 0.01, glas, sx - 0.21, YC - 0.05, zc + 0.05, 'x', 24);
      for (let i = 0; i < 8; i++) { const w = i*Math.PI/4; zyl(0.012, 0.03, stahlD, sx - 0.215, YC - 0.05 + 0.165*Math.sin(w), zc + 0.05 + 0.165*Math.cos(w), 'x', 6); }
      const tx = kopfX(0.5, 0.1); zyl(0.14, 0.22, stahl, tx - 0.06, YC + 0.5, zc + 0.1, 'x', 24); zyl(0.155, 0.04, stahlD, tx - 0.18, YC + 0.5, zc + 0.1, 'x', 24);
      for (const [dy, dz] of [[0.45, 0.38], [-0.32, 0.05], [-0.55, 0.05], [0.0, 0.32]]) kf(kopfX(dy, dz), YC + dy, zc + dz);
      const gx = kopfX(-0.05, 0.5); zyl(0.014, 0.36, stahlD, gx - 0.09, YC - 0.05, zc + 0.5, 'y', 8);
      zyl(0.012, 0.08, stahlD, gx - 0.05, YC + 0.12, zc + 0.5, 'x', 6); zyl(0.012, 0.08, stahlD, gx - 0.05, YC - 0.22, zc + 0.5, 'x', 6);
      // blauer Schwenkarm der Tür (links von vorn gesehen) mit Platten oben und unten, Scharnierlaschen, JLU-Schild
      kiste(blau, 0.32, 1.25, 0.46, X0 + 0.06, YC, zc - 0.66);
      for (const s of [1, -1]) { kiste(blau, 0.6, 0.04, 0.62, X0 + 0.16, YC + s*0.645, zc - 0.62); kiste(stahlD, 0.12, 0.1, 0.1, X0 + 0.44, YC + s*0.6, zc - 0.78); }
      add(new THREE.PlaneGeometry(0.32, 0.16), [new THREE.MeshLambertMaterial({map:schild}), new THREE.MeshStandardMaterial({map:schild, roughness:0.6})], X0 - 0.101, YC + 0.3, zc - 0.66, 0, -Math.PI/2, 0);
      // Sättel und Fußplatte
      for (const x of [X0 + 0.9, X1 - 0.9]) { kiste(blau, 0.45, 0.32, 1.1, x, 0.16, zc); kiste(blau, 0.7, 0.03, 1.3, x, 0.015, zc); }
      // oben: Ventil mit Handrad, schräger Messkopf, Kranösen
      zyl(0.04, 0.5, stahl, X0 + 0.75, YC + R0 + 0.2, zc + 0.15, 'y', 12); kiste(stahlD, 0.1, 0.1, 0.1, X0 + 0.75, YC + R0 + 0.35, zc + 0.15);
      zyl(0.05, 0.03, schwarz, X0 + 0.75, YC + R0 + 0.47, zc + 0.15, 'y', 12);
      const mk = add(new THREE.CylinderGeometry(0.11, 0.11, 0.4, 20), stahl, xm + 0.5, YC + R0 + 0.12, zc - 0.3, 0.5, 0, 0);
      zyl(0.07, 0.18, schwarz, xm + 0.5, YC + R0 + 0.35, zc - 0.42, 'y', 16);
      for (const x of [X0 + 0.55, X1 - 0.55]) kiste(stahlD, 0.12, 0.14, 0.02, x, YC + R0 + 0.05, zc);
      // Seite zum Gang: Durchführungsflansch mit Steckern; hinten ein Stutzen
      const sz = k === 0 ? zc - R0 : zc + R0, sd = k === 0 ? -1 : 1;
      zyl(0.22, 0.06, stahlD, xm + 0.6, YC + 0.05, sz + sd*0.03, 'z', 28);
      for (let i = 0; i < 5; i++) kiste(schwarz, 0.05, 0.04, 0.05, xm + 0.52 + (i % 3)*0.08, YC + 0.0 + Math.floor(i/3)*0.09, sz + sd*0.08);
      zyl(0.15, 0.3, stahl, X1 + 0.05, YC + 0.25, zc - 0.2, 'x', 24); zyl(0.17, 0.04, stahlD, X1 + 0.2, YC + 0.25, zc - 0.2, 'x', 24);
      // Kabel vom Messkopf und von der Durchführung
      kabel(kabelR, [[xm + 0.5, YC + R0 + 0.4, zc - 0.42], [xm - 0.3, YC + R0 + 0.3, zc - 0.7], [X0 + 0.2, 2.2, zc - 1.0], [X0 + 0.9, 2.75, zc - 1.2]]);
      kabel(kabelS, [[xm + 0.45, YC + R0 + 0.38, zc - 0.4], [xm - 0.5, YC + R0 + 0.2, zc - 0.75], [X0 + 0.3, 2.0, zc - 1.05], [X0 + 0.9, 2.75, zc - 1.25]]);
      kabel(kabelG, [[xm + 0.6, YC + 0.05, sz + sd*0.1], [xm + 0.3, YC - 0.3, sz + sd*0.35], [xm - 0.4, 0.05, sz + sd*0.5], [X0 - 0.2, 0.03, sz + sd*0.6]], 0.01);
      colsK.push({x0:X0 - 0.12, x1:X1 + 0.25, z0:zc - 0.95, z1:zc + 0.86, y0:-1, y1:2.3});
    });
    // neben Kammer 1: schwarzer Geräteschrank mit Monitor und Tastatur (Tische vorerst weggelassen)
    const z1 = KZ[0] - 1.35;
    kiste(schwarz, 0.6, 1.0, 0.6, (X0 + 0.85), 0.5, z1); kiste(weiss, 0.03, 0.34, 0.52, (X0 + 0.85), 1.33, z1); kiste(schwarz, 0.005, 0.3, 0.48, (X0 + 0.83), 1.33, z1);   // Schrank, Monitor
    kiste(weiss, 0.18, 0.02, 0.12, (X0 + 0.9), 1.01, z1); kiste(schwarz, 0.16, 0.02, 0.45, (X0 + 0.65), 1.01, z1);                                      // Fuß, Tastatur
    for (const s of [-1, 1]) zyl(0.035, 0.02, alu, (X0 + 0.85) + s*0.24, 1.01, z1 + s*0.24, 'y', 10);                                              // Ösen
    colsK.push({x0:X0 + 0.5, x1:X0 + 1.2, z0:z1 - 0.35, z1:z1 + 0.35, y0:-1, y1:1.6});
      G.rotation.y = Math.PI; G.position.set(A, 0, B);                     // Tür zur Fensterseite: (x, z) -> (A - x, B - z)
    for (const c of colsK) cols.push({x0:A - c.x1, x1:A - c.x0, z0:B - c.z1, z1:B - c.z0, y0:c.y0, y1:c.y1});
    // Unterverteilungen: je Tank eine schwarze Säule bis zur Decke im Zwischenraum, Steckdosen (rot 400 V, blau 230 V) zur Fensterseite
    const zs = KZ.map(z => B - z).sort((a, b) => a - b);                  // Achsen nach dem Drehen
    [[-4.9, zs[0] + R0 + 0.2], [-3.4, zs[1] - R0 - 0.2]].forEach(([x, z]) => {
      const o = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.8, 0.16), schwarz[1]); o.userData.mats = schwarz; cadMeshes.push(o); o.position.set(x, 1.4, z); scene.add(o);
      for (let i = 0; i < 6; i++) { const m = i % 2 ? M(0x2a62b8) : rot, d = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.1), m[1]); d.userData.mats = m; cadMeshes.push(d);
        d.position.set(x + 0.09, 0.9 + i*0.22, z); scene.add(d); }
      cols.push({x0:x - 0.1, x1:x + 0.12, z0:z - 0.1, z1:z + 0.1, y0:-1, y1:3}); });
    // zwischen den Tanktüren: Alugestell mit grauem Gerät oben und Kunststoffkiste unten (Foto von der Fensterseite)
    { const ax = A - X0 + 0.35, az = (zs[0] + zs[1])/2, part = (m, w, h, d, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m[1]); o.userData.mats = m; cadMeshes.push(o); o.position.set(x, y, z); scene.add(o); };
      for (const dx of [-0.27, 0.27]) for (const dz of [-0.22, 0.22]) part(alu, 0.04, 0.9, 0.04, ax + dx, 0.45, az + dz);
      for (const y of [0.1, 0.9]) part(alu, 0.58, 0.04, 0.48, ax, y, az);
      part(grau, 0.45, 0.2, 0.38, ax, 1.02, az); part(M(0xe8eef2, {transparent:true, opacity:0.55, roughness:0.2}), 0.4, 0.25, 0.34, ax, 0.25, az);
      cols.push({x0:ax - 0.3, x1:ax + 0.3, z0:az - 0.25, z1:az + 0.25, y0:-1, y1:1.2}); }
  }

  // Raum 019, Wand rechts beim Hereinkommen durch die erste Tür (nach Fotos aus dem Labor): kleinere, stehende Edelstahlkammer auf Beinen,
  // Strahlrohr zu einem Dipolmagneten (graues Joch, rote Spulen) auf einem Rohrgestell, davor ein Sechswege-Kreuz mit schwarzen
  // Manipulatoren auf einer roten Stange; davor ein dunkelgraues 19-Zoll-Rack, links ein Netzgerät auf Rollen, rechts ein Alu-Wagen.
  // An der Wand: Kupfer-Gasverteilung, grüne Gaswarngeräte. Gebaut an einer gedachten Wand bei z = 36.41 und dann um 180° gedreht
  // an die Wand z = 49.33 gesetzt (A, B): von vorn gesehen Magnet links, Kammer rechts, wie auf dem Foto.
  { const ZW = 36.41, YB = 1.25, A = -7.1, B = 36.41 + 49.333 - 0.7, WZ0 = ZW - 0.7, G = new THREE.Group(), colsS = []; scene.add(G);   // Bauwand, Strahlhöhe, Drehung
    const M = (color, o = {}) => [new THREE.MeshLambertMaterial({color, emissive:o.emissive || 0}), new THREE.MeshStandardMaterial({color, roughness:0.5, metalness:0.1, ...o})];
    const stahl = M(0xc9ccce, {roughness:0.4, metalness:0.5, emissive:0x26282a}), stahlD = M(0xaeb2b5, {roughness:0.35, metalness:0.6, emissive:0x1c1e20}), joch = M(0xc9ccc8, {roughness:0.7, metalness:0.1}),
          rot = M(0xc0281f, {roughness:0.55}), grauR = M(0x9aa3aa, {roughness:0.6, metalness:0.2}), schwarz = M(0x1b1d20, {roughness:0.5}), rack = M(0x3e4247, {roughness:0.6, metalness:0.2}),
          front = M(0xd9d8d2, {roughness:0.5, metalness:0.2}), alu = M(0xc4c8cc, {roughness:0.35, metalness:0.7}), weiss = M(0xf0f0ec, {roughness:0.7, metalness:0}),
          kupfer = M(0xc0703e, {roughness:0.35, metalness:0.8}), gruen = M(0x1d8a4a, {roughness:0.5}), schlinge = M(0x2fae55, {roughness:0.8, metalness:0});
    const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m[1]); o.userData.mats = m; cadMeshes.push(o);
      o.position.set(x, y, z); o.rotation.set(rx, ry, rz); G.add(o); return o; };
    const kiste = (m, w, h, d, x, y, z) => add(new THREE.BoxGeometry(w, h, d), m, x, y, z);
    const zyl = (r, l, m, x, y, z, achse = 'y', seg = 20) => add(new THREE.CylinderGeometry(r, r, l, seg), m, x, y, z, achse === 'z' ? Math.PI/2 : 0, 0, achse === 'x' ? Math.PI/2 : 0);
    const rohr = (a, b, r, m, seg = 12) => { const A = new THREE.Vector3(...a), D = new THREE.Vector3(...b).sub(A), L = D.length();
      const o = add(new THREE.CylinderGeometry(r, r, L, seg), m, 0, 0, 0); o.position.copy(A).addScaledVector(D, 0.5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), D.normalize()); return o; };
    const flansch = (x, y, z, achse, r) => { zyl(r, 0.035, stahlD, x, y, z, achse, 24); };
    // stehende Kammer: Ø 0,9 m, Mantel 0,6 m hoch, Flansche oben und unten, Stutzen vorn, Pumpe oben, grüne Hebeschlinge
    const KX = -2.4, KZc = ZW + 0.75, KY = 1.0;
    zyl(0.45, 0.6, stahl, KX, KY + 0.3, KZc, 'y', 40); zyl(0.5, 0.04, stahlD, KX, KY + 0.62, KZc, 'y', 40); zyl(0.52, 0.05, stahlD, KX, KY - 0.02, KZc, 'y', 40);
    add(new THREE.SphereGeometry(0.45, 32, 10, 0, Math.PI*2, Math.PI/2, Math.PI/2).scale(1, 0.4, 1), stahl, KX, KY - 0.04, KZc);
    for (const [dx, dy, r] of [[-0.12, 0.42, 0.14], [-0.1, 0.12, 0.13], [0.2, 0.2, 0.07]]) {               // Stutzen zum Raum hin (+z)
      const zz = KZc + Math.sqrt(0.45*0.45 - dx*dx); zyl(r, 0.12, stahl, KX + dx, KY + dy, zz + 0.05, 'z', 24); flansch(KX + dx, KY + dy, zz + 0.12, 'z', r + 0.03); }
    zyl(0.1, 0.35, stahl, KX - 0.15, KY + 0.82, KZc - 0.1, 'y', 20); zyl(0.12, 0.03, stahlD, KX - 0.15, KY + 0.65, KZc - 0.1, 'y', 20);
    zyl(0.03, 0.4, stahl, KX + 0.25, KY + 0.84, KZc - 0.2, 'y', 10); zyl(0.04, 0.03, schwarz, KX + 0.25, KY + 1.05, KZc - 0.2, 'y', 10);
    add(new THREE.TorusGeometry(0.22, 0.06, 8, 20), schlinge, KX + 0.05, KY + 0.68, KZc + 0.05, Math.PI/2, 0, 0);
    for (const [dx, dz] of [[-0.42, -0.4], [0.42, -0.4], [-0.42, 0.4], [0.42, 0.4]]) {                       // Beine mit Fußplatten, Rahmen unten
      zyl(0.05, KY - 0.04, alu, KX + dx, (KY - 0.04)/2, KZc + dz, 'y', 12); zyl(0.17, 0.03, alu, KX + dx, 0.015, KZc + dz, 'y', 20); }
    kiste(alu, 0.9, 0.05, 0.05, KX, 0.18, KZc - 0.4); kiste(alu, 0.9, 0.05, 0.05, KX, 0.18, KZc + 0.4); kiste(alu, 0.05, 0.05, 0.8, KX - 0.42, 0.18, KZc); kiste(alu, 0.05, 0.05, 0.8, KX + 0.42, 0.18, KZc);
    colsS.push({x0:KX - 0.6, x1:KX + 0.6, z0:ZW, z1:KZc + 0.62, y0:-1, y1:2.2});
    // Dipolmagnet: graues Joch (Rahmen) mit roten Spulen oben und unten, auf zwei grauen Rohrstützen mit Querstreben
    const MX = -5.0, MZ = ZW + 0.65;
    kiste(joch, 1.1, 0.14, 0.62, MX, YB + 0.42, MZ); kiste(joch, 1.1, 0.14, 0.62, MX, YB - 0.42, MZ);
    kiste(joch, 0.14, 0.98, 0.62, MX - 0.48, YB, MZ); kiste(joch, 0.14, 0.98, 0.62, MX + 0.48, YB, MZ);
    kiste(rot, 0.78, 0.22, 0.7, MX, YB + 0.23, MZ); kiste(rot, 0.78, 0.22, 0.7, MX, YB - 0.23, MZ);
    for (const dx of [-0.3, 0.3]) { zyl(0.12, YB - 0.49, grauR, MX + dx, (YB - 0.49)/2, MZ, 'y', 16); zyl(0.14, 0.04, grauR, MX + dx, YB - 0.51, MZ, 'y', 16); }
    kiste(grauR, 0.6, 0.08, 0.08, MX, 0.35, MZ); kiste(grauR, 0.08, 0.08, 0.5, MX, 0.6, MZ);
    colsS.push({x0:MX - 0.6, x1:MX + 0.6, z0:ZW, z1:MZ + 0.38, y0:-1, y1:2.0});
    // Strahlrohr: Kammer -> Magnet (längs der Wand), im Magneten um 90° abgelenkt zum Kreuz (in den Raum hinein)
    rohr([KX - 0.45, YB, KZc - 0.1], [MX + 0.55, YB, MZ], 0.05, stahl); flansch(KX - 0.5, YB, KZc - 0.1, 'x', 0.09); flansch(MX + 0.56, YB, MZ, 'x', 0.09);
    rohr([MX - 0.7, YB, MZ], [MX - 0.55, YB, MZ], 0.05, stahl); flansch(MX - 0.72, YB, MZ, 'x', 0.09);
    const CX = MX, CZ = MZ + 0.9;
    rohr([CX, YB, MZ + 0.36], [CX, YB, CZ - 0.12], 0.06, stahl); flansch(CX, YB, MZ + 0.38, 'z', 0.1);
    // Sechswege-Kreuz mit schwarzen Manipulatoren an den Schrägarmen, auf einer roten Stange
    zyl(0.11, 0.2, stahl, CX, YB, CZ, 'z', 24); flansch(CX, YB, CZ - 0.11, 'z', 0.15); flansch(CX, YB, CZ + 0.11, 'z', 0.15);
    rohr([CX, YB, CZ + 0.1], [CX, YB, CZ + 0.42], 0.05, stahl); zyl(0.06, 0.14, schwarz, CX, YB, CZ + 0.5, 'z', 16);
    for (const w of [0.785, 2.356, 3.927, 5.498]) { const ex = CX + Math.cos(w)*0.36, ey = YB + Math.sin(w)*0.36;
      rohr([CX, YB, CZ], [ex, ey, CZ], 0.025, stahl); const m = rohr([CX + Math.cos(w)*0.36, YB + Math.sin(w)*0.36, CZ], [CX + Math.cos(w)*0.52, YB + Math.sin(w)*0.52, CZ], 0.065, schwarz, 16); }
    zyl(0.035, YB - 0.12, rot, CX, (YB - 0.12)/2, CZ + 0.05, 'y', 12); zyl(0.2, 0.025, rot, CX, 0.012, CZ + 0.05, 'y', 24);
    colsS.push({x0:CX - 0.3, x1:CX + 0.3, z0:CZ - 0.25, z1:CZ + 0.3, y0:-1, y1:2.0});
    // dunkelgraues Rack zwischen Magnet und Kammer, vorn Einschübe (hell), Not-Aus oben
    const RX = -3.65, RZ = ZW + 1.15;
    kiste(rack, 0.62, 2.0, 0.62, RX, 1.0, RZ);
    for (const [y, h] of [[1.78, 0.2], [1.52, 0.2], [1.2, 0.24], [0.94, 0.18], [0.7, 0.14], [0.48, 0.16]]) kiste(front, 0.5, h, 0.02, RX, y, RZ + 0.31);
    zyl(0.035, 0.03, rot, RX - 0.15, 1.8, RZ + 0.33, 'z', 12); kiste(M(0xf0c000), 0.07, 0.07, 0.01, RX + 0.15, 1.8, RZ + 0.325);
    colsS.push({x0:RX - 0.31, x1:RX + 0.31, z0:RZ - 0.31, z1:RZ + 0.31, y0:-1, y1:2.1});
    // Netzgerät auf Rollen (Edelstahlgehäuse) mit Kabelrolle obendrauf
    const NX = -6.25, NZ = ZW + 1.0;
    kiste(stahl, 0.6, 0.65, 0.55, NX, 0.43, NZ); kiste(front, 0.5, 0.5, 0.01, NX, 0.43, NZ + 0.28);
    for (const dx of [-0.25, 0.25]) for (const dz of [-0.22, 0.22]) zyl(0.04, 0.03, schwarz, NX + dx, 0.05, NZ + dz, 'x', 10);
    add(new THREE.TorusGeometry(0.17, 0.03, 8, 20), schwarz, NX, 0.79, NZ, Math.PI/2, 0, 0);
    colsS.push({x0:NX - 0.32, x1:NX + 0.32, z0:NZ - 0.3, z1:NZ + 0.3, y0:-1, y1:1.0});
    // Alu-Wagen aus Profilen mit Geräten (rechts von der Kammer)
    const WX = -1.2, WZ = ZW + 0.7;
    for (const dx of [-0.5, 0.5]) for (const dz of [-0.35, 0.35]) kiste(alu, 0.045, 0.9, 0.045, WX + dx, 0.5, WZ + dz);
    for (const y of [0.15, 0.55, 0.95]) kiste(alu, 1.05, 0.03, 0.75, WX, y, WZ);
    kiste(front, 0.45, 0.13, 0.4, WX - 0.2, 0.62, WZ); kiste(schwarz, 0.4, 0.12, 0.35, WX + 0.25, 0.62, WZ); kiste(front, 0.3, 0.1, 0.25, WX, 1.02, WZ - 0.1);
    for (const dx of [-0.45, 0.45]) for (const dz of [-0.3, 0.3]) zyl(0.05, 0.03, M(0xd2691e), WX + dx, 0.05, WZ + dz, 'x', 12);
    colsS.push({x0:WX - 0.55, x1:WX + 0.55, z0:WZ - 0.4, z1:WZ + 0.4, y0:-1, y1:1.2});
    // an der Wand: Kupfer-Gasverteilung mit Ventilen, drei grüne Gaswarngeräte (der weiße Schrank entfällt, er stünde vor dem Fenster)
    rohr([-2.0, 1.95, WZ0 + 0.06], [-0.9, 1.95, WZ0 + 0.06], 0.015, kupfer, 8);
    for (let i = 0; i < 5; i++) { const x = -1.9 + i*0.22; rohr([x, 1.95, WZ0 + 0.06], [x, 1.55, WZ0 + 0.06], 0.012, kupfer, 8); kiste(stahlD, 0.05, 0.05, 0.05, x, 1.7, WZ0 + 0.07); }
    for (let i = 0; i < 3; i++) { kiste(gruen, 0.22, 0.28, 0.1, -0.65 + i*0.27, 1.75, WZ0 + 0.05); kiste(M(0x90a8a0, {emissive:0x203028}), 0.14, 0.12, 0.01, -0.65 + i*0.27, 1.76, WZ0 + 0.105); }
      // an der Wand, so nah wie möglich an der Fensterseite (bis an den Wandpfeiler): weißer Schrank mit zwei Türen (Foto),
    // 1,0 m breit, 0,6 m tief, 2 m hoch; hellgrau mit dunklem Sockel, Fugen und Griffen, damit er sich von der weißen Wand abhebt
    { const SX = A + 0.087 + 0.02 + 0.5, h = 2.0, fz = WZ0 + 0.6;          // Baukoordinate der Mitte (Pfeiler-Vorderkante bei x = -0.087)
      const korpus = M(0xd6d4cc, {roughness:0.6}), fuge = M(0x55595d), sockel = M(0x3c4045);
      kiste(korpus, 1.0, h - 0.08, 0.6, SX, 0.08 + (h - 0.08)/2, WZ0 + 0.3); kiste(sockel, 0.98, 0.08, 0.56, SX, 0.04, WZ0 + 0.28);
      kiste(fuge, 0.012, h - 0.12, 0.006, SX, 0.08 + (h - 0.08)/2, fz + 0.003);                                      // Mittelfuge
      for (const y of [0.1, h - 0.02]) kiste(fuge, 1.0, 0.012, 0.006, SX, y, fz + 0.003);                           // Kanten oben/unten
      for (const x of [SX - 0.496, SX + 0.496]) kiste(fuge, 0.008, h - 0.08, 0.006, x, 0.08 + (h - 0.08)/2, fz + 0.003);
      for (const dx of [-0.06, 0.06]) kiste(M(0x2a2d31), 0.025, 0.22, 0.03, SX + dx, 1.05, fz + 0.02);              // Griffe
      colsS.push({x0:SX - 0.5, x1:SX + 0.5, z0:WZ0, z1:WZ0 + 0.6, y0:-1, y1:2.1}); }
    G.rotation.y = Math.PI; G.position.set(A, 0, B);
    for (const c of colsS) cols.push({x0:A - c.x1, x1:A - c.x0, z0:B - c.z1, z1:B - c.z0, y0:c.y0, y1:c.y1});
  }

  // Raum 016 (Zugang von 09 durch einen schmalen Vorraum, Tür nach 017): Teeküche nach den Fotos IMG_0934/0935. Küchenzeile in Anthrazit
  // an der Wand zu 09: Hochschrank mit Mini-Kühlschrank obendrauf, Unterschränke mit heller Holz-Arbeitsplatte und Spüle, Rückwand in
  // Holzoptik, Oberschränke mit Mikrowelle. An der Wand zu 017 ein Röhrenheizkörper, Boden Laminat.
  { const XW = -6.961, XO = -4.776, Z0 = 6.513, ZT = 9.026;               // Wand zu 09, Wand zu 017, Hallenwand, Wandstück am Vorraum
    const M = (color, o = {}) => [new THREE.MeshLambertMaterial({color, map:o.map || null}), new THREE.MeshStandardMaterial({color, roughness:0.55, metalness:0.05, ...o})];
    const kiste = (m, dx, h, dz, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(dx, h, dz), m[1]); o.userData.mats = m; cadMeshes.push(o); o.position.set(x, y, z); scene.add(o); return o; };
    const zyl = (m, r, h, x, y, z, seg = 16) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m[1]); o.userData.mats = m; cadMeshes.push(o); o.position.set(x, y, z); scene.add(o); return o; };
    const anth = M(0x3b3d41, {roughness:0.6}), sockel = M(0x2a2b2e), griff = M(0xc4c8cc, {roughness:0.3, metalness:0.8}), edel = M(0xc0c4c7, {roughness:0.3, metalness:0.75}),
          platte = M(0xd9d0c1, {roughness:0.7, metalness:0}), weiss = M(0xf2f2ef, {roughness:0.6}), schwarz = M(0x1b1c1f), blau = M(0x1f3d8f, {roughness:0.6});
    const holz = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
      g.fillStyle = '#cdbfa7'; g.fillRect(0, 0, 256, 128); for (let i = 0; i < 60; i++) { g.strokeStyle = 'rgba(120,95,65,' + (0.05 + (i % 7)*0.015) + ')'; g.lineWidth = 1 + (i % 3);
        g.beginPath(); const y = (i*37) % 128; g.moveTo(0, y); g.bezierCurveTo(80, y + 6, 170, y - 6, 256, y + 2); g.stroke(); }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const F = XW + 0.6;                                                  // Vorderkante der Unterschränke
    const front = (z0, z1, y0, y1, xf = F, gr = null) => { kiste(anth, 0.02, y1 - y0 - 0.006, z1 - z0 - 0.006, xf + 0.01, (y0 + y1)/2, (z0 + z1)/2);
      if (gr === 'h') kiste(griff, 0.025, 0.015, Math.min(0.32, (z1 - z0)*0.6), xf + 0.035, y1 - 0.07, (z0 + z1)/2);
      if (gr === 'hm') kiste(griff, 0.025, 0.015, Math.min(0.32, (z1 - z0)*0.6), xf + 0.035, (y0 + y1)/2, (z0 + z1)/2);
      if (gr && gr[0] === 'v') kiste(griff, 0.025, 0.3, 0.015, xf + 0.035, gr[1], gr[2]); };
    // Unterschränke z 6.62 .. 8.42: Schubladenblock, zwei Türen; Sockel, Arbeitsplatte, Spüle
    const Za = Z0 + 0.1, Zh = 8.42;
    kiste(anth, 0.58, 0.76, Zh - Za, XW + 0.29, 0.48, (Za + Zh)/2); kiste(sockel, 0.54, 0.1, Zh - Za, XW + 0.27, 0.05, (Za + Zh)/2);
    front(7.82, Zh, 0.68, 0.86, F, 'hm'); front(7.82, Zh, 0.4, 0.68, F, 'hm'); front(7.82, Zh, 0.1, 0.4, F, 'hm');
    front(7.22, 7.82, 0.1, 0.86, F, 'h'); front(Za, 7.22, 0.1, 0.86, F, ['v', 0.68, 7.27]);
    kiste(M(0xd9d0c1, {map:holz, roughness:0.7, metalness:0}), 0.63, 0.04, Zh - Za, XW + 0.315, 0.88, (Za + Zh)/2);
    kiste(edel, 0.42, 0.01, 0.5, XW + 0.33, 0.903, 6.98); kiste(M(0x8a8e92, {roughness:0.3, metalness:0.7}), 0.34, 0.005, 0.36, XW + 0.33, 0.909, 6.98);
    zyl(edel, 0.02, 0.22, XW + 0.08, 1.01, 7.15); kiste(edel, 0.2, 0.025, 0.025, XW + 0.17, 1.12, 7.15);
    kiste(M(0xd9d0c1, {map:holz, roughness:0.8, metalness:0}), 0.015, 0.6, Zh - Za, XW + 0.008, 1.2, (Za + Zh)/2);     // Rückwand
    // Hochschrank z 8.42 .. 9.0 mit Lüftungsgitter unten, darauf ein weißer Mini-Kühlschrank; Zettel an der Tür
    kiste(anth, 0.58, 1.9, 9.0 - Zh, XW + 0.29, 1.05, (Zh + 9.0)/2); kiste(sockel, 0.54, 0.1, 9.0 - Zh, XW + 0.27, 0.05, (Zh + 9.0)/2);
    front(Zh, 9.0, 0.45, 2.0, F, ['v', 1.05, Zh + 0.05]); front(Zh, 9.0, 0.1, 0.45, F, 'hm');
    kiste(M(0x9a9da0), 0.01, 0.05, 0.4, F + 0.005, 0.12, (Zh + 9.0)/2);
    kiste(weiss, 0.5, 0.5, 0.5, XW + 0.27, 2.25, 8.72);
    const zettel = (farbe, x, y, z, w, h) => { const c = document.createElement('canvas'); c.width = 128; c.height = 160; const g = c.getContext('2d');
      g.fillStyle = '#f6f6f2'; g.fillRect(0, 0, 128, 160); g.fillStyle = farbe; g.fillRect(0, 0, 128, 26);
      g.fillStyle = 'rgba(40,40,40,0.55)'; for (let i = 0; i < 12; i++) g.fillRect(10 + (i % 2)*58, 36 + Math.floor(i/2)*20, 48, 6);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({map:t})); m.rotation.y = Math.PI/2; m.position.set(x, y, z); scene.add(m); };
    zettel('#2a62b8', F + 0.022, 1.45, 8.74, 0.2, 0.28);
    // Oberschränke (0,35 tief): Schrank, Mikrowelle mit Klappe darüber, höherer Schrank am Hochschrank; Betriebsanweisung am Schrank
    const FO = XW + 0.35;
    kiste(anth, 0.33, 0.78, 7.17 - Za, XW + 0.165, 1.92, (Za + 7.17)/2); front(Za, 7.17, 1.53, 2.31, FO, ['v', 1.65, 7.12]);
    kiste(anth, 0.33, 0.35, 0.65, XW + 0.165, 2.135, 7.495); front(7.17, 7.82, 1.96, 2.31, FO, 'h');
    kiste(edel, 0.34, 0.42, 0.63, XW + 0.17, 1.74, 7.495); kiste(schwarz, 0.005, 0.24, 0.36, FO + 0.002, 1.76, 7.45); zyl(schwarz, 0.02, 0.01, FO + 0.004, 1.8, 7.7).rotation.z = Math.PI/2;
    kiste(anth, 0.33, 0.88, Zh - 7.82, XW + 0.165, 1.97, (7.82 + Zh)/2); front(7.82, Zh, 1.53, 2.41, FO, ['v', 1.65, 7.87]);
    zettel('#1d8a4a', FO + 0.022, 1.92, 6.86, 0.18, 0.24);
    // auf der Arbeitsplatte: Siebträgermaschine, Wasserkocher, Dosen; auf den Oberschränken: Kaffeemaschine, Küchenrollen
    kiste(edel, 0.35, 0.36, 0.38, XW + 0.25, 1.08, 7.62); zyl(schwarz, 0.06, 0.14, XW + 0.22, 1.33, 7.7);
    zyl(edel, 0.08, 0.22, XW + 0.3, 1.01, 8.05); zyl(M(0xe8eef2, {roughness:0.3}), 0.1, 0.12, XW + 0.42, 0.96, 8.28, 4); zyl(M(0xf0c800), 0.1, 0.03, XW + 0.42, 1.035, 8.28, 4);
    kiste(schwarz, 0.22, 0.3, 0.2, XW + 0.18, 2.46, 7.5); zyl(edel, 0.07, 0.18, XW + 0.22, 2.4, 7.25);
    for (let i = 0; i < 4; i++) zyl(weiss, 0.06, 0.24, XW + 0.12 + (i % 2)*0.14, 2.43, 6.75 + Math.floor(i/2)*0.14);
    cols.push({x0:XW, x1:F + 0.05, z0:Z0, z1:9.0, y0:-1, y1:2.6});
    // Wand zu 017: Röhrenheizkörper in der Ecke zur Halle, Steigrohr, gestapelte Getränkekisten
    for (let k = 0; k < 9; k++) zyl(weiss, 0.022, 1.0, XO - 0.07, 0.75, 6.78 + k*0.05, 10);
    kiste(weiss, 0.06, 0.06, 0.48, XO - 0.07, 1.27, 6.98); kiste(weiss, 0.06, 0.06, 0.48, XO - 0.07, 0.23, 6.98); zyl(weiss, 0.025, 0.08, XO - 0.07, 1.34, 6.74);
    zyl(M(0xc9ccce, {roughness:0.4, metalness:0.6}), 0.05, 3.0, XO - 0.08, 1.5, Z0 + 0.08);
    cols.push({x0:XO - 0.12, x1:XO, z0:Z0, z1:7.25, y0:-1, y1:1.4});
    // großes Poster „Schnitzel Gonzalez“ an der Hallenwand gegenüber der Küchenzeile (Ausschnitt vom Meme-Whiteboard), schwarzer Rahmen
    if (window.TEX && window.TEX.poster_gonzalez) { const t = new THREE.TextureLoader().load(window.TEX.poster_gonzalez); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
      const px = -5.55, py = 1.65, w = 0.7, h = 0.76;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({map:t, color:0xe8e8e8})); m.position.set(px, py, Z0 + 0.022); scene.add(m);
      kiste(sockel, w + 0.06, h + 0.06, 0.02, px, py, Z0 + 0.01); }
    // Laminatboden graubraun in Dielen, über Raum und Vorraum
    { const c = document.createElement('canvas'); c.width = 512; c.height = 512; const g = c.getContext('2d');
      for (let r = 0; r < 8; r++) for (let k = 0; k < 3; k++) { const v = 108 + ((r*7 + k*13) % 5)*5; g.fillStyle = 'rgb(' + v + ',' + (v - 6) + ',' + (v - 12) + ')';
        const off = (r % 2)*85; g.fillRect((k*170 + off) % 512, r*64, 170, 64); if ((k*170 + off) % 512 + 170 > 512) g.fillRect(0, r*64, (k*170 + off + 170) % 512, 64); }
      g.strokeStyle = 'rgba(40,34,30,0.35)'; g.lineWidth = 2; for (let r = 0; r <= 8; r++) { g.beginPath(); g.moveTo(0, r*64); g.lineTo(512, r*64); g.stroke(); }
      for (let r = 0; r < 8; r++) for (let k = 0; k < 3; k++) { const x = (k*170 + (r % 2)*85) % 512; g.beginPath(); g.moveTo(x, r*64); g.lineTo(x, r*64 + 64); g.stroke(); }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
      const L = 10.462 - Z0, B = XO - XW; t.repeat.set(B/1.6, L/1.6);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(B, L), new THREE.MeshLambertMaterial({map:t, color:0xb0aaa4})); m.rotation.x = -Math.PI/2;
      m.position.set((XW + XO)/2, 0.007, (Z0 + 10.462)/2); scene.add(m); }
  }

  // Raum 09 (Vorraum zwischen Flur 05 und der Halle) nach den Fotos: rote Doppeltür zur Halle mit Fluchtwegschildern darüber.
  // Rechts (Blick zur Halle, Wand x = -7.44): rote Zarge der Tür in den Übergangsraum nach 017, daneben ein Ahorn-Sideboard mit
  // Schiebetüren (darauf das PRIS-10-Ionentriebwerk in einer Acrylhaube, Ordner, Gehörschutzspender), Türschild, zwei Mondbilder,
  // Garderobe mit Laborkittel und blauer Jacke, Uhr. Links (Wand x = -10.15): rote Tür (zu), Erste-Hilfe- und Feuerlöscherschild,
  // Druckknopfmelder, Verbandkasten, Feuerlöscher, großes Whiteboard mit Jahreskalender und Aushängen.
  { const XR = -7.44, XL = -10.15, ZH = 6.513;
    const M = (color, o = {}) => [new THREE.MeshLambertMaterial({color, emissive:o.emissive || 0, transparent:!!o.transparent, opacity:o.opacity ?? 1}),
      new THREE.MeshStandardMaterial({color, roughness:0.55, metalness:0.1, ...o})];
    const kiste = (m, dx, h, dz, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(dx, h, dz), m[1]); o.userData.mats = m; cadMeshes.push(o); o.position.set(x, y, z); scene.add(o); return o; };
    const zyl = (m, r, h, x, y, z, rz = 0, rx = 0, seg = 18) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m[1]); o.userData.mats = m; cadMeshes.push(o); o.position.set(x, y, z); o.rotation.set(rx, 0, rz); scene.add(o); return o; };
    const bildTex = (w, h, f) => { const c = document.createElement('canvas'); c.width = w; c.height = h; f(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
    const flach = (t, w, h, x, y, z, ry, basic) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), basic ? new THREE.MeshBasicMaterial({map:t, toneMapped:false}) : new THREE.MeshBasicMaterial({map:t, color:0xe4e4e4})); m.rotation.y = ry; m.position.set(x, y, z); scene.add(m); return m; };
    const rot = M(0x8e1c1c, {roughness:0.45}), ahorn = M(0xe2cfa6, {roughness:0.6, metalness:0}), dunkel = M(0x2a2d31), edel = M(0xc4c8cc, {roughness:0.3, metalness:0.75}),
          weiss = M(0xf4f4f1, {roughness:0.6, metalness:0}), blau = M(0x23366e), grau = M(0xb9bcbf);
    const zarge = (x, z0, z1, h, sx) => { kiste(rot, 0.06, 0.06, z1 - z0 + 0.12, x + sx*0.03, h + 0.03, (z0 + z1)/2); for (const z of [z0 - 0.03, z1 + 0.03]) kiste(rot, 0.06, h, 0.06, x + sx*0.03, h/2, z); };
    // Halle: rote Zarge, darüber Fluchtwegschild, zwei Warnleuchten und ein gelbes Schild; die Tür selbst steht unten (raumTuer)
    { const x0 = -10.15, x1 = -8.2, h = 2.1; kiste(rot, x1 - x0 + 0.12, 0.06, 0.06, (x0 + x1)/2, h + 0.03, ZH + 0.03);
      for (const x of [x0 - 0.03, x1 + 0.03]) kiste(rot, 0.06, h, 0.06, x, h/2, ZH + 0.03);
      const exit = bildTex(256, 96, (g, w, hh) => { g.fillStyle = '#18a558'; g.fillRect(0, 0, w, hh); g.fillStyle = '#fff'; g.font = 'bold 60px system-ui'; g.fillText('↓', 30, 70);
        g.fillRect(120, 20, 60, 56); g.fillStyle = '#18a558'; g.fillRect(128, 26, 44, 44); g.fillStyle = '#fff'; g.beginPath(); g.arc(200, 34, 8, 0, 7); g.fill(); g.fillRect(190, 46, 16, 26); });
      flach(exit, 0.4, 0.15, -9.6, 2.55, ZH + 0.02, 0, true);
      for (const x of [-9.0, -8.55]) { kiste(dunkel, 0.07, 0.16, 0.07, x, 2.5, ZH + 0.04); kiste(M(0xc4201c, {emissive:0x400000}), 0.05, 0.05, 0.05, x, 2.42, ZH + 0.08); }
      const gs = bildTex(128, 64, (g, w, hh) => { g.fillStyle = '#f2c200'; g.fillRect(0, 0, w, hh); g.fillStyle = '#b3261e'; g.font = 'bold 12px system-ui'; g.fillText('Gesperrt bei', 12, 20); g.fillText('Technikbetrieb', 12, 36); g.fillText('Raum nicht betreten', 6, 52); });
      flach(gs, 0.3, 0.15, -8.25, 2.5, ZH + 0.006, 0, false); }
    // rechte Wand: Zarge der offenen Tür in den Übergangsraum, Türschild
    zarge(XR, 9.436, 10.462, 2.05, -1); kiste(rot, 0.98, 2.0, 0.045, XR - 0.52, 1.0, 9.42);   // Türblatt steht offen in den Raum
    cols.push({x0:XR - 1.02, x1:XR, z0:9.39, z1:9.45, y0:-1, y1:2.05});
    // Schwerlastregal an der rechten Wand vor der Hallentür: Stahl, fünf Böden, oben weiße Schutzhelme, Kartons, blaue Box mit Gebotszeichen
    { const rz0 = 8.25, rz1 = 9.33, rd = 0.45, rx = XR - rd/2, st = M(0x9da3a8, {roughness:0.45, metalness:0.6});
      for (const z of [rz0 + 0.02, rz1 - 0.02]) for (const x of [XR - rd + 0.02, XR - 0.02]) kiste(st, 0.035, 2.0, 0.035, x, 1.0, z);
      for (const y of [0.12, 0.55, 0.98, 1.41, 1.84]) kiste(st, rd, 0.03, rz1 - rz0, rx, y, (rz0 + rz1)/2);
      for (let k = 0; k < 4; k++) { const hm = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 8, 0, Math.PI*2, 0, Math.PI/2), weiss[1]); hm.position.set(rx, 1.86, rz0 + 0.16 + k*0.25); scene.add(hm); }
      kiste(M(0xd8c497), 0.35, 0.22, 0.4, rx, 1.54, rz0 + 0.3); kiste(weiss, 0.3, 0.12, 0.3, rx, 1.48, rz1 - 0.3); kiste(M(0x2f8fd8), 0.3, 0.1, 0.25, rx, 1.09, rz0 + 0.3);
      kiste(M(0x1f4fb0), 0.38, 0.3, 0.5, rx, 0.29, rz0 + 0.35); kiste(M(0xc4201c), 0.2, 0.1, 0.2, rx, 1.04, rz1 - 0.25); kiste(weiss, 0.3, 0.2, 0.35, rx, 0.68, rz1 - 0.3);
      cols.push({x0:XR - rd, x1:XR, z0:rz0, z1:rz1, y0:-1, y1:2.05}); }
    // Transportwagen mit Holzkiste neben der Hallentür, davor ein weißer Eimer
    { const wx = -7.85, wz = 6.95, st = M(0x8f9599, {roughness:0.4, metalness:0.6});
      kiste(M(0xd2a868, {roughness:0.8, metalness:0}), 0.62, 0.6, 0.62, wx, 0.72, wz); kiste(st, 0.66, 0.03, 0.7, wx, 0.4, wz);
      for (const dx of [-0.3, 0.3]) for (const dz of [-0.32, 0.32]) { kiste(st, 0.025, 0.4, 0.025, wx + dx, 0.2, wz + dz); zyl(dunkel, 0.05, 0.03, wx + dx, 0.05, wz + dz, Math.PI/2); }
      kiste(st, 0.025, 0.6, 0.025, wx - 0.31, 0.75, wz + 0.34); kiste(st, 0.025, 0.6, 0.025, wx + 0.31, 0.75, wz + 0.34); kiste(st, 0.64, 0.025, 0.025, wx, 1.05, wz + 0.34);
      zyl(weiss, 0.15, 0.3, -8.0, 0.15, 7.55); cols.push({x0:wx - 0.35, x1:XR, z0:ZH, z1:7.75, y0:-1, y1:1.1}); }
    const schild = bildTex(128, 80, (g, w, h) => { g.fillStyle = '#f2f2f0'; g.fillRect(0, 0, w, h); g.fillStyle = '#2d4a7a'; g.fillRect(0, 0, w, 14);
      g.fillStyle = '#222'; g.font = '12px system-ui'; g.fillText('015-017', 8, 30); g.fillStyle = '#1d8a4a'; g.beginPath(); g.arc(22, 56, 14, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.fillRect(19, 46, 6, 20); g.fillRect(12, 53, 20, 6); g.fillStyle = 'rgba(0,0,0,0.55)'; for (let i = 0; i < 3; i++) g.fillRect(44, 42 + i*11, 66, 5); });
    flach(schild, 0.16, 0.1, XR - 0.006, 1.45, 10.62, -Math.PI/2, false);
    // Sideboard aus Ahorn mit zwei Schiebetüren, schwarzer Sockel; darauf Triebwerk in Acrylhaube, Ordner, Gehörschutzspender
    const sz0 = 10.6, sz1 = 11.6, sd = 0.45, sx = XR - sd/2;
    kiste(ahorn, sd, 0.72, sz1 - sz0, sx, 0.42, (sz0 + sz1)/2); kiste(M(0x2b2c2e), sd - 0.04, 0.06, sz1 - sz0 - 0.04, sx, 0.03, (sz0 + sz1)/2);
    kiste(M(0xd8c497), 0.005, 0.6, 0.004, XR - sd - 0.003, 0.43, (sz0 + sz1)/2);
    for (const z of [sz0 + 0.1, sz1 - 0.1]) kiste(dunkel, 0.02, 0.14, 0.015, XR - sd - 0.012, 0.45, z);
    kiste(M(0xe8f0f4, {transparent:true, opacity:0.3, roughness:0.1}), 0.3, 0.3, 0.3, sx, 0.93, sz0 + 0.2); kiste(M(0x5a6068), 0.28, 0.02, 0.28, sx, 0.79, sz0 + 0.2);
    zyl(edel, 0.08, 0.14, sx, 0.92, sz0 + 0.2, 0, Math.PI/2); zyl(M(0x8f9599, {roughness:0.4, metalness:0.6}), 0.065, 0.12, sx, 0.92, sz0 + 0.32, 0, Math.PI/2);
    for (let i = 0; i < 5; i++) { const z = sz0 + 0.42 + i*0.075; kiste(i === 3 ? grau : blau, 0.28, 0.3, 0.07, sx, 0.93, z); kiste(weiss, 0.005, 0.12, 0.05, sx - 0.141, 0.97, z); }
    kiste(dunkel, 0.2, 0.05, 0.2, sx, 0.805, sz1 - 0.15); kiste(M(0xf2e9b0, {transparent:true, opacity:0.75}), 0.16, 0.18, 0.16, sx, 1.0, sz1 - 0.15); kiste(M(0xc4201c), 0.06, 0.08, 0.06, sx, 0.87, sz1 - 0.15);
    cols.push({x0:XR - sd, x1:XR, z0:sz0, z1:sz1, y0:-1, y1:1.2});
    // zwei Mondbilder in weißen Rahmen über dem Sideboard
    const mond = (astronaut) => bildTex(128, 160, (g, w, h) => { g.fillStyle = '#f6f6f4'; g.fillRect(0, 0, w, h); g.fillStyle = '#0c0c0e'; g.fillRect(16, 22, 96, 96);
      if (astronaut) { g.fillStyle = '#7a7a76'; g.fillRect(16, 92, 96, 26); g.fillStyle = '#d8d8d4'; g.fillRect(56, 62, 14, 30); g.fillRect(74, 70, 26, 20); }
      else { g.fillStyle = '#8f9396'; g.beginPath(); g.arc(64, 70, 34, 0, 7); g.fill(); g.fillStyle = '#0c0c0e'; g.beginPath(); g.arc(46, 64, 32, 0, 7); g.fill(); } });
    for (const [z, a] of [[10.85, true], [11.35, false]]) { kiste(weiss, 0.03, 0.52, 0.42, XR - 0.015, 1.6, z); flach(mond(a), 0.38, 0.48, XR - 0.031, 1.6, z, -Math.PI/2, false); }
    // Garderobe (Edelstahlleiste mit vier Haken), Laborkittel und blaue Steppjacke; Wanduhr darüber
    kiste(edel, 0.03, 0.06, 0.62, XR - 0.015, 1.72, 12.25); for (let i = 0; i < 4; i++) kiste(edel, 0.07, 0.08, 0.015, XR - 0.05, 1.78, 11.98 + i*0.18);
    kiste(M(0xf4f4f2, {roughness:0.9}), 0.12, 1.05, 0.3, XR - 0.1, 1.15, 12.34); kiste(M(0x2f8fd8, {roughness:0.8}), 0.18, 0.75, 0.42, XR - 0.14, 1.3, 12.5);
    kiste(M(0xc4201c), 0.181, 0.05, 0.1, XR - 0.14, 1.62, 12.5);
    const uhr = bildTex(128, 128, (g) => { g.fillStyle = '#b8bcbf'; g.beginPath(); g.arc(64, 64, 63, 0, 7); g.fill(); g.fillStyle = '#16181b'; g.beginPath(); g.arc(64, 64, 56, 0, 7); g.fill();
      g.fillStyle = '#eee'; g.font = 'bold 12px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let i = 1; i <= 12; i++) { const a = i*Math.PI/6; g.fillText(String(i), 64 + Math.sin(a)*44, 64 - Math.cos(a)*44); }
      g.strokeStyle = '#eee'; g.lineWidth = 4; g.beginPath(); g.moveTo(64, 64); g.lineTo(40, 72); g.stroke(); g.lineWidth = 2; g.beginPath(); g.moveTo(64, 64); g.lineTo(36, 44); g.stroke(); });
    const u = new THREE.Mesh(new THREE.CircleGeometry(0.15, 32), new THREE.MeshLambertMaterial({map:uhr})); u.rotation.y = -Math.PI/2; u.position.set(XR - 0.01, 2.25, 12.2); scene.add(u);
    cols.push({x0:XR - 0.25, x1:XR, z0:12.0, z1:12.75, y0:-1, y1:2.0});
    // linke Wand: rote Tür (zu) mit Türschließer, darüber Erste-Hilfe- und Feuerlöscherschild, Melder, Verbandkasten, Feuerlöscher
    const tz0 = 10.359, tz1 = 11.436;
    zarge(XL, tz0, tz1, 2.05, 1); kiste(rot, 0.04, 2.0, tz1 - tz0 - 0.02, XL + 0.02, 1.0, (tz0 + tz1)/2);
    kiste(edel, 0.03, 0.05, 0.03, XL + 0.05, 1.05, tz1 - 0.12); kiste(edel, 0.12, 0.02, 0.02, XL + 0.09, 1.05, tz1 - 0.12); kiste(grau, 0.05, 0.06, 0.32, XL + 0.05, 2.0, (tz0 + tz1)/2 + 0.2);
    cols.push({x0:XL, x1:XL + 0.06, z0:tz0, z1:tz1, y0:-1, y1:2.1});
    const zeichen = (gruen) => bildTex(128, 128, (g, w, h) => { g.fillStyle = gruen ? '#18a558' : '#c4201c'; g.fillRect(0, 0, w, h); g.fillStyle = '#f4f4f0';
      if (gruen) { g.fillRect(50, 18, 28, 92); g.fillRect(18, 50, 92, 28); } else { g.lineWidth = 7; g.strokeStyle = '#f4f4f0'; g.strokeRect(46, 34, 30, 70); g.beginPath(); g.arc(80, 40, 20, -1.5, 1.2); g.stroke(); } });
    flach(zeichen(true), 0.24, 0.24, XL + 0.006, 2.45, 10.12, Math.PI/2, true); flach(zeichen(false), 0.24, 0.24, XL + 0.006, 2.18, 10.12, Math.PI/2, false);
    kiste(M(0xe8621e), 0.07, 0.13, 0.14, XL + 0.035, 1.7, 10.12);                                                         // Druckknopfmelder
    kiste(weiss, 0.12, 0.22, 0.28, XL + 0.06, 1.35, 10.12); kiste(M(0x1d8a4a), 0.122, 0.22, 0.04, XL + 0.06, 1.35, 9.99); // Verbandkasten
    zyl(M(0xc4201c, {roughness:0.35}), 0.065, 0.42, XL + 0.08, 0.55, 10.15); zyl(dunkel, 0.03, 0.12, XL + 0.08, 0.82, 10.15);
    // großes Whiteboard (Foto, Textur 'poster_whiteboard09') zwischen Tür und Halle: Betriebsanweisungen, Jahreskalender, Aushänge
    { const wbz0 = 7.9, wbz1 = 9.75, wh = 1.22;
      kiste(grau, 0.025, wh + 0.05, wbz1 - wbz0 + 0.05, XL + 0.012, 1.5, (wbz0 + wbz1)/2);
      if (window.TEX && window.TEX.poster_whiteboard09) { const t = new THREE.TextureLoader().load(window.TEX.poster_whiteboard09); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
        flach(t, wbz1 - wbz0, wh, XL + 0.026, 1.5, (wbz0 + wbz1)/2, Math.PI/2, false); } }
  }

  // Übergangsraum zwischen 09 und 017: Meme-Whiteboard (Foto docs/fotos/pinnwand, Textur 'poster_pinnwand', tools/postertex.py) an der
  // rechten Wand mit Holzleiste unten, an der Stirnwand oben eine USV mit Steckdosenleiste
  { const ZW = 10.462, x0 = -6.35, x1 = -4.85, y0 = 1.0, y1 = 2.0;
    const M = c => [new THREE.MeshLambertMaterial({color:c}), new THREE.MeshStandardMaterial({color:c, roughness:0.5, metalness:0.2})];
    const kiste = (m, dx, h, dz, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(dx, h, dz), m[1]); o.userData.mats = m; cadMeshes.push(o); o.position.set(x, y, z); scene.add(o); return o; };
    if (window.TEX && window.TEX.poster_pinnwand) { const t = new THREE.TextureLoader().load(window.TEX.poster_pinnwand); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), new THREE.MeshBasicMaterial({map:t, color:0xe8e8e8})); m.rotation.y = Math.PI; m.position.set((x0 + x1)/2, (y0 + y1)/2, ZW - 0.022); scene.add(m); }
    const alu = M(0xc3c7ca); kiste(alu, x1 - x0 + 0.04, 0.02, 0.02, (x0 + x1)/2, y1 + 0.01, ZW - 0.012); kiste(alu, 0.02, y1 - y0, 0.02, x0 - 0.01, (y0 + y1)/2, ZW - 0.012); kiste(alu, 0.02, y1 - y0, 0.02, x1 + 0.01, (y0 + y1)/2, ZW - 0.012);
    kiste(M(0xc8a46e), x1 - x0 + 0.06, 0.04, 0.07, (x0 + x1)/2, y0 - 0.02, ZW - 0.035);
    kiste(M(0x1f2124), 0.18, 0.32, 0.42, -4.776 - 0.09, 2.6, 10.1); kiste(M(0x1f2124), 0.06, 0.05, 0.5, -4.776 - 0.03, 2.35, 10.1); }

  // Tür von Flur 05 (Treppenvorplatz) nach 014a: rote Tür, geschlossen (Foto vom Hallenvorraum aus)
  { const rot = [new THREE.MeshLambertMaterial({color:0x8e1c1c}), new THREE.MeshStandardMaterial({color:0x8e1c1c, roughness:0.45, metalness:0.1})];
    const edel = [new THREE.MeshLambertMaterial({color:0xc4c8cc}), new THREE.MeshStandardMaterial({color:0xc4c8cc, roughness:0.3, metalness:0.8})];
    const z0 = 14.462, z1 = 15.59, x = -7.44, h = 2.05;
    const box = (m, dx, dy, dz, px, py, pz) => { const o = new THREE.Mesh(new THREE.BoxGeometry(dx, dy, dz), m[1]); o.userData.mats = m; cadMeshes.push(o); o.position.set(px, py, pz); scene.add(o); };
    box(rot, 0.05, h, z1 - z0 - 0.02, x + 0.05, h/2, (z0 + z1)/2);
    box(rot, 0.06, 0.06, z1 - z0 + 0.12, x - 0.03, h + 0.03, (z0 + z1)/2); for (const z of [z0 - 0.03, z1 + 0.03]) box(rot, 0.06, h, 0.06, x - 0.03, h/2, z);
    box(edel, 0.03, 0.05, 0.03, x + 0.01, 1.05, z0 + 0.12); box(edel, 0.02, 0.02, 0.13, x - 0.01, 1.05, z0 + 0.17);
    cols.push({x0:x - 0.1, x1:x + 0.1, z0, z1, y0:-1, y1:h}); }

  // Rote Doppeltüren, die man mit E öffnet und schließt (das Spiel liest window.raeumeTueren): Halle/09 mit den Warnschildern vom Foto,
  // 09/05 und 05/08b schlicht mit Klinke und Türschließer. Zu Spielbeginn sind sie zu.
  { window.raeumeTueren = [];
    const rotM = [new THREE.MeshLambertMaterial({color:0x8e1c1c}), new THREE.MeshStandardMaterial({color:0x8e1c1c, roughness:0.45, metalness:0.1})];
    const schlicht = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 512; const g = c.getContext('2d');
      g.fillStyle = '#8e1c1c'; g.fillRect(0, 0, 256, 512); g.strokeStyle = 'rgba(40,0,0,0.5)'; g.lineWidth = 3; g.strokeRect(2, 2, 252, 508);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const foto = window.TEX && window.TEX.poster_hallentuer ? (t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; })(new THREE.TextureLoader().load(window.TEX.poster_hallentuer)) : null;
    const edelM = [new THREE.MeshLambertMaterial({color:0xc4c8cc}), new THREE.MeshStandardMaterial({color:0xc4c8cc, roughness:0.3, metalness:0.8})];
    const tuer = (id, name, x0, x1, zw, s, vorn, hinten, h = 2.08) => {
      const w = (x1 - x0)/2, fl = [];
      for (const k of [0, 1]) {
        const g = new THREE.Group(); g.position.set(k ? x1 : x0, 0, zw); scene.add(g);
        const tex = (t, links) => { if (!t) return rotM[0]; const c = t.clone(); c.repeat.set(t === foto ? 0.5 : 1, 1); c.offset.set(t === foto ? (links ? 0 : 0.5) : 0, 0); c.needsUpdate = true; return new THREE.MeshLambertMaterial({map:c}); };
        const mats = [rotM[0], rotM[0], rotM[0], rotM[0], tex(vorn > 0 ? hinten : vorn, !k), tex(vorn > 0 ? vorn : hinten, !k)];
        const m = new THREE.Mesh(new THREE.BoxGeometry(w - 0.01, h, 0.05), [rotM[0], rotM[0], rotM[0], rotM[0], tex(vorn, !k), tex(hinten, !k)]);
        m.position.set(k ? -w/2 : w/2, h/2, 0); g.add(m);
        for (const sz of [-1, 1]) { const kl = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 0.02), edelM[1]); kl.position.set(k ? -w + 0.12 : w - 0.12, 1.05, sz*0.045); g.add(kl); }
        fl.push(g); }
      const col = {x0, x1, z0:zw - 0.12, z1:zw + 0.12, y0:-1, y1:h}; cols.push(col);
      const t = {id, name, x0, x1, z:zw, offen:false, a:0,
        schritt(){ const ziel = this.offen ? 1 : 0; if (this.a === ziel) return false; this.a += Math.sign(ziel - this.a)*Math.min(Math.abs(ziel - this.a), 0.03);
          fl[0].rotation.y = -s*1.55*this.a; fl[1].rotation.y = s*1.55*this.a; col.y1 = this.a > 0.5 ? -1 : h; return true; } };
      window.raeumeTueren.push(t); };
    // vorn = Seite +z, hinten = Seite -z
    tuer('raumtuer_halle', 'Tür zur Jumbo-Halle', -10.15, -8.2, 6.42, 1, foto || schlicht, schlicht, 2.08);
    tuer('raumtuer_0905', 'Tür in den Flur', -9.838, -7.707, 13.03, 1, schlicht, schlicht);
    tuer('raumtuer_0508b', 'Tür zum Flur 08b', -9.945, -7.813, 19.59, 1, schlicht, schlicht);
  }

  // Ostende von Flur 05 (vor 014), nach den Fotos docs/fotos/tuer_flur05 und poster_*: dunkle Türanlage über die ganze Flurbreite mit
  // verglaster Doppeltür nach draußen und Notausgangsschild (Textur 'tuer05', tools/tuertex.py), davor eine Fußmatte. Rechts (Wand zu 06)
  // drei Poster, links (Wand zu 014) ein Poster, der Desinfektionsspender und ein hoher cremefarbener Heizkörper. Die Tür bleibt zu.
  { const XW = 0.446, ZL = 16.513, ZR = 19.385, B = ZR - ZL, Ht = 2.4;      // Stirnwand (x), linke und rechte Flurwand (z) aus raeume_data.js
    const M = (color, o = {}) => [new THREE.MeshLambertMaterial({color}), new THREE.MeshStandardMaterial({color, roughness:0.5, metalness:0.1, ...o})];
    const kiste = (m, w, h, d, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m[1]); o.userData.mats = m; cadMeshes.push(o); o.position.set(x, y, z); scene.add(o); return o; };
    const bild = key => { if (!window.TEX || !window.TEX[key]) return null; const t = new THREE.TextureLoader().load(window.TEX[key]); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
    const tt = bild('tuer05');
    if (tt) { const tuer = new THREE.Mesh(new THREE.PlaneGeometry(B, Ht), new THREE.MeshBasicMaterial({map:tt, toneMapped:false}));
      tuer.rotation.y = -Math.PI/2; tuer.position.set(XW - 0.015, Ht/2, (ZL + ZR)/2); scene.add(tuer); }                  // vor der Sockelleiste
    kiste(M(0x3a3c3f, {roughness:0.95, metalness:0}), 0.85, 0.012, 1.3, XW - 0.6, 0.006, ZL + 0.95);                   // Fußmatte
    // Poster im Alurahmen; an der rechten Wand zeigen sie nach -z, an der linken nach +z
    const alu = M(0xc3c7ca, {roughness:0.35, metalness:0.7});
    const poster = (key, x, y, w, h, rechts) => { const t = bild('poster_' + key); if (!t) return;
      const z = rechts ? ZR - 0.016 : ZL + 0.016, ry = rechts ? Math.PI : 0, s = rechts ? -1 : 1;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({map:t, color:0xdedede})); m.rotation.y = ry;   // gleichmäßig hell, unabhängig von der Wandseite
      m.position.set(x, y, z); scene.add(m);
      const r = 0.025, d = 0.02, zr = z - s*0.004;
      kiste(alu, w + 2*r, r, d, x, y + h/2 + r/2, zr); kiste(alu, w + 2*r, r, d, x, y - h/2 - r/2, zr);
      kiste(alu, r, h, d, x - w/2 - r/2, y, zr); kiste(alu, r, h, d, x + w/2 + r/2, y, zr); };
    poster('ptra', -0.75, 1.55, 0.6, 0.84, true); poster('pb', -1.85, 1.55, 0.6, 0.84, true); poster('fair', -3.15, 1.5, 0.84, 1.16, true);
    poster('inlab', -0.55, 1.55, 0.6, 0.84, false);
    // Desinfektionsspender (weiß mit blauem Fenster) und hoher Heizkörper (cremeweiß, mit Thermostatkopf oben)
    kiste(M(0xf2f2ef), 0.12, 0.3, 0.1, -1.05, 1.3, ZL + 0.06); kiste(M(0x5a8fc8), 0.05, 0.12, 0.005, -1.05, 1.27, ZL + 0.112);
    kiste(M(0xf2f2ef), 0.18, 0.015, 0.12, -1.05, 1.12, ZL + 0.07);
    const creme = M(0xe9e3c4, {roughness:0.3, metalness:0.1});
    kiste(creme, 0.75, 1.45, 0.06, -1.75, 0.95, ZL + 0.07);
    for (let k = 0; k < 14; k++) kiste(M(0xd9d3b2), 0.006, 1.4, 0.004, -2.09 + k*0.052, 0.95, ZL + 0.101);
    kiste(M(0xb9bcbf), 0.04, 0.08, 0.04, -2.1, 1.74, ZL + 0.07); kiste(M(0xf2f2ef), 0.06, 0.06, 0.06, -2.1, 1.81, ZL + 0.07);
    cols.push({x0:-2.15, x1:-1.35, z0:ZL, z1:ZL + 0.12, y0:-1, y1:1.7});
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

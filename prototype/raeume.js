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
  function teile(a, b, fn){ const n = Math.max(1, Math.ceil((b - a)/0.5)); for (let i = 0; i < n; i++) fn(a + (b-a)*i/n, a + (b-a)*(i+1)/n); }
  function wand(x0, x1, y0, y1, z0, z1, sockel){
    beton.add([0,1,0], [[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0]]); beton.add([0,-1,0], [[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]]);
    teile(z0, z1, (a, b) => {
      let x = x1 + 0.05, z = (a+b)/2, f = imFlur(x, z); (f || imWeiss(x, z) ? flurW : beton).add([1,0,0], [[x1,y0,b],[x1,y0,a],[x1,y1,a],[x1,y1,b]]); if (f && sockel) kasten(leiste, x1, x1+SD, 0, SH, a, b);
      x = x0 - 0.05; f = imFlur(x, z); (f || imWeiss(x, z) ? flurW : beton).add([-1,0,0], [[x0,y0,a],[x0,y0,b],[x0,y1,b],[x0,y1,a]]); if (f && sockel) kasten(leiste, x0-SD, x0, 0, SH, a, b); });
    teile(x0, x1, (a, b) => {
      let x = (a+b)/2, z = z1 + 0.05, f = imFlur(x, z); (f || imWeiss(x, z) ? flurW : beton).add([0,0,1], [[a,y0,z1],[b,y0,z1],[b,y1,z1],[a,y1,z1]]); if (f && sockel) kasten(leiste, a, b, 0, SH, z1, z1+SD);
      z = z0 - 0.05; f = imFlur(x, z); (f || imWeiss(x, z) ? flurW : beton).add([0,0,-1], [[b,y0,z0],[a,y0,z0],[a,y1,z0],[b,y1,z0]]); if (f && sockel) kasten(leiste, a, b, 0, SH, z0-SD, z0); });
  }
  for (const [x0, x1, z0, z1] of R.walls) wand(x0, x1, 0, HR, z0, z1, true);
  for (const [x0, x1, z0, z1, u] of R.doors) wand(x0, x1, u || 2.1, HR, z0, z1, false);

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
  wand(T.xP, T.xA, T.K, T.H + 0.95, T.zT0, T.zT1, false);                        // Trennwand zwischen den Läufen, vom Keller bis oben
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
    mesh(K.geo(), mats(0xb3b2ac, 0x2a2a28)); mesh(B.geo(), mats(0x44474c, 0x101112)); }
  // Handläufe aus Stahlrohr an beiden Seiten der Trennwand, 0,9 m über den Stufen, und ein Geländer oben am Austritt
  { const stahl = mats(0x9aa0a6, 0x1a1c1e), R0 = 0.02;
    const rohr = (a, b) => { const A = new THREE.Vector3(...a), D = new THREE.Vector3(...b).sub(A), L = D.length();
      const m = new THREE.Mesh(new THREE.CylinderGeometry(R0, R0, L, 8), stahl[1]); m.userData.mats = stahl; cadMeshes.push(m);
      m.position.copy(A).addScaledVector(D, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), D.normalize()); scene.add(m); };
    const z1 = T.zT0 - 0.06, z2 = T.zT1 + 0.06, hl = 0.9, zm = (T.zT0 + T.zT1)/2;
    rohr([T.xA, hl, z1], [T.xP, T.h + hl, z1]); rohr([T.xP, T.h + hl, z2], [T.xB, T.H + hl, z2]); rohr([T.xB, T.H + hl, z2], [T.xO, T.H + hl, z2]);
    for (const x of [T.xA, (T.xA + T.xO)/2, T.xO]) rohr([x, T.H, zm], [x, T.H + 1.0, zm]);
    rohr([T.xA, T.H + 1.0, zm], [T.xO, T.H + 1.0, zm]); rohr([T.xA, T.H + 0.5, zm], [T.xO, T.H + 0.5, zm]);
    rohr([T.xA, hl, z2], [T.xP, -T.h + hl, z2]); rohr([T.xP, -T.h + hl, z1], [T.xA, T.K + hl, z1]); }       // in den Keller
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

  // Raum 019: zwei liegende Vakuumkammern (nach Fotos aus dem Labor): Edelstahl, 1,6 m Durchmesser, 4 m lang mit gewölbten Böden.
  // Die Türen (Flansch, blauer Schwenkarm mit JLU-Schild, Schauglas, KF-Stutzen, Griff) gehen zur Fensterseite auf, das hintere Ende steht
  // nah an der Gangwand (zwischen Wandpfeilern und hinterem Stutzen kommt man gerade noch durch). Oben Ventil und Messkopf, an der Seite
  // eine Durchführung mit Kabeln, daneben ein Geräteschrank mit Monitor; jeder Tank hat zwischen den Tanks seine eigene Unterverteilung.
  // Gebaut wird in einer Gruppe (Tür nach -x) und die Gruppe dann um 180° gedreht an ihren Platz gesetzt (A, B), samt Kollision.
  { const X0 = -5.6, X1 = -1.6, R0 = 0.8, YC = 1.0, KZ = [43.6, 46.0], A = -7.75, B = 87.6, G = new THREE.Group(), colsK = []; scene.add(G);
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
    kiste(schwarz, 0.6, 1.0, 0.6, -4.75, 0.5, z1); kiste(weiss, 0.03, 0.34, 0.52, -4.75, 1.33, z1); kiste(schwarz, 0.005, 0.3, 0.48, -4.77, 1.33, z1);   // Schrank, Monitor
    kiste(weiss, 0.18, 0.02, 0.12, -4.7, 1.01, z1); kiste(schwarz, 0.16, 0.02, 0.45, -4.95, 1.01, z1);                                      // Fuß, Tastatur
    for (const s of [-1, 1]) zyl(0.035, 0.02, alu, -4.75 + s*0.24, 1.01, z1 + s*0.24, 'y', 10);                                              // Ösen
    colsK.push({x0:-5.1, x1:-4.1, z0:z1 - 0.35, z1:z1 + 0.35, y0:-1, y1:1.6});
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
  { const ZW = 36.41, YB = 1.25, A = -7.1, B = 36.41 + 49.333, G = new THREE.Group(), colsS = []; scene.add(G);   // Bauwand, Strahlhöhe, Drehung
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
    rohr([-2.0, 1.95, ZW + 0.06], [-0.9, 1.95, ZW + 0.06], 0.015, kupfer, 8);
    for (let i = 0; i < 5; i++) { const x = -1.9 + i*0.22; rohr([x, 1.95, ZW + 0.06], [x, 1.55, ZW + 0.06], 0.012, kupfer, 8); kiste(stahlD, 0.05, 0.05, 0.05, x, 1.7, ZW + 0.07); }
    for (let i = 0; i < 3; i++) { kiste(gruen, 0.22, 0.28, 0.1, -0.65 + i*0.27, 1.75, ZW + 0.05); kiste(M(0x90a8a0, {emissive:0x203028}), 0.14, 0.12, 0.01, -0.65 + i*0.27, 1.76, ZW + 0.105); }
      G.rotation.y = Math.PI; G.position.set(A, 0, B);
    for (const c of colsS) cols.push({x0:A - c.x1, x1:A - c.x0, z0:B - c.z1, z1:B - c.z0, y0:c.y0, y1:c.y1});
  }

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

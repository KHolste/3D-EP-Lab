/* Detaillierte Bauteile, die Räume (raeume.js) und Halle (jumbo3d_*.html) gemeinsam nutzen.
   Materialien dürfen einzelne Materialien oder Paare [Lambert, Standard] sein (wie in raeume.js); bei Paaren nutzt das Netz
   das Standard-Material und merkt sich das Paar in userData.mats (Grafikstufe „niedrig“ schaltet auf Lambert).
   Polster bekommen die Oberflächenklasse 'stoff' (Gewebetextur, grafik.js), Griffe 'metall' bzw. 'kunststoff'.

   DETAIL.buerostuhl(THREE, {polster, schale, gestell, armlehnen, rueckenhoehe})
       -> Gruppe, Sitzmitte bei (0, 0, 0) auf dem Boden, Rückenlehne bei -z, Sitzfläche zeigt nach +z
   DETAIL.buegelgriff(THREE, mat, laenge)
       -> Gruppe, Griff liegt entlang x, steht nach +z ab (Befestigung bei z = 0) */
window.DETAIL = (() => {
  const netz = (THREE, geo, m) => { const o = new THREE.Mesh(geo, Array.isArray(m) ? m[1] : m); if (Array.isArray(m)) o.userData.mats = m; return o; };
  // Kopie des Materials (bzw. Paars) mit Oberflächenklasse; das übergebene Material bleibt unverändert (wird oft auch anderswo benutzt)
  const kopien = new Map();
  const klasse = (m, k) => { const key = [].concat(m).map(x => x.uuid).join() + k;
    if (!kopien.has(key)) { const c = [].concat(m).map(x => { const y = x.clone(); y.userData = {...x.userData, jgKlasse:k}; return y; }); kopien.set(key, Array.isArray(m) ? c : c[0]); }
    return kopien.get(key); };

  // Kissen: abgerundeter Quader, Oberseite (+y bzw. +z) leicht gewölbt, optional nach hinten gebogen (Rückenlehne)
  function kissen(THREE, RBG, w, h, d, r, woelbung, achse, biegung = 0){
    const g = new RBG(w, h, d, 3, r), p = g.attributes.position, hw = w/2, hd = (achse === 'y' ? d : h)/2;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (achse === 'y' && y > 0) p.setY(i, y + woelbung*Math.max(0, 1 - (x/hw)**2)*Math.max(0, 1 - (z/hd)**2));
      if (achse === 'z' && z > 0) p.setZ(i, z + woelbung*Math.max(0, 1 - (x/hw)**2)*Math.max(0, 1 - (y/hd)**2));
      if (biegung) p.setZ(i, p.getZ(i) - biegung*(x/hw)**2); }
    g.computeVertexNormals(); return g;
  }

  function buerostuhl(THREE, o = {}){
    const RBG = window.DETAIL.RoundedBoxGeometry, gr = new THREE.Group(), add = (geo, m, x, y, z) => { const n = netz(THREE, geo, m); n.position.set(x, y, z); gr.add(n); return n; };
    const polster = klasse(o.polster, 'stoff'), schale = klasse(o.schale, 'kunststoff'), gestell = o.gestell || schale;
    const H = 0.47;                                                       // Sitzhöhe (Oberkante Polster)
    // Sitz: Kissen auf einer Kunststoffschale
    add(kissen(THREE, RBG, 0.48, 0.075, 0.46, 0.03, 0.012, 'y'), polster, 0, H - 0.04, 0.01);
    add(new RBG(0.44, 0.025, 0.42, 1, 0.01), schale, 0, H - 0.085, 0.01);
    // Rückenlehne: gebogenes Kissen mit Schale, Träger aus Metall zum Sitz
    const rh = o.rueckenhoehe || 0.5, ry = H + 0.08 + rh/2;
    add(kissen(THREE, RBG, 0.44, rh, 0.065, 0.028, 0.01, 'z', 0.03), polster, 0, ry, -0.23);
    add(new RBG(0.4, rh - 0.04, 0.02, 1, 0.008), schale, 0, ry, -0.27);
    add(new RBG(0.05, 0.3, 0.025, 1, 0.008), gestell, 0, H + 0.02, -0.29);
    add(new RBG(0.05, 0.025, 0.22, 1, 0.008), gestell, 0, H - 0.11, -0.19);
    // Gaslift mit Abdeckung, Mechanik unter dem Sitz
    add(new RBG(0.16, 0.04, 0.2, 1, 0.01), gestell, 0, H - 0.12, 0.0);
    add(new THREE.CylinderGeometry(0.022, 0.022, 0.18, 14), gestell, 0, H - 0.22, 0);
    add(new THREE.CylinderGeometry(0.032, 0.036, 0.16, 16), schale, 0, 0.16, 0);
    // Fünfsternfuß mit Rollen
    for (let k = 0; k < 5; k++) { const a = k*Math.PI*0.4, ca = Math.cos(a), sa = Math.sin(a);
      const arm = add(new RBG(0.31, 0.035, 0.045, 1, 0.012), gestell, sa*0.155, 0.085, ca*0.155); arm.rotation.y = a - Math.PI/2;
      add(new THREE.CylinderGeometry(0.008, 0.008, 0.04, 8), gestell, sa*0.3, 0.06, ca*0.3);
      const rad = add(new THREE.CylinderGeometry(0.025, 0.025, 0.022, 14), schale, sa*0.3, 0.025, ca*0.3);
      rad.rotation.z = Math.PI/2; rad.rotation.y = a; }
    // Armlehnen: Stütze und gepolsterte Auflage
    if (o.armlehnen) for (const s of [-1, 1]) {
      add(new RBG(0.03, 0.2, 0.05, 1, 0.01), gestell, s*0.25, H + 0.03, -0.04);
      add(new RBG(0.03, 0.025, 0.12, 1, 0.01), gestell, s*0.25, H - 0.07, -0.04);
      add(new RBG(0.07, 0.03, 0.26, 1, 0.014), klasse(o.armpolster || schale, 'kunststoff'), s*0.25, H + 0.145, 0.0); }
    return gr;
  }

  function buegelgriff(THREE, m, laenge = 0.14){
    const g = new THREE.Group(), k = klasse(m, (Array.isArray(m) ? m[1] : m).metalness >= 0.5 ? 'metall' : 'kunststoff'), r = 0.0065, ab = 0.028;
    const stab = netz(THREE, new THREE.CylinderGeometry(r, r, laenge, 12), k); stab.rotation.z = Math.PI/2; stab.position.z = ab; g.add(stab);
    for (const s of [-1, 1]) { const st = netz(THREE, new THREE.CylinderGeometry(r*0.85, r*0.85, ab, 10), k); st.rotation.x = Math.PI/2; st.position.set(s*(laenge/2 - r*1.5), 0, ab/2); g.add(st);
      const kp = netz(THREE, new THREE.SphereGeometry(r, 10, 8), k); kp.position.set(s*laenge/2, 0, ab); g.add(kp); }
    return g;
  }

  // ---------- Unordnung auf einem Schreibtisch (Rodrigos Tisch in 06) ----------
  // Fläche x0..x1, z0..z1 auf Höhe y; frei: Rechtecke [x0, x1, z0, z1], auf denen nichts liegen soll (Monitorfuß, Tastatur).
  // Festes Zufallsmuster (seed): sieht bei jedem Start gleich aus.
  function unordnung(THREE, o){
    const RBG = window.DETAIL.RoundedBoxGeometry, g = new THREE.Group();
    let s = o.seed || 7; const rnd = () => (s = (s*16807) % 2147483647)/2147483647, zw = (a, b) => a + (b - a)*rnd();
    const mp = (color, opt = {}) => [new THREE.MeshLambertMaterial({color, map:opt.map || null}),
                                     new THREE.MeshStandardMaterial({color, roughness:0.6, metalness:0, ...opt})];
    const add = (geo, m, x, y, z, ry = 0, rx = 0, rz = 0) => { const n = netz(THREE, geo, m); n.position.set(x, y, z); n.rotation.set(rx, ry, rz); g.add(n); return n; };
    const frei = o.frei || [], belegt = [];
    const platz = (w, d, versuche = 40) => {                         // freie Stelle für ein Teil der Größe w x d suchen
      for (let v = 0; v < versuche; v++) { const x = zw(o.x0 + w/2 + 0.02, o.x1 - w/2 - 0.02), z = zw(o.z0 + d/2 + 0.02, o.z1 - d/2 - 0.02);
        const r = [x - w/2, x + w/2, z - d/2, z + d/2], ueber = q => r[0] < q[1] && r[1] > q[0] && r[2] < q[3] && r[3] > q[2];
        if (!frei.some(ueber) && !belegt.some(ueber)) { belegt.push(r); return [x, z]; } }
      return null; };
    const Y = o.y;
    // Papier: Blätter mit Textzeilen
    const text = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 180; const x = c.getContext('2d'); x.fillStyle = '#f7f6f1'; x.fillRect(0, 0, 128, 180);
      x.fillStyle = 'rgba(40,40,45,0.55)'; for (let i = 0; i < 26; i++) { const l = 60 + Math.random()*50; if (i % 9 !== 8) x.fillRect(12, 14 + i*6, l, 2); }
      x.strokeStyle = 'rgba(30,60,140,0.5)'; x.beginPath(); x.moveTo(20, 150); x.bezierCurveTo(40, 140, 60, 165, 90, 148); x.stroke();
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const papier = mp(0xffffff, {map:text, roughness:0.9}), papierW = mp(0xf3f2ec, {roughness:0.9});
    const stapel = (x, z, n, ry) => { let y = Y; for (let i = 0; i < n; i++) { const t = 0.0012 + (i % 7 === 0 ? 0.004 : 0);
        add(new THREE.BoxGeometry(0.21, t, 0.297), i === n - 1 ? papier : papierW, x + zw(-0.012, 0.012), y + t/2, z + zw(-0.012, 0.012), ry + zw(-0.08, 0.08)); y += t; }
      return y; };
    const stapelOben = [];
    for (let k = 0; k < 4; k++) { const p = platz(0.26, 0.33); if (p) stapelOben.push([p[0], stapel(p[0], p[1], 6 + Math.floor(rnd()*28), zw(-0.4, 0.4)), p[1]]); }
    for (let k = 0; k < 5; k++) { const p = platz(0.2, 0.2, 10); if (p) add(new THREE.BoxGeometry(0.21, 0.001, 0.297), papier, p[0], Y + 0.002 + k*0.0015, p[1], zw(0, 6.3)); }   // lose Blätter (dürfen überlappen)
    belegt.splice(belegt.length - 5, 5);
    // Ordner (liegend gestapelt) und Bücher
    const ordnerF = [0x1f4fa8, 0xb32d2d, 0x2f7d3a, 0x222222, 0xd8b21c];
    { const p = platz(0.34, 0.3); if (p) { let y = Y; for (let i = 0; i < 3; i++) { const h = 0.075;
        add(new RBG(0.32, h, 0.285, 1, 0.006), mp(ordnerF[Math.floor(rnd()*5)], {roughness:0.5}), p[0] + zw(-0.02, 0.02), y + h/2, p[1] + zw(-0.02, 0.02), zw(-0.25, 0.25)); y += h; } } }
    for (let k = 0; k < 2; k++) { const p = platz(0.22, 0.28); if (!p) continue; let y = Y;
      for (let i = 0; i < 2 + Math.floor(rnd()*3); i++) { const h = zw(0.02, 0.045), w = zw(0.15, 0.2), d = zw(0.21, 0.26);
        add(new RBG(w, h, d, 1, 0.003), mp([0x7a2e2e, 0x2e4a7a, 0x3d3d3d, 0xd6cfb8, 0x4f6b3a][Math.floor(rnd()*5)], {roughness:0.7}), p[0], y + h/2, p[1], zw(-0.4, 0.4)); y += h; } }
    // Tassen (eine mit Kaffeerest), Getränkedosen (eine umgekippt), Flasche
    // Teebeutel: liegend (benutzt, braun, flachgedrückt) oder in einer Tasse mit Faden über den Rand und Etikett außen
    const tee = mp(0x7a4a26, {roughness:0.9}), faden = mp(0xf0ece0, {roughness:0.9}), etikett = mp(0xf2f2ea, {roughness:0.8});
    const teebeutel = (x, y, z) => { const b = add(new THREE.SphereGeometry(1, 10, 6), tee, x, y + 0.004, z, zw(0, 6.3)); b.scale.set(0.028, 0.005, 0.034);
      add(new THREE.CylinderGeometry(0.0006, 0.0006, 0.07, 4), faden, x + 0.03, y + 0.001, z, zw(0, 6.3), 0, Math.PI/2); };
    const beutelInTasse = (x, y, z) => { const a = zw(0, 6.3), cx = Math.cos(a), sz = Math.sin(a);
      add(new THREE.CylinderGeometry(0.0006, 0.0006, 0.06, 4), faden, x + cx*0.02, y + 0.08, z + sz*0.02, 0, 0, 0);          // Faden aus der Tasse
      add(new THREE.CylinderGeometry(0.0006, 0.0006, 0.04, 4), faden, x + cx*0.042, y + 0.08, z + sz*0.042, 0, 0, 0);        // außen am Rand hinunter
      const e = add(new THREE.BoxGeometry(0.022, 0.026, 0.001), etikett, x + cx*0.044, y + 0.05, z + sz*0.044); e.rotation.y = -a + Math.PI/2; };
    const tasse = (x, z, c, voll, y0 = Y, beutel = false) => { const m = mp(c, {roughness:0.3}); add(new THREE.CylinderGeometry(0.04, 0.036, 0.095, 18, 1, true), m, x, y0 + 0.048, z);
      add(new THREE.CylinderGeometry(0.036, 0.036, 0.006, 18), m, x, y0 + 0.003, z);
      const h = add(new THREE.TorusGeometry(0.025, 0.007, 8, 14, Math.PI), m, x + 0.04, y0 + 0.05, z, zw(0, 6.3)); h.rotation.set(0, 0, -Math.PI/2);
      if (voll) add(new THREE.CylinderGeometry(0.037, 0.037, 0.002, 18), mp(beutel ? 0x6a3a18 : 0x2b1a10, {roughness:0.15}), x, y0 + 0.07, z);
      if (beutel) beutelInTasse(x, y0, z); };
    for (let k = 0; k < 3; k++) { const p = platz(0.1, 0.1); if (p) tasse(p[0], p[1], [0xffffff, 0x1f4fa8, 0xd94a2a][k], k !== 1); }
    // weitere Tassen (o.tassen), ein Teil davon mit Teebeutel; passt keine mehr auf den Tisch, stehen sie oben auf den Papierstapeln
    const tfarben = [0xf4f4f0, 0x2f7d3a, 0xe0b000, 0x3d3d3d, 0x8a2c6a, 0xffffff, 0x2856b5];
    for (let k = 0; k < (o.tassen || 0); k++) { const p = platz(0.1, 0.1, 200), c = tfarben[k % tfarben.length], b = k % 2 === 0;
      if (p) tasse(p[0], p[1], c, true, Y, b);
      else if (stapelOben.length) { const [sx, sy, sz] = stapelOben.splice(Math.floor(rnd()*stapelOben.length), 1)[0]; tasse(sx + zw(-0.04, 0.04), sz + zw(-0.06, 0.06), c, true, sy, b); } }
    for (let k = 0; k < (o.teebeutel || 0); k++) { const p = platz(0.07, 0.07, 60); if (p) teebeutel(p[0], Y, p[1]); }
    // Krümel: kleine unregelmäßige Brösel (Keks, Brot), gehäuft an zwei, drei Stellen, einzelne über den ganzen Tisch
    if (o.kruemel) { const km = [mp(0xc89a5a, {roughness:0.9}), mp(0xa8763e, {roughness:0.9}), mp(0xe0c48e, {roughness:0.9})];
      const nester = [0, 1, 2].map(() => [zw(o.x0 + 0.1, o.x1 - 0.1), zw(o.z0 + 0.1, o.z1 - 0.1)]);
      for (let i = 0; i < o.kruemel; i++) { let x, z;
        if (rnd() < 0.7) { const [nx, nz] = nester[i % 3], a = zw(0, 6.28), r = 0.09*Math.sqrt(rnd()); x = nx + Math.cos(a)*r; z = nz + Math.sin(a)*r; }
        else { x = zw(o.x0 + 0.02, o.x1 - 0.02); z = zw(o.z0 + 0.02, o.z1 - 0.02); }
        if (x < o.x0 + 0.01 || x > o.x1 - 0.01 || z < o.z0 + 0.01 || z > o.z1 - 0.01) continue;
        const r = zw(0.0015, 0.0045), k = add(new THREE.TetrahedronGeometry(r, 0), km[i % 3], x, Y + r*0.6, z, zw(0, 6.3), zw(0, 6.3)); k.scale.y = 0.6; } }
    for (let k = 0; k < 2; k++) { const p = platz(0.08, 0.14); if (!p) continue; const m = mp(k ? 0xc8ccd0 : 0xc0201a, {roughness:0.3, metalness:0.7});
      if (k) add(new THREE.CylinderGeometry(0.033, 0.033, 0.115, 16), m, p[0], Y + 0.033, p[1], zw(0, 6.3), 0, Math.PI/2);    // umgekippt
      else add(new THREE.CylinderGeometry(0.033, 0.033, 0.115, 16), m, p[0], Y + 0.058, p[1]); }
    { const p = platz(0.08, 0.08); if (p) { const m = mp(0x9fd3e8, {roughness:0.1, transparent:false}); add(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 14), m, p[0], Y + 0.1, p[1]);
      add(new THREE.CylinderGeometry(0.014, 0.02, 0.04, 12), m, p[0], Y + 0.22, p[1]); add(new THREE.CylinderGeometry(0.016, 0.016, 0.02, 12), mp(0x1f4fa8), p[0], Y + 0.25, p[1]); } }
    // Laborkram: KF-Klammern, Schrauben, Flansch, Kabelbinder
    const stahl = mp(0xc4c8cc, {roughness:0.35, metalness:0.8});
    for (let k = 0; k < 3; k++) { const p = platz(0.08, 0.08, 15); if (!p) continue;
      add(new THREE.TorusGeometry(0.03, 0.006, 8, 18, Math.PI*1.1), stahl, p[0], Y + 0.006, p[1], zw(0, 6.3), Math.PI/2);
      add(new THREE.CylinderGeometry(0.005, 0.005, 0.05, 6), stahl, p[0] + 0.03, Y + 0.006, p[1], 0, 0, Math.PI/2); }
    { const p = platz(0.14, 0.14); if (p) { add(new THREE.CylinderGeometry(0.065, 0.065, 0.014, 24), stahl, p[0], Y + 0.007, p[1]);
      add(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 20, 1, true), stahl, p[0], Y + 0.04, p[1]); } }
    for (let k = 0; k < 7; k++) { const p = platz(0.03, 0.03, 8); if (p) add(new THREE.CylinderGeometry(0.003, 0.003, zw(0.015, 0.04), 6), stahl, p[0], Y + 0.003, p[1], zw(0, 6.3), 0, Math.PI/2); }
    // Kabelsalat: Kabel quer über den Tisch und über die Kante
    const schwarz = mp(0x151515, {roughness:0.5});
    for (let k = 0; k < 4; k++) { const pts = []; let x = zw(o.x0 + 0.1, o.x1 - 0.1), z = o.z1 - 0.05;
      for (let i = 0; i < 7; i++) { pts.push(new THREE.Vector3(x, Y + 0.004 + (i === 6 && k % 2 ? -0.25 : 0), z)); x += zw(-0.18, 0.18); z -= zw(0.05, 0.14);
        x = Math.max(o.x0 + 0.02, Math.min(o.x1 - 0.02, x)); }
      add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.0035, 6), schwarz, 0, 0, 0); }
    // Snackverpackung (zerknittert, glänzend)
    { const p = platz(0.1, 0.1); if (p) { const geo = new THREE.IcosahedronGeometry(0.045, 1), q = geo.attributes.position;
      for (let i = 0; i < q.count; i++) { const f = zw(0.6, 1.25); q.setXYZ(i, q.getX(i)*f*1.4, q.getY(i)*f*0.5, q.getZ(i)*f); } geo.computeVertexNormals();
      add(geo, mp(0xe8a020, {roughness:0.25, metalness:0.6}), p[0], Y + 0.02, p[1], zw(0, 6.3)); } }
    return g;
  }

  // Jacke über einer Stuhllehne: Rücken hängt hinter der Lehne, Kragen oben, Ärmel seitlich (Lehne bei z, Oberkante y, Gruppe zeigt wie der Stuhl)
  function jacke(THREE, m, breite = 0.46){
    const RBG = window.DETAIL.RoundedBoxGeometry, g = new THREE.Group(), st = klasse(m, 'stoff');
    const add = (geo, x, y, z, rx = 0, rz = 0) => { const n = netz(THREE, geo, st); n.position.set(x, y, z); n.rotation.set(rx, 0, rz); g.add(n); };
    add(kissen(THREE, RBG, breite, 0.5, 0.035, 0.015, 0.01, 'z'), 0, -0.24, -0.035, -0.08);           // Rücken (hinter der Lehne)
    add(kissen(THREE, RBG, breite*0.95, 0.12, 0.03, 0.014, 0.006, 'z'), 0, -0.05, 0.03, 0.15);          // Vorderteil über die Kante
    add(new THREE.CylinderGeometry(0.035, 0.03, breite*0.9, 10), 0, 0.005, 0, 0, Math.PI/2);            // Kragen auf der Kante
    for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.045, 0.04, 0.5, 10), s*breite*0.47, -0.28, -0.05, 0.05, s*0.12);   // Ärmel
    return g;
  }

  // Rucksack: gewölbter Hauptkörper, Vortasche, Tragegriff
  function rucksack(THREE, m){
    const RBG = window.DETAIL.RoundedBoxGeometry, g = new THREE.Group(), st = klasse(m, 'stoff');
    const add = (geo, x, y, z, rx = 0) => { const n = netz(THREE, geo, st); n.position.set(x, y, z); n.rotation.x = rx; g.add(n); };
    add(kissen(THREE, RBG, 0.3, 0.42, 0.16, 0.06, 0.03, 'z'), 0, 0.21, 0);
    add(kissen(THREE, RBG, 0.24, 0.2, 0.06, 0.03, 0.015, 'z'), 0, 0.14, 0.09);
    add(new THREE.TorusGeometry(0.04, 0.008, 6, 12, Math.PI), 0, 0.42, -0.02);
    return g;
  }

  // Kartons und Zeug an einer Wand: gestapelte Umzugskartons (Klebeband, Etikett, einer offen), Gerätekoffer,
  // zusammengefaltete Kartons an der Wand. Wand entlang x (x0..x1) bei z = wand, Stapel ragen nach +z in den Raum (bis tiefe).
  function kartons(THREE, o){
    const RBG = window.DETAIL.RoundedBoxGeometry, g = new THREE.Group();
    let s = o.seed || 11; const rnd = () => (s = (s*16807) % 2147483647)/2147483647, zw = (a, b) => a + (b - a)*rnd();
    const pappe = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
      x.fillStyle = '#b08a5a'; x.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '90,60,30' : '210,180,130'},0.12)`; x.fillRect(Math.random()*128, Math.random()*128, 2, 1); }
      x.fillStyle = 'rgba(205,170,110,0.85)'; x.fillRect(54, 0, 20, 128);                                  // Klebeband
      x.fillStyle = '#f1efe8'; x.fillRect(14, 84, 30, 20); x.fillStyle = 'rgba(30,30,30,0.6)'; for (let i = 0; i < 3; i++) x.fillRect(17, 88 + i*5, 22 - i*5, 2);   // Etikett
      x.strokeStyle = 'rgba(40,30,20,0.6)'; x.lineWidth = 3; x.beginPath(); x.moveTo(100, 30); x.lineTo(100, 12); x.moveTo(94, 18); x.lineTo(100, 12); x.lineTo(106, 18); x.stroke();   // Pfeil „oben“
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const M = (opt) => [new THREE.MeshLambertMaterial({color:opt.color ?? 0xffffff, map:opt.map || null}), new THREE.MeshStandardMaterial({color:0xffffff, roughness:0.85, metalness:0, ...opt})];
    const karton = M({map:pappe}), kartonDunkel = M({map:pappe, color:0xd8cfc0}), koffer = M({color:0x2b2d30, roughness:0.45}), alu = M({color:0xb9bdc2, roughness:0.35, metalness:0.7});
    const add = (geo, m, x, y, z, ry = 0, rx = 0, rz = 0) => { const n = netz(THREE, geo, m); n.position.set(x, y, z); n.rotation.set(rx, ry, rz); g.add(n); return n; };
    const tiefe = o.tiefe || 0.55;
    let x = o.x0;
    while (x < o.x1 - 0.25) {
      const w = Math.min(zw(0.35, 0.6), o.x1 - x), d = Math.min(zw(0.3, 0.45), tiefe - 0.03);
      if (rnd() < 0.2) {                                                   // Gerätekoffer, hochkant an der Wand
        const h = zw(0.4, 0.55), b = Math.min(w, 0.45);
        add(new RBG(b, h, 0.16, 1, 0.02), koffer, x + b/2, h/2, o.wand + 0.09, zw(-0.05, 0.05));
        add(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 8), alu, x + b/2, h + 0.012, o.wand + 0.09, 0, 0, Math.PI/2);
        x += b + 0.04; continue; }
      let y = 0; const n = 1 + Math.floor(rnd()*3);
      for (let k = 0; k < n; k++) {                                         // Stapel aus 1 bis 3 Kartons, nach oben kleiner und schiefer
        const ww = w*zw(0.8, 1.0)*(1 - k*0.08), dd = d*zw(0.85, 1.0), h = zw(0.22, 0.4);
        const offen = k === n - 1 && rnd() < 0.3;
        const kb = add(new RBG(ww, h, dd, 1, 0.006), rnd() < 0.5 ? karton : kartonDunkel, x + w/2 + zw(-0.03, 0.03), y + h/2, o.wand + dd/2 + 0.02 + zw(0, 0.04), zw(-0.12, 0.12));
        if (offen) for (const sgn of [-1, 1]) {                             // offene Deckelklappen
          const k2 = add(new THREE.BoxGeometry(ww*0.98, 0.004, dd*0.5), karton, 0, 0, 0);
          k2.position.set(kb.position.x, y + h + 0.06, kb.position.z + sgn*dd*0.42); k2.rotation.set(sgn*1.1, kb.rotation.y, 0); }
        y += h; if (offen) break; }
      x += w + zw(0.02, 0.08); }
    // zusammengefaltete Kartons, schräg an die Wand gelehnt
    for (let k = 0; k < 3; k++) add(new THREE.BoxGeometry(zw(0.5, 0.8), zw(0.6, 0.9), 0.006), karton, o.x1 - 0.25 + k*0.03, 0.38, o.wand + 0.08 + k*0.015, zw(-0.05, 0.05), -0.18 - k*0.03);
    return g;
  }

  // ---------- Belebter, aber ordentlicher Schreibtisch: wenige Dinge, je Tisch verschieden ----------
  // Fläche und frei wie bei unordnung; auswahl: Anzahl der Dinge (Standard 3 bis 5)
  function belebt(THREE, o){
    const RBG = window.DETAIL.RoundedBoxGeometry, g = new THREE.Group(), Y = o.y;
    let s = o.seed || 5; const rnd = () => (s = (s*16807) % 2147483647)/2147483647, zw = (a, b) => a + (b - a)*rnd(), wahl = a => a[Math.floor(rnd()*a.length)];
    const mp = (color, opt = {}) => [new THREE.MeshLambertMaterial({color, map:opt.map || null, emissive:opt.emissive || 0}),
                                     new THREE.MeshStandardMaterial({color, roughness:0.6, metalness:0, ...opt})];
    const add = (geo, m, x, y, z, ry = 0, rx = 0, rz = 0, p = g) => { const n = netz(THREE, geo, m); n.position.set(x, y, z); n.rotation.set(rx, ry, rz); p.add(n); return n; };
    const frei = o.frei || [], belegt = [];
    const platz = (w, d) => { for (let v = 0; v < 40; v++) { const x = zw(o.x0 + w/2 + 0.03, o.x1 - w/2 - 0.03), z = zw(o.z0 + d/2 + 0.03, o.z1 - d/2 - 0.03);
        const r = [x - w/2, x + w/2, z - d/2, z + d/2], ueber = q => r[0] < q[1] && r[1] > q[0] && r[2] < q[3] && r[3] > q[2];
        if (!frei.some(ueber) && !belegt.some(ueber)) { belegt.push(r); return [x, z]; } } return null; };
    const teil = (fn, w, d) => { const p = platz(w, d); if (!p) return; const t = new THREE.Group(); t.position.set(p[0], Y, p[1]); t.rotation.y = zw(-0.5, 0.5); g.add(t); fn(t); };
    const dinge = {
      tasse: t => { const m = mp(wahl([0xffffff, 0xf2f2f2, 0x1f4fa8, 0xd94a2a, 0x2f7d3a]), {roughness:0.3});
        add(new THREE.CylinderGeometry(0.04, 0.036, 0.095, 18, 1, true), m, 0, 0.048, 0, 0, 0, 0, t); add(new THREE.CylinderGeometry(0.036, 0.036, 0.006, 18), m, 0, 0.003, 0, 0, 0, 0, t);
        add(new THREE.TorusGeometry(0.025, 0.007, 8, 14, Math.PI), m, 0.04, 0.05, 0, 0, 0, -Math.PI/2, t);
        if (rnd() < 0.6) add(new THREE.CylinderGeometry(0.037, 0.037, 0.002, 18), mp(0x2b1a10, {roughness:0.15}), 0, 0.07, 0, 0, 0, 0, t); },
      papier: t => { let y = 0; const n = 3 + Math.floor(rnd()*10); for (let i = 0; i < n; i++) { add(new THREE.BoxGeometry(0.21, 0.0012, 0.297), mp(0xf5f4ef, {roughness:0.9}), zw(-0.006, 0.006), y + 0.0006, zw(-0.006, 0.006), zw(-0.04, 0.04), 0, 0, t); y += 0.0012; } },
      buecher: t => { let y = 0; for (let i = 0; i < 1 + Math.floor(rnd()*3); i++) { const h = zw(0.02, 0.04);
          add(new RBG(zw(0.15, 0.2), h, zw(0.21, 0.25), 1, 0.003), mp(wahl([0x7a2e2e, 0x2e4a7a, 0x3d3d3d, 0xd6cfb8, 0x4f6b3a, 0xc9a227]), {roughness:0.7}), 0, y + h/2, 0, zw(-0.15, 0.15), 0, 0, t); y += h; } },
      laptop: t => { const gr = mp(0x3a3d42, {roughness:0.4, metalness:0.5});
        add(new RBG(0.33, 0.016, 0.23, 1, 0.005), gr, 0, 0.008, 0, 0, 0, 0, t);
        add(new THREE.BoxGeometry(0.29, 0.002, 0.1), mp(0x1b1c1f), 0, 0.017, 0.02, 0, 0, 0, t);                 // Tastatur
        const deckel = new THREE.Group(); deckel.position.set(0, 0.016, -0.112); deckel.rotation.x = -0.28; /* aufgeklappt, leicht nach hinten geneigt */ t.add(deckel);
        add(new RBG(0.33, 0.23, 0.008, 1, 0.004), gr, 0, 0.115, 0, 0, 0, 0, deckel);
        add(new THREE.PlaneGeometry(0.3, 0.19), mp(0x1d3557, {emissive:0x0d1a2e, roughness:0.2}), 0, 0.115, 0.0045, 0, 0, 0, deckel); },
      stifte: t => { const m = mp(wahl([0x222222, 0x8a8f96, 0x1f4fa8]), {roughness:0.4}); add(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 16, 1, true), m, 0, 0.05, 0, 0, 0, 0, t);
        add(new THREE.CylinderGeometry(0.035, 0.035, 0.004, 16), m, 0, 0.002, 0, 0, 0, 0, t);
        for (let i = 0; i < 4 + Math.floor(rnd()*4); i++) add(new THREE.CylinderGeometry(0.004, 0.004, 0.14, 6), mp(wahl([0x1f4fa8, 0xc0201a, 0x111111, 0x2f7d3a, 0xe0b000])),
          zw(-0.015, 0.015), 0.09, zw(-0.015, 0.015), 0, zw(-0.25, 0.25), zw(-0.25, 0.25), t); },
      block: t => { add(new RBG(0.15, 0.012, 0.21, 1, 0.002), mp(wahl([0xf4e27a, 0xffffff, 0xd8e8f8]), {roughness:0.9}), 0, 0.006, 0, 0, 0, 0, t);
        add(new THREE.CylinderGeometry(0.004, 0.004, 0.13, 6), mp(0x1f4fa8), 0.05, 0.016, 0.02, 0, Math.PI/2, 0.3, t); },
      pflanze: t => { add(new THREE.CylinderGeometry(0.055, 0.042, 0.1, 16), mp(wahl([0xb0573a, 0xf2f2ee, 0x3a3d42]), {roughness:0.7}), 0, 0.05, 0, 0, 0, 0, t);
        add(new THREE.CylinderGeometry(0.05, 0.05, 0.005, 16), mp(0x3a2a1c, {roughness:1}), 0, 0.098, 0, 0, 0, 0, t);
        const blatt = mp(0x3f8a3a, {roughness:0.6});
        for (let i = 0; i < 9; i++) { const a = i*2.4, l = zw(0.08, 0.15), b = add(new THREE.SphereGeometry(1, 8, 6), blatt, Math.cos(a)*0.02, 0.1 + l*0.45, Math.sin(a)*0.02, -a, 0, zw(0.25, 0.6), t);
          b.scale.set(0.018, l*0.55, 0.006); } },
    };
    const reihe = o.dinge || ['tasse', 'papier', 'buecher', 'laptop', 'stifte', 'block', 'pflanze'];
    const groesse = {tasse:[0.11, 0.1], papier:[0.24, 0.32], buecher:[0.24, 0.28], laptop:[0.36, 0.42], stifte:[0.09, 0.09], block:[0.18, 0.23], pflanze:[0.13, 0.13]};
    const n = o.anzahl || (3 + Math.floor(rnd()*3)), liste = reihe.slice();
    for (let i = 0; i < n && liste.length; i++) { const k = liste.splice(Math.floor(rnd()*liste.length), 1)[0]; teil(dinge[k], ...groesse[k]); }
    return g;
  }

  // ---------- Regalfach mit Ordnern, nicht ganz ordentlich ----------
  // Fach von x0 bis x1 auf Höhe y (Oberkante Fachboden), Rückwand bei z = wand, Ordner zeigen nach +z; hoehe = lichte Höhe
  function regalfach(THREE, o){
    const RBG = window.DETAIL.RoundedBoxGeometry, g = new THREE.Group();
    let s = o.seed || 3; const rnd = () => (s = (s*16807) % 2147483647)/2147483647, zw = (a, b) => a + (b - a)*rnd();
    const mp = (color, opt = {}) => [new THREE.MeshLambertMaterial({color}), new THREE.MeshStandardMaterial({color, roughness:0.5, metalness:0, ...opt})];
    const add = (geo, m, x, y, z, ry = 0, rx = 0, rz = 0) => { const n = netz(THREE, geo, m); n.position.set(x, y, z); n.rotation.set(rx, ry, rz); g.add(n); return n; };
    const farben = [0x1f4fa8, 0x1f4fa8, 0x1f4fa8, 0x2856b5, 0x17377a, 0xb32d2d, 0x222222, 0xf0f0ea, 0x2f7d3a], schild = mp(0xf4f3ee, {roughness:0.8});
    const H = Math.min(0.31, o.hoehe - 0.03), T = 0.28, Y = o.y, zc = o.wand + 0.16;
    let x = o.x0 + 0.01;
    const ordner = (b, kipp) => { const c = farben[Math.floor(rnd()*farben.length)], m = mp(c, {roughness:0.45});
      const xm = x + b/2 + (kipp ? Math.sin(Math.abs(kipp))*H*0.5 : 0);
      const n = add(new RBG(b, H, T, 1, 0.004), m, xm, Y + Math.cos(kipp)*H/2 + b/2*Math.abs(Math.sin(kipp)), zc + zw(-0.02, 0.02), zw(-0.04, 0.04), 0, kipp);
      const sch = add(new THREE.BoxGeometry(b*0.7, H*0.35, 0.002), schild, 0, 0, 0); n.add(sch); g.remove(sch); sch.position.set(0, H*0.12, T/2 + 0.001);
      if (rnd() < 0.8) { const r = add(new THREE.TorusGeometry(b*0.22, 0.004, 6, 12), mp(0x111111), 0, 0, 0); n.add(r); g.remove(r); r.position.set(0, -H*0.25, T/2 + 0.001); } };
    while (x < o.x1 - 0.05) {
      const r = rnd();
      if (r < 0.06 && o.x1 - x > 0.2) { x += zw(0.06, 0.14); continue; }                                 // Lücke
      if (r < 0.14 && o.x1 - x > 0.4) { let y = Y; for (let k = 0; k < 2 + Math.floor(rnd()*3); k++) { const h = zw(0.05, 0.075);        // liegender Stapel
          add(new RBG(0.31, h, T, 1, 0.004), mp(farben[Math.floor(rnd()*farben.length)], {roughness:0.45}), x + 0.17 + zw(-0.015, 0.015), y + h/2, zc, zw(-0.08, 0.08)); y += h; }
        x += 0.36; continue; }
      if (r < 0.2 && o.x1 - x > 0.15) {                                                                     // Stehsammler mit Heften
        const m = mp(0x2b2d30, {roughness:0.6}); add(new RBG(0.1, H*0.8, T*0.9, 1, 0.004), m, x + 0.05, Y + H*0.4, zc);
        for (let k = 0; k < 4; k++) add(new THREE.BoxGeometry(0.004, H*0.75, T*0.8), mp(farben[Math.floor(rnd()*farben.length)]), x + 0.02 + k*0.02, Y + H*0.45 + 0.02, zc + 0.01, 0, 0, zw(-0.05, 0.05));
        x += 0.12; continue; }
      if (r < 0.26 && o.x1 - x > 0.3) {                                                                     // kleiner Karton
        const w = zw(0.22, 0.3), h = Math.min(H*0.8, zw(0.15, 0.25)); add(new RBG(w, h, T, 1, 0.004), mp(0xb08a5a, {roughness:0.85}), x + w/2, Y + h/2, zc, zw(-0.1, 0.1)); x += w + 0.02; continue; }
      const b = rnd() < 0.7 ? 0.075 : 0.05;
      if (r < 0.34 && x > o.x0 + 0.1) { ordner(b, zw(0.15, 0.32)); x += b + Math.sin(0.3)*H; continue; }     // schräg angelehnt
      ordner(b, zw(-0.02, 0.02)); x += b + zw(0.0, 0.006); }
    return g;
  }

  // Papierkorb (schwarzer Kunststoff, leicht konisch); voll: Papierknäuel quellen heraus, einer liegt daneben
  function muelleimer(THREE, o = {}){
    const g = new THREE.Group(), m = klasse(o.mat || [new THREE.MeshLambertMaterial({color:0x1d1e20}), new THREE.MeshStandardMaterial({color:0x1d1e20, roughness:0.45})], 'kunststoff');
    let s = o.seed || 9; const rnd = () => (s = (s*16807) % 2147483647)/2147483647, zw = (a, b) => a + (b - a)*rnd();
    const add = (geo, mm, x, y, z) => { const n = netz(THREE, geo, mm); n.position.set(x, y, z); g.add(n); return n; };
    const eimer = new THREE.CylinderGeometry(0.15, 0.125, 0.33, 24, 1, true); add(eimer, m, 0, 0.165, 0).material.side = THREE.DoubleSide;
    add(new THREE.CylinderGeometry(0.125, 0.125, 0.008, 24), m, 0, 0.004, 0);
    add(new THREE.TorusGeometry(0.15, 0.006, 6, 28), m, 0, 0.33, 0).rotation.x = Math.PI/2;
    const papier = [new THREE.MeshLambertMaterial({color:0xf4f3ee}), new THREE.MeshStandardMaterial({color:0xf4f3ee, roughness:0.95})];
    const knaeuel = (x, y, z, r) => { const geo = new THREE.IcosahedronGeometry(r, 1), q = geo.attributes.position;
      for (let i = 0; i < q.count; i++) { const f = zw(0.7, 1.15); q.setXYZ(i, q.getX(i)*f, q.getY(i)*f, q.getZ(i)*f); } geo.computeVertexNormals(); add(geo, papier, x, y, z).rotation.set(zw(0, 6), zw(0, 6), 0); };
    const n = o.voll ? 14 : 5;
    for (let i = 0; i < n; i++) { const a = zw(0, 6.28), r = zw(0, 0.085), h = o.voll ? zw(0.12, 0.36) : zw(0.04, 0.2); knaeuel(Math.cos(a)*r, h, Math.sin(a)*r, zw(0.035, 0.05)); }
    if (o.voll) knaeuel(0.24, 0.035, 0.06, 0.04);
    return g;
  }

  // Umgekippte Tasse: Kaffee läuft über den Tisch bis zur Kante (z = kante, Tisch liegt bei z > kante), tropft hinunter
  // und bildet auf dem Boden (Höhe 0) eine Pfütze mit Spritzern. x, z: Lage der Tasse, y: Tischhöhe.
  function kaffeeunfall(THREE, o){
    const g = new THREE.Group(); let s = o.seed || 4; const rnd = () => (s = (s*16807) % 2147483647)/2147483647, zw = (a, b) => a + (b - a)*rnd();
    const kaffee = [new THREE.MeshLambertMaterial({color:0x24130a}), new THREE.MeshStandardMaterial({color:0x24130a, roughness:0.06, metalness:0, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2})];
    const tasseM = klasse([new THREE.MeshLambertMaterial({color:0xf2f2ee}), new THREE.MeshStandardMaterial({color:0xf2f2ee, roughness:0.25})], 'kunststoff');
    const add = (geo, m, x, y, z) => { const n = netz(THREE, geo, m); n.position.set(x, y, z); g.add(n); return n; };
    // unregelmäßige, flache Pfütze (Umriss mit Ausbuchtungen), liegt waagrecht
    // zmin: Pfütze endet an der Tischkante
    const pfuetze = (x, y, z, rx, rz, zipfel = null, zmin = -1e9) => { const sh = new THREE.Shape(), n = 40, p1 = zw(0, 6), p2 = zw(0, 6), a2 = zw(0.05, 0.15);   // weicher Rand: zwei langsame Wellen je Pfütze
      for (let i = 0; i <= n; i++) { const a = i/n*Math.PI*2, w = 1 + 0.18*Math.sin(a*2 + p1) + a2*Math.sin(a*5 + p2); let px = Math.cos(a)*rx*w, pz = Math.sin(a)*rz*w;
        if (zipfel && Math.cos(a - zipfel[0]) > 0.75) { const f = (Math.cos(a - zipfel[0]) - 0.75)/0.25; px += Math.cos(zipfel[0])*zipfel[1]*f; pz += Math.sin(zipfel[0])*zipfel[1]*f; }
        pz = Math.max(pz, zmin - z); i ? sh.lineTo(px, -pz) : sh.moveTo(px, -pz); }
      const m = add(new THREE.ShapeGeometry(sh, 2), kaffee, x, y, z); m.rotation.x = -Math.PI/2; return m; };
    const kz = o.kante, Y = o.y;
    // Tasse liegt auf der Seite, Öffnung zur Kante hin
    const t = new THREE.Group(); t.position.set(o.x, Y + 0.037, o.z); t.rotation.set(Math.PI/2, 0, zw(-0.4, 0.4)); g.add(t);
    const k = netz(THREE, new THREE.CylinderGeometry(0.04, 0.036, 0.095, 18, 1, true), tasseM); k.material.side = THREE.DoubleSide; t.add(k);
    const b = netz(THREE, new THREE.CylinderGeometry(0.036, 0.036, 0.006, 18), tasseM); b.position.y = 0.045; t.add(b);           // Boden (zur Rückseite)
    const h = netz(THREE, new THREE.TorusGeometry(0.025, 0.007, 8, 14, Math.PI), tasseM); h.position.set(0.04, 0, 0); h.rotation.z = -Math.PI/2; t.add(h);
    // Pfütze auf dem Tisch von der Tasse bis zur Kante, Rinnsal über die Kante, Tropfen, Pfütze auf dem Boden
    const lang = o.z - kz;
    pfuetze(o.x + zw(-0.02, 0.02), Y + 0.0012, (o.z + kz)/2, 0.07, lang/2 + 0.02, [-Math.PI/2, 0.04], kz + 0.002);
    pfuetze(o.x + zw(-0.08, 0.08), Y + 0.0012, o.z + 0.02, 0.06, 0.05, null, kz + 0.002);
    add(new THREE.BoxGeometry(0.035, 0.03, 0.002), kaffee, o.x, Y - 0.015, kz - 0.001);                        // über die Tischkante gelaufen
    for (let i = 0; i < 3; i++) add(new THREE.SphereGeometry(0.004, 8, 6), kaffee, o.x + zw(-0.012, 0.012), Y - 0.032 - i*0.012, kz - 0.002);
    pfuetze(o.x + zw(-0.03, 0.03), 0.009, kz - 0.09, 0.16, 0.11);     // knapp über dem Raumboden (der liegt bei 4 mm)
    for (let i = 0; i < 6; i++) { const a = zw(0, 6.28), r = zw(0.2, 0.3); pfuetze(o.x + Math.cos(a)*r, 0.009, kz - 0.09 + Math.sin(a)*r*0.7, zw(0.008, 0.02), zw(0.008, 0.02)); }
    return g;
  }

  // ---------- Getränkelager (Raum 015): gestapelte Kästen, leere Flaschen überall ----------
  // Sorten: Wasser (0,75 l, hellblau, blaue Kästen), Cola (0,33 l Glas, gelbe Kästen), Bier (Licher, 0,5 l braun, grüne Kästen)
  const SORTEN = {
    wasser: {kasten:0x2a62b0, flasche:0xb9d6e2, glanz:0.08, nx:4, nz:3, w:0.40, d:0.30, h:0.30, profil:[[0.0, 0], [0.04, 0], [0.042, 0.02], [0.042, 0.2], [0.03, 0.25], [0.014, 0.28], [0.014, 0.3], [0.0, 0.3]]},
    cola:   {kasten:0xe8b400, flasche:0xc9d6cf, glanz:0.05, nx:6, nz:4, w:0.40, d:0.27, h:0.22, profil:[[0.0, 0], [0.029, 0], [0.03, 0.015], [0.027, 0.06], [0.031, 0.11], [0.022, 0.16], [0.012, 0.19], [0.012, 0.205], [0.0, 0.205]]},
    bier:   {kasten:0x1f7a3a, flasche:0x5a2e0e, glanz:0.1, nx:5, nz:4, w:0.40, d:0.30, h:0.28, profil:[[0.0, 0], [0.033, 0], [0.034, 0.015], [0.034, 0.16], [0.026, 0.2], [0.014, 0.235], [0.014, 0.255], [0.0, 0.255]]},
  };
  function getraenkelager(THREE, o){
    const g = new THREE.Group(); let s = o.seed || 15; const rnd = () => (s = (s*16807) % 2147483647)/2147483647, zw = (a, b) => a + (b - a)*rnd();
    const mats = {}, M = (c, r, m = 0) => mats[c + ':' + r] || (mats[c + ':' + r] = klasse([new THREE.MeshLambertMaterial({color:c}), new THREE.MeshStandardMaterial({color:c, roughness:r, metalness:m})], 'kunststoff'));
    const geos = {}, flaschenGeo = k => geos[k] || (geos[k] = new THREE.LatheGeometry(SORTEN[k].profil.map(([r, y]) => new THREE.Vector2(r, y)), 8));
    const add = (geo, m, x, y, z, ry = 0, p = g) => { const n = netz(THREE, geo, m); n.position.set(x, y, z); n.rotation.y = ry; p.add(n); return n; };
    const flasche = (k, x, y, z, p = g, liegend = false) => { const f = add(flaschenGeo(k), M(SORTEN[k].flasche, SORTEN[k].glanz), x, y, z, zw(0, 6.3), p);
      if (liegend) { f.rotation.set(Math.PI/2, zw(0, 6.3), 0, 'YXZ'); f.position.y = y + 0.035; } return f; };
    // Kasten: Boden, vier Wände mit Griffmulden-Balken, Fächerraster; voll: Flaschen in jedem Fach (einzelne fehlen)
    const kasten = (k, x, y, z, ry, voll) => { const S = SORTEN[k], t = new THREE.Group(); t.position.set(x, y, z); t.rotation.y = ry; g.add(t);
      const m = M(S.kasten, 0.5), W = 0.012;
      add(new THREE.BoxGeometry(S.w, 0.01, S.d), m, 0, 0.005, 0, 0, t);
      for (const sz of [-1, 1]) add(new THREE.BoxGeometry(S.w, S.h, W), m, 0, S.h/2, sz*(S.d/2 - W/2), 0, t);
      for (const sx of [-1, 1]) { add(new THREE.BoxGeometry(W, S.h*0.72, S.d), m, sx*(S.w/2 - W/2), S.h*0.36, 0, 0, t);
        add(new THREE.BoxGeometry(W, S.h*0.12, S.d), m, sx*(S.w/2 - W/2), S.h*0.94, 0, 0, t); }               // Griffloch zwischen den beiden Teilen
      for (let i = 1; i < S.nx; i++) add(new THREE.BoxGeometry(0.004, S.h*0.5, S.d - 2*W), m, -S.w/2 + i*S.w/S.nx, S.h*0.25, 0, 0, t);
      for (let j = 1; j < S.nz; j++) add(new THREE.BoxGeometry(S.w - 2*W, S.h*0.5, 0.004), m, 0, S.h*0.25, -S.d/2 + j*S.d/S.nz, 0, t);
      if (voll) for (let i = 0; i < S.nx; i++) for (let j = 0; j < S.nz; j++) if (rnd() > 0.12)
        flasche(k, -S.w/2 + (i + 0.5)*S.w/S.nx, 0.01, -S.d/2 + (j + 0.5)*S.d/S.nz, t);
      return S.h; };
    const sorte = () => { const r = rnd(); return r < 0.45 ? 'wasser' : r < 0.72 ? 'bier' : 'cola'; };
    // Stapel entlang der Wände: o.reihen = [[x0, z0, x1, z1, ry], ...] (Stellfläche als Linie, ry: Drehung der Kästen)
    for (const [ax, az, bx, bz, ry] of o.reihen) { const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax)/L, uz = (bz - az)/L;
      let u = 0.02;
      while (u < L - 0.3) { const k = sorte(), S = SORTEN[k], n = 1 + Math.floor(rnd()*5), breit = Math.abs(Math.cos(ry)) > 0.5 ? S.w : S.d;
        if (u + breit > L) break;
        const cx = ax + ux*(u + breit/2), cz = az + uz*(u + breit/2); let y = 0;
        for (let i = 0; i < n; i++) { const kk = i === 0 || rnd() < 0.7 ? k : sorte();                                  // Stapel meist sortenrein
          y += kasten(kk, cx + zw(-0.02, 0.02), y, cz + zw(-0.02, 0.02), ry + zw(-0.05, 0.05), i === n - 1 ? rnd() < 0.85 : false) + 0.003; }
        // leere Flaschen obendrauf, die nicht mehr in die Kästen gepasst haben
        if (rnd() < 0.45) { const oben = y - 0.003;                                     // auf dem Rand des obersten Kastens: stehend in einer Lücke oder quer liegend
          for (let i = 0; i < 2 + Math.floor(rnd()*4); i++) flasche(sorte(), cx + zw(-0.14, 0.14), oben - (rnd() < 0.5 ? 0.18 : 0), cz + zw(-0.08, 0.08), g, rnd() < 0.4); }
        u += breit + zw(0.0, 0.05); } }
    // Reihen leerer Flaschen am Boden vor den Stapeln, ein paar umgekippt
    for (const [ax, az, bx, bz] of o.flaschen || []) { const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax)/L, uz = (bz - az)/L;
      for (let u = 0.05; u < L - 0.05; u += zw(0.07, 0.11)) { if (rnd() < 0.15) continue;
        flasche(sorte(), ax + ux*u + zw(-0.015, 0.015), 0.004, az + uz*u + zw(-0.015, 0.015), g, rnd() < 0.08); } }
    for (let i = 0; i < (o.verstreut || 0); i++) flasche(sorte(), zw(o.x0, o.x1), 0.004, zw(o.z0, o.z1), g, true);
    return g;
  }

  return {buerostuhl, buegelgriff, unordnung, jacke, rucksack, kartons, belebt, regalfach, muelleimer, kaffeeunfall, getraenkelager, RoundedBoxGeometry:null};
})();

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

  // alle Quader in ein gemeinsames Netz (wenige Zeichenaufrufe)
  function quader(list){
    const pos = [], nor = [], uv = [], idx = [];
    for (const [x0, x1, y0, y1, z0, z1] of list) {
      const F = [[[1,0,0],[[x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1]]], [[-1,0,0],[[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0]]],
                 [[0,1,0],[[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0]]], [[0,-1,0],[[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]]],
                 [[0,0,1],[[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]]], [[0,0,-1],[[x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0]]]];
      for (const [n, v] of F) { const b = pos.length/3;
        for (const p of v) { pos.push(...p); nor.push(...n); uv.push(n[0] ? p[2] : p[0], n[1] ? p[2] : p[1]); }   // UV in Metern, je nach Flächenrichtung projiziert
        idx.push(b, b+1, b+2, b, b+2, b+3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    return g;
  }
  // Leicht selbstleuchtende Flächen, weil die Räume keine eigenen Lampen haben und die Decke kein Licht wirft
  const mats = (color, emissive) => [new THREE.MeshLambertMaterial({color, emissive}), new THREE.MeshStandardMaterial({color, emissive, roughness:0.95, metalness:0})];
  const mesh = (geo, m) => { const o = new THREE.Mesh(geo, m[1]); o.userData.mats = m; cadMeshes.push(o); scene.add(o); return o; };   // castShadow/receiveShadow bleiben aus
  // Wände wie in der Halle: weiß gestrichener, brettgeschalter Beton (Textur 'wand' aus cad/tex_lite.js, eine Kachel 1,3 m)
  let wandM = mats(0xefeee9, 0x2e2e2c);
  if (window.TEX && window.TEX.wand) {
    const t = new THREE.TextureLoader().load(window.TEX.wand); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping; t.repeat.set(1/1.3, 1/1.3);
    wandM = [new THREE.MeshLambertMaterial({color:0xf4f4f0, map:t, emissive:0x2e2e2c, emissiveMap:t}),
             new THREE.MeshStandardMaterial({color:0xf4f4f0, map:t, emissive:0x2e2e2c, emissiveMap:t, roughness:0.92, metalness:0})];
  }
  mesh(quader(R.walls.map(([x0, x1, z0, z1]) => [x0, x1, 0, HR, z0, z1])), wandM);
  mesh(quader(R.doors.map(([x0, x1, z0, z1, u]) => [x0, x1, u || 2.1, HR, z0, z1])), wandM);
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
  const decke = mesh(new THREE.PlaneGeometry(w, d), mats(0xe6e6e2, 0x9a9a96)); decke.rotation.x = Math.PI/2; decke.position.set((bx0+bx1)/2, HR, (bz0+bz1)/2);

  // Ostende von Flur 05 (vor 014): verglaste Tür nach draußen, Textur 'tuer05' aus dem Foto docs/fotos/tuer_flur05 (tools/tuertex.py).
  // Die Tür bleibt zu; die Tueranlage ist 2,7 m breit und sitzt rechts in der Ecke, wie auf dem Foto. Unbeleuchtet, damit das Tageslicht hell bleibt.
  if (window.TEX && window.TEX.tuer05) {
    const t = new THREE.TextureLoader().load(window.TEX.tuer05); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    const XW = 0.446, Z1 = 19.385, B = 2.7, Ht = 2.25;                       // Wandfläche (x) und rechte Ecke (z) aus raeume_data.js
    const tuer = new THREE.Mesh(new THREE.PlaneGeometry(B, Ht), new THREE.MeshBasicMaterial({map:t, toneMapped:false}));
    tuer.rotation.y = -Math.PI/2; tuer.position.set(XW - 0.005, Ht/2, Z1 - B/2); scene.add(tuer);
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

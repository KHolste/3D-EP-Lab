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
    const pos = [], nor = [], idx = [];
    for (const [x0, x1, y0, y1, z0, z1] of list) {
      const F = [[[1,0,0],[[x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1]]], [[-1,0,0],[[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0]]],
                 [[0,1,0],[[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0]]], [[0,-1,0],[[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]]],
                 [[0,0,1],[[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]]], [[0,0,-1],[[x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0]]]];
      for (const [n, v] of F) { const b = pos.length/3; for (const p of v) { pos.push(...p); nor.push(...n); } idx.push(b, b+1, b+2, b, b+2, b+3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx);
    return g;
  }
  // Hell gestrichene Wände; leicht selbstleuchtend, weil die Räume keine eigenen Lampen haben und die Decke kein Licht wirft
  const mats = (color, emissive) => [new THREE.MeshLambertMaterial({color, emissive}), new THREE.MeshStandardMaterial({color, emissive, roughness:0.95, metalness:0})];
  const mesh = (geo, m) => { const o = new THREE.Mesh(geo, m[1]); o.userData.mats = m; cadMeshes.push(o); scene.add(o); return o; };   // castShadow/receiveShadow bleiben aus
  const wandM = mats(0xefeee9, 0x2e2e2c);
  mesh(quader(R.walls.map(([x0, x1, z0, z1]) => [x0, x1, 0, HR, z0, z1])), wandM);
  mesh(quader(R.doors.map(([x0, x1, z0, z1, u]) => [x0, x1, u || 2.1, HR, z0, z1])), wandM);
  for (const [x0, x1, z0, z1] of R.walls) cols.push({x0, x1, z0, z1, y0:-1, y1:HR});

  // Boden (grauer Belag) und Decke über das ganze Gebäude neben der Halle
  const [bx0, bx1, bz0, bz1] = R.floor, w = bx1-bx0, d = bz1-bz0;
  const boden = mesh(new THREE.PlaneGeometry(w, d), mats(0x8f8a80, 0x141412)); boden.rotation.x = -Math.PI/2; boden.position.set((bx0+bx1)/2, 0.002, (bz0+bz1)/2);
  const decke = mesh(new THREE.PlaneGeometry(w, d), mats(0xe6e6e2, 0x9a9a96)); decke.rotation.x = Math.PI/2; decke.position.set((bx0+bx1)/2, HR, (bz0+bz1)/2);

  // Raumnummern auf dem Boden, lesbar beim Blick von der Halle aus (nach +z, im Plan: nach links)
  for (const [nr, [x, z]] of Object.entries(R.labels)) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const g = cv.getContext('2d');
    g.fillStyle = 'rgba(245,245,240,0.9)'; g.font = 'bold 84px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(nr, 128, 68);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9), new THREE.MeshBasicMaterial({map:t, transparent:true, depthWrite:false}));
    m.rotation.set(-Math.PI/2, 0, Math.PI); m.position.set(x + 0.3, 0.01, z - 0.6); scene.add(m);
  }
};

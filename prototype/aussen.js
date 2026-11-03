/* Umgebung vor den Fenstern der Westseite (Raum 06 u. a.): Rasen, Hecke, ein paar Bäume, das Nachbargebäude in etwa 15 m
   Abstand (Fassade aus dem Fensterfoto) und ein bedeckter Himmel. Durch die Fensteröffnungen sieht man so echte Tiefe:
   Beim Gehen verschieben sich Hecke, Bäume und Fassade gegeneinander.
   Texturen: cad/tex_aussen.js (tools/aussentex.py). Aufruf nach dem Bau der Räume: window.baueAussen(THREE, scene).
   Alles hier ist als userData.dynamisch markiert: kein vorberechnetes Licht (draußen gibt es keine Raumlampen),
   stattdessen Tageslicht in Echtzeit (Hallensonne und Himmelslicht wirken außerhalb der Räume). */
window.baueAussen = function(THREE, scene){
  const T = window.TEX_AUSSEN; if (!T) return;
  const XA = -15.86, XF = XA - 15, YB = -0.15, Z0 = -25, Z1 = 90;      // Außenkante unserer Wand, Fassade gegenüber, Geländehöhe, Ausdehnung längs
  const g = new THREE.Group(); g.userData.dynamisch = true; scene.add(g);
  const tex = (k, rx, ry, spiegeln) => { const t = new THREE.TextureLoader().load(T[k]); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    t.wrapS = spiegeln ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); return t; };
  const M = (o) => new THREE.MeshStandardMaterial({roughness:0.9, metalness:0, ...o});
  let s = 12345; const rnd = () => (s = (s*16807) % 2147483647)/2147483647, zw = (a, b) => a + (b - a)*rnd();

  // Rasen zwischen den Gebäuden, schmaler Kiesstreifen an unserer Wand
  const L = Z1 - Z0;
  { const m = new THREE.Mesh(new THREE.PlaneGeometry(XA - XF + 12, L), M({map:tex('rasen', (XA - XF + 12)/1.6, L/1.6), color:0x9aa585, roughness:1}));
    m.rotation.x = -Math.PI/2; m.position.set((XA + XF - 12)/2, YB, (Z0 + Z1)/2); g.add(m);
    const k = new THREE.Mesh(new THREE.PlaneGeometry(0.6, L), M({color:0x9a958c, roughness:1})); k.rotation.x = -Math.PI/2; k.position.set(XA - 0.3, YB + 0.01, (Z0 + Z1)/2); g.add(k); }

  // Nachbargebäude: Fassade aus dem Foto (4,9 m x 8,5 m je Kachel, gespiegelt gekachelt), Attika obendrauf
  { const H = 8.5, D = 14, grau = M({color:0xb9bcbf}), fassade = M({map:tex('fassade', L/4.9, 1, true), roughness:0.7});
    const b = new THREE.Mesh(new THREE.BoxGeometry(D, H, L), [fassade, grau, grau, grau, grau, grau]); b.position.set(XF - D/2, YB + H/2, (Z0 + Z1)/2); g.add(b);
    const a = new THREE.Mesh(new THREE.BoxGeometry(D + 0.3, 0.45, L + 0.3), M({color:0x8d9196, roughness:0.6, metalness:0.3})); a.position.set(XF - D/2 + 0.1, YB + H + 0.22, (Z0 + Z1)/2); g.add(a);
    const sockel = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.35, L), M({color:0x6f7276})); sockel.position.set(XF + 0.05, YB + 0.17, (Z0 + Z1)/2); g.add(sockel); }

  // Hecke: Abschnitte mit Lücken, etwa 4 m vor der Fassade, Laub aus dem Foto
  { let z = Z0 + zw(0, 3); const x = XF + 4.5;
    while (z < Z1 - 2) { const l = zw(6, 13), h = zw(1.0, 1.25), d = zw(0.9, 1.2);
      const t = tex('hecke', l/3, 1), m = M({map:t, color:0x7f9070, roughness:1});
      const geo = new THREE.BoxGeometry(d, h, l, 2, 3, Math.max(2, Math.round(l))), p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > 0) { p.setY(i, y + zw(-0.08, 0.08)); p.setX(i, p.getX(i)*zw(0.8, 1.0)); } else p.setX(i, p.getX(i)*zw(0.95, 1.05)); }   // unregelmäßiger Wuchs, oben runder
      geo.computeVertexNormals();
      const he = new THREE.Mesh(geo, m); he.position.set(x + zw(-0.3, 0.3), YB + h/2, z + l/2); g.add(he);
      z += l + zw(1.5, 4); } }

  // Bäume: Stamm, unregelmäßige Krone aus mehreren Kugeln, Herbstlaub wie auf dem Foto
  { const stamm = M({color:0x5a4a3c}), laub = [0x66733a, 0x84762f, 0x56682f, 0x8f6f2a].map(c => M({color:c, roughness:0.95}));
    const klumpen = r => { const geo = new THREE.IcosahedronGeometry(r, 2), p = geo.attributes.position;          // Laubballen mit unruhiger Oberfläche
      for (let i = 0; i < p.count; i++) { const f = 1 + 0.18*Math.sin(p.getX(i)*9 + p.getY(i)*7) * Math.cos(p.getZ(i)*8) + zw(-0.06, 0.06); p.setXYZ(i, p.getX(i)*f, p.getY(i)*f, p.getZ(i)*f); }
      geo.computeVertexNormals(); return geo; };
    for (const [x, z] of [[XF + 2.5, 2], [XF + 7, 21], [XF + 2.2, 44], [XF + 8, 63], [XF + 3, 80]]) {
      const h = zw(4.5, 7), st = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, h*0.6, 8), stamm); st.position.set(x, YB + h*0.3, z); g.add(st);
      for (let k = 0; k < 14; k++) { const r = zw(0.55, 1.1), kr = new THREE.Mesh(klumpen(r), laub[k % 4]);
        kr.position.set(x + zw(-1.3, 1.3), YB + h*0.55 + zw(0, h*0.45), z + zw(-1.3, 1.3)); kr.scale.y = zw(0.75, 1.0); g.add(kr); }
      for (let k = 0; k < 4; k++) { const a = zw(0, 6.28), ast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, 1.4, 6), stamm);   // Äste
        ast.position.set(x + Math.cos(a)*0.4, YB + h*0.55, z + Math.sin(a)*0.4); ast.rotation.set(Math.sin(a)*0.7, 0, -Math.cos(a)*0.7); g.add(ast); } } }

  // Himmel: bedeckt, heller zum Horizont; folgt der Kamera (bleibt so immer innerhalb der Sichtweite)
  { const c = document.createElement('canvas'); c.width = 4; c.height = 256; const x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#aeb9c4'); gr.addColorStop(0.45, '#d7dde2'); gr.addColorStop(0.5, '#e4e7e9'); gr.addColorStop(1, '#c8ccc8'); x.fillStyle = gr; x.fillRect(0, 0, 4, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const h = new THREE.Mesh(new THREE.SphereGeometry(70, 24, 12), new THREE.MeshBasicMaterial({map:t, side:THREE.BackSide, depthWrite:false, toneMapped:false, fog:false}));
    h.renderOrder = -10; h.frustumCulled = false;
    h.onBeforeRender = (r, sc, cam) => { h.position.copy(cam.position); h.updateMatrixWorld(); };
    g.add(h); }
  g.traverse(o => { if (o.isMesh) { o.userData.dynamisch = true; o.receiveShadow = false; o.castShadow = false; } });
};

/* Umgebung vor den Fenstern. Westseite (Raum 06 u. a.): Rasen, Hecke, ein paar Bäume, das Nachbargebäude in etwa 15 m
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

  // ================= Ostseite (Glastür am Ende von Flur 05, Fenster der Alten Schreinerei 019) =================
  // Vor der Tür: gepflasterter Weg mit Rinne, Rasen mit Bordsteinen, Bauzaun, in etwa 8 m eine Sichtbetonwand mit Vordach und Gebäude darüber.
  // Vor 019 (weiter südlich): eine Stützmauer gut 1 m vor den hochliegenden Fenstern, dahinter das höhere Gelände mit Pflanzen,
  // einem geparkten weißen Auto und einem Gebäude mit Lamellenfassade.
  { const XO = 0.82, ZT = 17.95, XB = XO + 8, ZS = 30, YO = 2.3;           // Außenkante, Türmitte, Betonwand gegenüber, Beginn der Stützmauer, Höhe oben
    const canvas = (w, h, fn, rx, ry) => { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 8; return t; };
    const rauschen = (x, w, h, n, a) => { for (let i = 0; i < n; i++) { const v = Math.random(); x.fillStyle = `rgba(${v < 0.5 ? '0,0,0' : '255,255,255'},${a*Math.random()})`; x.fillRect(Math.random()*w, Math.random()*h, 1 + Math.random()*3, 1 + Math.random()*3); } };
    // Gelände unten (Rasen) vor unserer Ostwand bis zur Betonwand
    { const w = XB - XO, l = ZS - Z0, m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), M({map:tex('rasen', w/1.6, l/1.6), color:0x9aa585, roughness:1}));
      m.rotation.x = -Math.PI/2; m.position.set((XO + XB)/2, YB, (Z0 + ZS)/2); g.add(m); }
    // Weg: Betonpflaster im Läuferverband (20 x 10 cm), Bordsteine, Entwässerungsrinne quer
    { const pfl = canvas(256, 256, (x, w, h) => { x.fillStyle = '#8e8e8a'; x.fillRect(0, 0, w, h);
        for (let r = 0; r < 16; r++) for (let k = -1; k < 9; k++) { const v = 128 + Math.floor(Math.random()*30); x.fillStyle = `rgb(${v},${v},${v - 4})`;
          x.fillRect(k*32 + (r % 2)*16 + 1, r*16 + 1, 30, 14); }
        rauschen(x, w, h, 3000, 0.12); }, 1, 1);
      const B = 1.7, w = XB - 1.2 - XO; pfl.repeat.set(w/1.6, B/1.6);
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, B), M({map:pfl, roughness:0.95})); p.rotation.x = -Math.PI/2; p.position.set(XO + w/2, YB + 0.012, ZT); g.add(p);
      for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, 0.1), M({color:0x6e6f6c})); b.position.set(XO + w/2, YB + 0.03, ZT + s*(B/2 + 0.05)); g.add(b); }
      const ri = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.015, B), M({color:0x3d3f40, roughness:0.4, metalness:0.6})); ri.position.set(XO + 2.6, YB + 0.015, ZT); g.add(ri);
      for (let i = 0; i < 9; i++) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.018, B - 0.04), M({color:0x222324, metalness:0.6})); st.position.set(XO + 2.54 + i*0.015, YB + 0.02, ZT); g.add(st); }
      for (let i = 0; i < 30; i++) { const bl = new THREE.Mesh(new THREE.CircleGeometry(zw(0.02, 0.04), 5), M({color:[0x8a5a2a, 0xa8762e, 0x6a4a28][i % 3]}));   // Laub
        bl.rotation.set(-Math.PI/2, 0, zw(0, 6)); bl.position.set(zw(XO + 0.3, XB - 1.5), YB + 0.02, ZT + zw(-1.2, 1.2)); g.add(bl); } }
    // Sichtbetonwand gegenüber: Schalungsfugen, Ankerlöcher; Vordach (dunkle Unterseite mit Lamellen), Gebäude darüber
    { const sb = canvas(512, 256, (x, w, h) => { x.fillStyle = '#c9cccd'; x.fillRect(0, 0, w, h); rauschen(x, w, h, 6000, 0.08);
        x.strokeStyle = 'rgba(80,85,90,0.35)'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, h/2); x.lineTo(w, h/2); x.moveTo(w/2, 0); x.lineTo(w/2, h); x.stroke();
        x.fillStyle = 'rgba(70,75,80,0.6)'; for (const yy of [h*0.25, h*0.75]) for (let k = 0; k < 4; k++) { x.beginPath(); x.arc(w*(0.125 + k*0.25), yy, 4, 0, 7); x.fill(); } }, 1, 1);
      const L2 = ZS - Z0, H = 3.2; sb.repeat.set(L2/2.4, H/1.2);
      const wand = new THREE.Mesh(new THREE.BoxGeometry(0.4, H, L2), [M({color:0xb5b8ba}), M({map:sb, roughness:0.85}), M({color:0xb5b8ba}), M({color:0xb5b8ba}), M({color:0xb5b8ba}), M({color:0xb5b8ba})]);
      wand.position.set(XB + 0.2, YB + H/2, (Z0 + ZS)/2); g.add(wand);
      const lam = canvas(64, 64, (x, w, h) => { x.fillStyle = '#3a3e44'; x.fillRect(0, 0, w, h); x.fillStyle = '#5a6068'; for (let i = 0; i < 8; i++) x.fillRect(0, i*8, w, 3); }, L2/0.6, 1.5);
      const dach = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.35, L2), [M({color:0x2e3236}), M({color:0x2e3236}), M({color:0x4a4f55}), M({map:lam, roughness:0.6, metalness:0.4}), M({color:0x2e3236}), M({color:0x2e3236})]);
      dach.position.set(XB - 0.9, YB + H + 0.17, (Z0 + ZS)/2); g.add(dach);
      for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.12), new THREE.MeshBasicMaterial({color:0xf2f2ea})); l.position.set(XB - 0.9, YB + H - 0.02, ZT - 3 + i*3); g.add(l); }
      const fas = canvas(256, 256, (x, w, h) => { x.fillStyle = '#d4d6d6'; x.fillRect(0, 0, w, h); rauschen(x, w, h, 3000, 0.06);
        x.fillStyle = '#5a6570'; x.fillRect(0, h*0.3, w, h*0.32); x.fillStyle = 'rgba(200,210,220,0.5)'; for (let i = 0; i < 12; i++) x.fillRect(0, h*0.3 + i*7, w, 2); }, L2/3.5, 2);
      const geb = new THREE.Mesh(new THREE.BoxGeometry(12, 6, L2), [M({color:0xc4c6c7}), M({map:fas, roughness:0.7}), M({color:0xa8abad}), M({color:0xa8abad}), M({color:0xc4c6c7}), M({color:0xc4c6c7})]);
      geb.position.set(XB + 6.5, YB + H + 3, (Z0 + ZS)/2); g.add(geb); }
    // Bauzaun: Mobilzaun-Elemente aus Kunststoff (weiß, senkrechte Streben), daneben ein rot-weißes Absperrgitter
    { const weiss = M({color:0xe8eaea, roughness:0.6}), rot = M({color:0xc4201c, roughness:0.5});
      const element = (x, z, rz, farbig) => { const e = new THREE.Group(); e.position.set(x, YB, z); e.rotation.y = rz; g.add(e);
        const add = (w, h, d, px, py, pz, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(px, py, pz); e.add(b); };
        add(0.05, 0.06, 2.0, 0, 1.0, 0, weiss); add(0.05, 0.06, 2.0, 0, 0.12, 0, weiss); add(0.04, 0.05, 2.0, 0, 0.6, 0, weiss);
        for (let i = 0; i < 17; i++) add(0.03, 0.85, 0.035, 0, 0.56, -0.95 + i*0.119, farbig && (i % 4 < 2) ? rot : weiss);
        for (const s of [-1, 1]) { add(0.06, 1.1, 0.06, 0, 0.55, s*1.0, weiss); add(0.5, 0.08, 0.14, 0, 0.04, s*0.98, M({color:0x3a3c3e})); } };
      for (let i = 0; i < 6; i++) element(XB - 1.6 + zw(-0.05, 0.05), ZT - 5 + i*2.05, zw(-0.04, 0.04), false);
      element(XB - 1.3, ZT + 4.3, 0.4, true); }
    // Gelände oben: Erdblock mit Stützmauer (Beton aus dem Fensterfoto) zur Seite der 019, Rasen oben
    { const L3 = Z1 - ZS, D = 18, xm = XO + 1.3 + D/2, mauer = M({map:tex('stuetzmauer', L3/3, (YO - YB)/1.6, true), roughness:0.95});
      const grau = M({color:0x8e9090}), oben = M({map:tex('rasen', D/1.6, L3/1.6), color:0x9aa585, roughness:1});
      const e = new THREE.Mesh(new THREE.BoxGeometry(D, YO - YB, L3), [grau, mauer, oben, grau, grau, M({map:tex('stuetzmauer', D/3, (YO - YB)/1.6, true), roughness:0.95})]);
      e.position.set(xm, (YO + YB)/2, (ZS + Z1)/2); g.add(e);
      const k = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, L3), M({color:0x9a9c9c})); k.position.set(XO + 1.45, YO + 0.04, (ZS + Z1)/2); g.add(k);   // Mauerkrone
      // Pflanzen und Sträucher auf der Mauerkante, ein geparktes weißes Auto, Gebäude mit Lamellenfassade
      const laub = [0x5f7a34, 0x7c8f3a, 0x8a8a32].map(c => M({color:c, roughness:0.95}));
      for (let i = 0; i < 26; i++) { const r = zw(0.2, 0.55), geo = new THREE.IcosahedronGeometry(r, 2), q = geo.attributes.position;
        for (let j = 0; j < q.count; j++) { const f = 1 + 0.15*Math.sin(q.getX(j)*14 + q.getZ(j)*11) + zw(-0.05, 0.05); q.setXYZ(j, q.getX(j)*f, q.getY(j)*f*1.3, q.getZ(j)*f); } geo.computeVertexNormals();
        const b = new THREE.Mesh(geo, laub[i % 3]); b.position.set(XO + zw(1.6, 3.2), YO + r*0.8, zw(ZS + 1, Z1 - 2)); g.add(b); }
      const auto = new THREE.Group(); auto.position.set(XO + 4.4, YO, 41.5); g.add(auto);
      const lack = M({color:0xeceeee, roughness:0.25, metalness:0.4}), glas = M({color:0x2a3138, roughness:0.05, metalness:0.2}), reifen = M({color:0x1a1a1a});
      const RB = window.DETAIL && window.DETAIL.RoundedBoxGeometry;
      const kb = (w, h, d, r) => RB ? new RB(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d);
      const ka = new THREE.Mesh(kb(1.8, 0.75, 4.3, 0.18), lack); ka.position.y = 0.6; auto.add(ka);
      const ob = new THREE.Mesh(kb(1.55, 0.55, 2.3, 0.2), glas); ob.position.set(0, 1.18, -0.15); auto.add(ob);
      const dachA = new THREE.Mesh(kb(1.5, 0.08, 1.8, 0.04), lack); dachA.position.set(0, 1.47, -0.2); auto.add(dachA);
      for (const [x, z] of [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.4], [0.85, -1.4]]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 16), reifen); r.rotation.z = Math.PI/2; r.position.set(x, 0.32, z); auto.add(r); }
      const lam = canvas(64, 64, (x, w, h) => { x.fillStyle = '#4a5058'; x.fillRect(0, 0, w, h); x.fillStyle = '#8a9098'; for (let i = 0; i < 8; i++) x.fillRect(0, i*8, w, 3); }, L3/0.8, 7/0.5);
      const geb = new THREE.Mesh(new THREE.BoxGeometry(10, 7, L3), [M({color:0x9aa0a6}), M({map:lam, roughness:0.5, metalness:0.5}), M({color:0x7a8086}), M({color:0x7a8086}), M({color:0x9aa0a6}), M({color:0x9aa0a6})]);
      geb.position.set(XO + 12 + 5, YO + 3.5, (ZS + Z1)/2); g.add(geb); }
  }

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

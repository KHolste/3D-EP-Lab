/* Nerf-Gun (Gag): liegt im Doktorandenzimmer 06 auf einem Schreibtisch. Mit E aufnehmen, danach:
   linke Maustaste (oder X) = schießen, rechte Maustaste halten (oder C) = anlegen, F = ziehen/wegstecken.
   Schaumstoffpfeile fliegen mit Schwerkraft, prallen an Wänden ab oder bleiben mit dem Saugnapf kleben und lassen sich
   durch Drüberlaufen wieder einsammeln. Getroffene Kollegen wackeln kurz und sagen etwas.
   Aufruf: const NERF = window.nerfGun({THREE, scene, camera, handG, cols, groundAt, hit, def, msg, P, ac, figuren}) */
window.nerfGun = function(c){
  const {THREE, scene, camera, handG, cols, P} = c;
  const MAX = 6, TISCH = {x:-13.3, y:0.755, z:11.3};      // Platz auf dem zweiten Tisch der Gruppe A in Raum 06

  /* ---- Modell ---- */
  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({color, roughness:0.5, metalness:0, ...o});
  const BLAU = mat(0x1f6fd1), ORANGE = mat(0xff7a00), GRAU = mat(0x9aa0a6), DUNKEL = mat(0x2a2d31), GELB = mat(0xf2d21b);
  const SCHAUM = mat(0x2b8cff, {roughness:0.95}), SPITZE = mat(0xff7a00, {roughness:0.85});
  const Box = (w, h, d) => new THREE.BoxGeometry(w, h, d), Zyl = (r1, r2, h, s = 16) => new THREE.CylinderGeometry(r1, r2, h, s);
  const teil = (geo, m, p, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz);
    o.castShadow = o.receiveShadow = false; o.frustumCulled = false; p.add(o); return o; };
  const H = Math.PI/2;
  // Blaster: Lauf zeigt nach -z, Kimme oben bei y = 0.077
  function baueGun(){
    const g = new THREE.Group(), t = {};
    teil(Box(0.046, 0.062, 0.2), BLAU, g, 0, 0, -0.02);                                   // Gehäuse
    teil(Box(0.03, 0.04, 0.06), BLAU, g, 0, 0.004, 0.1);                                  // Schaft-Stummel
    teil(Box(0.05, 0.012, 0.16), GRAU, g, 0, -0.03, -0.03);                               // Unterseite
    t.slide = teil(Box(0.036, 0.02, 0.11), GRAU, g, 0, 0.04, -0.005);                    // Spannschlitten
    for (let k = 0; k < 4; k++) teil(Box(0.038, 0.004, 0.006), DUNKEL, t.slide, 0, 0.011, -0.04 + k*0.014);   // Rillen
    teil(Zyl(0.013, 0.013, 0.13), BLAU, g, 0, 0.005, -0.17, H);                           // Lauf
    teil(Zyl(0.017, 0.017, 0.02), ORANGE, g, 0, 0.005, -0.235, H);                        // orange Mündung
    t.drum = new THREE.Group(); t.drum.position.set(0, 0.005, -0.08); g.add(t.drum);       // Trommel mit 6 Kammern
    teil(Zyl(0.033, 0.033, 0.07, 18), GELB, t.drum, 0, 0, 0, H);
    t.tips = [];
    for (let k = 0; k < MAX; k++) { const a = k*Math.PI/3, x = Math.sin(a)*0.021, y = Math.cos(a)*0.021;
      teil(Zyl(0.0072, 0.0072, 0.002, 10), DUNKEL, t.drum, x, y, -0.0355, H);
      t.tips.push(teil(Zyl(0.0066, 0.0066, 0.004, 10), SPITZE, t.drum, x, y, -0.037, H)); }
    teil(Box(0.034, 0.1, 0.045), DUNKEL, g, 0, -0.072, 0.055, -0.3);                      // Griff
    teil(new THREE.TorusGeometry(0.022, 0.004, 6, 14, Math.PI), ORANGE, g, 0, -0.03, 0.005, 0, H, Math.PI);   // Abzugsbügel
    teil(Box(0.007, 0.024, 0.008), ORANGE, g, 0, -0.04, 0.008, 0.3);                      // Abzug
    teil(Box(0.005, 0.02, 0.005), GRAU, g, 0, 0.058, 0.05); teil(new THREE.TorusGeometry(0.009, 0.0018, 6, 18), ORANGE, g, 0, 0.077, 0.05);   // Kimme (Ring)
    teil(Box(0.004, 0.026, 0.004), ORANGE, g, 0, 0.064, -0.12);                            // Korn
    teil(Box(0.047, 0.012, 0.03), ORANGE, g, 0, 0.012, 0.045);                            // Zierstreifen
    g.userData.dynamisch = true; g.userData.t = t; return g;
  }
  function baueDart(){
    const g = new THREE.Group();
    teil(Zyl(0.0065, 0.0065, 0.06, 10), SCHAUM, g, 0, 0, 0);
    teil(Zyl(0.0085, 0.0066, 0.008, 12), SPITZE, g, 0, 0.034, 0);                          // Saugnapf vorne (+y)
    g.userData.dynamisch = true; return g;
  }

  // Blaster in der Hand (an der Kamera) und auf dem Tisch
  const gun = baueGun(), T = gun.userData.t; gun.visible = false; camera.add(gun);
  const tischGun = baueGun(); tischGun.position.set(TISCH.x, TISCH.y + 0.034, TISCH.z); tischGun.rotation.set(0, 2.2, H); scene.add(tischGun);
  const schachtel = new THREE.Group(); schachtel.position.set(TISCH.x + 0.27, TISCH.y, TISCH.z - 0.1); schachtel.rotation.y = 0.3; scene.add(schachtel); schachtel.userData.dynamisch = true;
  teil(Box(0.13, 0.05, 0.08), mat(0xc69a5b, {roughness:0.9}), schachtel, 0, 0.025, 0); teil(Box(0.131, 0.012, 0.081), ORANGE, schachtel, 0, 0.044, 0);
  for (let k = 0; k < 3; k++) { const d = baueDart(); d.rotation.set(H, 0, 0.4 + k*0.7); d.position.set(-0.12 - k*0.03, 0.008, 0.05 + k*0.04); schachtel.add(d); }
  c.hit('nerf', null, TISCH.x + 0.12, TISCH.y + 0.06, TISCH.z - 0.05, 0.5, 0.16, 0.35);

  /* ---- Ton (synthetisch wie die übrigen Geräusche) ---- */
  function ton(typ, f0, f1, dauer, vol){ const A = c.ac(); if (!A) return; const t = A.currentTime, o = A.createOscillator(), g = A.createGain();
    o.type = typ; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dauer);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dauer); o.connect(g).connect(A.destination); o.start(t); o.stop(t + dauer + 0.02); }
  function rausch(dauer, typ, f, vol){ const A = c.ac(); if (!A) return; const n = Math.floor(A.sampleRate*dauer), b = A.createBuffer(1, n, A.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random()*2 - 1)*Math.pow(1 - i/n, 3);
    const s = A.createBufferSource(), fl = A.createBiquadFilter(), g = A.createGain(); s.buffer = b; fl.type = typ; fl.frequency.value = f; g.gain.value = vol; s.connect(fl).connect(g).connect(A.destination); s.start(); }
  const SND = {
    plopp: () => { ton('sine', 260, 70, 0.1, 0.6); rausch(0.06, 'bandpass', 1300, 0.35); },
    spannen: () => { rausch(0.04, 'highpass', 2500, 0.15); setTimeout(() => rausch(0.04, 'highpass', 1800, 0.15), 120); },
    leer: () => rausch(0.025, 'highpass', 3500, 0.25),
    tock: () => ton('triangle', 720, 330, 0.07, 0.35),
    kleb: () => { ton('sine', 900, 1500, 0.05, 0.12); rausch(0.03, 'bandpass', 2000, 0.1); },
    tipp: () => ton('triangle', 1100, 600, 0.03, 0.12),
    nimm: () => ton('sine', 600, 900, 0.06, 0.15)};

  /* ---- Anzeige: Pfeile in der Trommel ---- */
  const hud = document.createElement('div'); hud.className = 'hud box';
  Object.assign(hud.style, {right:'18px', bottom:'18px', left:'auto', top:'auto', display:'none', fontSize:'15px', letterSpacing:'2px'});
  document.body.appendChild(hud); let hudTxt = '';
  const cross = document.getElementById('cross');

  /* ---- Figuren, die man treffen kann ---- */
  const SAETZE = {
    Udo: ['Ey! Die Nerf-Gun gehört ins Doktorandenzimmer!', 'Wenn du Zeit zum Rumballern hast, hast du auch Zeit zum Abpumpen.',
          'Ich zähl mit. Das gibt Kuchen-Schulden.', 'Treffer. Der Tankdruck sinkt davon trotzdem nicht.'],
    Anna: ['Hey! Ich bin am Arbeiten!', 'Das gibt Rache in der Mittagspause.', 'Netter Schuss. Und jetzt: Ventile.', 'Ist das nicht die Nerf-Gun aus der 06?'],
    Kalle: ['Aua! Also … eigentlich nicht aua. Aber trotzdem!', 'Gib her, ich zeig dir, wie man richtig zielt.',
            'Sammel die Pfeile bloß wieder ein, bevor einer im Tank landet!', 'Im Vakuum würde so ein Pfeil viel weiter fliegen. Kein Luftwiderstand.'],
    Doktorand: ['Hallo?! Hier drin arbeitet jemand!', 'Ich messe hier was ab, ja?'],
    'Yan Ravil': ['Hey! Ich lehne hier nur!', 'Schaumstoff im Flur? Das räumst du aber auf.', 'Zwei Treffer, dann schieß ich zurück.']};
  const figs = c.figuren.map(f => ({...f, w:0, last:-9, i:0}));

  /* ---- Zustand ---- */
  let has = false, drawn = false, adsZiel = false, adsK = 0, drawK = 0, ammo = MAX, schuss = 0, cool = 0, slideT = 0, kick = 0, drumA = 0;
  let bobPh = 0, lastX = P.x, lastZ = P.z, uhr = 0, leerHinweis = false, treffer = 0, fovAlt = camera.fov;
  const FOV = camera.fov, HUEFTE = new THREE.Vector3(0.17, -0.17, -0.45), ANGELEGT = new THREE.Vector3(0, -0.077, -0.36);
  const darts = [], v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);

  c.def('nerf', () => has ? 'Schaumstoffpfeile nachfüllen' : 'Nerf-Gun nehmen', () => {
    if (!has) { has = drawn = true; tischGun.visible = false; ammo = MAX; SND.spannen();
      c.msg('Eine Nerf-Gun! Linke Maustaste = schießen, rechte Maustaste = anlegen, F = wegstecken. Ohne Maus: X = schießen, C = anlegen.');
      c.msg('Verschossene Pfeile sammelst du ein, indem du drüberläufst. Nachschub gibt es hier in der Schachtel.'); return; }
    if (ammo >= MAX) return c.msg('Die Trommel ist schon voll.');
    ammo = MAX; leerHinweis = false; SND.spannen(); c.msg('Trommel nachgefüllt: ' + MAX + ' Pfeile.');
  });

  function schiessen(){
    if (!drawn || drawK < 0.8 || cool > 0 || handG.visible) return;
    if (ammo <= 0) { SND.leer(); cool = 0.25; if (!leerHinweis) { leerHinweis = true; c.msg('Trommel leer. Pfeile aufsammeln oder an der Schachtel in Raum 06 nachfüllen.'); } return; }
    ammo--; schuss++; cool = 0.38; slideT = 1; kick = 1; SND.plopp();
    camera.updateMatrixWorld(true);
    const p = gun.localToWorld(new THREE.Vector3(0, 0.005, -0.25));
    camera.getWorldDirection(v1); const ziel = camera.position.clone().addScaledVector(v1, 12);
    const streu = adsK > 0.7 ? 0.006 : 0.03;
    const dir = ziel.sub(p).normalize().add(new THREE.Vector3((Math.random() - 0.5)*streu, (Math.random() - 0.5)*streu, (Math.random() - 0.5)*streu)).normalize();
    const m = baueDart(); m.position.copy(p); scene.add(m);
    darts.push({m, p, alt:p.clone(), v:dir.multiplyScalar(16), zustand:'fliegt', t:0, getroffen:false});
    while (darts.length > 40) { const d = darts.shift(); scene.remove(d.m); }
    P.pitch += 0.008;                                                  // leichter Rückstoß
  }

  function trifft(f, d){
    treffer++; SND.tock(); f.w = 1; d.getroffen = true;
    d.v.set(-d.v.x*0.15, 0.6, -d.v.z*0.15);
    if (uhr - f.last > 1.2) { f.last = uhr; const s = SAETZE[f.name] || ['He!']; c.msg(f.name + ': „' + s[f.i++ % s.length] + '“'); }
    if (treffer % 10 === 0) c.msg(treffer + ' Treffer. Der Neutralisator wartet übrigens immer noch.');
  }

  // Pfeil landet flach auf einer Fläche
  function hinlegen(d, y){
    d.zustand = 'liegt'; d.p.y = y + 0.007; v1.set(d.v.x, 0, d.v.z); if (v1.lengthSq() < 1e-6) v1.set(1, 0, 0);
    v1.normalize().applyAxisAngle(Y, (Math.random() - 0.5)*0.8); d.m.quaternion.setFromUnitVectors(Y, v1); d.m.position.copy(d.p); SND.tipp();
  }

  function flug(d, dt){
    const n = Math.max(1, Math.ceil(d.v.length()*dt/0.04)), h = dt/n;
    for (let s = 0; s < n && d.zustand === 'fliegt'; s++) {
      d.alt.copy(d.p); d.v.y -= 9.81*0.7*h; d.v.multiplyScalar(1 - 0.3*h); d.p.addScaledVector(d.v, h);
      // Figuren
      if (!d.getroffen) for (const f of figs) { if (!f.g.visible) continue; f.g.getWorldPosition(v2);
        if (Math.hypot(d.p.x - v2.x, d.p.z - v2.z) < 0.28 && d.p.y > v2.y && d.p.y < v2.y + 1.85) { trifft(f, d); d.p.copy(d.alt); break; } }
      // Wände und Möbel (dieselben Kollisionsquader wie für den Spieler)
      for (const b of cols) {
        if (d.p.x <= b.x0 || d.p.x >= b.x1 || d.p.z <= b.z0 || d.p.z >= b.z1 || d.p.y <= b.y0 || d.p.y >= b.y1) continue;
        if (d.alt.y >= b.y1) { if (b.y1 > 1.2) { d.p.copy(d.alt); hinlegen(d, b.y1); } continue; }   // von oben: auf hohen Schränken liegen bleiben, sonst durchfallen
        const nx = d.alt.x <= b.x0 ? -1 : d.alt.x >= b.x1 ? 1 : 0, nz = nx ? 0 : (d.alt.z <= b.z0 ? -1 : d.alt.z >= b.z1 ? 1 : 0);
        d.p.copy(d.alt);
        if (d.v.length() > 7 && Math.random() < 0.45) { d.zustand = 'klebt'; SND.kleb(); break; }   // Saugnapf bleibt kleben
        if (nx) { d.v.x *= -0.25; d.v.z *= 0.5; } else if (nz) { d.v.z *= -0.25; d.v.x *= 0.5; } else d.v.multiplyScalar(-0.2);
        d.v.y *= 0.5; SND.tipp(); break;
      }
      if (d.zustand !== 'fliegt') break;
      // Boden
      const g = c.groundAt(d.p.x, d.p.z, d.alt.y - 0.6);
      if (g > -50 && d.p.y <= g + 0.007) { hinlegen(d, g); break; }
    }
    if (d.zustand === 'fliegt' || d.zustand === 'klebt') { d.m.position.copy(d.p); if (d.zustand === 'fliegt') d.m.quaternion.setFromUnitVectors(Y, v1.copy(d.v).normalize()); }
    if ((d.t += dt) > 8 && d.zustand === 'fliegt') d.zustand = 'weg';
  }

  function update(dt, live){
    if (!live) { adsZiel = false; return; }
    uhr += dt; cool -= dt;
    // Figuren wackeln nach einem Treffer
    for (const f of figs) if (f.w > 0) { f.w = Math.max(0, f.w - dt*1.6); f.g.rotation.z = Math.sin(f.w*30)*0.08*f.w; }
    // Pfeile
    for (let i = darts.length - 1; i >= 0; i--) { const d = darts[i];
      if (d.zustand === 'fliegt') flug(d, dt);
      if (d.zustand === 'weg') { scene.remove(d.m); darts.splice(i, 1); continue; }
      if (d.zustand !== 'fliegt' && has && ammo < MAX && Math.hypot(d.p.x - P.x, d.p.z - P.z) < 0.6 && d.p.y > P.feet - 0.3 && d.p.y < P.feet + 2.3) {
        scene.remove(d.m); darts.splice(i, 1); ammo++; leerHinweis = false; SND.nimm(); }
    }
    // Blaster in der Hand: ziehen, anlegen, wippen, Rückstoß
    drawK += ((drawn && !handG.visible ? 1 : 0) - drawK)*Math.min(1, dt*10);
    adsK += ((drawn && adsZiel && !handG.visible ? 1 : 0) - adsK)*Math.min(1, dt*12);
    const sp = Math.hypot(P.x - lastX, P.z - lastZ)/Math.max(dt, 1e-4); lastX = P.x; lastZ = P.z;
    bobPh += dt*Math.min(sp, 6)*2.3; const bob = Math.min(1, sp/3)*(1 - 0.85*adsK);
    kick = Math.max(0, kick - dt*7); slideT = Math.max(0, slideT - dt/0.3);
    gun.visible = drawK > 0.02;
    gun.position.lerpVectors(HUEFTE, ANGELEGT, adsK);
    gun.position.x += Math.sin(bobPh)*0.008*bob; gun.position.y += -Math.abs(Math.cos(bobPh))*0.008*bob - (1 - drawK)*0.25; gun.position.z += kick*0.035;
    gun.rotation.set(kick*0.15 - (1 - drawK)*0.7, 0.06*(1 - adsK), 0);
    T.slide.position.z = -0.005 + Math.sin(Math.PI*slideT)*0.035;
    drumA += (-schuss*Math.PI/3 - drumA)*Math.min(1, dt*18); T.drum.rotation.z = drumA;
    T.tips.forEach((m, k) => { m.visible = ((k - schuss%MAX + MAX) % MAX) < ammo; });
    // Zoom beim Anlegen, Fadenkreuz weicht der Kimme
    const fov = FOV - 24*adsK; if (Math.abs(fov - fovAlt) > 0.01) { camera.fov = fovAlt = fov; camera.updateProjectionMatrix(); }
    if (cross) cross.style.opacity = drawn ? String(1 - adsK) : '1';
    const txt = has ? 'Nerf ' + '●'.repeat(ammo) + '○'.repeat(MAX - ammo) : '';
    if (txt !== hudTxt) { hudTxt = txt; hud.textContent = txt; }
    hud.style.display = has && drawn ? 'block' : 'none';
  }

  return {
    update,
    // Tasten: true, wenn die Nerf-Gun die Taste verbraucht hat
    taste(code){
      if (!has) return false;
      if (code === 'KeyF') { drawn = !drawn; adsZiel = false; if (drawn) SND.spannen(); return true; }
      if (!drawn) return false;
      if (code === 'KeyX') { schiessen(); return true; }
      if (code === 'KeyC') { adsZiel = !adsZiel; return true; }
      return false;
    },
    // Maustasten: links schießen, rechts (gehalten) anlegen
    maus(knopf, runter){
      if (!has || !drawn) return false;
      if (knopf === 0) { if (runter) schiessen(); return true; }
      if (knopf === 2) { adsZiel = runter; return true; }
      return false;
    },
    empf: () => 1 - 0.55*adsK,                                     // Mausempfindlichkeit beim Anlegen geringer
    // für Screenshots (?nerf=1 in der Hand, ?nerf=2 angelegt)
    debug(n){ if (!n) return; has = drawn = true; tischGun.visible = false; adsZiel = n > 1; drawK = 1; adsK = adsZiel ? 1 : 0; update(0.016, true); }
  };
};

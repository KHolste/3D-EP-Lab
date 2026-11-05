/* Realistische Figuren (MakeHuman, cad/figuren_data.js, erzeugt von tools/figuren.py) für die Spielfiguren.
   Die bisherige Gliederpuppe aus figure() bleibt als unsichtbares Steuergerüst erhalten (Hüfte, Knie, Schulter, Ellbogen, Kopf,
   Körper); nach jedem pose() werden ihre Drehungen auf die Knochen des Modells übertragen.
   Aufruf: window.figurModell(THREE, GLTFLoader, g, 'udo') – g ist die Gruppe aus figure(); ersetzt deren Aussehen, sobald geladen. */
/* Eigene Hand des Spielers (Modell 'spielerarm': rechter Unterarm mit Hand und Hemdärmel).
   handG: Gruppe der bisherigen Hand (Finger zeigen nach -z, Handrücken nach +y, Unterarm auf +z). Das Modell wird so eingepasst,
   dass Handwurzel, Fingerrichtung und Handrücken übereinstimmen; danach steuert HAND (Krümmung c der Finger) die Fingerknochen.
   Liefert eine Funktion finger(kruemmung[4], daumen) oder null. */
window.spielerHand = function(THREE, GLTFLoader, handG, fertig){
  const F = window.FIGUREN && window.FIGUREN.spielerarm; if (!F) return;
  const roh = atob(F), u8 = new Uint8Array(roh.length); for (let i = 0; i < roh.length; i++) u8[i] = roh.charCodeAt(i);
  new GLTFLoader().parse(u8.buffer, '', gltf => {
    const m = gltf.scene, K = {}; m.traverse(o => { if (o.isBone) K[o.name] = o; if (o.isMesh) { o.frustumCulled = false; o.castShadow = false; } });
    if (!K.hand_r || !K.middle_01_r) return;
    m.updateMatrixWorld(true);
    const P = n => new THREE.Vector3().setFromMatrixPosition(K[n].matrixWorld);
    const hand = P('hand_r'), mitte = P('middle_01_r'), zeig = P('index_01_r'), klein = P('pinky_01_r');
    const vor = mitte.clone().sub(hand).normalize();                                     // Fingerrichtung
    const quer = zeig.clone().sub(klein).normalize();                                      // vom kleinen Finger zum Zeigefinger
    let ruecken = new THREE.Vector3().crossVectors(vor, quer).normalize();                 // Handrücken (rechte Hand: vor x quer)
    // Basis im Modell: X = quer zum Daumen hin gespiegelt passend (Daumen bei -x), Y = Rücken, Z = -vor
    const zA = vor.clone().negate(), yA = ruecken, xA = new THREE.Vector3().crossVectors(yA, zA).normalize();
    const B = new THREE.Matrix4().makeBasis(xA, yA, zA).setPosition(hand);               // Handkoordinaten im Modellraum
    const halter = new THREE.Group(); halter.add(m); m.applyMatrix4(B.clone().invert()); handG.add(halter);
    handG.children.forEach(c => { if (c !== halter) c.visible = false; });              // alte Kugel-Hand ausblenden
    // Fingerknochen: Ruhelage und Beugeachse (Handkoordinaten-x) im eigenen Knochenraum
    halter.updateMatrixWorld(true); handG.updateMatrixWorld(true);
    const qw = new THREE.Quaternion(), hq = new THREE.Quaternion(); handG.getWorldQuaternion(hq);
    const xHand = new THREE.Vector3(1, 0, 0).applyQuaternion(hq);
    const glied = n => { const b = K[n]; b.getWorldQuaternion(qw); return {b, rest:b.quaternion.clone(), achse:xHand.clone().applyQuaternion(qw.clone().invert()).normalize()}; };
    const finger = ['index', 'middle', 'ring', 'pinky'].map(f => [1, 2, 3].map(k => glied(`${f}_0${k}_r`)));
    const daumen = [2, 3].map(k => glied(`thumb_0${k}_r`));
    const q = new THREE.Quaternion();
    fertig((winkel, dWinkel) => {
      finger.forEach((js, i) => js.forEach((j, k) => j.b.quaternion.copy(j.rest).multiply(q.setFromAxisAngle(j.achse, -winkel[i][k]))));
      daumen.forEach(j => j.b.quaternion.copy(j.rest).multiply(q.setFromAxisAngle(j.achse, -dWinkel)));
    });
  }, err => console.warn('Spielerarm:', err));
};

window.figurModell = function(THREE, GLTFLoader, g, name){
  const F = window.FIGUREN && window.FIGUREN[name]; if (!F) return false;
  const roh = atob(F), u8 = new Uint8Array(roh.length); for (let i = 0; i < roh.length; i++) u8[i] = roh.charCodeAt(i);
  new GLTFLoader().parse(u8.buffer, '', gltf => {
    const r = g.userData.rig, body = r.body, m = gltf.scene;
    g.add(m);
    m.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; o.frustumCulled = false;
      const mt = o.material; if (mt.transparent || mt.alphaTest) { mt.alphaTest = mt.alphaTest || 0.5; mt.transparent = false; mt.depthWrite = true; } } });   // Brauen, Wimpern
    body.traverse(o => { if (o.isMesh) o.visible = false; });                     // Gliederpuppe ausblenden
    const knochen = {}; m.traverse(o => { if (o.isBone) knochen[o.name] = o; });
    // Ruhelage merken: Drehung des Elternknochens relativ zur Figur, eigene Ausgangsdrehung
    const gq = new THREE.Quaternion(), pq = new THREE.Quaternion(), V = new THREE.Vector3(), W = new THREE.Vector3();
    g.updateMatrixWorld(true); g.getWorldQuaternion(gq); const gqi = gq.clone().invert();
    // Drehungen relativ zum Modell (m): Ruhelage jedes Knochens; gesteuerte Knochen bekommen eine Gesamtdrehung D (im Modellraum),
    // aus der die lokale Drehung relativ zum (ggf. ebenfalls gedrehten) Elternknochen berechnet wird
    const mqi = new THREE.Quaternion(); m.getWorldQuaternion(mqi); mqi.invert();
    const restM = new Map(); m.traverse(o => { if (o.isBone) { o.getWorldQuaternion(pq); restM.set(o, mqi.clone().multiply(pq)); } });
    // Arme aus der A-Haltung des Modells an den Körper holen: Oberarm zeigt dann senkrecht nach unten, leicht nach außen
    const grund = {};
    for (const [n, s] of [['upperarm_l', 1], ['upperarm_r', -1]]) { const b = knochen[n], c = knochen[n.replace('upper', 'lower')]; if (!b || !c) continue;
      b.getWorldPosition(V); c.getWorldPosition(W); const dir = W.sub(V).applyQuaternion(mqi).normalize();
      grund[n] = new THREE.Quaternion().setFromUnitVectors(dir, new THREE.Vector3(s*0.1, -1, 0.02).normalize());
      // Unterarm: im Modell schon angewinkelt; eigene Grunddrehung, damit er gestreckt in Verlängerung des Oberarms hängt
      const h = knochen[n.replace('upperarm', 'hand')]; if (h) { c.getWorldPosition(V); h.getWorldPosition(W); const d2 = W.sub(V).applyQuaternion(mqi).normalize();
        grund[n.replace('upper', 'lower')] = new THREE.Quaternion().setFromUnitVectors(d2, new THREE.Vector3(s*0.1, -1, 0.02).normalize());
        // Hand: Handgelenk gerade richten (Mittelfinger-Grundgelenk in Verlängerung des Unterarms)
        const mf = knochen[n.replace('upperarm', 'middle_01')]; if (mf) { h.getWorldPosition(V); mf.getWorldPosition(W); const d3 = W.sub(V).applyQuaternion(mqi).normalize();
          const unten = new THREE.Vector3(s*0.1, -1, 0.02).normalize(), gH = new THREE.Quaternion().setFromUnitVectors(d3, unten);
          // Handfläche zum Oberschenkel drehen (Drehung um die Armachse); der Unterarm dreht halb mit, damit die Haut am Handgelenk nicht verdrillt
          const ix = knochen[n.replace('upperarm', 'index_01')], pk = knochen[n.replace('upperarm', 'pinky_01')];
          if (ix && pk) { ix.getWorldPosition(V); pk.getWorldPosition(W); const quer = V.clone().sub(W).applyQuaternion(mqi).normalize();
            const flaeche = s < 0 ? quer.clone().cross(d3) : d3.clone().cross(quer);          // Handfläche (rechte Hand: Querachse x Fingerrichtung)
            const proj = v => v.sub(unten.clone().multiplyScalar(v.dot(unten))).normalize();
            const ist = proj(flaeche.applyQuaternion(gH)), soll = proj(new THREE.Vector3(-s, 0, 0.25));
            const dreh = new THREE.Quaternion().setFromUnitVectors(ist, soll);
            gH.premultiply(dreh); grund[n.replace('upper', 'lower')].premultiply(new THREE.Quaternion().slerp(dreh, 0.5)); }
          grund[n.replace('upperarm', 'hand')] = gH; } } }
    // Fingerkrümmung: Drehachse quer über die Fingergrundgelenke (Zeigefinger -> kleiner Finger), so gerichtet,
    // dass ein positiver Winkel die Finger zur Handfläche krümmt (rechte Hand: Handrücken = Fingerrichtung x Querachse)
    const fingerAchse = {}, FINGER = ['index', 'middle', 'ring', 'pinky'];
    for (const s of ['l', 'r']) { const ix = knochen['index_01_' + s], pk = knochen['pinky_01_' + s]; if (!ix || !pk) continue;
      ix.getWorldPosition(V); pk.getWorldPosition(W); const quer = V.clone().sub(W).applyQuaternion(mqi).normalize();
      fingerAchse[s] = s === 'r' ? quer : quer.negate(); }
    // Die ganze Kette wird gesteuert: Becken -> Wirbelsäule -> Hals -> Kopf, Schlüsselbein -> Arm -> Hand -> Finger, Bein -> Fuß.
    // Jede Drehung A ist eine Gesamtdrehung im Modellraum; ein Kind setzt die Drehung seines Elternteils fort (A_kind = A_eltern * eigene).
    // Zusätzliche Kanäle (Becken, Wirbelsäule, Füße, Hände, Finger ...) stehen in rig.x und werden in pose() berechnet.
    const I = new THREE.Quaternion(), e = new THREE.Euler(), neu = new Map(), C = new THREE.Quaternion();
    const E = (x, y, z) => new THREE.Quaternion().setFromEuler(e.set(x || 0, y || 0, z || 0, 'YXZ'));
    const mal = (...qs) => { const r = qs[0].clone(); for (let k = 1; k < qs.length; k++) r.multiply(qs[k]); return r; };
    const setz = (b, A) => { if (!b) return; const ziel = A.clone().multiply(restM.get(b)), eltern = neu.get(b.parent) || restM.get(b.parent);
      neu.set(b, ziel); b.quaternion.copy(eltern).invert().multiply(ziel); };
    g.userData.sync = () => {
      const X = r.x || {}, v = (a, i) => (a ? a[i] || 0 : 0);
      m.position.copy(body.position); m.rotation.copy(body.rotation); neu.clear();
      const Ap = E(X.pX, X.pY, X.pZ); setz(knochen.pelvis, Ap);
      const A1 = mal(Ap, E(X.s1X, X.sY, X.sZ)); setz(knochen.spine_01, A1);
      const A2 = mal(A1, E(X.s2X, X.sY, X.sZ)); setz(knochen.spine_02, A2);
      const A3 = mal(A2, E(X.s3X, X.sY, 0)); setz(knochen.spine_03, A3);
      const An = mal(A3, E(X.nX, X.nY, 0)); setz(knochen.neck_01, An);
      setz(knochen.head, mal(An, E(r.head.rotation.x, r.head.rotation.y, 0)));
      for (const i of [0, 1]) { const s = i ? 'l' : 'r', sg = i ? 1 : -1, gr = grund['upperarm_' + s] || I, grL = grund['lowerarm_' + s] || gr, grH = grund['hand_' + s] || grL;   // Index 0 = rechte Seite (x < 0)
        const Ac = mal(A3, E(0, 0, sg*v(X.clav, i))); setz(knochen['clavicle_' + s], Ac);
        const Aa = mal(Ac, E(r.arm[i].rotation.x, r.arm[i].rotation.y, sg*v(X.abd, i))); setz(knochen['upperarm_' + s], mal(Aa, gr));
        const Ae = mal(Aa, E(r.elbow[i].rotation.x, 0, 0), E(0, v(X.dreh, i)*sg, 0));   // erst um die eigene Achse drehen, dann beugen setz(knochen['lowerarm_' + s], mal(Ae, grL));
        const Aw = mal(Ae, E(v(X.hand, i), 0, sg*v(X.hz, i)), grH); setz(knochen['hand_' + s], Aw);
        const ax = fingerAchse[s], k = v(X.curl, i);
        if (ax) { C.setFromAxisAngle(ax, k); for (const f of FINGER) { let F = Aw; for (const n of [1, 2, 3]) { F = mal(F, C); setz(knochen[f + '_0' + n + '_' + s], F); } } }
        const At = mal(Ap, E(r.leg[i].rotation.x, X.legY, X.legZ)); setz(knochen['thigh_' + s], At);
        const Ak = mal(At, E(r.knee[i].rotation.x, 0, 0)); setz(knochen['calf_' + s], Ak);
        setz(knochen['foot_' + s], mal(Ak, E(v(X.foot, i), 0, 0))); }
    };
    g.userData.sync();
    if (g.userData.onModell) { g.updateMatrixWorld(true); g.userData.onModell(knochen); }   // z. B. Gegenstand in die Hand geben
  }, err => console.warn('Figur ' + name + ':', err));
  return true;
};

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
      grund[n] = new THREE.Quaternion().setFromUnitVectors(dir, new THREE.Vector3(s*0.1, -1, 0.02).normalize()); }
    // Ketten: [Knochen, Liste der Gelenke des Steuergerüsts, deren Drehungen sich aufsummieren (außen zuerst), Grunddrehung]
    const K = [];
    for (const i of [0, 1]) { const s = i ? 'l' : 'r';           // Index 0 liegt bei x < 0: das ist die rechte Körperseite (Blick nach +z)
      K.push([knochen['thigh_' + s], [r.leg[i]], null], [knochen['calf_' + s], [r.leg[i], r.knee[i]], null],
             [knochen['upperarm_' + s], [r.arm[i]], grund['upperarm_' + s]], [knochen['lowerarm_' + s], [r.arm[i], r.elbow[i]], grund['upperarm_' + s]]); }
    K.push([knochen.head, [r.head], null]);
    const KK = K.filter(k => k[0]), neu = new Map(), q = new THREE.Quaternion(), D = new THREE.Quaternion(), e = new THREE.Euler();
    g.userData.sync = () => {
      m.position.copy(body.position); m.rotation.copy(body.rotation); neu.clear();
      for (const [b, gelenke, gr] of KK) {
        D.identity(); for (const j of gelenke) { e.set(j.rotation.x, j.rotation.y, 0, 'YXZ'); D.multiply(q.setFromEuler(e)); }
        if (gr) D.multiply(gr);
        const ziel = D.clone().multiply(restM.get(b)), eltern = neu.get(b.parent) || restM.get(b.parent);
        neu.set(b, ziel); b.quaternion.copy(eltern).invert().multiply(ziel); }
    };
    g.userData.sync();
    if (g.userData.onModell) { g.updateMatrixWorld(true); g.userData.onModell(knochen); }   // z. B. Gegenstand in die Hand geben
  }, err => console.warn('Figur ' + name + ':', err));
  return true;
};

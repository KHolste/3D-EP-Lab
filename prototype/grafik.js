/* Licht und Nachbearbeitung für die 3D-Varianten (jumbo3d_lite.html, jumbo3d_cad.html).

   1) Raumlicht: Jede Deckenleuchte in den Nachbarräumen (cad/raeume_data.js, raeume.js) wird zu einem Lichtpunkt.
      Weil viele Punktlichter teuer sind, gibt es nur einen kleinen Vorrat an Lampen, der jeweils an die Leuchten
      in der Nähe der Kamera wandert.
   2) Räume trennen: Aus dem Grundriss entsteht eine Raumkarte (eine Nummer je 10-cm-Zelle). Ein Licht wirkt nur in
      seinem eigenen Raum (sonst schiene es durch die Wände), und die „Sonne“ der Halle wirkt nur in der Halle.
      Dafür werden die Licht-Shader aller Materialien an einer Stelle erweitert (onBeforeCompile).
      Die Raumnummer des Lichts steckt in den letzten Stellen von light.decay (2.0001 = Raum 1); decay = 2 heißt:
      gewöhnliches Licht ohne Raumbindung.
   3) Nachbearbeitung (nur Stufe „sehr hoch“): Umgebungsverdeckung (GTAO, dunkle Ecken und Kontaktschatten),
      leichtes Überstrahlen heller Lampen (Bloom), Kantenglättung über Mehrfachabtastung.

   Einbinden als gewöhnliches Skript (läuft so auch beim direkten Öffnen der HTML-Datei ohne Server).
   4) Zusammenfassen: Unbewegliche Teile der Räume werden je Raum und Material zu einem Objekt verschmolzen
      (aus etwa 1500 Einzelteilen werden wenige hundert; jedes Einzelteil kostet einen Zeichenbefehl pro Bild).
   Stufen: 0 niedrig (wie früher), 1 mittel und 2 hoch (wenige Raumlampen), 3 sehr hoch (mehr Lampen, Schatten, Nachbearbeitung).
   Aufruf: const G = grafik(THREE, renderer, scene, camera, {EffectComposer, RenderPass, GTAOPass, UnrealBloomPass, OutputPass, mergeGeometries});
   nach dem Bau der Räume G.raeume(neueObjekte, cadMeshes); G.setQuality(q) aus applyQuality, G.resize() bei Größenänderung,
   G.render() statt renderer.render. */
window.grafik = function(THREE, renderer, scene, camera, {EffectComposer, RenderPass, GTAOPass, UnrealBloomPass, OutputPass, mergeGeometries}){
  // ---------- Raumkarte ----------
  const R = window.RAEUME, CELL = 0.1;
  const X0 = R ? R.floor[0] : 0, Z0 = R ? R.floor[2] : 0;
  const NX = R ? Math.ceil((R.floor[1] - X0)/CELL) : 1, NZ = R ? Math.ceil((R.floor[3] - Z0)/CELL) : 1;
  const ids = new Uint8Array(NX*NZ);           // 0 = frei (noch ohne Nummer), 255 = Wand/Türöffnung (jedes Raumlicht darf hin, die Sonne nicht)
  const flaeche = [0];                          // Fläche je Raumnummer in Zellen
  if (R) {
    const sperre = ([x0, x1, z0, z1]) => { for (let j = Math.max(0, Math.floor((z0 - Z0)/CELL)); j < Math.min(NZ, Math.ceil((z1 - Z0)/CELL)); j++)
      for (let i = Math.max(0, Math.floor((x0 - X0)/CELL)); i < Math.min(NX, Math.ceil((x1 - X0)/CELL)); i++) ids[j*NX + i] = 255; };
    R.walls.forEach(sperre); R.doors.forEach(sperre);        // Türen trennen die Räume wie Wände
    let n = 0; const st = [];
    for (let s = 0; s < ids.length; s++) { if (ids[s]) continue;
      if (n === 254) { ids[s] = 255; continue; }                // mehr Nummern passen nicht in ein Byte; Reste wie Wand behandeln
      n++; ids[s] = n; st.push(s); let a = 0;
      while (st.length) { const c = st.pop(); a++; const i = c % NX, j = (c - i)/NX;
        if (i > 0 && !ids[c-1]) { ids[c-1] = n; st.push(c-1); } if (i < NX-1 && !ids[c+1]) { ids[c+1] = n; st.push(c+1); }
        if (j > 0 && !ids[c-NX]) { ids[c-NX] = n; st.push(c-NX); } if (j < NZ-1 && !ids[c+NX]) { ids[c+NX] = n; st.push(c+NX); } }
      flaeche[n] = a; }
  }
  const raumAn = (x, z) => { const i = Math.floor((x - X0)/CELL), j = Math.floor((z - Z0)/CELL);
    return i < 0 || j < 0 || i >= NX || j >= NZ ? 0 : ids[j*NX + i]; };
  const mapTex = new THREE.DataTexture(ids, NX, NZ, THREE.RedFormat, THREE.UnsignedByteType);
  mapTex.magFilter = mapTex.minFilter = THREE.NearestFilter; mapTex.unpackAlignment = 1; mapTex.needsUpdate = true;   // Zeilen sind nicht durch 4 teilbar
  const U = { jgMap:{value:mapTex}, jgMin:{value:new THREE.Vector2(X0, Z0)}, jgSize:{value:new THREE.Vector2(NX*CELL, NZ*CELL)},
             jgUmgebungRaum:{value:1}, jgDetail:{value:0}, jgLichtSkala:{value:1} };

  // ---------- Licht-Shader aller Materialien erweitern ----------
  const KAB = [-15.03, -10.0, 0.27, 5.85, 3.4].map(v => v.toFixed(3));   // als GLSL-Kommazahlen;             // EMV-Kabine (innen): dort scheint keine Hallensonne hinein
  const chunk = `
      vec3 jgW = transpose( mat3( viewMatrix ) ) * ( - vViewPosition - viewMatrix[ 3 ].xyz );   // Weltposition
      vec3 jgP = jgW + transpose( mat3( viewMatrix ) ) * normal * 0.12;                         // ein Stück vor der Fläche: Wände gehören zum Raum, in den sie zeigen
      vec2 jgUV = ( jgP.xz - jgMin ) / jgSize;
      float jgRaum = ( jgUV.x >= 0.0 && jgUV.y >= 0.0 && jgUV.x <= 1.0 && jgUV.y <= 1.0 ) ? floor( texture2D( jgMap, jgUV ).r * 255.0 + 0.5 ) : 0.0;
      bool jgKab = jgW.x > ${KAB[0]} && jgW.x < ${KAB[1]} && jgW.z > ${KAB[2]} && jgW.z < ${KAB[3]} && jgW.y < ${KAB[4]};
      float jgSonne = ( jgRaum < 0.5 && ! jgKab ) ? 1.0 : 0.0;
      float jgUmgebung = jgSonne > 0.5 ? 1.0 : jgUmgebungRaum;   // Grundhelligkeit in den Räumen (Himmelslicht, Umgebungsbild) gedämpft
      float jgUmgDiff = jgUmgebung, jgUmgSpieg = sqrt( jgUmgebung );
      #ifdef JG_BAKED
        jgUmgDiff = 0.0; jgUmgSpieg = 0.6;      // vorberechnetes Licht (Lightmap) ersetzt Grundhelligkeit und Raumlampen; Spiegelungen bleiben
      #endif
      #ifdef STANDARD
      if ( jgDetail > 0.0 ) {                    // kleine Unregelmäßigkeiten: keine Fläche ist überall gleich hell und gleich glänzend
        float jgGrob = jgRausch( jgW * 1.7 ) - 0.5, jgFein = jgRausch( jgW * 9.0 ) - 0.5;
        material.roughness = clamp( material.roughness * ( 1.0 + jgGrob * 0.3 * jgDetail ), 0.0525, 1.0 );   // Glanz: nur großflächig
        material.diffuseColor *= 1.0 + ( jgGrob * 0.08 + jgFein * 0.04 ) * jgDetail;
        // Gebrauchsspuren: Schmutzrand am Wandfuß, Laufspuren und Flecken auf dem Boden (matter, etwas dunkler)
        vec3 jgNs = transpose( mat3( viewMatrix ) ) * normal;
        float jgFuss = ( 1.0 - smoothstep( 0.02, 0.45, jgW.y ) ) * step( -0.02, jgW.y ) * ( 1.0 - abs( jgNs.y ) );
        material.diffuseColor *= 1.0 - jgFuss * clamp( 0.16 + 0.5 * jgGrob + 0.3 * jgFein, 0.0, 0.4 ) * jgDetail;
        float jgBoden = step( 0.85, jgNs.y ) * ( 1.0 - step( 0.06, abs( jgW.y ) ) );
        float jgFleck = smoothstep( 0.58, 0.82, jgRausch( jgW * vec3( 0.9, 1.0, 0.45 ) ) ) * 0.7 + smoothstep( 0.62, 0.9, jgRausch( jgW * 4.0 + 7.0 ) ) * 0.3;
        material.diffuseColor *= 1.0 - 0.22 * jgFleck * jgBoden * jgDetail;
        material.roughness = mix( material.roughness, min( 1.0, material.roughness + 0.3 ), jgFleck * jgBoden * jgDetail );
      }
      #ifdef JG_PBR
      if ( jgDetail > 0.0 ) {                    // Oberflächentextur der Materialklasse, aus drei Richtungen projiziert (Objekte ohne passende Texturkoordinaten)
        vec3 jgNw = normalize( transpose( mat3( viewMatrix ) ) * normal );
        vec3 jgB = pow( abs( jgNw ), vec3( 4.0 ) ); jgB /= jgB.x + jgB.y + jgB.z;
        vec3 jgQ = jgW / jgPbrSkala;
        vec4 jgTx = texture2D( jgPbr, jgQ.zy ), jgTy = texture2D( jgPbr, jgQ.xz ), jgTz = texture2D( jgPbr, jgQ.xy );
        vec4 jgT = jgTx * jgB.x + jgTy * jgB.y + jgTz * jgB.z;
        #ifdef JG_PBR_FARBE
        material.diffuseColor *= mix( vec3( 1.0 ), 2.0 * jgT.rgb, jgPbrStaerke.x );      // Farbtextur (z. B. Holzmaserung) um die Grundfarbe herum
        material.roughness = clamp( material.roughness * mix( 1.0, 2.0 * jgT.a, jgPbrStaerke.y ), 0.0525, 1.0 );
        #else
        material.diffuseColor *= mix( 1.0, 2.0 * jgT.r, jgPbrStaerke.x );
        material.roughness = clamp( material.roughness * mix( 1.0, 2.0 * jgT.g, jgPbrStaerke.y ), 0.0525, 1.0 );
        vec2 jgNx = jgTx.ba * 2.0 - 1.0, jgNy = jgTy.ba * 2.0 - 1.0, jgNz = jgTz.ba * 2.0 - 1.0;
        vec3 jgRelief = jgB.x * vec3( 0.0, jgNx.y, jgNx.x ) + jgB.y * vec3( jgNy.x, 0.0, jgNy.y ) + jgB.z * vec3( jgNz.x, jgNz.y, 0.0 );
        normal = normalize( mat3( viewMatrix ) * normalize( jgNw + jgRelief * jgPbrStaerke.z ) );
        #endif
      }
      #endif
      #endif
` + THREE.ShaderChunk.lights_fragment_begin
    .replace('irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );',
             'irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal ) * jgUmgDiff;')
    .replace('getPointLightInfo( pointLight, geometryPosition, directLight );', `getPointLightInfo( pointLight, geometryPosition, directLight );
      { float jgId = floor( ( pointLight.decay - 2.0 ) * 10000.0 + 0.5 );
        if ( jgId > 0.5 && jgRaum != jgId && jgRaum < 254.5 ) directLight.color = vec3( 0.0 );
        #ifdef JG_BAKED
        if ( jgId > 0.5 ) directLight.color = vec3( 0.0 );
        #endif
      }`)
    .replace('getDirectionalLightInfo( directionalLight, directLight );', `getDirectionalLightInfo( directionalLight, directLight );
      directLight.color *= jgSonne;`);
  const maps = THREE.ShaderChunk.lights_fragment_maps
    .replace('iblIrradiance += getIBLIrradiance( geometryNormal );', 'iblIrradiance += getIBLIrradiance( geometryNormal ) * jgUmgDiff;')
    .replace('#if defined( RE_IndirectDiffuse )', '#if defined( RE_IndirectDiffuse )\n\t#ifdef JG_ECKEN\n\t\tirradiance += pow( vJgLicht, vec3( 2.2 ) ) * jgLichtSkala;\n\t#endif')
    .replace('radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );',
             'radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness ) * jgUmgSpieg;');
  const RAUSCHEN = `
    float jgHash( vec3 p ) { p = fract( p * 0.3183099 + 0.1 ); p *= 17.0; return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) ); }
    float jgRausch( vec3 x ) { vec3 i = floor( x ), f = fract( x ); f = f * f * ( 3.0 - 2.0 * f );
      return mix( mix( mix( jgHash( i ), jgHash( i + vec3( 1.0, 0.0, 0.0 ) ), f.x ), mix( jgHash( i + vec3( 0.0, 1.0, 0.0 ) ), jgHash( i + vec3( 1.0, 1.0, 0.0 ) ), f.x ), f.y ),
                  mix( mix( jgHash( i + vec3( 0.0, 0.0, 1.0 ) ), jgHash( i + vec3( 1.0, 0.0, 1.0 ) ), f.x ), mix( jgHash( i + vec3( 0.0, 1.0, 1.0 ) ), jgHash( i + vec3( 1.0, 1.0, 1.0 ) ), f.x ), f.y ), f.z ); }
`;
  const patchOk = chunk.includes('jgSonne;') && chunk.includes('jgId') && chunk.includes('* jgUmgDiff') && maps.includes('jgUmgSpieg');
  // Oberflächentexturen je Materialklasse (cad/tex_pbr.js, erzeugt von tools/pbrtex.py):
  // skala = Kachelgröße in Metern, staerke = (Helligkeitsstruktur, Glanzunterschiede, Relief)
  const PBR = {}, PBR_ART = {metall:[1.0, [0.15, 0.35, 0.35]], lack:[0.5, [0.45, 0.6, 0.5]], putz:[1.2, [1.2, 0.6, 0.8]], beton:[1.5, [1.0, 0.6, 0.8]],
                              boden:[1.2, [1.8, 0.8, 0.6]], holz:[0.9, [2.4, 0.6, 0.0]], kunststoff:[0.4, [0.45, 0.6, 0.45]]};
  if (window.TEX_PBR) for (const [k, [skala, st]] of Object.entries(PBR_ART)) { const e = window.TEX_PBR[k]; if (!e) continue;
    const t = new THREE.TextureLoader().load(e.bild || e); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;   // Daten, kein sRGB
    PBR[k] = {tex:t, skala, staerke:new THREE.Vector3(...st), farbe:e.art === 'farbe'}; }
  THREE.Material.prototype.customProgramCacheKey = function(){ const P = this.userData.jgKlasse && PBR[this.userData.jgKlasse]; return (P ? (P.farbe ? 'jgpbrf' : 'jgpbr') : 'jg') + (this.userData.jgGebacken ? 'b' : '') + (this.userData.jgEcken ? 'e' : ''); };
  // Klasse eines Materials: von Hand gesetzt (material.userData.jgKlasse) oder aus Farbe und Glanz geschätzt
  function klasse(m){
    if (!m.isMeshStandardMaterial || m.userData.jgKlasse !== undefined) return;
    const c = m.color, hell = (c.r + c.g + c.b)/3, braun = c.r > c.b*1.4 && c.g > c.b*1.1 && c.r < 0.9;
    m.userData.jgKlasse = m.transparent || !m.visible ? null : m.metalness >= 0.5 ? 'metall' : m.map ? null :
      braun && m.roughness >= 0.4 ? 'holz' : m.roughness <= 0.5 ? (hell > 0.6 ? 'kunststoff' : 'lack') : hell > 0.7 ? 'putz' : 'kunststoff';
  }
  let klassiert = false;
  function klassiereAlle(){ klassiert = true; const s = new Set();
    scene.traverse(o => { if (!o.isMesh) return; for (const m of [].concat(o.material)) s.add(m); if (o.userData.mats) for (const m of o.userData.mats) s.add(m); });
    for (const m of s) klasse(m); }
  if (patchOk) THREE.Material.prototype.onBeforeCompile = function(shader){
    if (!shader.fragmentShader.includes('#include <lights_fragment_begin>') || !shader.fragmentShader.includes('vViewPosition')) return;
    Object.assign(shader.uniforms, U);
    const k = this.userData.jgKlasse, P = k && PBR[k];
    if (P) Object.assign(shader.uniforms, {jgPbr:{value:P.tex}, jgPbrSkala:{value:P.skala}, jgPbrStaerke:{value:P.staerke}});
    if (this.userData.jgGebacken) shader.fragmentShader = '#define JG_BAKED\n' + shader.fragmentShader;
    if (this.userData.jgEcken) {                  // vorberechnetes Licht je Eckpunkt (kleine Teile)
      shader.uniforms.jgLichtSkala = U.jgLichtSkala;
      shader.vertexShader = 'attribute vec3 jgLicht;\nvarying vec3 vJgLicht;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvJgLicht = jgLicht;');
      shader.fragmentShader = '#define JG_ECKEN\nvarying vec3 vJgLicht;\nuniform float jgLichtSkala;\n' + shader.fragmentShader;
    }
    shader.fragmentShader = (P ? (P.farbe ? '#define JG_PBR_FARBE\n' : '') + '#define JG_PBR\nuniform sampler2D jgPbr;\nuniform float jgPbrSkala;\nuniform vec3 jgPbrStaerke;\n' : '') + 'uniform sampler2D jgMap;\nuniform vec2 jgMin;\nuniform vec2 jgSize;\nuniform float jgUmgebungRaum;\nuniform float jgDetail;\n' + RAUSCHEN +
      shader.fragmentShader.replace('#include <lights_fragment_begin>', chunk).replace('#include <lights_fragment_maps>', maps);
  };

  // ---------- Lampen ----------
  const anker = [];                             // {x, y, z, raum}
  const pool = [];                              // wandernde Punktlichter
  let raumMats = [];                            // [Material, ursprüngliche Eigenleuchtfarbe]
  let lampenMats = [];
  const W = new THREE.Box3(), C = new THREE.Vector3(), S = new THREE.Vector3();
  const hell = c => c && c.r > 0.85 && c.g > 0.85 && c.b > 0.8;

  function raeume(objekte, cadMeshes){
    const neu = [], mats = new Set(), lampen = new Set();
    for (const o of objekte) o.traverse(m => { if (!m.isMesh || !m.material) return;
      for (const mt of [].concat(m.material)) mats.add(mt);
      if (m.userData.mats) for (const mt of m.userData.mats) mats.add(mt);
      const mt = [].concat(m.material)[0];
      const leuchte = (mt.isMeshBasicMaterial && !mt.map && !mt.transparent && hell(mt.color) && mt.visible) ||
                      (mt.isMeshStandardMaterial && hell(mt.emissive) && mt.emissiveIntensity >= 1 && !mt.emissiveMap);
      m.receiveShadow = true; m.castShadow = !leuchte;     // für die Schatten der Raumlampen
      if (!leuchte) return;
      W.setFromObject(m); W.getCenter(C); W.getSize(S);
      if (C.y < 2.2 || S.y > 0.25) return;      // nur flache Leuchten unter der Decke
      lampen.add(mt);
      // lange Lichtbänder: alle 1,5 m ein Lichtpunkt
      const lang = S.x > S.z, L = Math.max(S.x, S.z), k = Math.max(1, Math.round(L/1.5));
      for (let i = 0; i < k; i++) { const t = (i + 0.5)/k - 0.5, x = C.x + (lang ? t*L : 0), z = C.z + (lang ? 0 : t*L);
        neu.push({x, y:W.min.y - 0.15, z, raum:raumAn(x, z), echt:true}); } });
    // nahe beieinander liegende Punkte zusammenfassen (Leuchten aus mehreren Teilen)
    for (const a of neu) { if (a.raum === 0 || a.raum === 255) continue;
      if (!anker.some(b => b.raum === a.raum && Math.hypot(b.x - a.x, b.z - a.z) < 0.8 && Math.abs(b.y - a.y) < 0.5)) anker.push(a); }
    // Räume ohne erkannte Leuchte bekommen ein schlichtes Deckenlicht im Raster von etwa 3 m (mit Leuchtpaneel)
    const hat = new Set(anker.map(a => a.raum)), panelGeo = new THREE.BoxGeometry(0.6, 0.012, 0.6),
          panelMat = new THREE.MeshBasicMaterial({color:0xffffff}), panels = [];
    for (let n = 1; n < flaeche.length; n++) { if (hat.has(n) || flaeche[n]*CELL*CELL < 3) continue;
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
      for (let s = 0; s < ids.length; s++) if (ids[s] === n) { const i = s % NX, j = (s - i)/NX; x0 = Math.min(x0, i); x1 = Math.max(x1, i); z0 = Math.min(z0, j); z1 = Math.max(z1, j); }
      const w = (x1 - x0 + 1)*CELL, d = (z1 - z0 + 1)*CELL, nx = Math.max(1, Math.round(w/3)), nz = Math.max(1, Math.round(d/3));
      for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) {
        const x = X0 + x0*CELL + (a + 0.5)*w/nx, z = Z0 + z0*CELL + (b + 0.5)*d/nz;
        if (raumAn(x, z) !== n) continue;       // Rasterpunkt liegt außerhalb (L-förmiger Raum)
        anker.push({x, y:2.85, z, raum:n, echt:false});
        const p = new THREE.Mesh(panelGeo, panelMat); p.position.set(x, 2.994, z); scene.add(p); lampen.add(panelMat); panels.push(p); } }
    const zahl = verschmelze(objekte.concat(panels), lampen, cadMeshes);
    mats.clear(); for (const o of objekte.concat(panels, zahl.neu)) o.traverse(m => { if (!m.isMesh || !m.parent) return;
      for (const mt of [].concat(m.material)) mats.add(mt); if (m.userData.mats) for (const mt of m.userData.mats) mats.add(mt); });
    raumMats = [...mats].filter(m => m.emissive && !lampen.has(m) && m.emissive.r + m.emissive.g + m.emissive.b > 0.05).map(m => [m, m.emissive.clone()]);
    lampenMats = [...lampen].map(m => [m, m.isMeshBasicMaterial ? m.color.clone() : m.emissiveIntensity]);
    if (new URLSearchParams(location.search).has('bakeexport')) bakeExport(zahl.neu); else wendeLichtAn(zahl.neu);
    window.__grafik = {anker:anker.length, raeume:flaeche.length - 1, lampen:lampenMats.length, raumMats:raumMats.length, patchOk, teileVorher:zahl.vorher, teileNachher:zahl.nachher, gebacken};
    setQuality(quality, true);
  }

  // ---------- Zusammenfassen ----------
  function verschmelze(objekte, lampen, cadMeshes){
    const alle = []; for (const o of objekte) o.traverse(m => { if (m.isMesh) alle.push(m); });
    // Bewegliche Teile finden: alle Raumtüren einmal ganz öffnen; was sich dabei bewegt, bleibt einzeln
    scene.updateMatrixWorld(true);
    const vorher = new Map(alle.map(m => [m, m.matrixWorld.clone()])), T = window.raeumeTueren || [];
    for (const d of T) { d.offen = true; for (let i = 0; i < 500 && d.schritt(); i++); }
    scene.updateMatrixWorld(true);
    const beweglich = new Set(alle.filter(m => !m.matrixWorld.equals(vorher.get(m))));
    for (const d of T) { d.offen = false; for (let i = 0; i < 500 && d.schritt(); i++); }
    scene.updateMatrixWorld(true);
    // gleich aussehende Materialien zusammenlegen (viele sind mehrfach angelegt)
    const kanon = new Map(), hex = c => c ? c.getHexString() : '';
    const eins = mt => { const k = [mt.type, hex(mt.color), hex(mt.emissive), mt.emissiveIntensity, mt.roughness, mt.metalness, mt.envMapIntensity,
        mt.map && mt.map.uuid, mt.emissiveMap && mt.emissiveMap.uuid, mt.normalMap && mt.normalMap.uuid, mt.alphaMap && mt.alphaMap.uuid,
        mt.transparent, mt.opacity, mt.side, mt.visible, mt.toneMapped, mt.depthWrite, mt.depthTest, mt.alphaTest, mt.polygonOffset, mt.polygonOffsetFactor,
        mt.polygonOffsetUnits, mt.flatShading, mt.vertexColors, mt.wireframe, lampen.has(mt), mt.userData.jgKlasse].join('|');
      if (!kanon.has(k)) kanon.set(k, mt); return kanon.get(k); };
    const sichtbar = m => { for (let p = m; p; p = p.parent) if (!p.visible) return false; return true; };
    const gruppen = new Map();
    for (const m of alle) { const mt = m.material, g = m.geometry;
      if (beweglich.has(m) || Array.isArray(mt) || m.isInstancedMesh || m.isSkinnedMesh || m.userData.id || !sichtbar(m)) continue;
      if (mt.transparent || !mt.visible || mt.depthWrite === false || g.morphAttributes.position || !g.attributes.position) continue;
      m.material = eins(mt); const mats = m.userData.mats ? m.userData.mats.map(eins) : null;
      W.setFromObject(m); W.getCenter(C); const r = raumAn(C.x, C.z);
      const zelle = r > 0 && r < 255 ? 'r' + r : 'g' + Math.floor(C.x/6) + ',' + Math.floor(C.y/4) + ',' + Math.floor(C.z/6);   // je Raum, sonst grobes Raster (Sichtbarkeitsprüfung bleibt wirksam)
      const attr = Object.keys(g.attributes).sort().map(a => a + g.attributes[a].itemSize).join(',');
      const key = [m.material.uuid, mats ? mats.map(x => x.uuid).join(',') : '', m.castShadow, m.receiveShadow, m.renderOrder, attr, zelle].join('|');
      if (!gruppen.has(key)) gruppen.set(key, []); gruppen.get(key).push({m, mats}); }
    const neu = [], weg = new Set(); let nachher = alle.length;
    for (const liste of gruppen.values()) {      // auch einzelne Teile: alle unbeweglichen Teile liegen danach als benannte Objekte in Weltkoordinaten vor (Lightmap)
      const geos = liste.map(({m}) => { const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()); g.clearGroups(); g.applyMatrix4(m.matrixWorld);   // Untergruppen (z. B. Würfelseiten) sind bei nur einem Material bedeutungslos
        if (m.matrixWorld.determinant() < 0) for (const a of Object.values(g.attributes)) for (let i = 0; i < a.count; i += 3)     // gespiegelt: Dreiecke umdrehen
          for (let k = 0; k < a.itemSize; k++) { const t = a.getComponent(i + 1, k); a.setComponent(i + 1, k, a.getComponent(i + 2, k)); a.setComponent(i + 2, k, t); }
        return g; });
      const geo = mergeGeometries(geos, false); if (!geo) continue;
      const m0 = liste[0].m, n = new THREE.Mesh(geo, m0.material); n.name = 'jg_' + neu.length; n.userData.lampe = lampen.has(m0.material);
      n.castShadow = m0.castShadow; n.receiveShadow = m0.receiveShadow; n.renderOrder = m0.renderOrder; if (liste[0].mats) n.userData.mats = liste[0].mats;
      for (const {m} of liste) { m.parent.remove(m); weg.add(m); }
      if (liste[0].mats) cadMeshes.push(n); scene.add(n); neu.push(n); nachher += 1 - liste.length; }
    for (let i = cadMeshes.length - 1; i >= 0; i--) if (weg.has(cadMeshes[i])) cadMeshes.splice(i, 1);
    return {neu, vorher:alle.length, nachher};
  }

  // ---------- Vorberechnetes Licht (cad/licht_data.js, erzeugt von tools/lichtbake.py) ----------
  // Jedes Objekt mit passender Punktzahl bekommt Lightmap-Koordinaten (uv1) und Materialkopien mit der Lightmap.
  const LICHT_HELL = 0.7;                       // Gesamthelligkeit des vorberechneten Lichts
  let gebacken = 0;
  function wendeLichtAn(liste){
    const L = window.LICHT; if (!L) return;
    const roh = atob(L.uv), u8 = new Uint8Array(roh.length); for (let i = 0; i < roh.length; i++) u8[i] = roh.charCodeAt(i);
    const uv = new Float32Array(u8.buffer), info = new Map(L.objekte.map(o => [o.name, o]));
    const er = atob(L.ecken || ''), ecken = new Uint8Array(er.length); for (let i = 0; i < er.length; i++) ecken[i] = er.charCodeAt(i);
    U.jgLichtSkala.value = Math.PI*L.skala*LICHT_HELL;
    const tex = new THREE.TextureLoader().load(L.bild); tex.colorSpace = THREE.SRGBColorSpace; tex.channel = 1;
    tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter;      // keine Mipmaps: sonst färben benachbarte Inseln ab
    const kopie = new Map(), kop = (m, art) => { const k = art + m.uuid; if (!kopie.has(k)) { const c = m.clone();
        if (art === 'lm') { c.lightMap = tex; c.lightMapIntensity = Math.PI*L.skala*LICHT_HELL; }
        if (c.emissive) c.emissive.setRGB(0, 0, 0); c.userData = {...m.userData, jgGebacken:true, jgEcken:art === 'ecken'}; kopie.set(k, c); } return kopie.get(k); };
    for (const n of liste) { const o = info.get(n.name), g = n.geometry;
      if (!o || o.punkte !== g.attributes.position.count) continue;            // Raum hat sich seit dem Vorberechnen geändert
      if (n.material.metalness >= 0.5) continue;                                // Metall lebt von Spiegelungen und Glanzlichtern: behält das Echtzeitlicht
      if (o.art === 'ecken') g.setAttribute('jgLicht', new THREE.BufferAttribute(ecken.subarray(o.versatz, o.versatz + 3*o.punkte), 3, true));
      else g.setAttribute('uv1', new THREE.BufferAttribute(uv.subarray(o.versatz, o.versatz + 2*o.punkte), 2));
      n.material = kop(n.material, o.art); if (n.userData.mats) n.userData.mats = n.userData.mats.map(m => kop(m, o.art)); gebacken++; }
  }

  // ---------- Export für das Vorberechnen des Lichts (tools/lichtbake.py) ----------
  // ?bakeexport=1: schreibt alle unbeweglichen Raumteile (Dreiecke in Weltkoordinaten, Reihenfolge wie im Spiel),
  // ihre Materialfarben und die Lampenpositionen als JSON in ein <pre id="bakeout">. Blender liefert dazu je Objekt
  // die Lightmap-Koordinaten in derselben Punktreihenfolge zurück.
  function bakeExport(liste){
    const pre = document.createElement('pre'); pre.id = 'bakeout'; document.body.appendChild(pre);
    setTimeout(() => { try {
      const b64 = arr => { const u = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength); let s = '';
        for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
      const mittel = (t) => { const im = t && t.image; if (!im || !im.width) return null;           // mittlere Farbe einer Textur (linear)
        const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d'); g.drawImage(im, 0, 0, 16, 16);
        const d = g.getImageData(0, 0, 16, 16).data; let r = 0, gg = 0, bb = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i+1]; bb += d[i+2]; }
        return new THREE.Color().setRGB(r/256/255, gg/256/255, bb/256/255, THREE.SRGBColorSpace); };
      const mats = [], matIdx = new Map(), objekte = [];
      for (const n of liste) { const m = n.material;
        if (!matIdx.has(m)) { const c = (m.color ? m.color.clone() : new THREE.Color(1, 1, 1)), t = mittel(m.map); if (t) c.multiply(t);
          const e = m.emissive ? m.emissive.clone().multiplyScalar(m.emissiveIntensity || 1) : new THREE.Color(0, 0, 0);
          matIdx.set(m, mats.length); mats.push({farbe:[c.r, c.g, c.b], leucht:[e.r, e.g, e.b], lampe:!!n.userData.lampe || !!m.isMeshBasicMaterial,
                                                 rau:m.roughness ?? 1, metall:m.metalness ?? 0}); }
        const g = n.geometry; objekte.push({name:n.name, mat:matIdx.get(m), pos:b64(g.attributes.position.array), nrm:b64(g.attributes.normal.array)}); }
      pre.textContent = 'BAKEJSON ' + JSON.stringify({mats, objekte, anker:anker.map(a => ({x:a.x, y:a.y, z:a.z, echt:a.echt}))}) + ' BAKEENDE';
    } catch (e) { pre.textContent = 'BAKEFEHLER ' + e.stack; } }, 2000);       // kurz warten, bis die Texturbilder geladen sind
  }

  // ---------- Nachbearbeitung ----------
  let composer = null, gtao = null, bloom = null;
  function baueComposer(){
    const w = innerWidth, h = innerHeight;
    const rt = new THREE.WebGLRenderTarget(w, h, {type:THREE.HalfFloatType, samples:4});
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    gtao = new GTAOPass(scene, camera, w, h);
    gtao.updateGtaoMaterial({radius:0.8, distanceExponent:1.5, thickness:1.5, scale:1.0, samples:16});
    gtao.updatePdMaterial({lumaPhi:10, depthPhi:2, normalPhi:3, radius:6, rings:2, samples:16});
    gtao.blendIntensity = 1.0;
    composer.addPass(gtao);
    bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.28, 0.55, 1.05);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    resize();
  }
  // Die Umgebungsverdeckung rechnet in halber Auflösung (spart etwa drei Viertel ihres Aufwands, das Ergebnis ist ohnehin weich).
  function resize(){ if (!composer) return; const pr = renderer.getPixelRatio(); composer.setPixelRatio(pr); composer.setSize(innerWidth, innerHeight);
    gtao.setSize(Math.round(innerWidth*pr/2), Math.round(innerHeight*pr/2)); }

  // leichte Randabdunkelung wie bei einer Kamera (über dem Bild, unter den Anzeigen)
  const vignette = document.createElement('div');
  vignette.style.cssText = 'position:fixed;inset:0;pointer-events:none;background:radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.32) 100%)';
  renderer.domElement.after(vignette);

  // ---------- Grafikstufe ----------
  // Raumlicht ab Stufe „mittel“; dann leuchten die Wände nicht mehr selbst (früherer Notbehelf), sondern werden von den Lampen beleuchtet.
  // Auf „hoch“ werfen die beiden nächsten Lampen Schatten.
  const POOL = [0, 4, 4, 10], SCHATTEN = [0, 0, 0, 2], EIGEN = [1, 0.25, 0.25, 0.12], UMGEBUNG = [1, 0.5, 0.5, 0.35];
  let quality = 2, nSchatten = 0;
  function setQuality(q, neuBau){
    if (q === quality && !neuBau) return; quality = q;
    const n = R && patchOk ? POOL[q] : 0;
    while (pool.length) { const l = pool.pop(); scene.remove(l); l.dispose(); }
    nSchatten = n ? SCHATTEN[q] : 0;
    for (let i = 0; i < n; i++) { const l = new THREE.PointLight(0xfff6ea, 0, 8, 2); l.userData.f = 0; l.userData.a = null;
      if (i < nSchatten) { l.castShadow = true; l.shadow.mapSize.set(512, 512); l.shadow.camera.near = 0.05; l.shadow.camera.far = 7;
        l.shadow.bias = -0.002; l.shadow.normalBias = 0.02; l.shadow.autoUpdate = false; }
      pool.push(l); scene.add(l); }
    for (const [m, e] of raumMats) m.emissive.copy(e).multiplyScalar(n ? EIGEN[q] : 1);
    U.jgUmgebungRaum.value = n ? UMGEBUNG[q] : 1;
    U.jgDetail.value = q >= 2 ? 1 : 0;
    vignette.style.display = q >= 2 ? 'block' : 'none';
    for (const [m, v] of lampenMats) { if (m.isMeshBasicMaterial) m.color.copy(v).multiplyScalar(n ? 3 : 1); else m.emissiveIntensity = n ? 3 : v; }
    if (q === 3 && !composer) baueComposer();
    if (pool.length) { lastX = 1e9; }
  }

  // Lichtvorrat auf die nächsten Leuchten verteilen. Licht, das den Platz wechselt, wird erst ausgeblendet und dann neu eingeblendet.
  let lastX = 1e9, lastZ = 1e9, ziel = [];
  const I_ECHT = 5, I_ERSATZ = 4;
  function verteile(dt){
    if (!pool.length) return;
    const cx = camera.position.x, cz = camera.position.z;
    if (Math.hypot(cx - lastX, cz - lastZ) > 0.4) { lastX = cx; lastZ = cz;
      ziel = anker.map(a => [Math.hypot(a.x - cx, a.z - cz, (a.y - camera.position.y)*0.5), a]).sort((p, q) => p[0] - q[0]).slice(0, pool.length).filter(p => p[0] < 16).map(p => p[1]); }
    // In der Halle sind die Raumlampen ganz aus (sonst kosten sie dort auf jeder Fläche Rechenzeit, ohne etwas zu bewirken)
    const drin = cz > 3; if (pool[0].visible !== drin) for (const l of pool) l.visible = drin;
    gruppe(pool.slice(0, nSchatten), ziel.slice(0, nSchatten), dt); gruppe(pool.slice(nSchatten), ziel.slice(nSchatten), dt);
    // Schatten der Raumlampen nur neu rechnen, wenn eine Lampe den Platz wechselt oder sich in der Szene etwas bewegt (Tür, Figur)
    if (renderer.shadowMap.needsUpdate && raumAn(cx, cz) > 0) for (let i = 0; i < nSchatten; i++) pool[i].shadow.needsUpdate = true;
  }
  function gruppe(lichter, ziel, dt){
    const frei = ziel.filter(a => !lichter.some(l => l.userData.a === a));
    for (const l of lichter) {
      const soll = l.userData.a && ziel.includes(l.userData.a);
      l.userData.f = Math.max(0, Math.min(1, l.userData.f + (soll ? dt : -dt)*3));
      if (!soll && l.userData.f === 0 && frei.length) { const a = frei.shift(); l.userData.a = a; l.position.set(a.x, a.y, a.z); l.decay = 2 + a.raum*1e-4;
        if (l.castShadow) { l.shadow.needsUpdate = true; renderer.shadowMap.needsUpdate = true; } }
      l.intensity = l.userData.a ? l.userData.f*(l.userData.a.echt ? I_ECHT : I_ERSATZ) : 0;
    }
  }

  let tPrev = performance.now();
  function render(){
    const t = performance.now(), dt = Math.min(0.1, (t - tPrev)/1000); tPrev = t;
    if (!klassiert) klassiereAlle();
    verteile(dt);
    if (quality === 3 && composer) composer.render(); else renderer.render(scene, camera);
  }
  return {raeume, setQuality, resize, render, raumAn};
};

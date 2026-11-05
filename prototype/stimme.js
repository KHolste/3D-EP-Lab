/* Sprachausgabe der Figuren über die Stimme des Browsers (Web Speech API, keine Dateien).
   window.stimme.ausText(text) sucht in einer Meldung wörtliche Rede der Form  Name: „…“  und liest sie mit der Stimme der Figur vor.
   Jede Figur hat eigene Tonlage und eigenes Tempo; Anna bekommt nach Möglichkeit eine Frauenstimme, die anderen eine Männerstimme.
   Taste V schaltet die Stimmen an und aus (wird im Browser gemerkt). */
window.stimme = (() => {
  const S = window.speechSynthesis;
  const FIG = {
    'Udo':       {pitch:0.75, rate:0.95, frau:false, wunsch:/conrad|stefan/i},
    'Anna':      {pitch:1.15, rate:1.05, frau:true,  wunsch:/katja|seraphina|hedda/i},
    'Kalle':     {pitch:0.95, rate:1.12, frau:false, wunsch:/killian/i},
    'Doktorand': {pitch:1.1,  rate:1.18, frau:false, wunsch:/jonas|jan/i},
    'Yan Ravil': {pitch:1.0,  rate:1.0,  frau:false, wunsch:/florian/i}};
  const FRAU = /katja|hedda|amala|seraphina|louisa|ingrid|elke|gisela|klarissa|maja|tanja|ketty|christel|petra|anna|marlene|vicki|female|weiblich/i;
  const MANN = /conrad|stefan|killian|florian|jonas|jan|kasper|ralf|bernd|christoph|klaus|lars|hans|markus|male|männlich/i;
  let an = true; try { an = localStorage.getItem('jumboStimmen') !== '0'; } catch(e) {}
  let stimmen = [], nr = 0;
  const bis = {};                                       // Name -> {t: Ende der Rede in ms, id}; für die Gesten der Figuren (pose)
  const laden = () => { if (S) stimmen = S.getVoices().filter(v => /^de/i.test(v.lang)); };
  if (S) { laden(); S.addEventListener && S.addEventListener('voiceschanged', laden); }

  // beste deutsche Stimme: Wunschstimme der Figur (damit nicht alle gleich klingen), passendes Geschlecht,
  // natürliche (Online-)Stimmen von Edge, Deutschland vor Österreich und Schweiz
  function wahl(f){
    if (!stimmen.length) laden(); const frau = f.frau;
    const gut = v => (f.wunsch && f.wunsch.test(v.name) ? 6 : 0) + (/natural|online|neural/i.test(v.name) ? 2 : 0) + (/^de-DE/i.test(v.lang) ? 1 : 0)
      + ((frau ? FRAU : MANN).test(v.name) ? 3 : (frau ? MANN : FRAU).test(v.name) ? -3 : 0);
    return stimmen.slice().sort((a, b) => gut(b) - gut(a))[0] || null;
  }
  // Zahlen und Einheiten so umschreiben, dass sie gesprochen gut klingen
  function sprechbar(t){
    return t.replace(/(\d+)\.(\d+)E([+-]?)(\d+)/g, (m, a, b, s, e) => a + (b !== '0' ? ',' + b : '') + ' mal zehn hoch ' + (s === '-' ? 'minus ' : '') + (+e))
            .replace(/(\d+)E([+-]?)(\d+)/g, (m, a, s, e) => (a === '1' ? '' : a + ' mal ') + 'zehn hoch ' + (s === '-' ? 'minus ' : '') + (+e))
            .replace(/\bmbar\b/g, 'Millibar').replace(/\bV1\b/g, 'V eins').replace(/\bVu\b/g, 'V u').replace(/–/g, ',');
  }
  function sprich(name, text){
    if (!an || !S || !text) return;
    const f = FIG[name] || {pitch:1, rate:1, frau:false, wunsch:null}, u = new SpeechSynthesisUtterance(sprechbar(text)), v = wahl(f);
    if (v) u.voice = v; u.lang = v ? v.lang : 'de-DE'; u.pitch = f.pitch; u.rate = f.rate; u.volume = 1;
    const id = ++nr; u.onstart = () => { bis[name] = {t:Infinity, id}; };
    u.onend = u.onerror = () => { if (bis[name] && bis[name].id === id) bis[name] = {t:performance.now() + 300, id}; };
    S.speak(u); return id;
  }
  return {
    ausText(text){
      const re = /(Udo|Anna|Kalle|Doktorand|Yan Ravil): „([^“"]*)[“"]/g; let m, erst = true, t0 = performance.now();
      while ((m = re.exec(text))) {
        if (erst && an && S) S.cancel(); erst = false;          // neue Rede unterbricht die alte
        const f = FIG[m[1]] || {rate:1}, dauer = 400 + m[2].length*65/f.rate;   // geschätzte Sprechdauer, auch ohne Stimme (für die Gesten)
        const id = an && S ? sprich(m[1], m[2]) : ++nr; bis[m[1]] = {t:t0 + dauer, id}; t0 += dauer; }
    },
    redet: name => !!bis[name] && performance.now() < bis[name].t,
    sprich,
    umschalten(){ an = !an; try { localStorage.setItem('jumboStimmen', an ? '1' : '0'); } catch(e) {} if (!an && S) S.cancel(); return an; },
    get an(){ return an; },
    get verfuegbar(){ return !!S; }
  };
})();

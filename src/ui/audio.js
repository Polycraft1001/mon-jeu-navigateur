// =====================================================
//  SONS : tout est fabriqué par le code (WebAudio),
//  aucun fichier à télécharger.
//  sfx('boom') · sfx('pistol', 0.5) ...
//  ➜ Nouveau son : ajoute une entrée dans SOUNDS.
// =====================================================
let ac = null, out = null, noiseBuf = null;
const last = {};

// Les navigateurs bloquent le son jusqu'au premier clic / touche
export function unlockAudio() {
  try {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      out = ac.createDynamicsCompressor();
      const master = ac.createGain();
      master.gain.value = 0.6;
      out.connect(master); master.connect(ac.destination);
      const len = ac.sampleRate;
      noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ac.state === 'suspended') ac.resume();
  } catch (e) { ac = null; }
}
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);

// enveloppe de volume : monte vite puis s'éteint
function env(t, vol, dur, attack = 0.005) {
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(vol, 0.0002), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(out);
  return g;
}
// bruit filtré (tirs, explosions, chocs)
function noise(t, dur, vol, f0, f1 = f0, type = 'lowpass', q = 0.8) {
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  const f = ac.createBiquadFilter();
  f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t + dur);
  src.connect(f); f.connect(env(t, vol, dur));
  src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
}
// note qui glisse de f0 à f1
function tone(t, dur, vol, f0, f1 = f0, type = 'square') {
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t + dur);
  o.connect(env(t, vol, dur));
  o.start(t); o.stop(t + dur + 0.05);
}

const SOUNDS = {
  pistol: (t, v) => { noise(t, 0.14, 0.7 * v, 2500, 600, 'bandpass', 0.7); tone(t, 0.09, 0.25 * v, 320, 80); },
  smg: (t, v) => { noise(t, 0.08, 0.45 * v, 3000, 900, 'bandpass', 0.8); tone(t, 0.05, 0.15 * v, 260, 90); },
  shotgun: (t, v) => { noise(t, 0.35, 0.9 * v, 1600, 200); tone(t, 0.22, 0.4 * v, 140, 40, 'sawtooth'); },
  rocket: (t, v) => { noise(t, 0.7, 0.5 * v, 400, 1800, 'bandpass', 1.2); tone(t, 0.3, 0.2 * v, 90, 50, 'sawtooth'); },
  boom: (t, v) => { noise(t, 1.4, 1.0 * v, 900, 60); tone(t, 0.9, 0.7 * v, 90, 28, 'sine'); },
  crash: (t, v) => { noise(t, 0.4, 0.7 * v, 1400, 300, 'bandpass', 0.6); tone(t, 0.2, 0.3 * v, 150, 50, 'triangle'); },
  punch: (t, v) => { tone(t, 0.12, 0.5 * v, 170, 55, 'sine'); noise(t, 0.06, 0.35 * v, 900, 300); },
  click: (t, v) => { tone(t, 0.04, 0.12 * v, 1300, 900); },
  coin: (t, v) => { tone(t, 0.08, 0.15 * v, 988, 988, 'sine'); tone(t + 0.07, 0.18, 0.15 * v, 1318, 1318, 'sine'); },
  horn: (t, v) => {
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25 * v, t + 0.03);
    g.gain.setValueAtTime(0.25 * v, t + 0.32);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    f.connect(g); g.connect(out);
    for (const fr of [370, 466]) {
      const o = ac.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = fr;
      o.connect(f); o.start(t); o.stop(t + 0.47);
    }
  },
};
// temps minimum entre deux fois le même son (évite la bouillie sonore)
const MIN_GAP = { smg: 0.05, crash: 0.12, boom: 0.08, horn: 0.4 };

export function sfx(name, vol = 1) {
  if (!ac || ac.state !== 'running' || !SOUNDS[name] || !(vol > 0.01)) return;
  const t = ac.currentTime;
  if (t - (last[name] ?? -1) < (MIN_GAP[name] || 0.03)) return;
  last[name] = t;
  try { SOUNDS[name](t, Math.min(vol, 1.5)); } catch (e) { /* pas de son */ }
}

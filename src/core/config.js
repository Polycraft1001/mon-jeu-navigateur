// =====================================================
//  DONNÉES DU JEU : voitures, armes, couleurs, police...
//  -> Pour ajouter une voiture ou une arme, c'est ICI !
// =====================================================

// style = forme de la voiture (CAR_SHAPES dans vehicles/models.js
// ou LUXURY dans vehicles/luxury.js pour les voitures de luxe)
export const CARS = [
  { name: 'GT Sprint', desc: 'Équilibrée, parfaite pour commencer', style: 'gt', maxSpeed: 52, accel: 20, turn: 2.2, drift: 1.0, hp: 100, stats: [4, 3, 4, 3] },
  { name: 'Drift King', desc: 'La reine de la glisse', style: 'drift', maxSpeed: 49, accel: 19, turn: 2.35, drift: 1.3, hp: 100, stats: [3, 3, 4, 5] },
  { name: 'Muscle V8', desc: 'Très rapide et solide', style: 'muscle', maxSpeed: 60, accel: 17, turn: 1.9, drift: 0.9, hp: 150, stats: [5, 3, 2, 3] },
  { name: 'Rally Mini', desc: 'Petite, agile et nerveuse', style: 'mini', maxSpeed: 46, accel: 24, turn: 2.7, drift: 1.1, hp: 90, stats: [2, 5, 5, 3] },
  { name: 'Ferrari 3D', desc: 'Vrai modèle 3D chargé en ligne', style: 'ferrari', maxSpeed: 58, accel: 22, turn: 2.25, drift: 1.05, hp: 100, stats: [5, 4, 4, 3] },
  // ----- Voitures de luxe -----
  { name: 'Lambo Taureau', desc: 'Supercar V12 en forme de flèche', style: 'lambo', maxSpeed: 64, accel: 25, turn: 2.3, drift: 1.1, hp: 95, stats: [5, 5, 4, 3] },
  { name: 'Hyper Chiron', desc: 'Hypercar : la plus rapide du jeu', style: 'hyper', maxSpeed: 72, accel: 26, turn: 2.0, drift: 0.95, hp: 110, stats: [5, 5, 3, 3] },
  { name: 'Porsche 911 R', desc: 'Précise et joueuse en drift', style: 'porsche', maxSpeed: 58, accel: 23, turn: 2.5, drift: 1.25, hp: 100, stats: [4, 4, 5, 4] },
  { name: 'Rolls Phantom', desc: 'Limousine royale, ultra solide', style: 'rolls', maxSpeed: 50, accel: 16, turn: 1.8, drift: 0.8, hp: 220, stats: [3, 2, 2, 2] },
  { name: 'G-Wagon 4x4', desc: 'SUV de luxe, roi des collines', style: 'suv', maxSpeed: 52, accel: 19, turn: 2.0, drift: 0.9, hp: 190, stats: [3, 3, 3, 2] },
];
// voiture volée dans la circulation
export const STOLEN_CAR = { name: 'Voiture volée', style: 'gt', maxSpeed: 42, accel: 16, turn: 2.0, drift: 0.9, hp: 80 };
// voiture de police (on peut la voler... mais ça énerve la police !)
export const POLICE_CAR = { name: 'Voiture de police', style: 'police', maxSpeed: 58, accel: 22, turn: 2.25, drift: 1.0, hp: 140 };
export const STAT_NAMES = ['Vitesse', 'Accélération', 'Maniabilité', 'Drift'];
// couleurs de peinture « bonbon »
export const COLORS = ['#ff5c8a', '#ff9f43', '#ffd93d', '#4dd8c0', '#5aa9ff', '#a77bff', '#ff7ad9', '#ffffff', '#3b3b58', '#8be04e'];

// Armes : rate = temps entre 2 tirs (s), dmg = dégâts, range = portée (m)
// pellets = nombre de plombs, spread = dispersion, force = recul donné aux piétons
// fa = icône Font Awesome affichée dans le HUD (https://fontawesome.com/icons)
export const WEAPONS = [
  { id: 'fist', name: 'Poings', icon: '', fa: 'fa-hand-fist', rate: 0.45, range: 2.4, dmg: 8, melee: true, force: 6 },
  { id: 'pistol', name: 'Pistolet', icon: '', fa: 'fa-gun', rate: 0.28, range: 90, dmg: 20, spread: 0.01, force: 5 },
  { id: 'smg', name: 'Mitraillette', icon: '', fa: 'fa-burst', rate: 0.09, range: 70, dmg: 9, spread: 0.045, auto: true, force: 3 },
  { id: 'shotgun', name: 'Fusil à pompe', icon: '', fa: 'fa-crosshairs', rate: 0.85, range: 30, dmg: 9, pellets: 7, spread: 0.11, force: 4 },
  { id: 'rocket', name: 'Lance-roquettes', icon: '', fa: 'fa-rocket', rate: 1.1, range: 220, rocket: true, force: 0 },
];

// Police : points de recherche nécessaires pour 1 à 5 étoiles
export const POLICE = {
  stars: [20, 120, 260, 450, 700],
  crime: { pedHit: 25, pedShot: 10, gunshot: 4, carWreck: 35, policeWreck: 90, copHit: 50, policeCarStolen: 120 },
  carSpeed: [0, 24, 27, 30, 33, 36],   // vitesse des voitures de police selon les étoiles
  copDamage: 5,                        // dégâts d'un tir de policier
};

export const TIMES = [{ id: 'day', name: 'Jour' }, { id: 'sunset', name: 'Soir' }, { id: 'night', name: 'Nuit' }];
export const TRAFFIC = [{ id: 0, name: 'Aucune' }, { id: 1, name: 'Normale' }, { id: 2, name: 'Beaucoup' }];
export const TRAFFIC_COUNT = [0, 34, 64];
export const ASSISTS = [{ id: 'strong', name: 'Forte' }, { id: 'normal', name: 'Normale' }, { id: 'pro', name: 'Pro (x1,5)' }];
export const ASSIST = {
  strong: { rate: 1.25, slip: 0.42, th: [0.7, 1.6, 2.7], pts: 1 },
  normal: { rate: 1.0, slip: 0.5, th: [1.0, 2.2, 3.5], pts: 1 },
  pro: { rate: 0.9, slip: 0.6, th: [1.2, 2.6, 4.2], pts: 1.5 },
};
export const LEVEL_COLORS = ['#ffffff', '#4fc3ff', '#ff9d2e', '#c46bff'];
export const LEVEL_NAMES = ['DRIFT', 'DRIFT BLEU', 'DRIFT ORANGE', 'SUPER DRIFT'];
export const TURBO_TIME = [0, 0.9, 1.5, 2.3];

// Ambiance de chaque moment de la journée (la « DA » : couleurs du ciel, lumière, brume...)
// Jour : ciel bleu bonbon qui devient rose pâle à l'horizon, soleil doux, montagnes lilas
export const TIME_SET = {
  day: { skyTop: '#4fb0ff', skyBot: '#ffe0f0', fog: '#f6dff0', fogNear: 220, fogFar: 1500, hemi: 1.15, hemiSky: '#e8f3ff', hemiGround: '#7d8a5c', sun: 2.9, sunColor: '#fff0d6', sunPos: [90, 160, 60], win: 0, neon: 0.55, lamp: 0.2, pool: 0, head: 0.8, spot: 0, env: 1, exposure: 1.06, bloom: [0.25, 0.45, 0.9], stars: false, clouds: true, cloud: '#ffffff', mountain: '#a99ad6' },
  sunset: { skyTop: '#2a3a78', skyBot: '#ff9457', fog: '#e7a07a', fogNear: 150, fogFar: 1200, hemi: 0.7, hemiSky: '#ffcfb0', hemiGround: '#4a3a44', sun: 2.3, sunColor: '#ffa860', sunPos: [160, 45, -70], win: 0.8, neon: 1.5, lamp: 2, pool: 0.08, head: 1.5, spot: 20, env: 0.6, exposure: 1.05, bloom: [0.45, 0.5, 0.8], stars: false, clouds: true, cloud: '#ffc7a8', mountain: '#5d4c66' },
  night: { skyTop: '#020512', skyBot: '#18214a', fog: '#0b1028', fogNear: 90, fogFar: 750, hemi: 0.5, hemiSky: '#7088d0', hemiGround: '#1a1a2a', sun: 0.4, sunColor: '#a8bcff', sunPos: [-70, 130, 40], win: 1.4, neon: 2.5, lamp: 3, pool: 0.2, head: 3, spot: 60, env: 0.2, exposure: 1.15, bloom: [0.8, 0.5, 0.7], stars: true, clouds: false, cloud: '#ffffff', mountain: '#121828' },
};

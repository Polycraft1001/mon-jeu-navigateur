// =====================================================
//  ÉTAT PARTAGÉ entre tous les fichiers du jeu
// =====================================================
export const G = {
  state: 'menu',   // 'menu' | 'play' | 'pause'
  mode: 'car',     // 'car' = au volant, 'foot' = à pied
  car: null,       // la voiture du joueur (objet 3D, voir vehicles/models.js)
  peds: null,      // les piétons (voir npc/pedestrians.js)
  time: null,      // réglages du moment de la journée
  shake: 0,        // secousse de la caméra
  camMode: 0,
  camHeading: 0,
  elapsed: 0,
};

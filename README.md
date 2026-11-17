# 🏎️ Turbo Drift 3D

Jeu de course et de drift en 3D, directement dans le navigateur (HTML, CSS, JavaScript et [Three.js](https://threejs.org/)).

👉 **Jouer : https://polycraft1001.github.io/mon-jeu-navigateur/**

## Contenu

- **Menu principal** : choix du circuit, de la voiture, de la couleur, du nombre de tours et de l'aide au drift.
- **4 circuits** :
  - 🏁 **Grand Prix** : circuit classique au soleil, avec tribune et public.
  - 🌵 **Canyon du Désert** : longues courbes, cactus et falaises.
  - 🌃 **Neon City** : course de nuit entre les buildings, arches néon.
  - ❄️ **Pic Enneigé** : route glissante et neige qui tombe.
- **4 voitures** : GT Sprint (équilibrée), Drift King (glisse), Muscle V8 (vitesse), Rally Mini (agilité).
- Records sauvegardés pour chaque circuit (temps et score de drift).
- Mini-carte, compte à rebours, chrono, meilleur tour.

## Contrôles

| Action | Clavier | Mobile |
|---|---|---|
| Accélérer | ↑ ou Z (W en QWERTY) | ▲ |
| Freiner / reculer | ↓ ou S | ▼ |
| Tourner | ← → ou Q D (A D en QWERTY) | ◀ ▶ |
| Drift | Espace (maintenir) ou Shift | DRIFT |
| Recommencer | R | menu pause |
| Changer de couleur | C | menu |
| Pause | Échap ou P | ❚❚ |

## 🎓 Comment drifter

1. Roule à plus de 40 km/h.
2. Tourne et **maintiens Espace** juste avant le virage.
3. Pendant le drift : flèche vers l'intérieur = virage plus serré, vers l'extérieur = plus large.
4. **Lâche Espace** pour obtenir un turbo. Plus le drift dure (🔵 → 🟠 → 🟣), plus le turbo est long.
5. Enchaîne les drifts pour monter le multiplicateur jusqu'à x5.

**Aide au drift** (dans le menu) :
- **Forte** : la voiture suit la route toute seule pendant le drift. Idéal pour débuter.
- **Normale** : tu diriges le drift avec les flèches.
- **Pro** : plus dur à contrôler, mais les points sont multipliés par 1,5.

## Fichiers

- `index.html` : la page, le menu et l'interface.
- `style.css` : le style du menu et du HUD.
- `game.js` : tout le jeu (circuits, voitures, physique, drift, effets).

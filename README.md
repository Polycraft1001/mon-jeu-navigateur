# 🏎️ Course 3D – Super Drift

Un jeu de course en 3D qui se joue directement dans le navigateur, réalisé avec [Three.js](https://threejs.org/).

👉 **Jouer : https://polycraft1001.github.io/mon-jeu-navigateur/**

## But du jeu
Fais 3 tours du circuit le plus vite possible, et enchaîne les drifts pour marquer des points et gagner des turbos.

## Contrôles

| Action | Clavier | Mobile |
|---|---|---|
| Accélérer | ↑ ou Z | ▲ |
| Freiner / reculer | ↓ ou S | ▼ |
| Tourner | ← → ou Q D | ◀ ▶ |
| **Drift** | **Espace + virage** | **DRIFT + ◀/▶** |
| Changer de couleur | C | – |
| Recommencer | R | – |

## Le super drift
1. Roule vite (plus de ~50 km/h), tourne et **maintiens Espace** : la voiture saute et part en glisse.
2. Pendant le drift, tourne **dans le même sens** pour serrer le virage, ou **dans l'autre sens** pour l'élargir (contre-braquage).
3. Plus le drift dure, plus les étincelles changent de couleur : 🔵 bleu → 🟠 orange → 🟣 violet (**SUPER DRIFT**).
4. **Relâche Espace** pour obtenir un turbo : plus le niveau est élevé, plus il dure longtemps.
5. Enchaîne les drifts rapidement pour monter le multiplicateur (jusqu'à x5).

⚠️ Si tu sors de la route pendant un drift, tu perds les points de ce drift.

## Graphismes
Ciel avec soleil, ombres en temps réel, reflets sur la carrosserie, effet de lueur (sur ordinateur), fumée, traces de pneus, tribune avec public, montagnes et nuages.

## Fichiers
- `index.html` : la page et l'interface
- `style.css` : l'apparence de l'interface
- `game.js` : le jeu (circuit, voiture, physique, drift, effets)

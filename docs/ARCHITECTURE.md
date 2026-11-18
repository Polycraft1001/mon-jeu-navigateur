# 🧭 Architecture de TURBO CITY 3D

Ce document explique **comment le jeu est construit**, pour pouvoir le modifier sans tout casser.

## 1. Le démarrage

1. `index.html` charge `style.css`, déclare l'**importmap** (three.js 0.160.0 via jsDelivr) puis lance `src/main.js` (`type="module"`).
2. Chaque fichier, au moment où il est importé, prépare ses propres objets :
   - `render/engine.js` crée le rendu, la scène, la caméra, les lumières et le ciel ;
   - `gameplay/onfoot.js` crée le héros (caché tant qu'on est en voiture) ;
   - `ui/input.js` branche le clavier, la souris, le joystick et les boutons tactiles ;
   - `ui/menu.js` branche les boutons JOUER, PAUSE, etc.
3. `main.js` construit la ville (10 × 10 pâtés de maisons) et le **relief** autour (collines, forêts, montagnes enneigées), la minimap, les piétons, la **police** (`initPolice()`), la voiture du joueur, la circulation et les pièces, puis lance la boucle.
4. Les **graphismes HD** (herbe, eau, Ferrari, ciels HDR, **personnages 3D animés**) arrivent en arrière-plan. S'ils ne se chargent pas, le jeu garde ses textures dessinées par le code (et des persos « en boîtes »).

## 2. La boucle du jeu (`main.js`)

À chaque image (environ 60 fois par seconde), `dt` = temps écoulé depuis l'image d'avant (jamais plus de 0,05 s).

**En jeu**, dans cet ordre :

| # | Fonction | Rôle |
|---|---|---|
| 1 | `readInput()` | lit les commandes (clavier ou tactile) |
| 2 | `updatePlayer(dt, inp)` | la voiture du joueur (reçoit `null` quand on est à pied : elle roule en roue libre) |
| 3 | `tiltCar()` | la voiture penche avec la pente (collines) |
| 4 | `updateHero(dt, inp)` | le héros à pied (reçoit `null` quand on est en voiture) |
| 5 | `updateHeroModel(dt, hero)` | les animations 3D du héros (immobile, marche, course, visée) |
| 6 | `updateWeapons(dt)` | tirs, balles, roquettes |
| 7 | `updatePolice(dt)` | étoiles de recherche, voitures de police, policiers à pied, arrestation |
| 8 | `updateTraffic(dt)` | circulation, voitures en feu, épaves |
| 9 | `G.peds.update(dt, cars)` | piétons (renvoie le nombre de piétons renversés par le joueur → délit) |
| 10 | `updateDestruction(dt)` | explosions, débris, arbres et lampadaires qui tombent |
| 11 | `updateParticles(dt)` | fumée, flammes, étincelles |
| 12 | `updateCoins` / `updateMission` / `animateMission` | pièces et missions |
| 13 | `updateCamera(dt)` | la caméra suit la voiture ou le héros |
| 14 | `updateHUD(dt)` / `drawMinimap()` | l'affichage à l'écran |

**Au menu** : la ville continue de vivre (circulation, piétons, effets), la police est rangée, et la caméra tourne autour de la voiture.
**En pause** : rien ne bouge, on redessine juste l'image.

À la fin de chaque image : le soleil (et ses ombres) suit le joueur, le ciel suit la caméra, puis `render()`.

Si une erreur arrive pendant une image, elle est affichée sous le bouton JOUER et dans la console, mais le jeu continue.

## 3. L'état partagé `G` (`src/core/ctx.js`)

Tout ce que plusieurs fichiers doivent connaître est rangé dans l'objet `G` :

| Champ | Signification |
|---|---|
| `G.state` | `'menu'`, `'play'` ou `'pause'` |
| `G.mode` | `'car'` (au volant) ou `'foot'` (à pied) |
| `G.car` | la voiture du joueur (objet 3D avec `root`, `S.W`, `S.L` = largeur / longueur, `isPolice` si c'est une voiture de police) |
| `G.hero` | le héros (position, vie, état `'ok'`, `'down'` ou `'ko'`) |
| `G.peds` | les piétons |
| `G.time` | les réglages du moment de la journée |
| `G.shake` | secousse de la caméra (0 = aucune) |
| `G.camMode`, `G.camHeading` | réglages de la caméra |
| `G.clock`, `G.elapsed` | horloge et temps de jeu |

Le **niveau de recherche** est dans `wanted` (`src/gameplay/police.js`) : `heat` (points), `stars` (0 à 5). Pour ajouter un délit ailleurs dans le code : `crime(points)`.

La **sauvegarde** (voiture choisie, couleur, records, argent, arme…) est dans `save` (`src/core/save.js`). Après une modification, appelle `persist()`.

## 4. Les règles du code

1. **Un fichier = un rôle.** Si un fichier devient énorme, on le coupe en deux.
2. **Les données sont dans `src/core/config.js`** (voitures, armes, police, couleurs, moments de la journée). On règle le jeu là, sans toucher à la logique.
3. **Imports circulaires** : certains fichiers s'importent l'un l'autre (par exemple `driving.js` ↔ `traffic.js` ↔ `onfoot.js`, ou `models.js` ↔ `luxury.js`). C'est permis **à condition de n'utiliser une valeur importée qu'à l'intérieur d'une fonction**, jamais directement en haut du fichier. Sinon : erreur « Cannot access '…' before initialization ». Dans `main.js`, garde l'import de `vehicles/models.js` **avant** les autres véhicules.
4. **Pas de création d'objets dans la boucle** quand on peut l'éviter (on réutilise des vecteurs et des objets) : ça évite les petites saccades.
5. **Directions** : dans le jeu, « devant » = vers −Z. Un angle `h` correspond à la direction `(-sin h, -cos h)`.
6. **Commentaires en français**, courts et utiles.

## 5. Recettes

### Ajouter une arme
1. `src/core/config.js` : ajoute une ligne dans `WEAPONS` avec un `id` unique, un nom, une icône et ses réglages (`rate` = temps entre 2 tirs, `dmg` = dégâts, `range` = portée, `spread` = dispersion, `pellets` = plombs, `auto` = tir continu).
2. `src/gameplay/onfoot.js` : dessine son modèle avec `gun('ton_id', (g) => { ... })` et indique sa longueur dans `GUN_LEN`.
3. Si elle a un comportement spécial (comme la roquette qui explose), ajoute-le dans `src/gameplay/weapons.js`.
4. Pense à mettre à jour l'aide « 1-5 » dans `index.html`.

### Ajouter une voiture
1. `src/core/config.js` : ajoute une ligne dans `CARS` (`maxSpeed`, `accel`, `turn`, `drift`, `hp`, et `stats` pour les barres du menu).
2. `style` = une forme qui existe déjà : `gt`, `drift`, `muscle`, `mini`, `ferrari` (dans `src/vehicles/models.js`) ou une voiture de luxe `lambo`, `hyper`, `porsche`, `rolls`, `suv` (dans `src/vehicles/luxury.js`). Pour une nouvelle forme de luxe, ajoute-la dans `LUXURY` (`luxury.js`).

### Régler la police
`POLICE` dans `src/core/config.js` :
- `stars` = points de recherche pour avoir 1, 2, 3, 4 puis 5 étoiles ;
- `crime` = points donnés par chaque délit (piéton renversé, coup de feu, voiture détruite, policier touché, voiture de police volée…) ;
- `carSpeed` = vitesse des voitures de police selon les étoiles ;
- `copDamage` = dégâts d'un tir de policier.

Le comportement (poursuite, policiers à pied, arrestation, « semer » la police) est dans `src/gameplay/police.js`. La voiture de police elle-même est dessinée dans `src/vehicles/luxury.js` (`buildPoliceCar`).

### Personnages 3D
`src/npc/characters.js` charge le modèle animé « Soldier » (exemples officiels de three.js).
- `makeCharacter({ tint, cap, gun })` crée un perso (couleur des habits, casquette, pistolet) ;
- `attachHero(...)` remplace le héros « en boîtes » par le perso 3D ;
- si les persos marchent **à reculons**, mets `FACE = Math.PI` en haut du fichier.

### Changer un moment de la journée
`TIME_SET` dans `src/core/config.js` : couleurs du ciel, brouillard, soleil, lumière des fenêtres et des lampadaires, intensité du bloom.

### Modifier la ville et le relief
- `src/world/city.js` : la grille de rues, les immeubles, les parcs, les skateparks, l'eau. Tout ce qui doit bloquer la voiture ou le héros est ajouté dans `colliders`.
- `src/world/terrain.js` : la hauteur du sol hors de la ville (`terrainHeight(x, z)`) : collines, puis grandes montagnes au bord du monde.

### Modifier les missions
`src/gameplay/mission.js` : les points de passage, le temps et la récompense.

## 6. Déboguer

- Les erreurs s'affichent **sous le bouton JOUER** (en rouge).
- Pour plus de détails : **F12 → Console**.
- Dans la console, `TURBO` donne accès au jeu : `TURBO.hero.hp = 999`, `TURBO.player.speed`, `TURBO.G.mode`, `TURBO.wanted.stars` (nombre d'étoiles)…
- Après avoir poussé sur GitHub, attends 1 à 2 minutes puis fais **Ctrl + F5**.

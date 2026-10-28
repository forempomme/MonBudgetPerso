# Gestion du Budget

Application Android de gestion de budget personnel, développée en React et packagée via Capacitor.
Interface entièrement en français, 100 % hors-ligne, sans compte ni serveur.

**Version actuelle : `1.79.0`** — thème *Aube sur Minas Tirith*.

---

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Stack technique](#stack-technique)
- [Thème visuel](#thème-visuel)
- [Arborescence](#arborescence)
- [Installation locale](#installation-locale)
- [Build APK](#build-apk)
- [Données & sauvegarde](#données--sauvegarde)
- [Structure du code](#structure-du-code)
- [Versioning](#versioning)
- [Changelog](#changelog)

---

## Fonctionnalités

### Onglet Accueil

- **Carrousel hero (swipeable)** — deux cartes glissables horizontalement, avec indicateur à points :
  - **Solde bancaire estimé** — dégradé, shimmer, orbes pulsées, compteur animé, sparkline 6 mois, badge delta 🔼/🔽. Le point du mois en cours dans la sparkline affiche désormais **exactement** la même valeur que le gros chiffre au-dessus (source unique, voir [Logique solde](#logique-solde)) ; les mois passés gardent leur propre calcul historique
  - **Projection à 3 mois** — solde prévu mois par mois à partir des fixes, récurrentes, programmées connues + une estimation du flux courant net ; inclut une alerte si le seuil configuré sera franchi, une explication de la plus grosse programmée qui pèse sur un mois, et un encart **Fiabilité** comparant les projections passées à la réalité une fois le mois écoulé
- **SmartIndicator** — point coloré : vert / jaune (solde < seuil ou backup > 7 j) / rouge (solde négatif ou backup > 14 j). Tap → bulle explicative
- **Rapprochement bancaire** — mini-cartes cliquables « ✓ Solde pointé » et « ⏳ En attente » + barre de progression. Tapoter « En attente » ouvre Historique avec le filtre correspondant déjà appliqué
- **Opération d'équilibre** — ajuste le solde pointé sans impacter le solde estimé (⚖️ dans le FAB)
- **Colonne arrondis** (si arrondi activé) — Mois / Année / À virer
- Cartes 🐷 Cagnottes et 📌 Fixes/mois sur une ligne (v1.49.0 ; le taux d'épargne du mois est dans le détail des cagnottes, au tap) — Fixes/mois respecte la date de démarrage propre à chaque frais/revenu fixe et les corrections ponctuelles du mois
- **💡 Surplus de fin de cycle** (v1.50.0) — les 5 derniers jours avant la paie, propose de verser le surplus (reste à vivre − dépenses courantes estimées) dans une cagnotte ; « voir le calcul » détaille chaque ligne
- **🧪 Et si… ?** (v1.50.0) — bouton de la carte Projection : simulation de changements temporaires sur 6 mois, rien n'est enregistré
- **Bloc 📊 Bilan** (v1.49.0, remplace « Mois en cours » + « Année en cours ») — Revenus, Dépenses, Épargné (+ retiré), Dép. variables, avec un sélecteur Mois | Année qui revient toujours sur le mois
- **Récap cagnotte au tap** — sheet avec répartition des mouvements par cagnotte
- **Modal ⏳ À venir** — s'ouvre en tapant la carte (remplace l'ancien dépliant inline), centré à l'écran, fermable par le bouton ✕ ou le bouton retour (Android/navigateur) :
  - Onglets Tout / Récurrents / Fixes / Programmés, badge occurrences restantes sur les récurrentes
  - Chaque dépense fixe non pointée a sa propre case à cocher, plus un bouton **✓ Tout pointer** qui pointe en un tap toutes les fixes non pointées actuellement visibles (filtre respecté)
  - **Carte fermée** — distingue désormais « Ce mois » (récurrentes + fixes en attente + programmées dues ce mois-ci) et le mois suivant ayant une programmée (ex: « Ce mois −35 € · Sept. −60 € »), avec un petit « +N » discret s'il y a encore d'autres mois au-delà

### FAB (bouton +)

Menu à 5 options (tap court) :

| Option | Action |
|--------|--------|
| 💸 Dépense | Ouvre TransModal en mode dépense |
| 💰 Revenu | Ouvre TransModal en mode revenu |
| 🐷 Épargne | Ouvre TransModal en mode épargne |
| 📅 Programmée | Ouvre ScheduledModal |
| ⚖️ Équilibre | Ouvre TransModal en mode balance_adjustment |

**Appui long (450 ms) → Templates de saisie rapide** — un éventail de bulles apparaît autour du bouton (voile sombre + halo bleuté derrière, pour rester lisible par-dessus le contenu de l'accueil). Chaque bulle correspond à un template (icône + catégorie + type prédéfinis) et ouvre un tiroir de saisie avec le vrai clavier `NumPad` (montant toujours vide, à saisir soi-même) et les raccourcis de date habituels (Aujourd'hui / Hier / Avant-hier / 📅 date libre). Une bulle ⚙️ ouvre la gestion des templates (créer/modifier/supprimer — nom, icône, catégorie, type). Accessible aussi depuis Options → *Templates rapides*.

**Récurrentes** — depuis une dépense/revenu, cocher « Récurrente » avec fréquence (mensuelle/annuelle) et nombre de fois optionnel. La toute première opération est reliée au modèle récurrent dès sa création (`templateId`), pour que le compteur d'occurrences compte juste dès le départ. **Important** : ce lien (`templateId`) est préservé lors d'une édition ultérieure de cette opération — l'éditer ne casse plus le rattachement à la récurrente.

### Onglet Cagnottes

- Bloc stats : épargné ce mois, cette année, décagnottages
- **Types de cagnottes** (`cagType`) — Projet 🎯 / Urgence 🛡️ / Plaisir ✈️ / Investissement 📈, badge coloré sur chaque carte, filtre chips
- Bouton 🔄 Transfert — modal avec toggle « ↔ Entre cagnottes » / « ↑ Vers le compte courant » + champ **raison** optionnel
- Libellé retrait : `"Transfert 🏖️ NomCagnotte → compte [— raison]"` dans l'historique
- Projets d'épargne avec barre de progression, objectif € et date cible
- Montant à épargner par mois calculé automatiquement

### Onglet Historique

- Navigation mois par flèches
- Mini donut répartition revenus / dépenses / épargne + barre budget
- Rapprochement **du mois affiché** (mini-cartes pointé / en attente) — distinct du rapprochement cumulé de l'accueil (voir [Logique solde](#logique-solde))
- **Vues** : Liste / Catégories / Calendrier
- **Code couleur par type** : fond teinté + bande gauche colorée pour épargne (violet), retrait cagnotte (corail/vert), équilibre (sapin), badge type sous le label
- **Swipe gauche** → ✏️ Modifier / 📋 Dupliquer / 🗑 Supprimer (la duplication recopie désormais aussi `targetCagId` et `tagIds`)
- Pointage ○/✓ (désactivé pour les types non-pointables : dissolution, decagnottage, balance_adjustment)
- Sections : Épargnes à confirmer / Programmées ce mois / Récurrentes à confirmer / Frais fixes du mois (respecte la date de démarrage propre à chaque frais)
- Tags — chips colorées sous chaque transaction taguée

### Onglet Fixes

- **Hero card** — Charges / Revenus fixes / Net fixe, calculée pour le mois en cours (respecte `startYM` et les corrections ponctuelles du mois, comme partout ailleurs)
- **Onglets Charges / Revenus** — deux sections séparées avec code couleur (rouge/vert)
- Grille 4 colonnes avec boutons d'action au tap
- Boutons d'ajout en pointillé coloré (voyants)
- **Date de début** (`startYM`) optionnelle — le frais n'est déduit qu'à partir du mois configuré, et n'apparaît dans aucune vue (accueil, historique, rapport, popups de détail) avant ce mois
- Badge delta ▲/▼ si le montant a changé depuis le mois précédent
- **Revenus fixes** (`fixedIncomes[]`) — ajoutés au solde estimé chaque mois comme les frais fixes se soustraient ; comptés uniquement dans le solde estimé, pas dans le rapprochement pointé/en attente (pas de mécanisme de pointage pour eux — voir [Logique solde](#logique-solde))

### Onglet Rapport

- Hero card annuelle avec donut et 4 stats
- Onglets Bilan / Analyse / Périodes
- Classement des mois 🥇🥈🥉, tappables
- Moyennes mensuelles, objectif épargne annuel
- Top 5 dépenses par catégorie (respecte `startYM` des frais fixes)
- Évolution solde cumulé
- Tableau comparatif N vs N-1
- 🎯 Suivi catégories / 🏷️ Tags / 📊 Analyse catégorie / 🐷 Taux d'épargne — l'analyse par catégorie calcule désormais un nombre de mois propre à **chaque** frais fixe (et non plus un total partagé), pour rester juste même si deux frais d'une même catégorie n'ont pas la même date de départ
- Comparaison deux périodes, notes sur les mois

### Onglet Options

| Section | Options |
|---------|---------|
| 🔒 Sécurité | PIN & biométrie |
| 🐷 Épargne | Versements automatiques · Arrondi · Alerte solde bas |
| 🏷️ Catégories | Gestion · Liaisons · Récurrentes · **Templates rapides** |
| 🔔 Notifications | Notifications locales Android |
| 💾 Données | Sauvegarde |

**🔒 Sécurité** — PIN SHA-256 + biométrie via `@aparajita/capacitor-biometric-auth` ; reverrouillage après un délai hors de l'appli (Immédiat / 1 / **5** / 15 min / Jamais) ; attente imposée après N erreurs de PIN (3 / **5** / 10 / illimité : 30 s, 1 min, 5 min, 15 min) ; aperçu masqué dans les applis récentes en option (Android 13+, désactivé par défaut depuis 1.77.1 : sur le Pixel il bloque aussi les captures d'écran) ; option « ouvrir en mode discret » (v1.75.0)

**🙈 Mode discret** (v1.75.0) — bouton 👁 en haut à droite de chaque écran : montants et pourcentages remplacés par « •••• », barres de proportion cachées, graphiques floutés ; les montants tapés en saisie restent visibles

**💾 Sauvegardes chiffrées** (v1.75.0) — toutes les sauvegardes sont chiffrées (AES-256-GCM, clé tirée du mot de passe de sauvegarde par PBKDF2-SHA256 600 000 itérations) ; mot de passe choisi une fois, redemandé et vérifié à chaque sauvegarde, jamais stocké ; les anciens fichiers non chiffrés restent importables

**⚡ Templates rapides** — gestion des templates de saisie rapide (voir FAB ci-dessus), badge du nombre de templates créés

**🔔 Notifications locales** — via `window.Capacitor.Plugins.LocalNotifications`, planifiées uniquement sur action utilisateur explicite (pas au démarrage pour éviter l'écran noir post-biométrie)

**🐷 Versements automatiques** — virement mensuel fixe vers une cagnotte avec double-garde anti-doublon (UTC corrigé en heure locale)

**🐷 Arrondi automatique** — arrondit chaque dépense vers une cagnotte cible. Si la cagnotte visée a été supprimée, aucune transaction fantôme n'est créée : un message d'avertissement s'affiche en toast à la place. Éditer une dépense déjà arrondie recalcule (ou retire) automatiquement l'arrondi lié.

### Transactions programmées

- FAB → 📅 Programmée : montant, date future, catégorie, note. Pensé pour les cas type précommande payée à la sortie : la dépense est saisie aujourd'hui mais ne pèsera sur le solde estimé qu'à partir du mois de son échéance
- Section « ⏳ À venir » (modal) — programmées futures uniquement ; celles dont l'échéance est le mois en cours basculent dans Historique pour confirmation
- Confirmation automatique au démarrage (heure locale)
- Badge **PROG** dans l'historique

### Opération d'équilibre (`balance_adjustment`)

- FAB → ⚖️ Équilibre
- Ajuste le **solde pointé** (rapprochement bancaire) sans impacter le solde estimé
- Code couleur `--sapin` (#58c090) dans l'historique : fond teinté, bande gauche, badge ⚖ Équilibre
- Note pré-remplie "Ajustement de solde"

---

## Stack technique

| Technologie | Version | Usage |
|-------------|---------|-------|
| React | 18.3 | UI, state management (useReducer) |
| Vite | 5.4 | Bundler, dev server |
| Capacitor | 6.0 | Packaging Android (WebView) |
| `@capacitor/app` | 6.0 | Bouton retour Android |
| `@capacitor/filesystem` | 6.0 | Export fichier |
| `@capacitor/share` | 6.0 | Partage Android |
| `@capacitor/splash-screen` | 6.0 | Écran de démarrage |
| `@capacitor/status-bar` | 6.0 | Barre de statut |
| `@capacitor/keyboard` | 6.0 | Clavier virtuel |
| `@aparajita/capacitor-biometric-auth` | ^8.0.0 | Empreinte / FaceID |
| `crypto.subtle` | Web API | SHA-256 du PIN |

---

## Thème visuel

**Aube sur Minas Tirith** — inspiré de la Terre du Milieu.

| Variable | Valeur | Usage |
|----------|--------|-------|
| `--accent` | `#70b8e0` | Bleu acier — actions |
| `--accent2` | `#88c880` | Vert Comté |
| `--purple` | `#b090e0` | Violet — épargne, cagnottes |
| `--coral` | `#e08870` | Corail — retraits cagnotte |
| `--success` | `#68d498` | Vert — revenus |
| `--danger` | `#c87070` | Rouge — dépenses |
| `--warning` | `#c8b860` | Ambre — fixes, vigilance |
| `--sapin` | `#58c090` | Vert menthe — équilibre |
| `--bg` | `#060810` | Fond principal |

---

## Arborescence

```
gestion-du-budget/
├── .github/workflows/build.yml
├── src/
│   ├── main.jsx
│   ├── App.jsx          — state, FAB (+ éventail templates rapides), modals, callbacks
│   ├── store.js         — reducer, actions A.*, DEFAULT_DATA
│   ├── releve.js        — lecture du relevé PDF + comparaison (lecture seule)
│   ├── taxRules.js      — règles fiscales par année de revenus (récap fiscal) — à mettre à jour chaque janvier
│   ├── backupCrypto.js  — chiffrement des sauvegardes (AES-256-GCM + PBKDF2, WebCrypto)
│   ├── hooks.js         — useBalance, useReconciliation, useBalanceWithRecurring, computeProjection…
│   ├── utils.js         — fmt, isIncome, txLabel, txTypeClass, txSign, APP_VERSION
│   ├── views.jsx        — toutes les vues + LockScreen + SwipeRow
│   ├── styles.css       — variables thème, animations, classes type-*
│   └── components/
│       ├── index.jsx
│       └── modals.jsx   — TransModal, FixedModal, FixedIncomeModal, CagModal, QuickTemplateSheet, QuickTemplateManagerModal…
├── index.html
├── vite.config.js
├── capacitor.config.js
└── package.json         — version: 1.79.0
```

---

## Installation locale

```bash
git clone https://github.com/<compte>/gestion-du-budget.git
cd gestion-du-budget
npm install
npm run dev   # → http://localhost:5173
```

## Build APK

### Via GitHub Actions (méthode principale)

**Actions → Build APK → Run workflow**

### Secrets GitHub requis

| Secret | Description |
|--------|-------------|
| `KEYSTORE_BASE64` | Keystore JKS encodé en base64 |
| `KEYSTORE_PASSWORD` | Mot de passe du keystore |
| `KEY_ALIAS` | Alias (`budgetpro`) |
| `KEY_PASSWORD` | Mot de passe de la clé |

---

## Données & sauvegarde

Stockage en `localStorage` sous la clé `budget_ultimate_2026_v10`.

### Structure DEFAULT_DATA (champs clés)

| Champ | Type | Description |
|-------|------|-------------|
| `transactions` | `Transaction[]` | Toutes les opérations |
| `categories` | `Category[]` | Catégories |
| `cagnottes` | `Cagnotte[]` | Cagnottes (avec `cagType`) |
| `fixedExpenses` | `FixedExpense[]` | Frais fixes (avec `startYM`) |
| `fixedIncomes` | `FixedIncome[]` | Revenus fixes récurrents |
| `recurringTemplates` | `RecurringTemplate[]` | Modèles récurrents |
| `autoSavings` | `AutoSaving[]` | Versements auto mensuels |
| `scheduledTransactions` | `ScheduledTransaction[]` | Transactions programmées |
| `tags` | `Tag[]` | Tags transversaux |
| `quickTemplates` | `QuickTemplate[]` | Templates de saisie rapide (`{ id, icon, name, categoryId, type }`) — montant et date jamais mémorisés |
| `notifSettings` | `NotifSettings` | Config notifications locales |
| `pinEnabled` / `pinHash` / `bioEnabled` | — | Sécurité |
| `warning` | `string \| null` | Avertissement ponctuel émis par le reducer (ex: cagnotte d'arrondi introuvable), affiché en toast puis effacé via `CLEAR_WARNING` |
| `projectionSnapshots` | `{ [ym]: { predictedValue, predictedOn } }` | Première projection figée pour chaque mois futur, jamais réécrite — sert à comparer prévu/réel une fois le mois passé |

### Types de transactions (`TxType`)

`income` · `expense` · `epargne` · `decagnottage` · `dissolution_cagnotte` · `transfer` · `balance_adjustment`

### Logique solde

**Le rapprochement bancaire (`useReconciliation`) est la source unique de vérité pour "pointé" et "en attente" — le solde estimé en découle directement, les deux ne peuvent plus diverger.**

- **Rapprochement** (`useReconciliation`) — calcule `soldePointe` et `soldeAttente` à partir de toutes les transactions pointables (hors `decagnottage`/`transfer`) et de tous les frais fixes, pointés ou non, depuis le premier mois d'utilisation. **Les revenus fixes n'y entrent pas** : il n'existe pas de mécanisme de pointage pour eux (pas de case à cocher), donc les compter automatiquement dans "pointé" fausserait ce chiffre, qui doit refléter uniquement ce que l'utilisateur a réellement vérifié face à son relevé bancaire.
- **Solde estimé** (`useBalanceWithRecurring`) = `soldePointe + soldeAttente`, moins les récurrentes et programmées **pas encore confirmées** (pas encore de transaction réelle, donc absentes du rapprochement par définition). Les frais fixes non pointés ne sont **jamais** soustraits une seconde fois ici : ils sont déjà comptés une fois dans `soldeAttente`. Une récurrente peut être un revenu (ex: bonus mensuel) ou une dépense — son type est respecté, pas une hypothèse "toujours dépense". Une récurrente à occurrences limitées arrête bien de peser une fois son nombre de fois atteint (pas de décalage d'un mois).
- **Revenus fixes** — comptés uniquement dans le solde estimé (`effectiveIncomesForMonth`, tous les mois écoulés), jamais dans le rapprochement.
- **Projection** (`computeProjection(data, breakdown, { monthsAhead, alertThreshold })`, v1.62.0) — simule le solde **jour par jour** à partir du solde estimé : reste des dépenses courantes du mois en cours (habituel − déjà dépensé, jamais un ajout), puis chaque mois les revenus et frais fixes à leur jour (jour 1 s'il n'est pas renseigné), les récurrentes mensuelles (type et occurrences restantes respectés) et **annuelles** (au mois de leur dernière occurrence), les programmées, et le courant habituel réparti sur le mois. Donne le **point bas** (date, « juste avant la paie »), les fins de mois avec leur détail ligne par ligne et une **fourchette** (quartiles du courant, à partir de 3 mois d'historique).
- **Flux courant net** (`variableNetForMonth` + médiane dans `computeProjection`) — médiane, sur les 6 derniers mois **complets et réellement vécus** (aucun mois avant la 1ʳᵉ opération), du net des transactions qui ne sont ni fixes, ni récurrentes, ni un arrondi automatique ; la médiane évite qu'un imprévu ponctuel ne fausse l'estimation
- **Fiabilité de la projection** (`computeProjectionAccuracy` / `useProjectionAccuracy`) — compare la fin de mois annoncée **le mois d'avant** (`projectionSnapshots[ym]`, `horizon: 1`) au solde réellement atteint, calculé avec la même définition que le solde estimé (opérations d'équilibre comprises). Retourne `{ items, avgAbs, avgSigned, n }`
- **Sparkline (hero card)** — le point du mois en cours affiche directement la valeur du solde estimé (même source) ; les points des mois passés gardent un calcul historique indépendant (pas de notion "en attente" pertinente pour un mois déjà terminé)
- **Historique** — affiche son propre rapprochement, mais **scopé au mois affiché** (pas cumulé depuis le début comme celui de l'accueil) : deux métriques légitimement différentes, pas un doublon
- **Dates** — toujours en heure locale (pas `toISOString()` UTC — corrigé sur tous les raccourcis de date, les valeurs par défaut de formulaire, et les vérifications "mois en cours")

---

## Structure du code

### Actions `A.*` principales

| Action | Description |
|--------|-------------|
| `SAVE_TRANSACTION` | Créer/modifier. Arrondi automatique si `roundingEnabled` (recalculé à l'édition, retiré proprement si la cagnotte d'arrondi n'existe plus). Le `templateId` d'une opération liée à une récurrente est préservé lors d'une édition (jamais écrasé par `undefined`) |
| `DELETE_TRANSACTION` | Supprimer + restaure `cagnotte.current` si epargne/decagnottage |
| `SAVE_FIXED` / `DELETE_FIXED` | Frais fixes. `startYM` et `monthlyOverrides` préservés à l'édition |
| `SAVE_FIXED_INCOME` / `DELETE_FIXED_INCOME` | Revenus fixes récurrents |
| `SAVE_AUTO_SAVING` / `APPLY_AUTO_SAVING` | Versements auto (double-garde anti-doublon) |
| `SAVE_SCHEDULED` / `CONFIRM_SCHEDULED` | Transactions programmées |
| `EXECUTE_TRANSFER` | Entre cagnottes ou vers compte (avec `reason`) |
| `SAVE_NOTIF_SETTINGS` | Config notifications |
| `CLEAR_WARNING` | Efface le message d'avertissement ponctuel (`warning`) après affichage |
| `SAVE_PROJECTION_SNAPSHOT` | Fige la première projection connue pour un mois donné (no-op si déjà figée) |
| `SAVE_QUICK_TEMPLATE` / `DELETE_QUICK_TEMPLATE` | Templates de saisie rapide |

### Hooks custom

| Hook | Retourne |
|------|----------|
| `useBalance(txs, fixes, incomes)` | Solde brut toutes périodes (base historique, utilisé pour les points passés de la sparkline) |
| `isPointable(type)` | `true` sauf pour `decagnottage`/`transfer` (mouvements internes, absents d'un relevé bancaire) |
| `useReconciliation(txs, fixes, incomes)` | `{ soldePointe, soldeAttente, nbPointed, totalPointable }` — source unique pour pointé/en attente |
| `useBalanceWithRecurring(txs, fixes, incomes, recurring, scheduled)` | Solde estimé = `soldePointe + soldeAttente` moins récurrentes/programmées non confirmées |
| `computeProjection(data, breakdown, opts)` | `{ start, current, months[{ ym, label, value, start, delta, range, lines, variable }], days, low, variableNetMedian, historyMonths, thresholdBreachMonth, biggestSchedMonth, biggestSchedItem }` |
| `useProjectionAccuracy(txs, fixes, incomes, projectionSnapshots)` | `{ items[{ ym, predicted, actual, delta }], avgAbs, avgSigned, n }` (horizon 1 uniquement) |
| `useMonthStats(txs, fixes, ym, incomes)` | `{ inc, exp, expVar, decag, net }` |
| `useYearMonths` / `useYearTotals` | Stats annuelles — les frais fixes sont comptés pour **tous** les mois déjà écoulés de l'année (pas seulement le mois en cours) |
| `useTotalFixes(fixes, ym?)` | Total frais fixes, respecte `startYM` et les `monthlyOverrides` du mois donné |
| `effectiveFixesForMonth` / `effectiveIncomesForMonth` | Helpers exportés — montant effectif d'un frais/revenu fixe pour un mois donné (respecte `startYM` et les corrections ponctuelles) |

### Logique de démarrage (App.jsx `useEffect`)

1. **Versements auto** — si `today >= dayOfMonth && lastAppliedYm !== curYM` et aucune transaction `isAutoSaving` existante ce mois → dispatch `APPLY_AUTO_SAVING`
2. **Programmées** — si `date.startsWith(curYM) && today >= scheduledDay` → dispatch `CONFIRM_SCHEDULED`
3. **Notifications** — planifiées uniquement sur action utilisateur (pas au démarrage)
4. **Avertissements** — si `data.warning` est renseigné, affiché en toast puis effacé via `CLEAR_WARNING`
5. **Instantanés de projection** — à chaque calcul de la projection (Accueil), les mois pas encore figés dans `projectionSnapshots` sont sauvegardés (no-op côté reducer si déjà présents, pas de risque de boucle)

### FAB — appui long (templates rapides)

- `onMouseDown`/`onTouchStart` démarre un timer de 450 ms ; s'il aboutit, ouvre l'éventail (`quickFanOpen`) au lieu du menu habituel
- `onClick` vérifie un flag `fabLongPressed` pour ne PAS rouvrir le menu court après un appui long
- CSS `.fab` : `user-select: none`, `-webkit-touch-callout: none`, `touch-action: manipulation` — empêche la sélection de texte / le menu contextuel natif sur l'appui long
- Positionnement de l'éventail : angle mesuré de 15° (vers la gauche) à 100° (légèrement au-delà du haut) — évite de pousser les bulles hors de l'écran (le FAB étant collé au coin bas-droit)
- Voile sombre (`rgba(0,0,0,.68)` + `blur(3px)`) et halo bleuté radial derrière le FAB pendant que l'éventail est ouvert, pour rester lisible par-dessus le contenu de l'accueil

### SwipeRow — code couleur historique

| Type | Fond | Bande gauche | Badge |
|------|------|-------------|-------|
| `dissolution_cagnotte` | `#080f0c` | vert | ↑ Retrait cagnotte |
| `decagnottage` | `#0e0906` | corail | ↩ Retrait cagnotte |
| `epargne` | `#0b080f` | violet | ↓ Épargne |
| `balance_adjustment` | `#060e0a` | sapin | ⚖ Équilibre |

---

## Versioning

| Type | Condition | Exemple |
|------|-----------|---------|
| `PATCH` | Bug fix, retouche | `1.38.0` → `1.38.1` |
| `MINOR` | Nouvelle fonctionnalité | `1.38.0` → `1.39.0` |
| `MAJOR` | Refonte structurelle | `1.x.x` → `2.0.0` |

---

## Changelog

| Version | Type | Description |
|---------|------|--------------|
| **1.79.0** | minor | **7 nouveautés** — *Montants suggérés* : à la saisie d'une dépense ou d'un revenu, les 3 derniers montants distincts de la catégorie choisie en pastilles (un toucher remplit le montant ; masqués en modification, pour les cagnottes et l'équilibre). *Les plus utilisées* : en tête du choix de catégorie, les 4 catégories les plus utilisées des 3 derniers mois (dès 8 catégories). *Archiver une catégorie* (Options › Catégories) : elle disparaît des choix de saisie mais garde tout son historique ; une principale emporte ses sous-catégories ; section « archivées » repliable pour réactiver. *🩺 Vérification des données* (État de l'appli) : catégorie supprimée, montant à 0 €, date dans le futur, doublons probables (« Pas un doublon » mémorisé), frais/revenus fixes sans catégorie — chaque point avec son bouton, rien n'est corrigé sans un toucher. *🧾 Récap fiscal* (Rapport › Année) : garde d'enfant (7GA), dons aide aux personnes (7UD, plafond 2 000 € LF 2026), autres dons (7UF), emploi à domicile (7DB) — catégories au choix, aides et revenu facultatifs, **taux et plafonds modifiables à tout moment** ; table des règles par année dans l'appli (hors ligne), année inconnue → dernière année connue + avertissement. *📈 Patrimoine* : courbe empilée compte courant + cagnottes sur 12 mois, détail au toucher, depuis l'Accueil (« 📈 courbe ») et Rapport › Année. *Événements à préparer* : intégrés aux **Projets** (section « Projets & événements ») — option « Revient chaque année », cagnotte facultative (compte à rebours J−n), bilan après la date (prévu / dépensé / écart, dépenses du tag), « Reconduire en N+1 » avec le budget dépensé ou le budget gardé. Tout respecte le mode discret. |
| **1.78.0** | minor | **Harmonisation des écrans** — *Toutes les fenêtres au centre de l'écran* (avant : feuilles qui montaient du bas, en 4 styles différents) : saisies (opération, frais fixe, cagnotte, programmée, catégorie…), réglages d'Options, récaps (paie, mois, année), détail du solde, prévisions, actions d'une opération (Historique), fenêtre d'une cagnotte (Accueil) — même cadre : marge 12 px, coins 22 px, bordure fine, fond plein, titre + ✕ 32 px, défilement intérieur au-delà de 86 % de l'écran. Choix de catégorie / options : même cadre (titre normal, ✕ 32 px, largeur alignée). *Interrupteur unique* `Toggle` (42 × 24) à la place de 15 interrupteurs dessinés à la main (couleur propre à chaque réglage conservée). *Cartes* : plus de bande colorée à gauche (dernière sauvegarde, cartes du Rapport › Catégories, sections et vue Catégories de l'Historique, types de cagnotte, tags, montants à part, détail du solde, Fixes) → bordure fine teintée. *Écran du code PIN* : fond du thème, icône de l'appli, touches rondes, points de saisie couleur d'accent (fonctionnement inchangé). |
| **1.77.2** | patch | **Choix de catégorie dans les saisies** — catégories et sous-catégories rangées de A à Z (accents et majuscules ignorés, comme dans Options › Catégories) ; noms affichés en entier sur plusieurs lignes (avant : coupés, ex. « Course sem… ») ; la fenêtre défile si la liste dépasse l'écran. Vaut pour tous les formulaires qui utilisent le choix de catégorie (opération, frais/revenu fixe, programmée, modèle rapide…). |
| **1.77.1** | patch | **Captures d'écran rétablies + fenêtres opaques** — *Captures* : depuis 1.75.0, l'aperçu de l'appli était toujours masqué dans les applis récentes (`setRecentsScreenshotEnabled(false)` au démarrage) et, sur le Pixel, ça bloquait aussi les captures d'écran. Désormais réglable dans Options › Sécurité (« Masquer l'aperçu dans les applis récentes », **désactivé par défaut**), via un petit module Android `PrivacyScreen` ajouté par le build. *Fenêtres* : fond opaque pour la fenêtre de saisie et toutes les feuilles (avant : légèrement transparentes en thèmes Abysse / Glacier), la fenêtre de choix de catégorie / sous-catégorie, le choix de date, les feuilles récap (paie, mois, année, solde, prévisions, actions d'une opération) et la feuille d'une cagnotte à l'accueil. |
| **1.77.0** | minor | **Déplacer une catégorie** — bouton « ↔ Déplacer » dans la barre d'Options › Catégories : ranger une catégorie principale dans une autre (elle devient sous-catégorie), ou faire d'une sous-catégorie une catégorie principale. Destinations : catégories principales du même type. Si la catégorie a des sous-catégories : les emmener (elles passent dans la destination, un seul niveau) ou les laisser (elles deviennent principales). Résultat annoncé avant de valider ; bandeau « Annuler » 6 s après. Opérations, frais fixes, budgets et liaisons restent attachés aux mêmes catégories : seul le regroupement change (Rapport, budgets de la catégorie principale). |
| **1.76.0** | minor | **Catégories en grille + frais fixes rangés dans leurs catégories** — *Options › Catégories* : onglets Dépenses / Revenus et recherche collés en haut, grille de 4 tuiles par ligne des catégories principales (badge = nombre de sous-catégories, 📌 = contient des frais/revenus fixes, 🔗 = liée, point orange = jamais utilisée) ; toucher une tuile → barre collée en bas : frais fixes rangés ici (pastilles avec montant, ouvrent le frais), sous-catégories (pastilles), ＋ Sous-cat. · Modifier · Lier · Supprimer ; la recherche trouve aussi les sous-catégories. Une catégorie qui ne sert qu'à des fixes, récurrentes ou programmées n'est plus marquée « jamais utilisée ». *Rapport* (Mois « Où est parti l'argent » et onglet Catégories) : chaque frais fixe compte dans sa catégorie (avant : ligne « 📌 Frais fixes » à part, alors que budgets, « Ce qui a bougé » et détail d'une catégorie les comptaient déjà dedans) ; détail « dont fixes … · variables … », part fixe hachurée ; total « dont frais fixes » conservé en tête ; fixe sans catégorie → « Sans catégorie » ; total inchangé. *Fixes* : étiquette de catégorie sur chaque ligne, bandeau pour les fixes sans catégorie. *Formulaire d'un frais/revenu fixe* : plus de catégorie pré-remplie (avant : 1ʳᵉ de la liste), choix obligatoire (ou « Sans catégorie »), suggestions d'après le nom. |
| **1.75.0** | minor | **Sécurité et mode discret** — *Reverrouillage* : le PIN/l'empreinte est redemandé après un délai hors de l'appli (Options › Sécurité : Immédiat · 1 · 5 · 15 min · Jamais, 5 min par défaut ; avant : seulement au démarrage). *Essais du PIN* : après 3/5/10 erreurs (5 par défaut, ou illimité), attente de 30 s, puis 1 min, 5 min, 15 min ; compteur gardé hors des données (survit à la fermeture, absent des sauvegardes) ; l'empreinte reste utilisable. *Applis récentes* : aperçu remplacé par un fond uni (Android 13+, `setRecentsScreenshotEnabled(false)` injecté par le build), captures d'écran toujours possibles. *Sauvegardes chiffrées obligatoires* : AES-256-GCM + PBKDF2-SHA256 600 000 itérations, mot de passe choisi une fois (8 car. min., tapé 2 fois), vérifié à chaque sauvegarde, jamais stocké ; import : mot de passe demandé pour un fichier chiffré, anciens fichiers en clair toujours acceptés (sans effacer le mot de passe actuel) ; « mot de passe oublié » → nouveau mot de passe pour les sauvegardes suivantes. Avant, le fichier sur Drive était lisible en clair, PIN compris (4 chiffres = retrouvable en < 1 s). *Corrections* : nom du fichier de sauvegarde et heures de l'historique des sauvegardes en heure locale (avant : UTC), anciens fichiers de sauvegarde supprimés du cache de l'appli. *Mode discret* : bouton 👁 dans l'en-tête, montants et pourcentages masqués partout, barres de proportion cachées, graphiques floutés ; option « ouvrir l'appli en mode discret ». |
| **1.74.2** | patch | **Icône de la barre de notifications** — remplace le rond blanc « ! » par défaut d'Android par une silhouette monochrome de l'icône de l'appli (sac, pièces, camembert ; détails en creux). Fichier `assets/android-icons/ic_stat_notify.png` (96 px, blanc sur transparent), copié par le workflow dans `res/drawable-xxxhdpi` ; chaque notification la désigne via `smallIcon`. Si le fichier manque, Android reprend l'icône par défaut. |
| **1.74.1** | patch | **Notifications : vérification complète** — *Build* : le workflow ajoute la permission des **alarmes exactes** (`USE_EXACT_ALARM`, + `SCHEDULE_EXACT_ALARM` jusqu'à Android 12L) au manifeste recréé à chaque build ; sans elle, Android 14+ traitait les rappels comme « non exacts » et pouvait les retarder de plusieurs minutes à plusieurs heures (le test à +5 s semblait ne jamais arriver). *Test* : 2 étapes — une notification **immédiate** (vérifie l'affichage, sans alarme) puis un rappel programmé **dans 1 minute** (vérifie les alarmes). *Diagnostic* (Options › Notifications) : appli Android, module, permission (bouton « Demander »), alarmes exactes (bouton « Autoriser »), canal, liste des rappels réellement programmés avec leur date, notification immédiate à la demande, conseil batterie. Chaque réglage de notification replanifie aussitôt les rappels (avant : à la prochaine ouverture). Message d'erreur détaillé si Android refuse. Couleur d'accent posée sur chaque notification (le réglage du fichier de config n'était pas lu au build). |
| **1.74.0** | minor | **Fenêtres, catégories et Historique par type** — *Historique (Frise)* : une partie repliable par type d'opération (Dépenses, Revenus, Cagnottes, Équilibres, Hors compte), chacune avec sa frise par jour et un code couleur léger (titre, liseré, fond, bulles et trait de la frise) ; bloc « À confirmer » (récurrentes, programmées, épargnes) toujours visible, grisé quand il n'y a rien ; boutons « Tout replier / Tout déplier ». *Glisser une ligne* et *feuille d'actions* : boutons ronds à contour coloré (Modifier, Dupliquer, Supprimer, Pointer), comme le menu du +. *Bouton +* : après un appui long (modèles rapides), un nouvel appui sur + referme l'éventail au lieu d'ouvrir le menu des opérations par-dessus. *Catégories* : recherche, rangées de A à Z (sous-catégories aussi, accents ignorés), groupes Dépenses / Revenus, icône teintée, badges « jamais utilisée » et 🔗 liaison ; toucher une ligne = barre ＋ Sous-catégorie / ✏️ / 🔗 / 🗑. Nouveau : **couleur de catégorie** (10 teintes ou aucune) avec aperçu, utilisée par la frise et le Rapport. *Toutes les fenêtres* : feuilles qui montent du bas (poignée, coins arrondis), champs en verre sans liseré, clavier aux touches en verre, bouton principal de la couleur du type ; les réglages d'Options aussi ; confirmations en petite fenêtre centrée avec icône. Le thème Aube garde ses fenêtres centrées. |
| **1.73.0** | minor | **Cohérence visuelle + sections repliables** — *Historique* : les parties Opérations, Épargnes à confirmer, Programmées, Récurrentes à confirmer, Frais fixes et Revenus fixes du mois se replient / déplient d'un toucher sur leur titre (choix mémorisé). Les lignes des frais et revenus fixes (et le mode « pointage ») ont le même style que la frise : icône teintée, badge « FIXE · le 5 », montant, rond de pointage à droite ; toucher la ligne = corriger ce mois-ci (remplace le bouton ✏️), rangées par jour. Récurrentes, programmées et épargnes à confirmer en lignes du même style ; « Récurrentes à confirmer » n'apparaît plus quand il n'y a rien à confirmer. Total des fixes calculé avec les changements prévus. *Accueil* : aligné sur le mockup — titres de section sans trait, cartes en verre à liseré teinté sans pastille d'icône, Bilan en 4 tuiles teintées (mêmes chiffres, mêmes détails au toucher). *Bouton +* : menu comme le mockup — plus de panneau, une étiquette + une pastille ronde par type, rappel « appui long : modèles rapides ». |
| **1.72.0** | minor | **Rapport « récit » et Options « État de l'appli »** — *Rapport › Mois* : le mois raconté en une phrase (gagné, dépensé, mis de côté, comparaisons à la moyenne) et « Il te reste / Il te manque », barre « Où est parti l'argent » par catégorie (toucher = analyse), « Ce qui a bougé » en mots ; comparaison, budgets, à faire et note inchangés. *Rapport › Année* : l'année racontée (moyennes par mois, comparaison à l'an passé) avec la courbe du net cumulé et la projection au 31 déc. en pointillés, calendrier de 12 mois colorés selon le net (mini-barres revenus / dépenses, toucher = ouvre le mois), meilleur / moins bon mois ; bilan de l'année, épargne et fin d'année prévue inchangés. *Rapport › Catégories* : total + barre empilée, une carte par catégorie avec liseré de sa couleur (budgets, sous-catégories, montants à part et tags inchangés). *Options* : carte « État de l'appli » (sauvegarde, verrouillage, notifications, budget courses — x/4, chaque point ouvre son réglage, bouton Sauvegarder si besoin), « Mes données » en 3 boutons, thèmes en vignettes, réglages en tuiles 2 colonnes avec leur petite description et leur état, Réinitialiser à part en bas. |
| **1.71.0** | minor | **Écrans plus lisibles** — *Bouton +* opaque (bleu plein, bord clair) et, menu ouvert, fond de l'écran légèrement flouté pour faire ressortir les choix (menu sur fond plein). *Historique* : nouvelle vue **Frise** par défaut — une bulle par jour sur une ligne de temps, total du jour, lignes avec icône teintée de la catégorie, badges (chèque, montants à part, tags, « ↩️ X € attendus »), montant coloré par type et rond de pointage à droite ; toucher une ligne ouvre Pointer / Modifier / Dupliquer / Supprimer, le glissement vers la gauche reste. Vues Par type, Liste, Catégories et Calendrier toujours dans ⚙️ › Vue, filtres et sections à confirmer inchangés. *Cagnottes* : carte « Total mis de côté » avec ＋ Cagnotte / 🔄 Transférer, cartes compactes sur 2 colonnes (montant violet, anneau d'objectif, liseré du type, repères 🔁 🪙 projet) ; toucher une cagnotte ouvre sa fiche avec Verser / Retirer / Transférer (pré-réglés sur elle), objectif, historique et ✏️ Modifier. *Fixes* : frise du mois (un point par échéance, trait « aujourd'hui ») et échéancier rangé par jour avec bulle du jour, statut (✓ / à pointer / à venir) et la même barre d'actions (pointer, jour, pause, modifier, supprimer) ; sections En pause et Commencent plus tard ; prévisions ponctuelles en lignes. Accueil et saisies inchangés. |
| **1.70.0** | minor | **Thèmes « Verre bleu »** — nouveau groupe Options › 🎨 Apparence : *Verre bleu · Abysse* (par défaut), *Verre bleu · Glacier*, ou *Aube (classique)*, le thème d'origine conservé à l'identique. Thèmes verre : fond à halos bleus, cartes et feuilles en verre dépoli, barre d'onglets flottante arrondie, bouton + en dégradé bleu, titres en DM Sans. Code couleur des cartes et pastilles inchangé (violet réservé aux cagnottes). Interrupteur « Effets de verre » pour couper le flou. Choix enregistré dans les données (donc dans les sauvegardes). Copie de l'ancien CSS dans `theme-backup/`. Aucun écran ni fonction modifié. |
| **1.69.1** | patch | Un « À recevoir » saisi seul (sans dépense liée) est lui aussi compté dans le solde estimé jusqu'à sa réception (retard compté depuis sa date prévue ou sa création). |
| **1.69.0** | minor | **Remboursements attendus comptés** — une dépense marquée « sera remboursée » compte le remboursement dans le solde estimé (nouvelle ligne « ↩️ Remboursements attendus » dans le détail), donc dans le reste à vivre et la projection, dès sa saisie et jusqu'à sa réception (il devient alors un revenu normal : jamais compté deux fois). La part remboursée (attendue ou reçue) n'est plus comptée dans le budget courses ni dans le Rapport par catégorie. Pastille « … à recevoir · comptés », ⚠️ après un délai réglable (Options › Budget & prévisions › Remboursements attendus, 15 j par défaut). Un « À recevoir » sans dépense liée n'est pas compté. |
| **1.68.0** | minor | **Taux d'épargne** ((versements − retraits) ÷ revenus) dans le récap à la paie (avant / après versement + moyenne 12 mois), le bilan du 1er et une carte 12 mois dans Rapport › Année (moyenne en pointillés, détail au toucher). **Bilan de l'année** (« 2026 en bref ») : s'ouvre le 1er janvier après celui de décembre, et depuis Rapport › Année ; revenus / dépenses vs année précédente, épargne et taux, cagnottes début → fin, meilleur / pire mois, catégories qui ont le plus bougé, frais fixes et hausses. **Changements de revenu prévus** (fiche d'un revenu fixe) : période + montant, pris en compte partout (budget, solde, reste à vivre, projection, récap), exclus de la moyenne automatique, alerte si la projection 3 mois passe sous 0 € à cause du changement. Correction : la projection ne compte plus comme « flux courant » les anciens salaires saisis à la main dans la catégorie d'un revenu fixe (ils doublaient le salaire). |
| **1.67.0** | minor | **Salaire, suite** — Fixes : la case « Revenus oct. » indique aussi « +2 422 € attendus/reçus → nov. » et une phrase explique que le salaire du 29 compte pour novembre. Saisie d'un revenu dans la catégorie d'un revenu fixe : avertissement « déjà prévu en revenu fixe, compté deux fois » + bouton pour le pointer (« Enregistrer quand même » reste possible). Pointage : interrupteur **« Mois exceptionnel »** (congé, prime…) — compté au budget, exclu de la moyenne du montant prévu. Bilan du 1er : ligne **« À la paie : reste X, mis de côté Y · reste final Z »**, en orange si trop a été mis de côté. |
| **1.66.1** | patch | Interne : la règle « frais/revenu fixe actif ce mois-ci » (démarrage, pauses) n'existe plus qu'à un seul endroit (`utils.js`), partagée par les calculs et la comparaison de relevé (avant : copiée dans `releve.js`). Aucun changement visible. |
| **1.66.0** | minor | **Récap à la paie** — quand tu pointes ton salaire (revenu fixe daté le plus élevé), une feuille s'ouvre : bilan simple du mois qui se termine (revenus, frais fixes, dépenses courantes, déjà mis de côté, reste du mois — mêmes chiffres que le Rapport) et **somme à mettre de côté** = reste du mois arrondi à la dizaine inférieure, avec versement direct vers une cagnotte (opération 🐷 Épargne « Reste de … »). |
| **1.65.0** | patch | **Solde estimé : un revenu fixe daté n'est compté qu'à sa date de versement** (ou dès qu'il est pointé s'il arrive en avance), plus dès le début du mois ; avant, il est listé « à venir » hors solde. Reste à vivre : ajoute les revenus attendus avant la paie. **Règles « dernier / avant-dernier jour ouvré »** : une date qui tombe un lundi est avancée au jour ouvré précédent (banques fermées le lundi). |
| **1.64.0** | minor | **Salaire : vraie date, bon mois, montant réel** — nouveau jour de versement/prélèvement « Dernier jour ouvré » / « Avant-dernier jour ouvré » (week-ends et jours fériés français sautés, date recalculée chaque mois). Revenu fixe : option **« Compter dans le budget du mois suivant »** (versé fin octobre → budget et rapports de novembre ; solde, paie, reste à vivre, projection et comparaison de relevé à la vraie date) et **montant prévu automatique** (moyenne des 3 derniers montants réels, repris au début des opérations de la même catégorie). Pointer un tel revenu ouvre une fenêtre « montant réel » pré-remplie, figée pour ce mois. Correction : le reste à vivre ne compte plus une paie du mois en cours pas encore arrivée. |
| **1.63.0** | minor | **Comparer avec un relevé (lecture seule)** — bouton 🏦 dans la barre de l'Historique et Options › Mes données. Choisis le relevé PDF de ta banque (format Crédit Mutuel de Bretagne / Arkéa) : il est lu **sur le téléphone** avec pdf.js, sans réseau, puis oublié. Lecture vérifiée contre les sous-totaux, les totaux et « ancien solde + mouvements = nouveau solde ». Rapprochement par **montant au centime + date** (carte : date d'achat du libellé ±2 j ; virements/prélèvements ±4 j ; chèques jusqu'à 90 j), une ligne bancaire = une opération ; frais/revenus fixes et versements/retraits de cagnotte (livret) compris. Résultat : retrouvées, **oubliées** (à la banque, pas dans l'appli), **en trop** (doublon possible signalé), **presque pareilles** (chiffres inversés…), mis de côté (chèques non encaissés, après la fin du relevé), écart expliqué, solde du livret vs total des cagnottes. **Rien n'est créé, pointé, enregistré ni partagé** ; nom, adresse, IBAN et numéros de compte ne sont jamais lus. Nouvelle dépendance : `pdfjs-dist` 6.2.108 (chargée seulement à l'ouverture de cet écran) |
| **1.62.1** | patch | **Historique filtré (Pointées / Attente) lisible** : les boutons Modifier / Supprimer restaient affichés sous chaque ligne pointée et se voyaient à travers son fond semi-transparent, masquant les montants. Ils n'apparaissent plus qu'en glissant la ligne vers la gauche, et le fond des lignes pointées est opaque |
| **1.62.0** | minor | **Projection fiable** — corrections : le reste des dépenses courantes du mois en cours est enfin déduit (avant : projection trop optimiste d'environ un demi-mois) ; les mois sans aucune donnée ne comptent plus pour 0 dans la médiane ; la fiabilité compte les opérations d'équilibre et ne compare plus que les projections faites le mois d'avant (les anciennes, faites jusqu'à 3 mois avant, sont remplacées). Ajouts : récurrentes annuelles projetées au mois de leur dernière occurrence ; calcul **jour par jour** → point bas réel (« juste avant la paie ») au lieu de la fin de mois ; **fourchette** selon tes derniers mois ; courbe quotidienne avec les fins de mois — touche un point pour le **détail ligne par ligne** (départ, revenus, fixes, récurrentes, programmées, courant estimé, fin de mois) ; fiabilité résumée (« erreur moyenne ±x €, plutôt optimiste / prudente »). La simulation « Et si… ? » part des mêmes chiffres corrigés |
| **1.61.0** | minor | **Accueil : carte Projection refaite** — point le plus bas des 3 prochains mois en grand (« au plus bas, en déc. »), courbe aujourd'hui → 3 mois avec la ligne pointillée du seuil d'alerte (points jaunes sous le seuil, rouges en négatif), pastilles **Points d'attention** (découvert / sous le seuil, plus grosse programmée) et **Hypothèses** (flux courant, fiabilité ±x € → détail mois par mois, 🧪 Et si… ?). L'explication du calcul passe derrière le ⓘ du titre. Mode simulation inchangé. **Ménage CSS** : `.hero-dot(s)`, `.dash-cagnotte(2)`, `.dash-fixe(2)`, `.dash-revenu`, `.dash-depense`, `.dash-dep-var` (16 lignes, plus utilisées) |
| **1.60.0** | minor | **Accueil : cartes différenciées** — chaque carte a sa couleur (🧾 chèques bleu, ⏳ À venir argent, 🐷 Cagnottes violet, 📌 Fixes orange, 📊 Bilan bleu ciel) : fond légèrement teinté, icône dans une pastille carrée colorée, titre en couleur. Petits titres de section : « À traiter » (surplus, chèques, À venir — seulement s'il y a quelque chose), « Patrimoine » (Cagnottes, Fixes), « Résultats » (Bilan). Purement visuel |
| **1.59.1** | patch | **Accueil : carte du solde plus aérée** (marges, solde un peu plus grand, pastilles plus grandes et espacées) et **pastilles qui passent à la ligne** au lieu de défiler horizontalement |
| **1.59.0** | minor | **Accueil : carte du solde ramassée** (~200 px au lieu de ~400) : solde + pastille « ▲ x % vs même jour du mois dernier » (touche → fenêtre **Évolution du solde** avec le graphe des 6 mois, les soldes et la variation de chaque mois) ; pastilles rangées en 2 lignes titrées — **Ce mois-ci** (courses, reste à vivre, à recevoir, après prévisions, arrondis du mois/de l'année, arrondis à virer) et **Rapprochement x/y** (pointé, en attente, porte-monnaie TR) ; bascule **Solde / Projection** à la place des points du carrousel, la hauteur suit la carte affichée. **« À venir » remonté juste sous la carte chèque** ; le reste de l'écran est inchangé. Calculs identiques (même solde, même écart, mêmes montants) |
| **1.58.0** | minor | **Jour d'un frais/revenu fixe choisi depuis sa tuile** (écran Fixes) : bouton « 📅 Jour ? » (en jaune s'il manque) ou « 📅 Le 12 » dans la barre d'actions → grille 1–31 ; la tuile se range aussitôt dans le bon groupe. Les tuiles sans jour affichent « jour ? » en jaune. Bouton pause réduit à ⏸️ / ▶️. **Saisie plus fluide** : « Repéré pour toi » n'est plus recalculé à chaque chiffre tapé, seulement quand les données changent |
| **1.57.1** | patch | **Ajustements manuels de cagnotte tracés** : modifier « Déjà épargné » dans la fiche ajoute une ligne « ✏️ Ajustement manuel » (date, avant → après, écart) dans l'historique de la cagnotte. Sans effet sur le solde bancaire ni sur le versé/retiré (ce n'est pas une transaction). **Ménage** : `PALETTE` et `polar` (utils.js), `useYearTotals` (hooks.js), plus utilisés nulle part |
| **1.57.0** | minor | **Récap de l'écran Cagnottes plus détaillé, aussi compact** : net du mois à côté du total, barre de répartition par type, ligne résumé (mois · objectif annuel ou net de l'année · versements auto). « Détail ▾ » ouvre (et mémorise) un panneau qui défile avec la page : répartition chiffrée par type, mouvements du mois / du mois précédent / de l'année, objectif annuel (même calcul que le Rapport), avancement des objectifs des cagnottes, versements auto, arrondis du mois. Les retraits incluent désormais les dissolutions de cagnotte, comme dans le Rapport |
| **1.56.0** | minor | **Types de cagnotte personnalisables** (Options › 🐷 Épargne automatique › Types de cagnotte, ou « ⚙️ Gérer les types » depuis la fiche d'une cagnotte) : créer, renommer, changer l'emoji et la couleur, supprimer. Les 4 types d'origine (Projet, Urgence, Plaisir, Investissement) deviennent les types de départ. Supprimer un type utilisé fait passer ses cagnottes « sans type » (🐷) après confirmation — argent et objectifs inchangés. Purement visuel : aucun calcul ne dépend du type. Fenêtres de gestion et fiche cagnotte centrées à l'écran |
| **1.55.1** | patch | **Ménage** : suppression de `components/charts.jsx` (ChartSVG, PatrimoineSVG), plus utilisé nulle part depuis la refonte du Rapport (v1.52.0/1.53.1). Aucun changement visible |
| **1.55.0** | minor | **Écran Fixes refait en échéancier de tuiles** : barre collée (charges / revenus / net du mois, bascule Charges ↔ Revenus, ＋), avancement du mois (« x/y prélevés · reste à prélever »), tuiles compactes 3 par ligne (jour, icône, statut, montant du mois avec correction ponctuelle, ▲▼ si le montant a changé) rangées en groupes pliables : passés pas encore pointés, à venir, déjà pointés, en pause, commencent plus tard. Groupes dépliés par défaut, pliage mémorisé. **Pointer / dépointer directement depuis une tuile**. « Repéré pour toi » réduit à une ligne (touche pour voir). Prévisions ponctuelles en tuiles |
| **1.54.0** | minor | **Options réorganisées par usage** : 💶 Budget & prévisions, 🐷 Épargne automatique, ✍️ Saisie & classement, 🔔 Notifications, 🔒 Sécurité, 💾 Mes données (Sauvegarder, Importer, Réinitialiser). Lignes plus denses avec une ligne d'explication sous chaque réglage (remplace le ⓘ). **Rappel de sauvegarde** en haut de l'écran si aucune sauvegarde ou si la dernière date de plus de 7 jours (bouton Sauvegarder direct). Statistiques globales en une ligne de pied de page |
| **1.53.1** | patch | **Dissolution de cagnotte ≠ revenu** dans les totaux (Bilan, Rapport, détails, bilan du 1ᵉʳ du mois) : comptée avec les retraits de cagnotte ; les soldes la comptent toujours. Le bilan du 1ᵉʳ du mois utilise désormais exactement les mêmes revenus/dépenses que le Rapport. **Fenêtres ouvertes depuis Options (et Rapport) visibles sans défiler** : l'animation de changement d'onglet laissait un `transform` actif (fill-mode « both » → « backwards ») et `Modal` est rendu dans `<body>` (portail). **Ménage** (~800 lignes) : anciens blocs du Rapport (comparaison de périodes, notes, suivi, taux d'épargne, donut, analyses), donut et barre de budget de l'Historique, fenêtre « détail d'un mois » |
| **1.53.0** | minor | **Cagnottes compact** (variante B « grille compacte ») : barre collée en haut avec le **total mis de côté**, 🔄 transfert et ＋ Cagnotte ; pastilles « épargné ce mois / retirés / année » (remplacent le bloc de 4 lignes) ; projets en bandeau horizontal (barre + trait « prévu à ce jour », statut, €/mois), détail complet au toucher ; cartes de cagnottes 2× plus basses, couleur de bordure = type, % de l'objectif, €/mois, versement auto, arrondis, projet lié. La **suppression** d'une cagnotte se fait désormais depuis ✏️ (bouton « Supprimer la cagnotte », avec confirmation) — plus de ✕ sur les cartes. 1ʳᵉ cagnotte à ~310 px au lieu de ~640 px |
| **1.52.1** | patch | Barre du bas : libellés légèrement plus petits (.6rem, `flex: 1 1 0; min-width: 0`) — icônes toujours à égale distance, les mots ne se touchent plus (« Cagnottes » / « Historique ») |
| **1.52.0** | minor | **Rapport refondu** en 3 onglets avec barre collée (onglets + ◀ période ▶) : **📅 Mois** (par défaut) — revenus/dépenses/épargné/net vs moyenne 3 mois, « 🔀 Comparer à un autre mois » (remplace l'onglet Périodes), ce qui a bougé, budgets du mois (catégories, budget courses, tags), à faire (à pointer → Historique, chèques), note du mois ; **📆 Année** — 4 chiffres (vs année précédente quand il y a des données), un seul graphique mois par mois (toucher un mois → onglet Mois), meilleur/moins bon mois, objectif d'épargne (**désormais enregistré**, avant il était perdu en quittant l'écran) + montant mensuel nécessaire, taux d'épargne par mois, fin d'année prévue ; **🗂️ Catégories** (mois ou année) — coût net par catégorie (sous-catégories détaillées, revenus liés déduits comme avant), budget réglable sous chaque ligne, alerte sur l'onglet, toucher → analyse de la catégorie ; montants à part & hors banque (payé banque / hors banque / budget réel, par type et par catégorie) ; tags (total, nombre d'opérations, budget). Retirés : donut, 2ᵉ graphique « évolution du solde net », bloc cagnottes, liste des notes de tous les mois, bouton « Bilans mensuels » (le bilan s'affiche toujours le 1ᵉʳ du mois). Corrigé : la comparaison de périodes ignorait les revenus fixes et ne comptait les frais fixes que pour le mois en cours |
| **1.51.0** | minor | **Historique compact** (variante B) : une barre unique collée en haut — ◀ mois ▶, 🔍 (ouvre la recherche), ⚙️ filtres (avec compteur), ⊟/⊞ tout replier — et une ligne de pastilles (revenus, dépenses, ✓ pointées x/y, ⏳ en attente ; les 2 dernières filtrent au toucher). Retirés : donut + « budget consommé », carte rapprochement, zone de recherche à 2 lignes, ligne « Tout replier ». 1ʳᵉ dépense à ~260 px au lieu de ~685 px. Recherche aussi par **montant** (« 67,48 » ou « 67 »). Corrigés : 2 boutons 🌐 en double, « Tout reset » qui remettait la vue Liste au lieu de Par type. `overflow-x: clip` au lieu de `hidden` (html, body, .container) : l'en-tête reste maintenant réellement visible en haut, comme prévu par son `position: sticky` |
| **1.50.1** | patch | Historique : opérations affichées **des plus récentes aux plus anciennes** par défaut — semaines dans l'ordre décroissant (vue « Par type »), et à date égale la dernière saisie en premier (opérations bancaires et hors compte) |
| **1.50.0** | minor | **Revenu fixe corrigé pour un mois** (✏️ « ce mois uniquement » dans Historique → Revenus fixes du mois, comme les frais fixes ; pris en compte partout, `effectiveIncomesForMonth` respecte désormais `monthlyOverrides`) ; **🎯 budget de la catégorie dans la saisie** (dépensé du mois + la dépense en cours / plafond, catégorie + sous-catégories + frais fixes, vert/orange ≥ 80 %/rouge, informatif) ; **🧪 Et si… ?** sur la carte Projection : changements temporaires (baisse/hausse de revenu, dépense mensuelle, dépense unique, durée 1/3/6 mois/toujours) simulés sur 6 mois, courbe comparée, point bas, économie mensuelle nécessaire pour rester au-dessus de la marge — rien n'est enregistré ; **🔍 Repéré pour toi** (page Fixes + point sur l'onglet) : hausse de prix d'une récurrente (≥ +5 % et ≥ +1 €, « Mettre à jour ») et dépense régulière non déclarée (même catégorie/note, ±10 %, 3 mois sur 4, 1×/mois, jour ±5 ; « Créer un frais fixe », démarrage le mois suivant si déjà payée ce mois), « Ignorer » mémorisé ; **💡 surplus de fin de cycle** les 5 derniers jours avant la paie (ou du mois) : reste à vivre − dépenses courantes estimées (médiane/jour hors courses), ≥ 20 €, arrondi à la dizaine, « Verser » crée une épargne vers la cagnotte choisie, ✕ jusqu'à la paie suivante. Aussi : total « Frais fixes » de l'Historique tient compte des corrections du mois ; police Syne (inutilisée) plus téléchargée ; import inutile retiré |
| **1.49.1** | patch | **Détails cohérents avec les cases** : le détail ouvert depuis le Bilan (Revenus / Dépenses / Dép. variables, mois ou année) et le détail d'un mois du Rapport affichent désormais les mêmes totaux que les cases et le graphique (`computePeriodTotals` / `computeMonthTotals`) — avant, les revenus fixes étaient ignorés et les frais fixes comptés pour un seul mois (ou seulement le mois en cours). Nouvelles sections « Revenus fixes » / « Frais fixes » ligne par ligne (« 4 mois × 2 100,00 € » sur l'année), sans les fixes inactifs ou en pause |
| **1.49.0** | minor | **Titres de page** = emoji + libellé du menu (🏠 Accueil, 🐷 Cagnottes, 📋 Historique, 📌 Fixes, 📊 Rapport, ⚙️ Options) avec une ligne de contexte (mois, nombre/total des cagnottes, mois affiché dans l'Historique, « frais & revenus fixes », année du rapport) ; bouton ☀️ retiré (thème sombre forcé) ; **Historique** : la catégorie n'apparaît plus 2 fois quand il n'y a pas de note — sous-ligne « jour date » (« mar. 07/10 »), précédée de la catégorie parente pour une sous-catégorie ; **Accueil compact** : « Mois en cours » + « Année en cours » fusionnés en un bloc « 📊 Bilan » (sélecteur Octobre | 2026, revient toujours sur le mois), cartes Cagnottes / Fixes sur une ligne, taux d'épargne déplacé dans le détail des cagnottes ; **police DM Sans intégrée** à l'APK (≈ 50 Ko, s'affiche sans Internet), chiffres de largeur fixe limités aux chiffres (la virgule et l'espace ne sont plus élargis) |
| **1.48.0** | minor | **Jour de prélèvement** des frais et revenus fixes (Aucun / 1 / 5 / 10 / grille 31 j) ; panneau **À venir** avec 2 onglets — « 📋 Liste » (par défaut, dates de prélèvement affichées) et « 📅 Calendrier & solde » (calendrier du mois, opérations datées jusqu'à la paie, courbe du solde jour par jour, point bas) — bandeau d'accueil inchangé ; **reste à vivre** par jour jusqu'à la paie (revenu fixe daté le plus élevé) en pastille + détail, marge de sécurité 0 € par défaut modifiable (Options → Reste à vivre), indicatif ; **remboursements attendus** : option « ↩️ Sera remboursé » d'une dépense (tout / 50 % / montant, par qui, date), entrée « À recevoir » dans le bouton +, pastille + liste, « ✓ Reçu » crée le revenu, un revenu correspondant (± 1 € ou nom) propose « C'est le remboursement de… ? », rappel 15 j après la date prévue ; jamais compté dans le solde avant réception ; **rappel du soir** (heure, jours) seulement si rien n'a été saisi ce jour-là, avec boutons Saisir / Rien aujourd'hui. Pastilles de la carte du solde sur 2 lignes |
| **1.47.1** | patch | Totaux mensuels et annuels justes partout — nouvelle source unique `computeMonthTotals` / `computePeriodTotals` (opérations + frais fixes + revenus fixes de chaque mois vécu, depuis la 1ʳᵉ opération et jusqu'au mois en cours) utilisée par l'Accueil (mois en cours / précédent, année en cours / même période l'an dernier), le donut de l'Historique, le Rapport (mois, année, classement, comparaison N-1, taux d'épargne, analyste, top catégories). Corrige « Dépenses ▲ 117 % » (fixes comptés seulement pour le mois en cours), les revenus fixes absents de tous ces chiffres, et les frais fixes comptés avant le début d'utilisation de l'app |
| **1.47.0** | minor | **Historique « Par type »** (vue par défaut) : blocs dépliants Dépenses / Revenus / Frais & revenus fixes / Cagnottes / Équilibres / Hors compte avec total et nombre à pointer, puis sous-blocs par semaine ; **sous-catégories** (`parentId`, un niveau) : saisie avec ▸ « Toute la catégorie » / sous-catégories, champ « Transport › Carburant », arbre dans Options (＋ sous), Rapport, seuils et budget courses additionnent les sous-catégories dans la principale ; liaisons inchangées ; **suppression protégée** des catégories (liste de tout ce qui est rattaché + déplacer vers / laisser sans catégorie — plus d'opérations orphelines) ; **aperçu avant import** (fichier vs données actuelles, alerte opérations perdues, sauvegarde préalable cochée par défaut ; la version de l'app est désormais notée dans les sauvegardes) ; **clôture du mois** (« Octobre en bref » affiché automatiquement le 1er du mois, une seule fois, + Rapport → Bilans mensuels) ; **projets avec échéance** (onglet Cagnottes : cagnotte + tag liés, avance/retard, € par mois, versement auto en un tap). Fix : le réglage Options → Budget courses n'était pas enregistré (callback branché sur le Rapport au lieu des Options depuis 1.46.0) |
| **1.46.2** | patch | 3 correctifs : (1) projection 3 mois — les frais/revenus fixes en pause (y compris pauses passées) ou pas encore commencés (`startYM`) étaient quand même projetés → passe désormais par `isActiveForMonth` ; (2) badge % et petite courbe de la hero card — les opérations d'équilibre (+/−) étaient ignorées dans les soldes des mois passés ; (3) notification « Récurrentes à confirmer » — annonçait le nombre total de modèles au lieu de celles qui tombent vraiment le mois suivant (terminées exclues, annuelles seulement en janvier) |
| **1.46.1** | patch | Budget courses : la moyenne inclut maintenant le mois en cours **au prorata** de la part du mois écoulée — (N derniers mois complets + dépensé ce mois) ÷ (N + jour/nb de jours du mois). En début de mois ≈ moyenne des mois passés, le dernier jour = moyenne simple des N+1 mois. Ligne « Octobre (au 10) · poids 10/31 » ajoutée au détail ; réglage « N mois + en cours » |
| **1.46.0** | minor | Budget courses (informatif, **n'impacte pas le solde estimé**) : reste à dépenser ce mois = moyenne des 2 derniers mois complets (1 ou 3 au choix) − déjà dépensé ce mois, dans la catégorie « Courses » (ou celles choisies). Pastille corail sous le solde de la hero card (« 142,30 € de courses à prévoir ce mois » / « budget dépassé de X € ») ; section « Pour information · non déduit » sous le total du panneau « Calcul du solde estimé » (mois, moyenne, déjà dépensé, barre de progression, solde après courses prévues) ; réglage Options → Épargne → Budget courses. Seule la part payée par la banque compte ; récurrentes et arrondis exclus ; calcul unique `computeGroceryBudget()` |
| **1.45.3** | patch | Nettoyage code mort (validé) : méthode `closeType` de `useSideAmounts`, plus utilisée depuis la suppression de `SideAmountsPicker` |
| **1.45.2** | patch | Nettoyage code mort (validé) : `SideAmountsPicker` (ancien sélecteur de montants à part, remplacé par le menu « Options ») et `Field` (ancien champ avec libellé), plus utilisés depuis 1.45.0 |
| **1.45.1** | patch | Fix pause des frais/revenus fixes : réactiver un fixe effaçait la période de pause → les mois en pause redevenaient « à payer » (en attente) dans le solde estimé. Chaque pause terminée est maintenant archivée (`pauseHistory`, fait dans le reducer : bouton ▶️ et formulaire) et reste exclue partout via `isActiveForMonth` ; nouvelle rubrique « Pauses passées » dans les Options du formulaire pour ajouter/retirer une période (réparation des pauses effacées avant cette version) |
| **1.45.0** | minor | Tous les formulaires de saisie sur le modèle de la saisie d'une dépense (boutons de type, montant au clavier de l'app, champs colorés, menus déroulants, Annuler / Enregistrer) : frais/revenu fixe (un seul formulaire, bascule à la création, mois de début en boutons, pause dans « Options »), cagnotte (type en boutons, objectif + déjà épargné au clavier), transfert (cagnottes en menus déroulants), programmée (raccourcis Demain / +1 sem. / le 1er), catégorie et template (icône + nom, aperçu), saisie rapide (même ordre que la saisie normale, montants à part dans « Options ») ; **détail du solde estimé** : toucher le montant de la hero card ouvre « Calcul du solde estimé » (pointé, en attente avec chèques non encaissés à part et périmés signalés, frais/revenus fixes non pointés regroupés, récurrentes pas encore passées, programmées échues) — calcul unique `computeBalanceBreakdown()` qui produit aussi le chiffre de la carte ; fix : un montant tapé « 12+3 » sans appuyer sur « = » était enregistré 12 € au lieu de 15 € |
| **1.44.3** | patch | Formulaire hors compte aligné sur la saisie d'une dépense : boutons « Payé avec » au style des boutons de type, montant + clavier de l'app en haut, catégorie en menu déroulant (grille), date avec « Autre… » → calendrier, note, boutons Annuler / Enregistrer ; catégorie et date sont désormais des composants partagés (`CategoryField`, `DateField`) entre les deux formulaires |
| **1.44.2** | patch | Fix date « Autre… » : le bouton ne faisait rien, il ouvre maintenant le calendrier natif (et affiche la date choisie) ; fix glissement : commencer un défilement le doigt posé sur un bouton ne le déclenche plus (ouverture de menu, pointage, confirmation de récurrente…) — détecteur global `touchMoved()` appliqué aux 33 boutons réagissant au relâcher du doigt |
| **1.44.1** | patch | Fix récurrentes : modifier une opération créée par une récurrente effaçait son lien (`templateId`) → la récurrente redevenait « à confirmer » et était comptée deux fois dans le solde estimé. Le formulaire renvoie désormais le lien existant et le reducer ne peut plus l'effacer |
| **1.44.0** | minor | Écran de saisie qui tient sans défilement sur un Pixel 8 (largeur inchangée) : 4 boutons de type sur une ligne (même style), catégorie en violet, date en bleu, note en gris ; montants à part, chèque, tags et récurrence regroupés dans un menu déroulant « Options » (cuivre) qui s'ouvre par-dessus et affiche un résumé une fois rempli |
| **1.43.0** | minor | Chèques : bouton « 🧾 Chèque » (+ n° optionnel) dans la saisie d'une dépense ; bandeau « N chèques non encaissés » sous la hero card de l'accueil, liste avec ancienneté colorée, encaissement à une date choisie (la dépense passe à la date d'encaissement, la date d'émission est conservée), annulation des chèques périmés (1 an et 8 jours) ; pointer un chèque dans l'Historique = l'encaisser à la date du jour ; rappels (tous les 15/30/60 j + 1 mois avant péremption) ; confirmation des récurrentes basée sur la date d'émission (`recurringRefDate`) pour qu'un loyer payé par chèque reste rattaché au bon mois. Aucun calcul de solde modifié |
| **1.42.0** | minor | Dépenses hors compte (tickets resto…) : entrée « 🎫 Hors compte » dans le bouton + (3ᵉ en partant du bas), formulaire avec le clavier de l'app, stockage séparé `offAccountEntries` (aucun impact sur les calculs bancaires) ; porte-monnaie par type avec « Suivre le solde » (rechargements, corrections, solde = rechargements − dépenses hors compte − TR utilisés en complément), 3ᵉ mini-carte « métal » dans la hero card de l'accueil ; lignes hors compte dans l'Historique (hors totaux et pointage, filtre Masquer) ; Rapport : montants à part incluant le hors compte + carte « Payé hors banque par catégorie » (filtres type et mois/année) ; couleur TR dédiée `--tr` (or/cuivre) partout |
| **1.41.1** | patch | Nettoyage code mort : composant `Sparkline` (jamais rendu) + hook `useSpark`, imports inutilisés `getPrevMonth` (hooks.js) et `polar` (charts.jsx), 18 règles CSS jamais utilisées (`fixed-card*`, `fixed-grid`, `fixed-row`, `savings-bar-bg`, `dash-balance`, `dash-decag`, `hero-indicator`, `section-enter`, `section-title`, `btn-success`, `filter-row`) |
| **1.41.0** | minor | Budget par tag : montant optionnel « par mois » ou « total (projet) » dans le gestionnaire de tags (désormais modifiable ✏️), barres de suivi dans Rapport (vert < 80 %, orange 80–100 %, rouge dépassé), alerte sur l'Accueil dès 80 % ; calcul unique `computeTagBudgets()` dans hooks.js |
| **1.40.0** | minor | Découpage de `views.jsx` en un fichier par vue (`src/views/`) ; notifications réparées : plugin `@capacitor/local-notifications` absent de `package.json` (cause racine), canal Android, replanification à chaque ouverture, rappel sauvegarde même sans sauvegarde antérieure, versements auto programmés au mois suivant si le jour est passé, plus de doublons, notification de test, messages d'erreur visibles ; `normalizeData()` commun au chargement et à l'import (fusion des réglages de notifications + migration des tickets resto de 1.39.31) ; sélecteur de montants à part et raccourcis de dates factorisés ; texte de l'opération d'équilibre corrigé (elle impacte aussi le solde estimé) |
| **1.39.26** | patch | Fix sparkline hero card — le point du mois en cours utilise directement la valeur du solde estimé au lieu d'un calcul indépendant qui avait fini par diverger |
| **1.39.25** | patch | Fix rapprochement — retrait des revenus fixes du calcul de "solde pointé" (doit rester ce que l'utilisateur a réellement vérifié, pas une extrapolation automatique) |
| **1.39.24** | minor | Refonte "solde estimé" — nouveau hook `useReconciliation`, source unique pour pointé/en attente ; le solde estimé en découle directement (`pointé + en attente − récurrentes/programmées non confirmées`), sans plus jamais compter un frais fixe non pointé deux fois (une fois dans "en attente", une fois dans "à venir") |
| **1.39.23** | — | *(correctif préservation `templateId` à l'édition, développé puis annulé sur demande avant d'être réappliqué différemment en 1.39.24+)* |
| **1.39.22** | — | *(tentative d'ajout des revenus fixes au rapprochement, annulée sur demande — voir 1.39.25 pour la version correcte)* |
| **1.39.21** | patch | Voile sombre + halo bleuté derrière l'éventail de templates rapides (au lieu d'un fond transparent qui perdait les bulles dans le contenu de l'accueil) |
| **1.39.20** | patch | Fix appui long FAB — sélection de texte native bloquée (`user-select`, `touch-action`) ; correction d'une inversion de signe qui poussait l'éventail hors de l'écran |
| **1.39.19** | minor | Carte "À venir" (fermée) — distingue "Ce mois" et le mois suivant ayant une programmée, au lieu d'un total unique |
| **1.39.18** | minor | Templates de saisie rapide — appui long sur le FAB, éventail de templates, tiroir de saisie (vrai `NumPad`, date modifiable), gestion créer/modifier/supprimer, entrée dans Options |
| **1.39.17** | patch | Fix carte Fixes/mois et calculs annuels (`useYearTotals`/`useYearMonths`) — les frais fixes n'étaient comptés que pour le mois en cours dans les totaux annuels, ignorant tous les mois précédents de l'année ; fix `useTotalFixes` pour respecter aussi les corrections ponctuelles (`monthlyOverrides`) du mois |
| **1.39.16** | patch | Fix `startYM` (date de démarrage d'un frais fixe) non respecté à 7 autres endroits (accueil, historique, popups de détail, rapport, suivi catégories) ; fix de 7 usages de `toISOString()` (bug de fuseau horaire, UTC au lieu de l'heure locale) sur les raccourcis de date et les vérifications de mois en cours |
| **1.39.15** | patch | *(étape intermédiaire — voir 1.39.16/1.39.17 pour le détail des correctifs)* |
| **1.39.14** | minor | Fiabilité de la projection — `projectionSnapshots` fige la première prédiction de chaque mois futur ; encart comparant prévu vs réel une fois le mois passé, dans la carte Projection |
| **1.39.13** | patch | Fix projection — une récurrente à occurrences limitées continuait de peser un mois de trop après sa fin réelle (décalage lié au mois en cours déjà anticipé dans le solde) |
| **1.39.12** | minor | Projection — alerte si le solde estimé franchira le seuil d'alerte configuré, et explication de la plus grosse programmée qui pèse sur le mois le plus bas |
| **1.39.11** | patch | Fix projection — le flux courant intègre désormais aussi les revenus variables (freelance, remboursements…) via un flux net, pas seulement les dépenses ; fix récurrentes de type revenu, traitées à tort comme des dépenses |
| **1.39.10** | minor | Nouvelle hero card **Projection à 3 mois**, glissable horizontalement à côté du solde (carrousel + points), basée sur la médiane du flux courant sur 6 mois |
| **1.39.9** | patch | Modal "À venir" — ajout d'un bouton ✕ et gestion du bouton retour (Android/navigateur) pour le fermer, les deux fonctionnent désormais |
| **1.39.8** | minor | "À venir" — le dépliant inline devient un modal centré avec les mêmes filtres ; pointage individuel des fixes + bouton "✓ Tout pointer" pour pointer en un tap toutes les fixes non pointées visibles |
| **1.39.7** | patch | Solde estimé — intègre désormais les programmées dont l'échéance est ce mois-ci ou déjà passée (comme c'était déjà le cas pour les récurrentes) |
| **1.39.6** | patch | Fix arrondi automatique — plus de transaction fantôme si la cagnotte cible a été supprimée (avertissement à la place) ; l'arrondi lié à une dépense se recalcule (ou se retire) quand on édite cette dépense |
| **1.39.5** | patch | Fix récurrentes — la toute première opération n'était pas reliée au modèle récurrent (`templateId` absent), ce qui la faisait se répéter une fois de trop par rapport au nombre de fois choisi |
| **1.39.4** | patch | Fix écran noir au bouton + (`isAdj` non défini dans `NumPad`) ; fix duplication d'opération (cagnotte et tags non recopiés) ; factorisation de `onConfirmRecurring` (dupliqué) ; optimisation de l'affichage des onglets (une seule vue construite par render) ; fusion des styles de chips dupliqués |
| **1.39.3** | patch | Fix LockScreen — suppression de la double définition de `Sec` référençant `editMode` (crash silencieux post-unlock) ; biométrie restaurée avec `import()` dynamique original |
| **1.39.2** | patch | Fix écran noir post-PIN — suppression du code orphelin LockScreen (65 lignes hors fonction) |
| **1.39.1** | patch | Fix écran noir post-biométrie — suppression du `useEffect` notifications au démarrage |
| **1.39.0** | minor | Opération d'équilibre (`balance_adjustment`) — pill ⚖️ dans FAB, impacte solde pointé uniquement, code couleur sapin dans historique ; suppression mode édition accueil |
| **1.38.4** | patch | Fix swipe historique — fond opaque calculé (#080f0c…) pour masquer le panneau d'actions |
| **1.38.3** | patch | Fix swipe ouvert par défaut — `isPointable` exclut `dissolution_cagnotte` |
| **1.38.2** | patch | Fix layout swipe — `boxShadow inset` au lieu de `borderLeft` pour éviter le décalage |
| **1.38.1** | minor | Historique visuel variante D — fond teinté + bande gauche colorée par type, icône à fond coloré, badge type, spacer alignement |
| **1.38.0** | minor | Revenus fixes (`fixedIncomes[]`) — FixedIncomeModal, onglets Charges/Revenus dans FixesView, hero card Net fixe, boutons d'ajout voyants ; libellé transfert cagnotte → compte amélioré + champ raison |
| **1.37.3** | patch | Corrections bugs solde — UTC → heure locale sur toutes les dates (APPLY_AUTO_SAVING, EXECUTE_TRANSFER, MARK_ROUNDING_TRANSFERRED) ; double-garde récurrentes ; loadState deep merge |
| **1.37.2** | patch | Fix double versement auto — date locale + double-garde transaction existante |
| **1.37.1** | patch | Fix écran noir post-biométrie — notifications planifiées uniquement sur action utilisateur |
| **1.37.0** | minor | Types de cagnottes (`cagType`) — filtre chips, badge coloré ; taux d'épargne sur carte Cagnottes accueil ; notifications locales Android (Options) |
| **1.36.0** | minor | Date de début frais fixes (`startYM`) — champ optionnel dans FixedModal, respecté par `effectiveFixesForMonth` |
| **1.35.0** | minor | Hero card sparkline 6 mois + badge delta vs même jour mois précédent |
| **1.34.2** | patch | Nettoyage — import `useBalance` mort retiré, `onConfirmRecurring` double-garde, `loadState` deep merge `notifSettings` |
| **1.34.1** | patch | À venir — badge occurrences restantes sur les récurrentes |
| **1.34.0** | minor | `useBalanceWithRecurring` — déduit les récurrentes non confirmées du solde estimé |
| **1.33.3** | patch | À venir — tailles de police et icônes réduites (discret) |
| **1.33.2** | patch | À venir — couleurs de police améliorées (`#e8f2ff`, onglets inactifs lisibles) |
| **1.33.1** | patch | À venir — polices et icônes agrandies pour meilleure lisibilité |
| **1.33.0** | minor | Cartes Cagnottes et Fixes — hauteur fixe 80px, classes `dash-cagnotte2`/`dash-fixe2`, ordre correct des sections |
| **1.32.1** | patch | Fix CSS contour cartes — `border: 1px solid` préservé sur 4 côtés |
| **1.32.0** | minor | Redesign accueil — cartes teintées Cagnottes (violet) et Fixes (orange #e8944a) |
| **1.31.0** | minor | À venir — récurrentes intégrées (onglet Récurrents, bouton ✓, `onConfirmRecurring`) |
| **1.30.0** | minor | Grille catégories dépliable dans TransModal — overlay fixed, anti-ghost-tap |
| **1.29.0** | minor | TransModal compact — touches 43px, catégories chips scrollables, pills date |
| **1.28.0** | minor | TransModal redessiné — pills type, grand montant coloré, chips catégorie, raccourcis date |
| **1.27.0** | minor | Version de base (cf. historique précédent) |

---

## Licence

Projet personnel — usage privé.

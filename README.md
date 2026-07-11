# Gestion du Budget

Application Android de gestion de budget personnel, développée en React et packagée via Capacitor.
Interface entièrement en français, 100 % hors-ligne, sans compte ni serveur.

**Version actuelle : `1.39.14`** — thème *Aube sur Minas Tirith*.

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
  - **Solde bancaire estimé** — dégradé, shimmer, orbes pulsées, compteur animé, sparkline 6 mois, badge delta 🔼/🔽
  - **Projection à 3 mois** — solde prévu mois par mois à partir des fixes, récurrentes, programmées connues + une estimation du flux courant net (voir [Logique solde](#logique-solde)) ; inclut une alerte si le seuil configuré sera franchi, une explication de la plus grosse programmée qui pèse sur un mois, et un encart **Fiabilité** comparant les projections passées à la réalité une fois le mois écoulé
- **SmartIndicator** — point coloré : vert / jaune (solde < seuil ou backup > 7 j) / rouge (solde négatif ou backup > 14 j). Tap → bulle explicative
- **Rapprochement bancaire** — mini-cartes cliquables « ✓ Solde pointé » et « ⏳ En attente » + barre de progression
- **Opération d'équilibre** — ajuste le solde pointé sans impacter le solde estimé (⚖️ dans le FAB)
- **Colonne arrondis** (si arrondi activé) — Mois / Année / À virer
- Cartes 🐷 Cagnottes (avec taux d'épargne du mois) et 📌 Fixes/mois
- **Cartes stat teintées** — Revenus, Dépenses, Cagnotte, Dép. variables avec barre dégradée
- **Récap cagnotte au tap** — sheet avec répartition des mouvements par cagnotte
- **Modal ⏳ À venir** — s'ouvre en tapant la carte (remplace l'ancien dépliant inline), centré à l'écran, fermable par le bouton ✕ ou le bouton retour (Android/navigateur) :
  - Onglets Tout / Récurrents / Fixes / Programmés, badge occurrences restantes sur les récurrentes
  - Chaque dépense fixe non pointée a sa propre case à cocher, plus un bouton **✓ Tout pointer** qui pointe en un tap toutes les fixes non pointées actuellement visibles (filtre respecté)

### FAB (bouton +)

Menu à 5 options :

| Option | Action |
|--------|--------|
| 💸 Dépense | Ouvre TransModal en mode dépense |
| 💰 Revenu | Ouvre TransModal en mode revenu |
| 🐷 Épargne | Ouvre TransModal en mode épargne |
| 📅 Programmée | Ouvre ScheduledModal |
| ⚖️ Équilibre | Ouvre TransModal en mode balance_adjustment |

**Récurrentes** — depuis une dépense/revenu, cocher « Récurrente » avec fréquence (mensuelle/annuelle) et nombre de fois optionnel. La toute première opération est reliée au modèle récurrent dès sa création (`templateId`), pour que le compteur d'occurrences compte juste dès le départ.

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
- Rapprochement du mois (mini-cartes pointé / en attente)
- **Vues** : Liste / Catégories / Calendrier
- **Code couleur par type** : fond teinté + bande gauche colorée pour épargne (violet), retrait cagnotte (corail/vert), équilibre (sapin), badge type sous le label
- **Swipe gauche** → ✏️ Modifier / 📋 Dupliquer / 🗑 Supprimer (la duplication recopie désormais aussi `targetCagId` et `tagIds` — une épargne/décagnottage dupliqué reste bien lié à sa cagnotte)
- Pointage ○/✓ (désactivé pour les types non-pointables : dissolution, decagnottage, balance_adjustment)
- Sections : Épargnes à confirmer / Programmées ce mois / Récurrentes à confirmer / Frais fixes du mois
- Tags — chips colorées sous chaque transaction taguée

### Onglet Fixes

- **Hero card** — Charges / Revenus fixes / Net fixe
- **Onglets Charges / Revenus** — deux sections séparées avec code couleur (rouge/vert)
- Grille 4 colonnes avec boutons d'action au tap
- Boutons d'ajout en pointillé coloré (voyants)
- **Date de début** (`startYM`) optionnelle — le frais n'est déduit qu'à partir du mois configuré
- Badge delta ▲/▼ si le montant a changé depuis le mois précédent
- **Revenus fixes** (`fixedIncomes[]`) — ajoutés au solde estimé chaque mois comme les frais fixes se soustraient

### Onglet Rapport

- Hero card annuelle avec donut et 4 stats
- Onglets Bilan / Analyse / Périodes
- Classement des mois 🥇🥈🥉, tappables
- Moyennes mensuelles, objectif épargne annuel
- Top 5 dépenses par catégorie
- Évolution solde cumulé
- Tableau comparatif N vs N-1
- 🎯 Suivi catégories / 🏷️ Tags / 📊 Analyse catégorie / 🐷 Taux d'épargne
- Comparaison deux périodes, notes sur les mois

### Onglet Options

| Section | Options |
|---------|---------|
| 🔒 Sécurité | PIN & biométrie |
| 🐷 Épargne | Versements automatiques · Arrondi · Alerte solde bas |
| 🏷️ Catégories | Gestion · Liaisons · Récurrentes |
| 🔔 Notifications | Notifications locales Android |
| 💾 Données | Sauvegarde |

**🔒 Sécurité** — PIN SHA-256 + biométrie via `@aparajita/capacitor-biometric-auth`

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
│   ├── App.jsx          — state, FAB, modals, callbacks
│   ├── store.js         — reducer, actions A.*, DEFAULT_DATA
│   ├── hooks.js         — useBalance, useBalanceWithRecurring, useBalanceProjection…
│   ├── utils.js         — fmt, isIncome, txLabel, txTypeClass, txSign, APP_VERSION
│   ├── views.jsx        — toutes les vues + LockScreen + SwipeRow
│   ├── styles.css       — variables thème, animations, classes type-*
│   └── components/
│       ├── index.jsx
│       ├── charts.jsx
│       └── modals.jsx   — TransModal, FixedModal, FixedIncomeModal, CagModal…
├── index.html
├── vite.config.js
├── capacitor.config.js
└── package.json         — version: 1.39.14
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
| `notifSettings` | `NotifSettings` | Config notifications locales |
| `pinEnabled` / `pinHash` / `bioEnabled` | — | Sécurité |
| `warning` | `string \| null` | Avertissement ponctuel émis par le reducer (ex: cagnotte d'arrondi introuvable), affiché en toast puis effacé via `CLEAR_WARNING` |
| `projectionSnapshots` | `{ [ym]: { predictedValue, predictedOn } }` | Première projection figée pour chaque mois futur, jamais réécrite — sert à comparer prévu/réel une fois le mois passé |

### Types de transactions (`TxType`)

`income` · `expense` · `epargne` · `decagnottage` · `dissolution_cagnotte` · `transfer` · `balance_adjustment`

### Logique solde

- **Solde estimé** (`useBalance`) — transactions réelles + frais fixes depuis le premier mois, **hors** `balance_adjustment`
- **Solde avec récurrentes et programmées** (`useBalanceWithRecurring`) — déduit du solde estimé les récurrentes non confirmées **et** les programmées dont l'échéance est ce mois-ci ou déjà passée (mais pas encore confirmées) ; une programmée dont l'échéance est dans un mois futur ne pèse pas encore sur le solde
- **Projection** (`useBalanceProjection`) — anticipe le solde sur N mois (3 par défaut) à partir des fixes, des récurrentes mensuelles (en respectant leur type revenu/dépense et leur nombre d'occurrences restantes — une récurrente qui se termine arrête bien de peser sur les mois suivants), des programmées déjà datées, et d'une estimation du flux courant net
- **Flux courant net** (`useVariableCashflowMedian`) — médiane, sur 6 mois, du solde net (revenus moins dépenses) des transactions qui ne sont ni fixes, ni récurrentes, ni un arrondi automatique ; la médiane (plutôt qu'une moyenne) évite qu'un imprévu ponctuel (grosse réparation, gros cadeau) ne fausse l'estimation des mois suivants
- **Fiabilité de la projection** (`useProjectionAccuracy`) — compare, pour chaque mois désormais passé, la toute première projection figée (`projectionSnapshots`) au solde réellement atteint à la fin de ce mois
- **Solde pointé** (rapprochement) — inclut les `balance_adjustment`
- **Dates** — toujours en heure locale (pas `toISOString()` UTC)

---

## Structure du code

### Actions `A.*` principales

| Action | Description |
|--------|-------------|
| `SAVE_TRANSACTION` | Créer/modifier. Arrondi automatique si `roundingEnabled` (recalculé à l'édition, retiré proprement si la cagnotte d'arrondi n'existe plus) |
| `DELETE_TRANSACTION` | Supprimer + restaure `cagnotte.current` si epargne/decagnottage |
| `SAVE_FIXED` / `DELETE_FIXED` | Frais fixes. `startYM` et `monthlyOverrides` préservés à l'édition |
| `SAVE_FIXED_INCOME` / `DELETE_FIXED_INCOME` | Revenus fixes récurrents |
| `SAVE_AUTO_SAVING` / `APPLY_AUTO_SAVING` | Versements auto (double-garde anti-doublon) |
| `SAVE_SCHEDULED` / `CONFIRM_SCHEDULED` | Transactions programmées |
| `EXECUTE_TRANSFER` | Entre cagnottes ou vers compte (avec `reason`) |
| `SAVE_NOTIF_SETTINGS` | Config notifications |
| `CLEAR_WARNING` | Efface le message d'avertissement ponctuel (`warning`) après affichage |
| `SAVE_PROJECTION_SNAPSHOT` | Fige la première projection connue pour un mois donné (no-op si déjà figée) |

### Hooks custom

| Hook | Retourne |
|------|----------|
| `useBalance(txs, fixes, incomes)` | Solde estimé toutes périodes |
| `useBalanceWithRecurring(txs, fixes, incomes, recurring, scheduled)` | Solde − récurrentes et programmées non confirmées du mois |
| `useVariableCashflowMedian(txs, monthsWindow)` | Médiane du flux courant net sur N mois |
| `useBalanceProjection(balance, txs, fixes, incomes, recurring, scheduled, monthsAhead, alertThreshold)` | `{ months, variableNetMedian, thresholdBreachMonth, biggestSchedMonth, biggestSchedItem }` |
| `useProjectionAccuracy(txs, fixes, incomes, projectionSnapshots)` | Liste `{ ym, predicted, actual, delta }` pour les mois passés |
| `useMonthStats(txs, fixes, ym, incomes)` | `{ inc, exp, expVar, decag, net }` |
| `useYearMonths` / `useYearTotals` | Stats annuelles |
| `useTotalFixes` | Total frais fixes brut |

### Logique de démarrage (App.jsx `useEffect`)

1. **Versements auto** — si `today >= dayOfMonth && lastAppliedYm !== curYM` et aucune transaction `isAutoSaving` existante ce mois → dispatch `APPLY_AUTO_SAVING`
2. **Programmées** — si `date.startsWith(curYM) && today >= scheduledDay` → dispatch `CONFIRM_SCHEDULED`
3. **Notifications** — planifiées uniquement sur action utilisateur (pas au démarrage)
4. **Avertissements** — si `data.warning` est renseigné, affiché en toast puis effacé via `CLEAR_WARNING`
5. **Instantanés de projection** — à chaque calcul de la projection (Accueil), les mois pas encore figés dans `projectionSnapshots` sont sauvegardés (no-op côté reducer si déjà présents, pas de risque de boucle)

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

# Gestion du budget

Application Android de gestion de budget personnel, développée en React et packagée via Capacitor.
Interface entièrement en français, 100 % hors-ligne, sans compte ni serveur.

**Version actuelle : `1.10.1`** — thème *Aube sur Minas Tirith*, build release signé via GitHub Actions.

---

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Stack technique](#stack-technique)
- [Thème visuel](#thème-visuel)
- [Arborescence](#arborescence)
- [Installation locale](#installation-locale)
- [Build APK](#build-apk)
- [Intégration GitHub Actions](#intégration-github-actions)
- [Données & sauvegarde](#données--sauvegarde)
- [Structure du code](#structure-du-code)
- [Versioning](#versioning)
- [Changelog](#changelog)

---

## Fonctionnalités

### Onglet Accueil
- **Hero card animée** — solde bancaire estimé avec dégradé, shimmer lumineux continu, orbes de lumière pulsées, compteur qui s'incrémente au chargement
- **SmartIndicator** — point coloré en haut à droite de la hero card : vert (tout va bien), jaune (solde < 500 € ou dépenses > revenus ou backup > 7 j), rouge (solde négatif / critique ou backup > 14 j). Tap → bulle explicative avec action directe
- **Solde prévisionnel** — si des frais prévisionnels sont définis, une deuxième ligne affiche le solde après ces dépenses
- **Sparkline** des 6 derniers mois en superposition
- Carte **🐷 Cagnottes** (violet) et **📌 Fixes / mois** (ambre)
- Stats **🗓️ Mois en cours** : 💰 Revenus, 💸 Dépenses, 🐷 Cagnotte (carte double : épargne violet + retraits corail), 📊 Dép. variables — avec badges delta colorés sémantiquement (rouge si dépenses en hausse, vert si en baisse)
- Stats **📅 Année en cours** avec même structure et delta vs année précédente
- **Graphique mensuel cliquable** (ouvre le détail du mois)
- **5 dernières opérations** avec empty state illustré SVG

### Onglet Cagnottes
- **Bloc stats** en haut : épargné ce mois, épargné cette année (vert), décagnottage ce mois, décagnottage cette année (orange)
- Bouton **🔄 Transfert** et **＋ Nouvelle** cagnotte
- Projets d'épargne avec barre de progression, objectif € et date cible
- Affichage automatique du montant à épargner par mois
- Tap sur une cagnotte → historique complet

### Onglet Historique
- **Navigation mois par flèches** ◀ Mai 2026 ▶ (remplace le sélecteur natif Android)
- **Mini donut** répartition revenus / dépenses / épargne avec solde net au centre
- **Barre de budget** ratio dépenses/revenus avec couleur dynamique (vert → ambre → rouge)
- **Groupement par date** — "Aujourd'hui / Hier / Lundi 4 mai…" avec bilan financier du jour
- **Swipe sur les lignes** — glisser gauche révèle ✏️ et 🗑️ (détection horizontal/vertical : le scroll vertical n'est jamais perturbé)
- **Toggle Liste / Catégories** — vue catégories avec barres de progression et %, tappable pour filtrer la liste
- **Filtre montant** min/max expandable dans la barre de tri
- Recherche textuelle, filtres type, tri date/montant
- **Détection de doublons** — alerte si même montant + même catégorie dans les 7 derniers jours

### Onglet Fixes
- **Carte récap** en haut avec total fixes/mois + total prévisionnels
- **Grille 4 colonnes** pour les frais fixes — tap sur une carte révèle ✏️ ✕
- **Frais prévisionnels** en grille 4 colonnes avec bordure orange

### Onglet Rapport
- **Hero card annuelle** avec donut revenus/dépenses/épargne et 4 lignes de stats
- **Filtre graphique** — Tout / 💰 / 💸 sur le graphique flux mensuels
- **Classement des mois** avec 🥇🥈🥉, barres de progression, solde net, tappable
- **Moyennes mensuelles** sur 3 cartes (revenu moy. / dépense moy. / solde moy.)
- **Objectif épargne annuel** — barre de progression, modifiable avec ✏️
- Top 5 dépenses par catégorie
- Évolution du solde net cumulé (graphique aire)
- **Tableau comparatif N vs N-1**
- **Analyses automatiques locales** (projection fin d'année, bilan cagnottes)
- **Comparaison de deux périodes** — sélectionner 2 mois, tableau + barres visuelles
- **Notes sur les mois** — mémo textuel par mois persisté (ex : "Vacances Italie"), visible dans le rapport

### Onglet Options
- **Carte stats globales** — nb transactions, première opération, total géré, nb catégories
- **Sauvegarde visible** — point vert/rouge, date lisible, nb de jours depuis le dernier backup
- **Gestion des catégories** en grille — badge usage (nb de transactions associées), badge "inutilisée" si 0
- Export JSON, Import JSON, Réinitialisation complète

### Navigation & UX
- **Transitions entre onglets** — glissement horizontal (droite/gauche selon la position)
- Barre de navigation 6 onglets — emoji agrandi + lueur sur l'onglet actif, texte blanc
- Historique de navigation empilé, bouton retour Android
- Empty states illustrés SVG contextuels sur toutes les vues vides
- **Animations** : cartes en cascade, compteurs qui s'incrémentent, tap feedback

### Transactions
| Type | Effet |
|------|-------|
| `expense` — Dépense | Débite le solde |
| `income` — Revenu | Crédite le solde |
| `epargne` — Épargne | Débite le solde, crédite la cagnotte cible |
| `decagnottage` — Décagnottage | Débite la cagnotte, ne crédite pas le solde |
| `dissolution_cagnotte` | Crédite le solde du solde de la cagnotte |

---

## Stack technique

| Technologie | Version | Usage |
|-------------|---------|-------|
| React | 18.3 | UI, state management (useReducer) |
| Vite | 5.4 | Bundler, dev server |
| Capacitor | 6.0 | Packaging Android (WebView) |
| `@capacitor/app` | 6.0 | Bouton retour Android physique |
| `@capacitor/filesystem` | 6.0 | Écriture fichier en cache pour export |
| `@capacitor/share` | 6.0 | Feuille de partage Android (export JSON) |
| `@capacitor/splash-screen` | 6.0 | Écran de démarrage |
| `@capacitor/status-bar` | 6.0 | Barre de statut Android |
| `@capacitor/keyboard` | 6.0 | Gestion du clavier virtuel |
| Georgia | Serif | Police d'affichage (titres, thème) |
| DM Sans | Google Fonts | Police UI |

Pas de librairie UI externe. Tout le CSS est custom avec variables CSS pour les thèmes.

---

## Thème visuel

**Aube sur Minas Tirith** — mélange inspiré de la Terre du Milieu entre Minas Tirith (pierre blanche, bleus acier) et la Comté (touches végétales vertes).

| Variable | Valeur | Usage |
|----------|--------|-------|
| `--accent` | `#70b8e0` | Bleu acier — actions, liens, accent principal |
| `--accent2` | `#88c880` | Vert Comté — touches végétales |
| `--purple` | `#b090e0` | Violet — épargne, cagnottes |
| `--coral` | `#e08870` | Corail — retraits cagnotte |
| `--success` | `#68d498` | Vert — revenus, positif |
| `--danger` | `#c87070` | Rouge — dépenses, négatif |
| `--warning` | `#c8b860` | Ambre — fixes, vigilance |
| `--bg` | `#060810` | Fond principal |

La hero card utilise un dégradé `#0c1830 → #182a48 → #101e38` avec shimmer animé et deux orbes pulsées (bleu + vert).

---

## Arborescence

```
gestion-du-budget/
├── .github/
│   └── workflows/
│       └── build.yml              # CI/CD : build APK release signé
├── assets/
│   └── android-icons/             # Icônes Android pré-générées (5 densités)
│       ├── mipmap-mdpi/
│       ├── mipmap-hdpi/
│       ├── mipmap-xhdpi/
│       ├── mipmap-xxhdpi/
│       └── mipmap-xxxhdpi/
├── src/
│   ├── main.jsx                   # Point d'entrée React
│   ├── App.jsx                    # Racine : useReducer, thème, navigation, transitions
│   ├── store.js                   # Reducer, actions (A.*), DEFAULT_DATA
│   ├── hooks.js                   # useBalance, useMonthStats, useYearMonths, useSpark…
│   ├── context.js                 # ToastCtx + useToast()
│   ├── utils.js                   # fmt, uid, APP_NAME, APP_VERSION, currentYM (UTC-safe)…
│   ├── views.jsx                  # 6 vues + composants locaux (SwipeRow, HistDonut…)
│   ├── styles.css                 # CSS complet (variables thème, animations, layout)
│   └── components/
│       ├── index.jsx              # ItemRow, Delta (prop inverted), Sparkline, Modal…
│       ├── charts.jsx             # ChartSVG, PatrimoineSVG
│       └── modals.jsx             # TransModal (détection doublons), FixedModal, CagModal…
├── public/
│   └── icons/
├── index.html
├── vite.config.js
├── capacitor.config.js
├── package.json                   # version: 1.10.1
└── README.md
```

---

## Installation locale

### Prérequis
- Node.js 20+
- Java JDK 17+
- Android Studio (SDK Android 34+)

### Installation
```bash
git clone https://github.com/<compte>/gestion-du-budget.git
cd gestion-du-budget
npm install
```

### Développement web
```bash
npm run dev
# → http://localhost:5173
```

### Build APK local
```bash
npm run build
npm run cap:init    # première fois uniquement
npm run cap:add     # première fois uniquement
npm run cap:sync
cd android && ./gradlew assembleRelease \
  -Pandroid.injected.signing.store.file=../budgetpro.keystore \
  -Pandroid.injected.signing.store.password=BudgetPro2026! \
  -Pandroid.injected.signing.key.alias=budgetpro \
  -Pandroid.injected.signing.key.password=BudgetPro2026!
```

---

## Build APK

### Via GitHub Actions (méthode principale)

Le build est déclenché manuellement :
**Actions → Build APK → Run workflow**

L'APK produit est nommé `GestionBudget-v{version}.apk` (ex : `GestionBudget-v1.10.1.apk`).

### Secrets GitHub requis

| Secret | Description |
|--------|-------------|
| `KEYSTORE_BASE64` | Keystore JKS encodé en base64 |
| `KEYSTORE_PASSWORD` | Mot de passe du keystore |
| `KEY_ALIAS` | Alias de la clé (`budgetpro`) |
| `KEY_PASSWORD` | Mot de passe de la clé |

> ⚠️ **Garder le keystore en lieu sûr.** Sans lui, Android refusera toute mise à jour de l'app installée et il faudra désinstaller/réinstaller.

### Étapes du workflow

1. Checkout + Node 20 + Java 17 + Android SDK
2. `npm install` + `npm run build`
3. `cap init` + `cap add android` + `cap sync`
4. **Fix Maven** — init script Gradle qui redirige vers `repo1.maven.org` (contournement du 403 GitHub Actions sur Maven Central)
5. **Injection icônes** — copie les PNG depuis `assets/android-icons/`, supprime les XML adaptatifs anydpi
6. Décodage du keystore depuis `KEYSTORE_BASE64`
7. `./gradlew assembleRelease` avec signing via `-P`
8. Renommage APK + upload artifact (30 jours)

---

## Intégration GitHub Actions

### Premier push
```bash
git init
git add .
git commit -m "feat: initial commit — Gestion du budget v1.10.1"
git branch -M main
git remote add origin https://github.com/<compte>/gestion-du-budget.git
git push -u origin main
```

### Workflow de mise à jour
```bash
# Modifier les sources
git add src/views.jsx src/utils.js
git commit -m "feat: nouvelle fonctionnalité"
git push
# → déclencher le build manuellement dans Actions
```

---

## Données & sauvegarde

Toutes les données sont stockées en `localStorage` sous la clé `budget_ultimate_2026_v10`.

### Structure JSON
| Champ | Type | Description |
|-------|------|-------------|
| `transactions` | `Transaction[]` | Toutes les opérations |
| `categories` | `Category[]` | Catégories personnalisées |
| `cagnottes` | `Cagnotte[]` | Cagnottes avec soldes et objectifs |
| `fixedExpenses` | `FixedExpense[]` | Frais fixes récurrents |
| `provisionalExpenses` | `ProvisionalExpense[]` | Frais prévisionnels ponctuels |
| `lastBackupDate` | `string\|null` | Date ISO de la dernière sauvegarde |
| `monthNotes` | `Record<string,string>` | Notes texte par mois (`"2026-05": "Vacances"`) |

### Export / Import
L'export utilise `@capacitor/filesystem` + `@capacitor/share`. L'import valide la structure avant de remplacer les données.

---

## Structure du code

### State management
`useReducer` dans `App.jsx`, reducer dans `store.js`. Actions typées via `A.*`. Persistance auto en `localStorage` à chaque changement d'état.

### Navigation
Pile `tabHistory` (tableau de strings) + suivi de direction pour les transitions. `navigateTo(tab)` calcule la direction (gauche/droite selon `TAB_ORDER`) et anime le container. Bouton retour Android intercepté via `@capacitor/app`.

### Hooks custom (`hooks.js`)

| Hook | Retourne |
|------|----------|
| `useBalance` | Solde total = Σ transactions − fixes × mois écoulés |
| `useMonthStats` | `{ inc, exp, expVar, decag, net }` pour un mois |
| `useYearMonths` | Tableau 12 entrées avec stats mensuelles |
| `useYearTotals` | Totaux annuels |
| `usePriorYearStats` | Année précédente (mêmes mois écoulés) |
| `useSpark` | 6 derniers soldes nets (sparkline) |
| `useTotalFixes` | Total frais fixes |

### Calcul du solde (`useBalance`)
```
solde = Σ(revenus) − Σ(dépenses) − Σ(épargnes) − totalFixes × moisEcoulés
```
`moisEcoulés` = nombre de mois entre la première transaction et le mois en cours (inclus). Les frais fixes sont ainsi déduits chaque mois automatiquement sans nécessiter de transaction manuelle.

### Dates et UTC
`currentYM()` et `todayISO()` utilisent l'heure **locale** (et non `toISOString()` qui est UTC). Cela évite le décalage d'un mois pour les utilisateurs en UTC+ au début de chaque mois.

### Delta coloré (`components/index.jsx`)
Le composant `<Delta cur prev inverted?>` accepte une prop `inverted` pour les cartes de dépenses : une hausse des dépenses affiche ▲ rouge (mauvais) au lieu de ▲ vert.

### Détection de doublons (`modals.jsx`)
À la validation d'une transaction, `TransModal` cherche une entrée avec le même montant et la même catégorie dans les 7 derniers jours. Si trouvée, une alerte s'affiche avec la transaction existante — l'utilisateur peut annuler ou forcer l'ajout.

---

## Versioning

Format : **MAJOR.MINOR.PATCH** (Semantic Versioning)

| Type | Condition | Exemple |
|------|-----------|---------|
| `PATCH` | Bug fix, retouche visuelle mineure | `1.10.0` → `1.10.1` |
| `MINOR` | Nouvelle fonctionnalité visible | `1.9.1` → `1.10.0` |
| `MAJOR` | Refonte structurelle, changement format données | `1.x.x` → `2.0.0` |

La version est définie dans **deux endroits synchronisés** :
- `src/utils.js` → `APP_VERSION` (affiché dans l'onglet Options)
- `package.json` → `version` (utilisé pour nommer l'APK)

---

## Changelog

| Version | Type | Description |
|---------|------|-------------|
| **1.10.1** | patch | Scroll SwipeRow fluide (détection horizontal/vertical), catégories cliquables → liste filtrée, suppression chips catégories |
| **1.10.0** | minor | Transitions onglets (slide L/R), comparaison deux périodes, détection doublons, notes sur les mois |
| **1.9.1** | patch | OptionsView : stats globales, backup visible, compteur usage catégories |
| **1.9.0** | minor | RapportView : hero donut, filtre graphique, classement mois, moyennes, objectif épargne |
| **1.8.0** | minor | HistoriqueView refonte complète (donut, barre budget, nav flèches, groupement date, swipe, catégories, filtre montant) |
| **1.7.0** | minor | CagnottesView stats bloc, FixesView grille 4 colonnes + carte récap |
| **1.6.0** | minor | AccueilView : emojis, Delta inversé pour dépenses, carte cagnotte option B, cohérence couleurs |
| **1.5.0** | minor | Empty states SVG illustrés sur toutes les vues |
| **1.4.0** | minor | Hero card animée (shimmer, orbes, CountUp), SmartIndicator option D |
| **1.3.0** | minor | Tab bar redesign (hauteur, police blanche, emoji glow), fix focus Android |
| **1.2.0** | minor | Thème Aube sur Minas Tirith (variables CSS complètes, LotR-inspired) |
| **1.1.0** | minor | Renommage "Gestion du budget", système versioning, `package.json` |
| **1.0.2** | patch | Fix `useBalance` — frais fixes × mois écoulés |
| **1.0.1** | patch | Corrections UTC (`currentYM`, `todayISO`, `useSpark`) |
| **1.0.0** | — | Version initiale "Budget Pro 2026" |

---

## Licence

Projet personnel — usage privé.

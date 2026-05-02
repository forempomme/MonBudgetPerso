# Budget Pro 2026

Application Android de gestion de budget personnel, développée en React et packagée via Capacitor. Interface entièrement en français, 100% hors-ligne, sans compte ni serveur.

---

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Stack technique](#stack-technique)
- [Arborescence](#arborescence)
- [Installation locale](#installation-locale)
- [Build APK](#build-apk)
- [Intégration GitHub](#intégration-github)
- [Données & sauvegarde](#données--sauvegarde)
- [Structure du code](#structure-du-code)

---

## Fonctionnalités

### Onglet Accueil
- **Hero card** avec le solde bancaire estimé (toutes transactions + frais fixes du mois en cours)
- **Solde prévisionnel** : si des frais prévisionnels sont définis, une deuxième ligne affiche le solde après ces dépenses (rouge si négatif)
- **Sparkline** des 6 derniers mois en superposition
- Carte total **cagnottes** et **frais fixes mensuels**
- Stats du **mois en cours** : revenus, dépenses totales, dépenses hors fixes, décagnottages — avec badges delta vs mois précédent
- Stats de l**'année en cours** avec delta vs année précédente
- **Graphique mensuel cliquable** (ouvre le détail du mois)
- **5 dernières opérations** avec édition et suppression inline

### Onglet Cagnottes
- Projets d'épargne avec nom, solde actuel, objectif (€) et date cible optionnels
- **Barre de progression** et affichage automatique du montant à épargner par mois
- **Transfert entre cagnottes**
- Tap sur une cagnotte → historique complet de ses versements et retraits
- Dissolution automatique d'une cagnotte (solde crédité comme revenu)

### Onglet Historique
- Filtres par **mois** (sélecteur natif), **type** (revenus / dépenses / cagnottes), **catégorie**
- **Recherche textuelle** sur note et catégorie
- Tri par date (↓), montant (↓ ou ↑)
- Résumé revenus / dépenses / solde net du mois affiché
- Édition et suppression de chaque opération

### Onglet Fixes
- **Frais fixes récurrents** (loyer, abonnements…) — déduits du solde du mois en cours uniquement, affichés en grille 3 colonnes
- **Frais prévisionnels ponctuels** (réparation, achat prévu…) — visibles sur la hero card de l'Accueil en deuxième solde, supprimés manuellement une fois la dépense réalisée

### Onglet Rapport
- Navigation annuelle ◀ ▶
- **3 cartes** Revenus / Dépenses / Solde net (coloré dynamiquement)
- **Taux d'épargne** avec barre de progression (masqué si aucune épargne)
- **Meilleur et pire mois** cliquables → ouvre le détail du mois (masqué si un seul mois actif)
- **Graphique barres mensuel** cliquable avec ligne de tendance
- **Top 5 catégories** de dépenses avec barres et pourcentages
- **Évolution du solde net** cumulé (graphique aire)
- **Tableau comparatif** N vs N-1 avec flèches sémantiques (vert/rouge selon le type de poste)
- **Analyses automatiques locales** (sans internet) :
  - 🔮 Projection de fin d'année (revenus, dépenses et solde projetés)
  - 🏦 Bilan des cagnottes (objectifs atteints, montants)

### Onglet Options
- **Gestion des catégories** (icône emoji, nom, type dépense/revenu) — création, édition, suppression
- **Export JSON** via la feuille de partage Android native (choix de l'emplacement)
- **Import JSON** depuis le gestionnaire de fichiers
- **Réinitialisation complète** des données

### Navigation
- Barre de navigation en bas à 6 onglets
- **Historique de navigation empilé** : le bouton ‹ dans le header et le bouton physique retour Android ferment d'abord les modals ouverts, puis remontent dans l'historique

### Transactions
Quatre types :
| Type | Effet |
|------|-------|
| `expense` — Dépense | Débite le solde |
| `income` — Revenu | Crédite le solde |
| `epargne` — Épargne | Débite le solde, crédite la cagnotte cible |
| `decagnottage` — Décagnottage | Débite la cagnotte, crédite le solde |

Champs : montant, date, catégorie (optionnelle), cagnotte cible, note libre.
L'édition recalcule correctement les soldes des cagnottes.

### Thème
Thème sombre par défaut, thème clair disponible via le bouton ☀️/🌙 dans le header. Préférence sauvegardée en localStorage.

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
| Syne | Google Fonts | Police d'affichage (titres) |
| DM Sans | Google Fonts | Police UI |

Pas de librairie UI externe. Tout le CSS est custom avec variables pour les deux thèmes.

---

## Arborescence

```
budget-pro-2026/
├── .github/
│   └── workflows/
│       └── build-apk.yml       # CI/CD : build APK automatique sur push
├── src/
│   ├── main.jsx                # Point d'entrée React
│   ├── App.jsx                 # Racine : useReducer, thème, toasts, modals, navigation
│   ├── store.js                # Reducer, actions (A.*), DEFAULT_DATA, types JSDoc
│   ├── hooks.js                # Hooks useMemo : useBalance, useMonthStats, useYearMonths…
│   ├── context.js              # ToastCtx + useToast()
│   ├── utils.js                # fmt, uid, polar, deltaInfo, txLabel, PALETTE…
│   ├── views.jsx               # 6 vues : AccueilView, CagnottesView, HistoriqueView,
│   │                           #          FixesView, RapportView, OptionsView
│   │                           #          + AnalysteLocal (analyses locales)
│   ├── styles.css              # Tout le CSS (variables, layout, composants, thèmes)
│   └── components/
│       ├── index.jsx           # ItemRow, Delta, Sparkline, ToastContainer, Modal
│       ├── charts.jsx          # ChartSVG, PatrimoineSVG (SVG inline)
│       └── modals.jsx          # TransModal, FixedModal, CagModal, TransferModal,
│                               # CatModal, ConfirmModal, DetailModal,
│                               # MonthDetailModal, CagHistModal
├── public/
│   ├── icon.svg                # Icône source (SVG)
│   ├── manifest.json           # PWA manifest
│   └── icons/                  # PNG générés par generate_icons.py (72→512px)
│       └── .gitkeep
├── index.html                  # HTML racine (point d'entrée Vite)
├── vite.config.js              # Config Vite (base: "./", chunks react)
├── capacitor.config.js         # Config Capacitor (appId, plugins)
├── package.json                # Dépendances + scripts npm
├── generate_icons.py           # Génère les PNG depuis icon.svg (cairosvg + pillow)
├── build-apk.sh                # Script de build APK interactif
├── .gitignore
└── README.md
```

> **Note :** les dossiers `android/`, `dist/`, `node_modules/` sont générés automatiquement et exclus du dépôt git.

---

## Installation locale

### Prérequis
- Node.js 18+
- Java JDK 17+
- Android Studio (avec SDK Android 34)

### Variables d'environnement Android
```bash
# macOS / Linux (~/.zshrc ou ~/.bashrc)
export ANDROID_HOME=$HOME/Android/Sdk  # macOS: $HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/tools

# Windows (variables système)
ANDROID_HOME = C:\Users\<toi>\AppData\Local\Android\Sdk
```

### Installation
```bash
git clone https://github.com/<ton-compte>/budget-pro-2026.git
cd budget-pro-2026
npm install
```

### Développement web (navigateur)
```bash
npm run dev
# → http://localhost:5173
```

### Build APK debug
```bash
npm run build          # Compile React → dist/
npx cap add android    # Ajoute la plateforme Android (première fois)
npx cap sync android   # Synchronise dist/ → android/
cd android
./gradlew assembleDebug
# APK → android/app/build/outputs/apk/debug/app-debug.apk
```

Ou en une commande avec le script interactif :
```bash
chmod +x build-apk.sh
./build-apk.sh
```

### Générer les icônes (optionnel)
```bash
pip install cairosvg pillow
python3 generate_icons.py
```

---

## Build APK

### Debug (usage personnel)
```bash
npm run android:debug
# APK → android/app/build/outputs/apk/debug/app-debug.apk
```

### Release (distribution)
```bash
# 1. Créer un keystore (une seule fois)
keytool -genkey -v -keystore budgetpro.keystore \
  -alias budgetpro -keyalg RSA -keysize 2048 -validity 10000

# 2. Build signé
cd android
./gradlew assembleRelease \
  -Pandroid.injected.signing.store.file=../budgetpro.keystore \
  -Pandroid.injected.signing.store.password=MOT_DE_PASSE \
  -Pandroid.injected.signing.key.alias=budgetpro \
  -Pandroid.injected.signing.key.password=MOT_DE_PASSE
```

### Installer sur le téléphone
```bash
# Via USB (débogage USB activé)
adb install output/BudgetPro2026-debug.apk

# Via fichier : copier l'APK sur le téléphone, ouvrir depuis le gestionnaire de fichiers
# (activer "Sources inconnues" dans Paramètres → Sécurité si demandé)
```

---

## Intégration GitHub

### 1. Créer le dépôt

Sur [github.com](https://github.com), crée un nouveau dépôt **privé** (tes données financières ne sont pas dans le code, mais c'est une bonne pratique) nommé `budget-pro-2026`.

### 2. Premier push

```bash
cd budget-pro-2026
git init
git add .
git commit -m "feat: initial commit — Budget Pro 2026"
git branch -M main
git remote add origin https://github.com/<ton-compte>/budget-pro-2026.git
git push -u origin main
```

### 3. Build APK automatique via GitHub Actions

Le fichier `.github/workflows/build-apk.yml` est déjà inclus. À chaque push sur `main`, GitHub va :
1. Installer Node.js 20 + Java 17 + Android SDK
2. `npm ci` → `npm run build` → `npx cap sync android`
3. `./gradlew assembleDebug`
4. Uploader l'APK comme **artifact téléchargeable** (conservé 30 jours)

**Récupérer l'APK depuis GitHub :**
- Va sur ton dépôt → onglet **Actions**
- Clique sur le dernier workflow terminé ✅
- En bas de la page → section **Artifacts** → télécharge `BudgetPro2026-debug`

**Lancer un build manuellement :**
- Actions → "Build APK" → bouton **Run workflow** → branche `main`

### 4. Workflow de mise à jour

```bash
# Modifier un fichier source
git add src/views.jsx
git commit -m "fix: correction affichage rapport"
git push
# → GitHub Actions lance automatiquement le build et produit un nouvel APK
```

---

## Données & sauvegarde

Toutes les données sont stockées dans le `localStorage` de la WebView sous la clé `budget_ultimate_2026_v10`.

### Contenu de la sauvegarde JSON
| Champ | Description |
|-------|-------------|
| `transactions` | Toutes les opérations (revenus, dépenses, épargnes, décagnottages) |
| `categories` | Catégories personnalisées (nom, icône, type) |
| `cagnottes` | Cagnottes avec soldes et objectifs |
| `fixedExpenses` | Frais fixes récurrents |
| `provisionalExpenses` | Frais prévisionnels ponctuels |
| `lastBackupDate` | Date de la dernière sauvegarde |

### Export (Android)
L'export utilise `@capacitor/filesystem` (écriture en cache) + `@capacitor/share` (feuille de partage Android). L'utilisateur choisit l'emplacement (Téléchargements, Drive, email…).

### Import
Via le sélecteur de fichiers natif Android. Validation de la structure avant import.

---

## Structure du code

### State management
`useReducer` dans `App.jsx` avec le reducer centralisé dans `store.js`. Actions typées via la constante `A`. Persistance automatique dans `localStorage` à chaque changement.

### Navigation
Pile d'historique `tabHistory` (tableau de strings). `navigateTo(tab)` empile, `goBack()` dépile. Le bouton retour Android est intercepté via `@capacitor/app` → ferme d'abord les modals, puis dépile les onglets.

### Hooks custom (`hooks.js`)
| Hook | Retourne |
|------|----------|
| `useBalance` | Solde total toutes périodes |
| `useMonthStats` | `{ inc, exp, expVar, decag, net }` pour un mois |
| `useYearMonths` | Tableau 12 mois avec stats |
| `useYearTotals` | Totaux annuels |
| `usePriorYearStats` | Année précédente (mêmes mois écoulés) |
| `useSpark` | 6 derniers soldes nets (sparkline) |
| `useTotalFixes` | Total des frais fixes |

### Frais fixes vs solde
Les frais fixes sont soustraits du solde **uniquement pour le mois en cours** (`isCur` dans les hooks). Cela évite de les comptabiliser plusieurs fois sur les mois passés.

---

## Licence

Projet personnel — usage privé.

# Gestion du Budget

Application Android de gestion de budget personnel, développée en React et packagée via Capacitor.
Interface entièrement en français, 100 % hors-ligne, sans compte ni serveur.

**Version actuelle : `1.19.0`** — thème *Aube sur Minas Tirith*.

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
- **SmartIndicator** — point coloré en haut à droite : vert (tout va bien), jaune (solde < seuil ou backup > 7 j), rouge (solde négatif ou backup > 14 j). Tap → bulle explicative avec action directe
- **Solde prévisionnel** — si des frais prévisionnels sont définis, deuxième ligne avec solde après ces dépenses
- **Rapprochement bancaire** — mini-cartes cliquables "✓ Solde pointé" et "⏳ En attente" + barre de progression. Tap → Historique filtré
- **Colonne arrondis** (droite de la hero card, si arrondi activé) — 3 mini-cartes compactes : Mois / Année / À virer. La carte "À virer" est tappable pour marquer le virement comme effectué
- Carte 🐷 Cagnottes et 📌 Fixes/mois
- Stats mois en cours et année en cours avec badges delta colorés
- Graphique mensuel cliquable, 5 dernières opérations

### Onglet Cagnottes
- Bloc stats en haut : épargné ce mois, épargné cette année, décagnottages
- Bouton 🔄 Transfert et ＋ Nouvelle cagnotte
- Projets d'épargne avec barre de progression, objectif € et date cible
- Montant à épargner par mois calculé automatiquement
- Tap → historique complet de la cagnotte

### Onglet Historique
- Navigation mois par flèches ◀ Mai 2026 ▶
- Mini donut répartition revenus / dépenses / épargne
- Barre de budget ratio dépenses/revenus avec couleur dynamique
- Mini récap rapprochement cliquable
- Groupement par date avec bilan financier du jour
- **Filtres compacts** — barre unique avec bouton ⚙️ Filtres (badge du nombre de filtres actifs) + 🌐 recherche globale. Panneau expansible avec sections Type / Pointage / Tri / Montant / Vue. Chips de filtres actifs visibles en dehors du panneau avec ✕ individuel
- Pointage des transactions — bouton ○/✓ par ligne
- Swipe gauche → ✏️ 📋 🗑️
- **Section Épargnes à confirmer** (violet) — versements automatiques planifiés dont le jour est passé et non encore confirmés ce mois. ＋ confirme le virement, ✕ saute le mois
- Section Récurrentes à confirmer
- Section Frais fixes du mois avec pointage et modification ponctuelle
- Toggle Liste / Catégories intégré dans le panneau de filtres
- **Tags** — chips colorées sous chaque transaction taguée
- Détection de doublons à la saisie

### Onglet Fixes
- Carte récap avec total fixes/mois + total prévisionnels
- Grille 4 colonnes frais fixes et prévisionnels

### Onglet Rapport
- Hero card annuelle avec donut et 4 stats
- Filtre graphique Tout / Revenus / Dépenses
- Classement des mois 🥇🥈🥉, tappables
- Moyennes mensuelles, objectif épargne annuel
- Top 5 dépenses par catégorie avec liaisons nettes
- Évolution solde cumulé
- Tableau comparatif N vs N-1
- **Bouton 🎯 Suivi catégories** — SuiviModal avec seuils mensuels par catégorie et tableau de bord
- **Bouton 🏷️ Tags** — TagsModal avec vue par tag (résumé dépenses/revenus/net + liste transactions toutes catégories confondues) et onglet Gérer (créer avec icône et couleur, supprimer)
- **Bouton 📊 Analyse catégorie** — CategoryDetailModal avec frais fixes intégrés
- **Bouton 🐷 Taux d'épargne** — SavingsRateModal
- Comparaison deux périodes, notes sur les mois

### Onglet Options — menu groupé
L'onglet est une page courte composée d'un menu en sections. Chaque ligne affiche un badge d'état (ex. "PIN actif", "2 plans", "Vacances") et ouvre un **plein écran dédié** au tap.

| Section | Options |
|---------|---------|
| 🔒 Sécurité | PIN & biométrie |
| 🐷 Épargne | Versements automatiques · Arrondi automatique · Alerte solde bas |
| 🏷️ Catégories | Gestion catégories · Liaisons · Récurrentes |
| 💾 Données | Sauvegarde |

Actions directes : Importer · ⚠️ Réinitialiser. Stats globales en bas.

**🔒 Sécurité — PIN & biométrie**
- Toggle empreinte/FaceID (Capacitor BiometricAuth, déclenché automatiquement à l'ouverture)
- Toggle PIN 4 chiffres — setup inline en 2 étapes (saisir → confirmer), PIN stocké en SHA-256 via `crypto.subtle`, jamais en clair. Écran de verrou plein écran au démarrage si activé

**🐷 Versements automatiques**
- Planifier un virement mensuel fixe vers une cagnotte (montant + jour du mois)
- Toggle on/off par plan, suppression
- Apparaît dans l'Historique sous "Épargnes à confirmer"

**🐷 Arrondi automatique**
- À chaque dépense, verse la différence jusqu'à l'arrondi dans une cagnotte choisie
- 3 règles : euro supérieur / 5 € supérieur / 10 € supérieur
- Preview dans le formulaire de saisie : "+0,40 € → Vacances 🏖️"
- Colonne dans la hero card Accueil : Mois / Année / À virer (tappable)
- `roundingLastTransferDate` pour suivi des virements non encore effectués

**🔔 Alerte solde bas**
- Seuil configurable avec raccourcis 200 / 500 / 1000 €

**🏷️ Gestion catégories**
- Grille avec badge usage et badge "inutilisée" si 0 transaction

**🔗 Liaisons de catégories**
- Lier une catégorie revenu à une catégorie dépense pour calcul net

**🔄 Récurrentes**
- Liste des modèles avec fréquence, compteur d'occurrences, suppression

**💾 Sauvegarde**
- Carte "Dernière sauvegarde" proéminente avec date/taille/compteur
- Bouton "📋 Historique (N)" dépliable — chaque entrée a un bouton 📥 re-export
- Méta-données : date, taille ko, nombre de transactions

### Saisie des transactions
- **Clavier numérique custom** (NumPad) — grille 4×4 avec +, −, =, virgule, ⌫. Évaluateur arithmétique intégré pour additionner plusieurs reçus. Bouton type "Passer en Revenu/Dépense" qui change simultanément le type dans le formulaire
- **Tags** — sélecteur de tags dans le formulaire, chips colorées existantes cliquables
- **Preview arrondi** — bulle verte si arrondi activé et type = dépense
- Détection de doublons (même montant + catégorie dans les 7 derniers jours)
- Récurrentes avec fréquence et occurrences

### Sécurité — écran de verrou
- Affiché au démarrage si PIN activé et hash stocké
- Biométrie déclenchée automatiquement au montage si `bioEnabled`
- Clavier PIN 4 chiffres, vérification SHA-256 côté client
- Fallback PIN si biométrie indisponible

### Navigation & UX
- Transitions entre onglets par glissement horizontal
- Barre de navigation 6 onglets — emoji agrandi + lueur sur l'onglet actif
- Historique de navigation empilé, bouton retour Android
- Empty states illustrés SVG sur toutes les vues vides
- Animations : cartes en cascade, compteurs, tap feedback
- Composant `Sheet` réutilisable — plein écran défilable depuis le haut, fermeture ✕ ou tap extérieur

---

## Stack technique

| Technologie | Version | Usage |
|-------------|---------|-------|
| React | 18.3 | UI, state management (useReducer) |
| Vite | 5.4 | Bundler, dev server |
| Capacitor | 6.0 | Packaging Android (WebView) |
| `@capacitor/app` | 6.0 | Bouton retour Android physique |
| `@capacitor/filesystem` | 6.0 | Écriture fichier en cache pour export |
| `@capacitor/share` | 6.0 | Feuille de partage Android |
| `@capacitor/splash-screen` | 6.0 | Écran de démarrage |
| `@capacitor/status-bar` | 6.0 | Barre de statut Android |
| `@capacitor/keyboard` | 6.0 | Gestion du clavier virtuel |
| `crypto.subtle` | Web API | Hachage SHA-256 du PIN (natif navigateur) |
| `@capacitor-community/biometric-auth` | optionnel | Empreinte / FaceID Android |

Pas de librairie UI externe. Tout le CSS est custom avec variables CSS.

---

## Thème visuel

**Aube sur Minas Tirith** — inspiré de la Terre du Milieu.

| Variable | Valeur | Usage |
|----------|--------|-------|
| `--accent` | `#70b8e0` | Bleu acier — actions, accent principal |
| `--accent2` | `#88c880` | Vert Comté — touches végétales |
| `--purple` | `#b090e0` | Violet — épargne, cagnottes, tags |
| `--coral` | `#e08870` | Corail — retraits cagnotte |
| `--success` | `#68d498` | Vert — revenus, positif |
| `--danger` | `#c87070` | Rouge — dépenses, négatif |
| `--warning` | `#c8b860` | Ambre — fixes, vigilance, à virer |
| `--bg` | `#060810` | Fond principal |

---

## Arborescence

```
gestion-du-budget/
├── .github/
│   └── workflows/
│       └── build.yml              # CI/CD : build APK release signé
├── assets/
│   └── android-icons/             # Icônes Android pré-générées (5 densités)
├── src/
│   ├── main.jsx                   # Point d'entrée React
│   ├── App.jsx                    # Racine : useReducer, navigation, dispatchers, LockScreen
│   ├── store.js                   # Reducer, actions A.*, DEFAULT_DATA
│   ├── hooks.js                   # useBalance, useMonthStats, useYearMonths, useSpark…
│   ├── context.js                 # ToastCtx + useToast()
│   ├── utils.js                   # fmt, uid, APP_NAME, APP_VERSION, currentYM…
│   ├── views.jsx                  # 6 vues + Sheet + LockScreen + composants locaux
│   ├── styles.css                 # CSS complet (variables thème, animations, layout)
│   └── components/
│       ├── index.jsx              # ItemRow, Delta, Sparkline, Modal…
│       ├── charts.jsx             # ChartSVG, PatrimoineSVG
│       └── modals.jsx             # TransModal (NumPad, tags, arrondi preview), FixedModal, CagModal…
├── index.html
├── vite.config.js
├── capacitor.config.js
├── package.json                   # version: 1.19.0
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

**Actions → Build APK → Run workflow**

L'APK produit est nommé `GestionBudget-v{version}.apk`.

### Secrets GitHub requis

| Secret | Description |
|--------|-------------|
| `KEYSTORE_BASE64` | Keystore JKS encodé en base64 |
| `KEYSTORE_PASSWORD` | Mot de passe du keystore |
| `KEY_ALIAS` | Alias de la clé (`budgetpro`) |
| `KEY_PASSWORD` | Mot de passe de la clé |

> ⚠️ **Garder le keystore en lieu sûr.** Sans lui, Android refusera toute mise à jour.

### Étapes du workflow

1. Checkout + Node 20 + Java 17 + Android SDK
2. `npm install` + `npm run build`
3. `cap sync`
4. Fix Maven (init script Gradle, contourne le 403 GitHub Actions)
5. Injection icônes PNG
6. Décodage keystore + `./gradlew assembleRelease`
7. Renommage APK + upload artifact (30 jours)

---

## Données & sauvegarde

Stockage en `localStorage` sous la clé `budget_ultimate_2026_v10`.

### Structure DEFAULT_DATA

| Champ | Type | Description |
|-------|------|-------------|
| `transactions` | `Transaction[]` | Toutes les opérations |
| `categories` | `Category[]` | Catégories personnalisées |
| `cagnottes` | `Cagnotte[]` | Cagnottes avec soldes et objectifs |
| `fixedExpenses` | `FixedExpense[]` | Frais fixes récurrents |
| `provisionalExpenses` | `ProvisionalExpense[]` | Frais prévisionnels ponctuels |
| `recurringTemplates` | `RecurringTemplate[]` | Modèles de transactions récurrentes |
| `autoSavings` | `AutoSaving[]` | Plans de versements automatiques mensuels |
| `tags` | `Tag[]` | Tags transversaux |
| `lastBackupDate` | `string\|null` | Date ISO de la dernière sauvegarde |
| `backupHistory` | `BackupEntry[]` | Historique des 10 dernières sauvegardes |
| `monthNotes` | `Record<string,string>` | Notes par mois (`"2026-05": "Vacances"`) |
| `categoryThresholds` | `Record<string,number>` | Seuils mensuels par catégorie |
| `alertEnabled` | `boolean` | Alerte solde bas |
| `alertThreshold` | `number` | Seuil d'alerte (€) |
| `roundingEnabled` | `boolean` | Arrondi automatique activé |
| `roundingCagnotteId` | `string\|null` | Cagnotte cible des arrondis |
| `roundingRule` | `"ceil"\|"5"\|"10"` | Règle d'arrondi |
| `roundingLastTransferDate` | `string\|null` | Date du dernier virement d'arrondis |
| `pinEnabled` | `boolean` | Verrou PIN activé |
| `pinHash` | `string\|null` | SHA-256 hex du PIN (jamais en clair) |
| `bioEnabled` | `boolean` | Biométrie activée |

### Structure `Transaction`

```js
{
  id: "t1",
  date: "2026-05-03",
  type: "expense",        // expense | income | epargne | decagnottage | transfer | dissolution_cagnotte
  amount: 85.40,
  categoryId: "c1",
  note: "Courses Leclerc",
  pointed: true,          // rapprochement bancaire
  tagIds: ["tg1"],        // tags transversaux (optionnel)
  isRounding: true,       // vrai si créé par l'arrondi automatique
  autoSavingId: "as1",    // référence au plan de versement auto si applicable
  templateId: "tpl1",     // référence au modèle récurrent si applicable
}
```

### Structure `Tag`

```js
{ id: "tg1", name: "Vacances Bretagne", icon: "🏖️", color: "#70b8e0" }
```

### Structure `AutoSaving`

```js
{ id: "as1", cagnotteId: "c2", amount: 50, dayOfMonth: 5, enabled: true }
```

### Structure `BackupEntry`

```js
{ id: "bk1", date: "2026-05-19 14:32", sizeKo: 86, txCount: 248 }
```

### Export / Import
L'export utilise `@capacitor/filesystem` + `@capacitor/share`. L'import valide la structure avant de remplacer. À chaque export, une `BackupEntry` est ajoutée à `backupHistory` (max 10).

---

## Structure du code

### State management
`useReducer` dans `App.jsx`, reducer dans `store.js`. Actions typées via `A.*`. Persistance auto en `localStorage` à chaque changement d'état.

### Actions `A.*` complètes

| Action | Description |
|--------|-------------|
| `SAVE_TRANSACTION` | Créer/modifier. Si nouvelle dépense + `roundingEnabled` → crée automatiquement une transaction `epargne` `isRounding:true` |
| `DELETE_TRANSACTION` | Supprimer |
| `TOGGLE_POINT_TX` | Bascule `transaction.pointed` |
| `TOGGLE_POINT_FIX` | Bascule `fixedExpense.pointedMonths[ym]` |
| `OVERRIDE_FIX_MONTH` | Modif ponctuelle d'un frais fixe pour un mois |
| `SAVE_MONTH_NOTE` | Note texte par mois |
| `SAVE_RECURRING` / `DEL_RECURRING` | Modèles récurrents |
| `SAVE_AUTO_SAVING` / `DELETE_AUTO_SAVING` | Plans de versements auto |
| `SAVE_ALERT_SETTINGS` | Alerte solde bas |
| `SAVE_CATEGORY_THRESHOLD` | Seuil mensuel par catégorie |
| `SAVE_ROUNDING_SETTINGS` | Config arrondi automatique |
| `MARK_ROUNDING_TRANSFERRED` | Marque les arrondis comme virés (met à jour `roundingLastTransferDate`) |
| `SAVE_TAG` / `DELETE_TAG` | Tags transversaux. DELETE retire aussi le tag de toutes les transactions |
| `SAVE_SECURITY_SETTINGS` | PIN hash + biométrie |
| `ADD_BACKUP_ENTRY` | Ajoute une entrée à `backupHistory` (max 10) et met à jour `lastBackupDate` |
| `IMPORT_DATA` / `RESET` | Import JSON / remise à zéro |

### Navigation
Pile `tabHistory` + direction pour les transitions. `navigateTo(tab)` calcule gauche/droite selon `TAB_ORDER`. Bouton retour Android via `@capacitor/app`.

### Hooks custom (`hooks.js`)

| Hook | Retourne |
|------|----------|
| `useBalance` | Solde total = Σ transactions − Σ effectiveFixesForMonth |
| `useMonthStats` | `{ inc, exp, expVar, decag, net }` pour un mois |
| `useYearMonths` | 12 entrées avec stats mensuelles |
| `useYearTotals` | Totaux annuels |
| `usePriorYearStats` | Année précédente |
| `useSpark` | 6 derniers soldes nets |
| `useTotalFixes` | Total frais fixes brut |

Helpers : `effectiveFixesForMonth(fixedExpenses, ym)` et `monthRange(startYM, endYM)`.

### Composants clés

**`LockScreen`** (`views.jsx`) — écran plein écran si `pinEnabled && pinHash`. `useEffect` déclenche `tryBio()` au montage si `bioEnabled`. `window.Capacitor?.Plugins?.BiometricAuth` sans import statique (évite la résolution Rollup). PIN vérifié par `sha256hex()` via `crypto.subtle`.

**`Sheet`** (`views.jsx`) — plein écran `position:fixed, inset:0, overflowY:auto` défilable depuis le haut. Fermeture ✕ ou tap sur le fond. Utilisé par tous les modals d'Options.

**`NumPad`** (`modals.jsx`) — clavier 4×4 remplaçant l'`<input type="number">`. `evalSimple()` pour additions/soustractions de reçus. Opérateurs sans doublon, virgule unique par segment. Bouton type "Passer en Revenu" change `type` dans le formulaire. `const val = String(value ?? "")` pour défense contre les valeurs non-string.

**`TagsModal`** (`views.jsx`) — 2 onglets : Par tag (sélecteur + résumé dépenses/revenus/net + liste transactions) et Gérer (créer avec icône + couleur palette, supprimer).

### Arrondi automatique (SAVE_TRANSACTION)
```
Si roundingEnabled && type === "expense" && roundingCagnotteId && !isRounding :
  rounded = ceil(amount) | ceil(amount/5)*5 | ceil(amount/10)*10
  roundAmt = rounded − amount (arrondi à 2 décimales)
  Si roundAmt > 0.005 :
    Créer transaction { type:"epargne", isRounding:true, targetCagId:roundingCagnotteId, amount:roundAmt }
    Créditer la cagnotte cible
```

### Rapprochement bancaire
`isPointable(type)` — `false` pour `decagnottage` et `transfer` (mouvements internes).
Transactions : `pointed: boolean` via `TOGGLE_POINT_TX`.
Frais fixes : `pointedMonths[ym]` via `TOGGLE_POINT_FIX`.
Modifications ponctuelles : `monthlyOverrides[ym]` via `OVERRIDE_FIX_MONTH`.

### Dates et UTC
`currentYM()` et `todayISO()` utilisent l'heure locale (pas `toISOString()` UTC). Évite le décalage de mois pour les utilisateurs UTC+.

---

## Versioning

| Type | Condition | Exemple |
|------|-----------|---------|
| `PATCH` | Bug fix, retouche mineure | `1.19.0` → `1.19.1` |
| `MINOR` | Nouvelle fonctionnalité visible | `1.19.0` → `1.20.0` |
| `MAJOR` | Refonte structurelle, changement format données | `1.x.x` → `2.0.0` |

Version définie dans `src/utils.js` (`APP_VERSION`) et `package.json` (`version`).

---

## Changelog

| Version | Type | Description |
|---------|------|-------------|
| **1.19.0** | minor | Menu Options restructuré — sections groupées (Sécurité · Épargne · Catégories · Données), composant `Sheet` plein écran par option, badge d'état sur chaque ligne, stats globales en bas |
| **1.18.0** | minor | Historique des sauvegardes — `backupHistory[]`, `ADD_BACKUP_ENTRY`, carte dernière sauvegarde proéminente, accordéon historique avec re-export 📥 par entrée |
| **1.17.0** | minor | Clavier numérique custom `NumPad` — grille 4×4, `evalSimple()` pour additions de reçus, opérateurs sans doublon, virgule unique par segment, bouton type Revenu/Dépense synchronisé avec le formulaire |
| **1.16.0** | minor | Verrouillage PIN + biométrie — `LockScreen`, `SAVE_SECURITY_SETTINGS`, PIN hashé SHA-256 via `crypto.subtle`, `useEffect` auto-déclenchement bio au montage, accès plugin via `window.Capacitor?.Plugins?.BiometricAuth` |
| **1.15.0** | minor | Versements automatiques mensuels — `SAVE_AUTO_SAVING`/`DELETE_AUTO_SAVING`, plans avec cagnotte + montant + jour du mois, section "Épargnes à confirmer" dans Historique, config dans Options |
| **1.14.0** | minor | Filtres Historique simplifiés — barre unique ⚙️ Filtres avec badge actifs, panneau expansible (Type · Pointage · Tri · Montant · Vue), chips de filtres actifs avec ✕ individuel, toggle Liste/Catégories intégré |
| **1.13.0** | minor | Arrondi automatique — `SAVE_ROUNDING_SETTINGS`, `MARK_ROUNDING_TRANSFERRED`, création automatique transaction `isRounding` dans `SAVE_TRANSACTION`, colonne hero card (Mois · Année · À virer tappable), preview saisie "+0,40 € → Vacances 🏖️" |
| **1.12.0** | minor | Tags transversaux — `SAVE_TAG`/`DELETE_TAG`, `transaction.tagIds[]`, TagsModal dans Rapport (vue par tag + gérer), sélecteur dans TransModal, chips colorées dans Historique, `DELETE_TAG` nettoie toutes les transactions |
| **1.11.0** | minor | Rapprochement bancaire complet (hero card pointé/attente, PointRow, filtre 3 états, pointedMonths frais fixes, monthlyOverrides, isPointable, effectiveFixesForMonth dans hooks) |
| **1.10.1** | patch | Scroll SwipeRow fluide, catégories cliquables → liste filtrée, suppression chips catégories |
| **1.10.0** | minor | Transitions onglets, comparaison deux périodes, détection doublons, notes sur les mois |
| **1.9.1** | patch | OptionsView stats globales, backup visible, compteur usage catégories |
| **1.9.0** | minor | RapportView hero donut, filtre graphique, classement mois, moyennes, objectif épargne |
| **1.8.0** | minor | HistoriqueView refonte complète (donut, barre budget, nav flèches, groupement date, swipe, catégories, filtre montant) |
| **1.7.0** | minor | CagnottesView stats bloc, FixesView grille 4 colonnes |
| **1.6.0** | minor | AccueilView emojis, Delta inversé, carte cagnotte, cohérence couleurs |
| **1.5.0** | minor | Empty states SVG illustrés |
| **1.4.0** | minor | Hero card animée (shimmer, orbes, CountUp), SmartIndicator |
| **1.3.0** | minor | Tab bar redesign, fix focus Android |
| **1.2.0** | minor | Thème Aube sur Minas Tirith |
| **1.1.0** | minor | Renommage "Gestion du budget", système versioning |
| **1.0.2** | patch | Fix useBalance — frais fixes × mois écoulés |
| **1.0.1** | patch | Corrections UTC (currentYM, todayISO, useSpark) |
| **1.0.0** | — | Version initiale |

---

## Licence

Projet personnel — usage privé.

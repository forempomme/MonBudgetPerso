# Gestion du Budget

Application Android de gestion de budget personnel, développée en React et packagée via Capacitor.
Interface entièrement en français, 100 % hors-ligne, sans compte ni serveur.

**Version actuelle : `1.27.0`** — thème *Aube sur Minas Tirith*.

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
- **SmartIndicator** — point coloré en haut à droite : vert (tout va bien), jaune (solde < seuil ou backup > 7 j), rouge (solde négatif ou backup > 14 j). Tap → bulle explicative
- **Solde prévisionnel** — si des frais prévisionnels sont définis, deuxième ligne avec solde après ces dépenses
- **Rapprochement bancaire** — mini-cartes cliquables « ✓ Solde pointé » et « ⏳ En attente » + barre de progression. Tap → Historique filtré
- **Colonne arrondis** (si arrondi activé) — Mois / Année / À virer. La carte « À virer » est tappable pour marquer le virement comme effectué
- Cartes 🐷 Cagnottes et 📌 Fixes/mois
- **Cartes stat teintées** — Revenus (fond vert), Dépenses (fond rouge), Cagnotte (fond violet), Dép. variables (fond bleu). Barre dégradée en haut de chaque carte
- Stats mois en cours et année en cours avec badges delta colorés (▲/▼ %)
- **Récap cagnotte au tap** — tap sur les cartes 🐷 mensuelle ou annuelle → sheet avec répartition des mouvements par cagnotte
- **Section 🔮 À venir** (repliable) — positionnée après les cartes Cagnottes/Fixes. Repliée : chips `↻N` (fixes non pointés) + `📅N` (programmées) + total. Dépliée : onglets Tout / Récurrents / Programmés, liste détaillée avec compte à rebours, total global
- **Mode édition accueil** — accessible via FAB → ✏️ Accueil. Bannière jaune + boutons Masquer/Afficher sur chaque section. Persisté en localStorage

### FAB (bouton +)

Menu à 5 options, card encadrée avec fond distinct :

| Option | Action |
|--------|--------|
| 💸 Dépense | Ouvre TransModal en mode dépense |
| 💰 Revenu | Ouvre TransModal en mode revenu |
| 🐷 Épargne | Ouvre TransModal en mode épargne |
| 📅 Programmée | Ouvre ScheduledModal |
| ✏️ Accueil | Active le mode édition de l'accueil |

FAB avec dégradé bleu `#5ab8e0 → #3090c0` et ombre colorée. Rotation 45° à l'ouverture.

### Onglet Cagnottes

- Bloc stats en haut : épargné ce mois, épargné cette année, décagnottages
- **Bouton 🔄 Transfert** — modal avec toggle « ↔ Entre cagnottes » / « ↑ Vers le compte courant ». Le retrait vers le compte crée une transaction `dissolution_cagnotte` (comptabilisée comme revenu dans le solde estimé) et décrémente `cagnotte.current`
- Bouton ＋ Nouvelle cagnotte
- Projets d'épargne avec barre de progression, objectif € et date cible
- Montant à épargner par mois calculé automatiquement
- Tap → historique complet de la cagnotte

### Onglet Historique

- Navigation mois par flèches ◀ Mai 2026 ▶
- Mini donut répartition revenus / dépenses / épargne
- Barre de budget ratio dépenses/revenus avec couleur dynamique
- Mini récap rapprochement cliquable
- **Vues** : Liste / Catégories / **Calendrier** (toggle 📋/📅) — la vue calendrier affiche une grille mensuelle, tap sur un jour → détail des transactions
- Groupement par date avec bilan financier du jour
- **Filtres compacts** — barre unique avec bouton ⚙️ Filtres + 🌐 recherche globale. Panneau expansible avec sections Type / Pointage / Tri / Montant / Vue. Chips de filtres actifs avec ✕ individuel
- Pointage des transactions — bouton ○/✓ par ligne
- **Swipe gauche** sur une transaction → révèle ✏️ Modifier + 🗑 Supprimer
- **Section 📅 Programmées ce mois** (orange) — transactions programmées dont le jour n'est pas encore passé. ✓ confirme manuellement, ✕ supprime
- **Section Épargnes à confirmer** (violet) — versements automatiques planifiés non encore appliqués. ＋ applique le virement, ✕ saute le mois
- Section Récurrentes à confirmer
- Section Frais fixes du mois avec pointage et modification ponctuelle
- **Tags** — chips colorées sous chaque transaction taguée
- Détection de doublons à la saisie

### Onglet Fixes

- Carte récap avec total fixes/mois + total prévisionnels
- Grille 4 colonnes frais fixes et prévisionnels
- **Badge delta** ▲/▼ sur les cartes dont le montant a changé depuis le mois précédent (`prevAmountYM` ≠ mois courant)

### Onglet Rapport

- Hero card annuelle avec donut et 4 stats
- Filtre graphique Tout / Revenus / Dépenses
- Classement des mois 🥇🥈🥉, tappables
- Moyennes mensuelles, objectif épargne annuel
- Top 5 dépenses par catégorie avec liaisons nettes
- Évolution solde cumulé
- Tableau comparatif N vs N-1
- **Bouton 🎯 Suivi catégories** — SuiviModal avec seuils mensuels par catégorie
- **Bouton 🏷️ Tags** — TagsModal (vue par tag + résumé dépenses/revenus/net + gérer)
- **Bouton 📊 Analyse catégorie** — CategoryDetailModal avec frais fixes intégrés
- **Bouton 🐷 Taux d'épargne** — SavingsRateModal
- Comparaison deux périodes, notes sur les mois

### Onglet Options

| Section | Options |
|---------|---------|
| 🔒 Sécurité | PIN & biométrie |
| 🐷 Épargne | Versements automatiques · Arrondi automatique · Alerte solde bas |
| 🏷️ Catégories | Gestion catégories · Liaisons · Récurrentes |
| 💾 Données | Sauvegarde |

**🔒 Sécurité — PIN & biométrie**
- Toggle empreinte/FaceID — plugin `@aparajita/capacitor-biometric-auth`, déclenché automatiquement à l'ouverture
- Toggle PIN 4 chiffres — setup inline en 2 étapes, PIN stocké en SHA-256 via `crypto.subtle`, jamais en clair

**🐷 Versements automatiques**
- Planifier un virement mensuel fixe vers une cagnotte (montant + jour du mois)
- Si créé après le jour déclencheur du mois courant → démarrage le mois suivant (`lastAppliedYm` pré-renseigné)
- Application automatique au démarrage si le jour est passé et non encore appliqué ce mois-ci
- Toggle on/off par plan, suppression

**🐷 Arrondi automatique** — à chaque dépense, verse la différence jusqu'à l'arrondi dans une cagnotte choisie

**🔔 Alerte solde bas** — seuil configurable avec raccourcis 200 / 500 / 1000 €

**🏷️ Gestion catégories** — grille avec badge usage

**🔗 Liaisons de catégories** — lier revenu/dépense pour calcul net

**🔄 Récurrentes** — liste des modèles avec fréquence, compteur, suppression

**💾 Sauvegarde** — carte dernière sauvegarde, historique des 10 dernières avec re-export

### Transactions programmées

- Saisie via FAB → 📅 Programmée : montant, date future, catégorie optionnelle, note
- Visibles sur l'**accueil** dans la section « 🔮 À venir » avec compte à rebours humain
- Le mois J, apparaissent dans l'**Historique** sous « 📅 Programmées ce mois » avec ✓/✕ manuels
- **Confirmation automatique au démarrage** : si le jour prévu est arrivé, la programmée devient une dépense réelle avec la date prévue (même logique que les versements automatiques)
- Badge **PROG** dans l'historique sur les transactions issues d'une programmée

### Saisie des transactions (TransModal redessiné)

- **Sélecteur type** — 3 pills visuels colorés : 💸 Dépense / 💰 Revenu / 🐷 Épargne. Tap 🐷 → sous-toggle ↑ Dépôt / ↓ Retrait
- **Montant** — grand affichage coloré selon le type, change en temps réel
- **Catégorie** — chips horizontaux scrollables avec icônes
- **Date** — raccourcis Aujourd'hui / Hier / Avant-hier + champ complet si besoin
- **Bouton valider** — coloré selon le type avec libellé explicite (« Enregistrer la dépense »)
- **NumPad** — clavier custom avec `evalSimple()` pour additions de reçus
- Détection de doublons (même montant + catégorie dans les 7 derniers jours)
- Récurrentes avec fréquence et occurrences
- Preview arrondi automatique si activé
- Tags sélectables

### Sécurité — écran de verrou

- Affiché au démarrage si PIN activé
- Biométrie déclenchée automatiquement au montage
- Clavier PIN 4 chiffres, vérification SHA-256 côté client
- Fallback PIN si biométrie indisponible

### Navigation & UX

- Transitions entre onglets par glissement horizontal
- Barre de navigation 6 onglets — emoji agrandi + lueur sur l'onglet actif
- `backStackRef` avec IDs pour la navigation interne (sheets, panels) — évite les désync
- Empty states illustrés SVG sur toutes les vues vides
- Animations : cartes en cascade, compteurs, tap feedback

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
| `@aparajita/capacitor-biometric-auth` | ^8.0.0 | Empreinte / FaceID Android |
| `crypto.subtle` | Web API | Hachage SHA-256 du PIN |

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
│   ├── App.jsx                    # Racine : useReducer, navigation, dispatchers, LockScreen, FAB
│   ├── store.js                   # Reducer, actions A.*, DEFAULT_DATA
│   ├── hooks.js                   # useBalance, useMonthStats, useYearMonths, useSpark…
│   ├── context.js                 # ToastCtx + useToast()
│   ├── utils.js                   # fmt, uid, APP_NAME, APP_VERSION, currentYM…
│   ├── views.jsx                  # 6 vues + composants locaux (PointRow, SectionTitle…)
│   ├── styles.css                 # CSS complet (variables thème, animations, layout)
│   └── components/
│       ├── index.jsx              # ItemRow, Delta, Sparkline, Modal…
│       ├── charts.jsx             # ChartSVG, PatrimoineSVG
│       └── modals.jsx             # TransModal, FixedModal, CagModal, TransferModal, ScheduledModal…
├── index.html
├── vite.config.js
├── capacitor.config.js
├── package.json                   # version: 1.27.0
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
| `scheduledTransactions` | `ScheduledTransaction[]` | Transactions programmées futures |
| `tags` | `Tag[]` | Tags transversaux |
| `lastBackupDate` | `string\|null` | Date ISO de la dernière sauvegarde |
| `backupHistory` | `BackupEntry[]` | Historique des 10 dernières sauvegardes |
| `monthNotes` | `Record<string,string>` | Notes par mois |
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
  type: "expense",        // expense | income | epargne | decagnottage | dissolution_cagnotte
  amount: 85.40,
  categoryId: "c1",
  note: "Courses Leclerc",
  pointed: true,          // rapprochement bancaire
  tagIds: ["tg1"],        // tags transversaux (optionnel)
  isRounding: true,       // vrai si créé par l'arrondi automatique
  isAutoSaving: true,     // vrai si créé par un versement automatique
  autoSavingId: "as1",    // référence au plan de versement auto
  templateId: "tpl1",     // référence au modèle récurrent
  fromScheduled: true,    // vrai si confirmé depuis une transaction programmée
}
```

### Structure `FixedExpense`

```js
{
  id: "f1",
  name: "Netflix",
  amount: 17.99,
  categoryId: "c3",
  pointedMonths: { "2026-05": true },   // pointage par mois
  prevAmount: 15.99,                     // montant avant dernière modification
  prevAmountYM: "2026-04",              // mois de la dernière modification (pour delta)
}
```

### Structure `AutoSaving`

```js
{
  id: "as1",
  cagnotteId: "c2",
  amount: 50,
  dayOfMonth: 5,
  enabled: true,
  lastAppliedYm: "2026-05",  // mois de la dernière application (null = jamais)
}
```

### Structure `ScheduledTransaction`

```js
{
  id: "sch1",
  amount: 449.99,
  date: "2026-07-04",       // date prévue (toujours future à la création)
  categoryId: "c5",         // optionnel
  note: "Précommande Switch 2",
  confirmed: false,         // true après confirmation automatique ou manuelle
}
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
| `SAVE_TRANSACTION` | Créer/modifier. Si dépense + `roundingEnabled` → crée automatiquement une transaction `isRounding:true` |
| `DELETE_TRANSACTION` | Supprimer + restaure `cagnotte.current` si la transaction est de type `epargne` ou `decagnottage` |
| `TOGGLE_POINT_TX` | Bascule `transaction.pointed` |
| `TOGGLE_POINT_FIX` | Bascule `fixedExpense.pointedMonths[ym]` |
| `OVERRIDE_FIX_MONTH` | Modif ponctuelle d'un frais fixe pour un mois |
| `SAVE_MONTH_NOTE` | Note texte par mois |
| `SAVE_RECURRING` / `DEL_RECURRING` | Modèles récurrents |
| `SAVE_AUTO_SAVING` | Créer/modifier un plan. À la création, si `today >= dayOfMonth`, `lastAppliedYm` est pré-renseigné → démarrage le mois suivant |
| `DELETE_AUTO_SAVING` | Supprimer un plan |
| `APPLY_AUTO_SAVING` | Appliquer un plan pour un mois donné : crée transaction `epargne` avec `autoSavingId`, crédite la cagnotte, met à jour `lastAppliedYm` |
| `SAVE_SCHEDULED` | Créer/modifier une transaction programmée |
| `DELETE_SCHEDULED` | Supprimer une transaction programmée |
| `CONFIRM_SCHEDULED` | Convertit en dépense réelle avec la date prévue, badge `fromScheduled:true` |
| `EXECUTE_TRANSFER` | Entre cagnottes : déplace `current`. Vers compte (`toId === "__account__"`) : décrémente cagnotte + crée transaction `dissolution_cagnotte` |
| `SAVE_ALERT_SETTINGS` | Alerte solde bas |
| `SAVE_CATEGORY_THRESHOLD` | Seuil mensuel par catégorie |
| `SAVE_ROUNDING_SETTINGS` | Config arrondi automatique |
| `MARK_ROUNDING_TRANSFERRED` | Met à jour `roundingLastTransferDate` |
| `SAVE_TAG` / `DELETE_TAG` | Tags. DELETE retire aussi le tag de toutes les transactions |
| `SAVE_SECURITY_SETTINGS` | PIN hash + biométrie |
| `SAVE_FIXED` | Créer/modifier frais fixe. Si montant modifié → `prevAmount` = ancien montant, `prevAmountYM` = mois courant |
| `DELETE_FIXED` | Supprimer frais fixe |
| `ADD_BACKUP_ENTRY` | Ajoute une entrée à `backupHistory` (max 10) + `lastBackupDate` |
| `IMPORT_DATA` / `RESET` | Import JSON / remise à zéro |

### Navigation
Pile `tabHistory` + direction pour les transitions. `navigateTo(tab)` calcule gauche/droite selon `TAB_ORDER`. `backStackRef` avec entrées `{ id, fn }` pour la navigation interne — chaque sheet/panel enregistre une fermeture, le bouton retour Android consomme le dernier.

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

### Logique de confirmation automatique au démarrage

Au montage de `App.jsx`, un `useEffect` unique parcourt :

1. **Versements automatiques** — si `plan.enabled && plan.lastAppliedYm !== curYM && today >= plan.dayOfMonth` → dispatch `APPLY_AUTO_SAVING`
2. **Transactions programmées** — si `!s.confirmed && s.date.startsWith(curYM) && today >= scheduledDay` → dispatch `CONFIRM_SCHEDULED`

### Composants clés

**`LockScreen`** (`views.jsx`) — écran plein écran si `pinEnabled && pinHash`. `useEffect` déclenche `tryBio()` au montage si `bioEnabled`. Import dynamique de `@aparajita/capacitor-biometric-auth` pour éviter la résolution Rollup.

**`SectionTitle`** (`views.jsx`) — barre verticale 3px couleur accent + texte uppercase text2. Utilisé pour « 🗓️ Mois en cours », « 📅 Année en cours ».

**`NumPad`** (`modals.jsx`) — clavier custom 4×4. `evalSimple()` pour additions/soustractions de reçus. Bouton type Revenu/Dépense synchronisé avec le formulaire.

**`ScheduledModal`** (`modals.jsx`) — saisie transaction programmée : montant, date future obligatoire, catégorie optionnelle, note.

**`TransferModal`** (`modals.jsx`) — toggle « ↔ Entre cagnottes » / « ↑ Vers le compte courant ». Validation fonds insuffisants.

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
| `PATCH` | Bug fix, retouche mineure | `1.26.0` → `1.26.1` |
| `MINOR` | Nouvelle fonctionnalité visible | `1.26.0` → `1.27.0` |
| `MAJOR` | Refonte structurelle, changement format données | `1.x.x` → `2.0.0` |

Version définie dans `src/utils.js` (`APP_VERSION`) et `package.json` (`version`).

---

## Changelog

| Version | Type | Description |
|---------|------|-------------|
| **1.27.0** | minor | TransModal entièrement redessiné — pills visuels pour le type (💸/💰/🐷 + sous-toggle ↑Dépôt/↓Retrait pour cagnotte), grand affichage coloré du montant, chips catégorie scrollables avec icônes, raccourcis date (Aujourd'hui/Hier/Avant-hier), bouton valider coloré avec libellé explicite |
| **1.26.0** | minor | Redesign visuel accueil — cartes stat teintées par type (vert/rouge/violet/bleu + barre dégradée haut), `SectionTitle` style barre verticale, FAB dégradé `#5ab8e0→#3090c0` avec ombre colorée |
| **1.25.3** | patch | Section « À venir » repliable — style A : chips `↻N`/`📅N` + total visibles en replié, onglets filtre visibles seulement ouvert |
| **1.25.2** | patch | Section « À venir » repositionnée après cartes Cagnottes/Fixes ; frais fixes non pointés du mois intégrés (badge bleu ↻) ; onglets Tout / Récurrents / Programmés |
| **1.25.1** | patch | Section « À venir » améliorée — compte à rebours humain (demain / dans X j / dans X sem.), total si 2+ items, suppression avec confirmation inline (Oui/Non), `onDeleteScheduled` passé à AccueilView |
| **1.25.0** | minor | Transactions programmées — `ScheduledModal` (FAB 📅), section « 📅 À venir » accueil, section « 📅 Programmées ce mois » historique (✓/✕), confirmation automatique au démarrage (même logique que versements auto), badge PROG dans l'historique, `SAVE_SCHEDULED`/`DELETE_SCHEDULED`/`CONFIRM_SCHEDULED` dans le store |
| **1.24.4** | patch | TransferModal étendu — toggle « ↔ Entre cagnottes » / « ↑ Vers le compte courant » ; retrait vers compte crée une transaction `dissolution_cagnotte` et décrémente `cagnotte.current` |
| **1.24.3** | patch | Fix boutons ＋ et ✕ dans section « Épargnes à confirmer » — `onApplyAutoSaving`/`onSkipAutoSaving` (TypeError silencieuse corrigée) ; `autoSavingId` ajouté aux transactions `APPLY_AUTO_SAVING` |
| **1.24.2** | patch | Fix logique création plan auto savings — si `today >= dayOfMonth` à la création, `lastAppliedYm` = mois courant → démarrage mois suivant |
| **1.24.1** | patch | Fix `DELETE_TRANSACTION` — restaure désormais `cagnotte.current` pour les types `epargne` et `decagnottage` ; badge AUTO sur les transactions de versement automatique dans PointRow |
| **1.24.0** | minor | Récap cagnotte au tap — cartes 🐷 mensuelle et annuelle ouvrent un sheet avec répartition des mouvements par cagnotte (+ajouté / −retiré / net) |
| **1.23.2** | patch | Retrait complet du re-verrouillage `appStateChange` (trop intrusif, causait écran noir après biométrie) |
| **1.23.1** | patch | Fix lock screen biométrie — `backgroundedAtRef` initialisé à `Date.now()` (était 0, causait `elapsed` énorme → re-verrouillage immédiat après unlock) |
| **1.23.0** | minor | `backStackRef` avec IDs `{ id, fn }` pour éviter les désync ; `prevAmount`/`prevAmountYM` sur `FixedExpense` (delta affiché sur les cartes Fixes seulement si `prevAmountYM` ≠ mois courant) |
| **1.22.5** | patch | Suppression flux mensuels et 5 dernières opérations de l'accueil (code entièrement retiré) |
| **1.22.4** | patch | Swipe mois retiré définitivement de HistoriqueView (conflit avec swipe transactions) |
| **1.22.2** | patch | `parseAmt()` — remplace `parseFloat` sur tous les inputs utilisateur dans modals.jsx (virgule → point avant parsing) |
| **1.22.1** | patch | FAB menu visibilité améliorée — card avec fond `var(--surface)`, bordure, ombre forte, items avec fond `var(--surface2)` |
| **1.22.0** | minor | Mode édition accueil (FAB → ✏️ Accueil) — sections masquables avec boutons Masquer/Afficher, persisté en localStorage ; swipe gauche PointRow → révèle ✏️ Modifier + 🗑 Supprimer |
| **1.21.0** | minor | FAB quick menu 5 options (Dépense/Revenu/Épargne/Programmée/Accueil) — card encadrée avec animation |
| **1.20.0** | minor | Vue calendrier dans HistoriqueView — toggle 📋/📅, grille 7 colonnes, tap jour → détail transactions |
| **1.19.0** | minor | Menu Options restructuré — sections groupées, composant `Sheet` plein écran, badge d'état, stats globales |
| **1.18.0** | minor | Historique des sauvegardes — `backupHistory[]`, accordéon avec re-export |
| **1.17.0** | minor | Clavier numérique custom `NumPad` — `evalSimple()`, bouton type synchronisé |
| **1.16.0** | minor | Verrou PIN + biométrie — `LockScreen`, SHA-256, `@aparajita/capacitor-biometric-auth` |
| **1.15.0** | minor | Versements automatiques mensuels |
| **1.14.0** | minor | Filtres Historique simplifiés |
| **1.13.0** | minor | Arrondi automatique |
| **1.12.0** | minor | Tags transversaux |
| **1.11.0** | minor | Rapprochement bancaire complet |
| **1.10.0** | minor | Transitions onglets, comparaison périodes, détection doublons, notes mois |
| **1.9.0** | minor | RapportView hero donut, classement mois, moyennes |
| **1.8.0** | minor | HistoriqueView refonte complète |
| **1.7.0** | minor | CagnottesView stats, FixesView grille 4 colonnes |
| **1.0.0** | — | Version initiale |

---

## Licence

Projet personnel — usage privé.

# Cartographie — Gestion du Budget

Document de référence technique pour reprendre le développement de l'app sans avoir à tout redécouvrir. Version couverte : **1.43.0**.

---

## 1. Vue d'ensemble

Application Android de budget personnel — React 18 + Capacitor 6, thème visuel *Aube sur Minas Tirith*. 100 % hors-ligne, aucun compte, aucun serveur : tout vit dans `localStorage` (clé `budget_ultimate_2026_v10`), géré par un unique `useReducer`.

**Arborescence `src/`** (depuis v1.40.0, `views.jsx` est découpé par vue) :

```
src/
├── main.jsx               point d'entrée React (createRoot + StrictMode)
├── App.jsx                state global, FAB, routing, handlers, notifications
├── store.js               reducer, DEFAULT_DATA, actions A.*, normalizeData()
├── hooks.js               tous les calculs (solde, rapprochement, projection…)
├── utils.js               fmt, dates locales, isIncome, txLabel, APP_VERSION…
├── context.js             ToastCtx + useToast
├── styles.css
├── views.jsx              simple point d'entrée : ré-exporte les 7 vues
├── views/
│   ├── shared.jsx         composants partagés entre vues (TagsModal, EmptyIllustration, SectionTitle, sha256hex…)
│   ├── AccueilView.jsx    ├── CagnottesView.jsx   ├── HistoriqueView.jsx
│   ├── FixesView.jsx      ├── RapportView.jsx     ├── OptionsView.jsx
│   └── LockScreen.jsx
└── components/
    ├── index.jsx          Delta, ItemRow, Modal, ToastContainer
    ├── modals.jsx         tous les formulaires modaux + NumPad + SideAmountsPicker
    └── charts.jsx         ChartSVG, PatrimoineSVG
```

Hors `src/` : `package.json`, `capacitor.config.cjs` — **tous vus en v1.40.0**. Seul `vite.config.js` n'a jamais été transmis.

Un composant utilisé par une seule vue vit dans le fichier de cette vue ; dès qu'une 2e vue en a besoin, il passe dans `views/shared.jsx`.

> ⚠️ **Leçon apprise (v1.39.30)** : `useSpark` a été supprimé de `hooks.js` en le croyant mort, alors qu'il était importé par `components/index.jsx` — le build a cassé. Avant de qualifier quoi que ce soit de "code mort", vérifier l'usage dans **tout** le dépôt, pas seulement les fichiers en main. En cas de doute, demander le fichier plutôt que de supposer.

---

## 2. Rôle de chaque fichier

| Fichier | Rôle | Taille approx. |
|---|---|---|
| `App.jsx` | State global (`useReducer`), FAB (menu court + éventail templates rapides), routing entre les 6 vues, tous les handlers qui `dispatch()`, `useEffect` de démarrage (versements auto, programmées, projection snapshots) | ~1000 lignes |
| `store.js` | Le reducer complet : `DEFAULT_DATA` (schéma des données), objet `A` (actions), `case` du reducer | ~760 lignes |
| `hooks.js` | Tous les hooks de calcul — solde, rapprochement, projection, stats annuelles/mensuelles | ~590 lignes |
| `views/*.jsx` | Une vue par fichier (voir arborescence). `SwipeRow`/`PointRow` → HistoriqueView, `Sheet`/`SideAmountTypesModal` → OptionsView, `TagsModal` → shared | 80 à 1 420 lignes par fichier |
| `modals.jsx` | Tous les formulaires modaux (`TransModal`, `FixedModal`, `FixedIncomeModal`, `CagModal`, `ScheduledModal`, `QuickTemplateSheet`...) + le `NumPad` partagé | ~1960 lignes |
| `styles.css` | Variables du thème, animations, classes `type-*`, `.fab`, etc. | ~410 lignes |
| `utils.js` | `fmt`, `isIncome`, `currentYM`, `todayISO`, `daysAgoISO`, `getPrevMonth`, `txLabel`, `txTypeClass`, `txSign`, `deltaInfo`, `APP_VERSION` (à bumper avec `package.json`), `uid`, `LS_KEY` | ~140 lignes |
| `components/index.jsx` | `Delta`, `ItemRow`, `Modal`, `ToastContainer` (`Sparkline`/`useSpark` supprimés en 1.41.1) | ~90 lignes |
| `components/charts.jsx` | `ChartSVG`, `PatrimoineSVG` (Rapport) | ~150 lignes |

---

## 3. Flux de données

```
App.jsx (useReducer + store.js)
   │
   ├─ handlers (useCallback) qui font dispatch({ type: A.XXX, ... })
   │
   └─ passés en props aux vues de views.jsx / aux modals de modals.jsx
         │
         └─ chaque vue lit `data` (le state) + appelle les hooks de hooks.js
               pour ses calculs (jamais de recalcul ad-hoc dupliqué — voir §5)
```

Aucun contexte React global autre que `ToastCtx` : tout redescend explicitement en props depuis `App.jsx`.

---

## 4. Modèle de données (`DEFAULT_DATA` dans `store.js`)

| Champ | Description |
|---|---|
| `transactions[]` | Toutes les opérations. Champs notables : `paymentMethod` (`"cheque"`), `chequeNumber`, `issuedDate` (date d'émission d'un chèque — `date` devient la date d'encaissement une fois pointé), `type`, `amount`, `date`, `categoryId`, `pointed`, `templateId` (lien récurrente), `adjSign` (`"+"`/`"-"`, pour `balance_adjustment`), `tagIds[]`, `sideAmounts` (`{ [typeId]: montant }`), `targetCagId` |
| `categories[]` | Catégories (icône, nom, type) |
| `cagnottes[]` | Cagnottes (avec `cagType`) |
| `fixedExpenses[]` | Frais fixes. Champs : `startYM`, `monthlyOverrides`, `pointedMonths`, `paused`, `pausedFrom`, `pausedUntil` |
| `fixedIncomes[]` | Revenus fixes récurrents — **mêmes champs** que `fixedExpenses` (startYM, monthlyOverrides, pointedMonths, paused, pausedFrom, pausedUntil) |
| `recurringTemplates[]` | Modèles de récurrentes (`type`, `amount`, `frequency`, `occurrences`, `categoryId`) |
| `scheduledTransactions[]` | Transactions programmées (date future) |
| `autoSavings[]` | Versements automatiques mensuels |
| `tags[]` | `{ id, name, icon, color, budget?, budgetPeriod? }` — `budgetPeriod` : `"month"` (défaut) ou `"total"` |
| `sideAmountTypes[]` | Types de "montants à part" configurables (ex: `{ id:"tr", icon:"🎫", label:"Tickets resto", trackBalance:true }`). `trackBalance` = porte-monnaie affiché sur l'accueil |
| `offAccountEntries[]` | Dépenses 100 % hors compte et rechargements : `{ id, kind:"expense"|"recharge", satId, amount, date, categoryId?, note? }`. **Liste séparée des transactions : aucun calcul bancaire ne doit jamais la lire** |
| `quickTemplates[]` | Templates de saisie rapide (`{ id, icon, name, categoryId, type }`) |
| `categoryThresholds{}` | Seuils d'alerte budget par catégorie |
| `notifSettings{}` | Config notifications locales |
| `pinEnabled` / `pinHash` / `bioEnabled` | Sécurité |
| `warning` | Avertissement ponctuel du reducer, affiché en toast puis effacé via `CLEAR_WARNING` |
| `projectionSnapshots{}` | `{ [ym]: { predictedValue, predictedOn } }`, jamais réécrit une fois posé |
| `roundingEnabled` / `roundingCagnotteId` / `roundingRule` | Arrondi automatique |
| `alertEnabled` / `alertThreshold` | Alerte solde bas |

### Types de transaction (`TxType`)
`income` · `expense` · `epargne` · `decagnottage` · `dissolution_cagnotte` · `transfer` · `balance_adjustment`

---

## 5. Sources de vérité — À NE JAMAIS DUPLIQUER

C'est le point le plus important de ce document. Une bonne partie des bugs rencontrés dans les sessions précédentes venaient du **même calcul réécrit à la main à plusieurs endroits**, qui finissait par diverger silencieusement. Toujours réutiliser ces helpers plutôt que d'écrire `isIncome(t.type) ? ... : ...` ou `!f.startYM || ym >= f.startYM` à la main :

| Helper (`hooks.js`) | Rôle | À utiliser pour |
|---|---|---|
| `isActiveForMonth(f, ym)` | Un frais/revenu fixe est-il actif ce mois-là ? Gère **à la fois** `startYM` et la pause (`paused`/`pausedFrom`/`pausedUntil`) | Tout filtrage de frais/revenu fixe par mois |
| `isIncomeDirection(t)` | Le sens d'une transaction (+ ou −). Respecte `adjSign` pour une opération d'équilibre (qui peut être + ou −), sinon retombe sur `isIncome(t.type)` | Tout endroit qui affiche/calcule un signe, une couleur, un total net |
| `isPointable(type)` | `true` sauf `decagnottage`/`transfer` (mouvements internes, absents d'un relevé) | Rapprochement bancaire, filtres Historique |
| `useReconciliation(txs, fixedExpenses, fixedIncomes)` | LA seule source pour `soldePointe`/`soldeAttente`/`nbPointed`/`totalPointable`. Inclut les frais ET revenus fixes avec leur propre `pointedMonths` | Accueil (rapprochement + base du solde estimé) |
| `useBalanceWithRecurring(...)` | Solde estimé = `soldePointe + soldeAttente` moins les récurrentes/programmées pas encore confirmées. **Ne recompte jamais un frais fixe non pointé une 2e fois** (déjà dans `soldeAttente`) | Le gros chiffre "Solde bancaire estimé" |
| `pendingCheques(txs)` | Chèques non pointés avec âge, date limite (1 an + 8 j) et niveau `recent`/`old`/`veryold`/`expired` | Bandeau + liste chèques (Accueil) |
| `recurringRefDate(t)` (utils.js) | `issuedDate || date` : date qui décide quel mois une opération confirme pour les récurrentes. **À utiliser pour toute vérification « récurrente déjà confirmée ce mois »** | hooks, Accueil, Historique, App |
| `computeWallets(types, offEntries, txs, ym)` | Porte-monnaie par type suivi : solde = rechargements − dépenses hors compte − montants à part en complément ; rechargé/dépensé du mois (corrections exclues) ; mouvements | Mini-carte hero + panneau porte-monnaie (Accueil) |
| `computeSidePaidByCategory(txs, offEntries, type, période)` | Payé hors banque vs budget réel par catégorie | Rapport |
| `computeTagBudgets(tags, txs, ym)` | Budgets par tag : dépensé / budget / % / niveau (`ok`/`warn`/`over`). Dépenses uniquement, montant banque | Rapport (`TagBudgetBars`) ET alerte Accueil |
| `effectiveFixesForMonth` / `effectiveIncomesForMonth` | Montant effectif d'un frais/revenu fixe pour un mois donné (respecte `isActiveForMonth` + `monthlyOverrides`) | Tout total mensuel de frais/revenus fixes |

**Rappel de conception (établi et re-confirmé plusieurs fois avec l'utilisateur)** :
- Le rapprochement d'Historique (par mois affiché) est **volontairement différent** du rapprochement de l'Accueil (cumulé depuis le début) — ce n'est pas un doublon à fusionner, ce sont deux métriques différentes.
- Les revenus fixes ne sont **jamais** comptés automatiquement dans "pointé" — ils ont leur propre `pointedMonths`, comme les frais fixes, depuis que ce système a été ajouté.
- Une récurrente ou une opération d'équilibre peut être un revenu ou une dépense : ne jamais supposer une direction fixe.

---

## 6. Où trouver telle fonctionnalité

| Fonctionnalité | Fichier(s) | Composant / fonction |
|---|---|---|
| Saisie d'une opération | `modals.jsx` | `TransModal` (+ `NumPad` partagé) |
| Récurrentes | `modals.jsx` (saisie) + `store.js` (`SAVE_RECURRING`, `DEL_RECURRING`) + `hooks.js`/`views.jsx` (`upcomingRecurring`) | — |
| Frais/revenus fixes | `modals.jsx` (`FixedModal`, `FixedIncomeModal`) + `views.jsx` (`FixesView`) | — |
| Pause d'un frais/revenu fixe | `hooks.js` (`isActiveForMonth`), `modals.jsx` (toggle + champ `pausedUntil`), `views.jsx` (`FixesView` badge + tooltip) | — |
| Programmées | `modals.jsx` (`ScheduledModal`) + `store.js` (`SAVE_SCHEDULED`, `CONFIRM_SCHEDULED`) | — |
| Templates de saisie rapide (FAB appui long) | `App.jsx` (détection appui long + éventail) + `modals.jsx` (`QuickTemplateSheet`, `QuickTemplateManagerModal`) | — |
| Opération d'équilibre (⚖️, +/−) | `modals.jsx` (`TransModal`, toggle `adjSign`) + `hooks.js` (`isIncomeDirection`) | — |
| Montants à part (tickets resto, etc.) | `store.js` (`sideAmountTypes`, `SAVE_SIDE_AMOUNT_TYPE`) + `modals.jsx` (boutons dans `TransModal` ET `QuickTemplateSheet`) + `views.jsx` (`SideAmountTypesModal`, affichage Historique/Rapport) | — |
| Tags | `store.js` (`SAVE_TAG`, `DELETE_TAG`) + `modals.jsx` (sélection dans `TransModal`) + `views.jsx` (`TagsModal`, affichage + filtre Historique, vue Rapport) | — |
| Arrondi automatique | `store.js` (reducer `SAVE_TRANSACTION`) + `views.jsx` (`OptionsView`) | — |
| Rapprochement bancaire | `hooks.js` (`useReconciliation`) + `views.jsx` (Accueil : cumulé / Historique : par mois affiché, calcul local) | — |
| Solde estimé + sparkline hero card | `hooks.js` (`useBalanceWithRecurring`) + `views.jsx` (`AccueilView`, le point du mois en cours = `balance` directement) | — |
| Projection 3 mois | `hooks.js` (`useBalanceProjection`, `useVariableCashflowMedian`, `useProjectionAccuracy`) + `views.jsx` (`AccueilView`, carte carrousel) | — |
| Historique — liste/filtres/calendrier | `views.jsx` | `HistoriqueView`, `SwipeRow`, `PointRow` |
| Rapport | `views.jsx` | `RapportView`, `RapportDonut`, `AnalysteLocal`, `SuiviModal`, `CategoryDetailModal` |
| Options (menu + info-bulles ⓘ) | `views.jsx` | `OptionsView` (tableau `GROUPS`, champ `desc` par item) |
| Sécurité (PIN/biométrie) | `views.jsx` | `LockScreen` |

---

## 7. Conventions établies au fil des sessions

- **Toujours tester en isolation avant de livrer** — chaque modif de `hooks.js`/`store.js` est validée par une simulation Node.js (`useMemo` stubbé, `utils.js` mocké) reproduisant le scénario réel, pas juste une validation de syntaxe.
- **Toujours valider par un build complet** : bundle esbuild de `src/main.jsx` (équivalent `vite build`) + détection des identifiants non déclarés via TypeScript — le build seul ne voit pas une variable utilisée sans être définie.
- **Toujours bumper la version à 3 endroits** : `utils.js` (`APP_VERSION`), `package.json`, `README.md` — et **l'annoncer** à la fin de chaque réponse contenant une modif de code (patch pour un fix, minor pour une nouvelle fonctionnalité).
- **Demander confirmation avant toute suppression** de code, même identifié comme "mort" — et vérifier l'usage dans tout le dépôt connu, pas seulement les fichiers en main.
- **Mockup avant implémentation** pour tout ce qui touche à une interaction ou un visuel nouveau (l'utilisateur valide toujours un mockup HTML autonome — fond sombre, cadre téléphone, variables CSS du vrai thème — avant le code réel).
- **Dates toujours en heure locale**, jamais `toISOString()` (bug UTC déjà rencontré et corrigé à de nombreux endroits).
- **Préserver les champs non gérés par un formulaire lors d'une édition** — un `{ ...old, ...payload }` naïf écrase silencieusement un champ que le formulaire ne connaît pas (ex : `templateId` cassé lors de l'édition d'une récurrente, corrigé en v1.39.23/24). Vérifier ce risque à chaque nouveau champ optionnel ajouté à `transactions`/`fixedExpenses`/`fixedIncomes`.

---

## 8. Historique des grandes évolutions (contexte, pas exhaustif — voir `README.md` pour le changelog complet)

- **Templates rapides** (appui long FAB) — v1.39.18, emoji libre v1.39.27
- **Refonte du solde estimé** autour de `useReconciliation` — v1.39.24, ajustée en 1.39.25 (revenus fixes retirés du calcul "pointé" automatique)
- **Pause des frais/revenus fixes** avec reprise automatique — v1.39.30, non-rétroactivité corrigée dans la foulée
- **Opération d'équilibre bidirectionnelle** (`adjSign`) — v1.39.31
- **Montants à part génériques** (remplace l'ancien champ unique `mealVoucherAmount`) — v1.39.32
- **Tags** : filtre Historique + entrée Options — v1.39.34 (la base du système de tags existait déjà avant)
- **Découpage de `views.jsx`**, notifications réparées (plugin manquant), `normalizeData` — v1.40.0
- **Info-bulles ⓘ dans Options** — v1.39.35, repositionnées dans le flux normal (au lieu d'un survol) en v1.39.36 pour éviter d'être coupées par les coins arrondis des cartes

---

- **Notifications** : plugin `@capacitor/local-notifications`, canal `budget`, replanifiées à chaque ouverture (après déverrouillage, +4 s, sans popup de permission). Ne jamais demander une permission au démarrage (écran noir 1.39.1).
- **Chèques** : pointer = encaisser. `TOGGLE_POINT_TX` sur un chèque déplace sa date au jour même (et la remet à `issuedDate` au dépointage) ; `CASH_CHEQUE` encaisse à une date choisie. Couleur `--chq` (bleu ardoise).
- **Hors compte** : couleur dédiée `--tr` (or/cuivre) + classes `.tr-metal-box` / `.tr-metal-text` (dégradé) dans `styles.css`. Le jaune `--warning` reste réservé à « En attente » et aux alertes.
- **Données entrantes** : tout passe par `normalizeData()` (chargement ET import de sauvegarde). Toute future migration de champ s'ajoute là.

## 9. Ce que ce document ne couvre pas

- Le contenu exact de `utils.js`, `components/index.jsx`, `components/charts.jsx` — à demander si besoin.
- La configuration de build (`vite.config.js`, `capacitor.config.js`, workflow GitHub Actions) — voir `README.md`, section *Build APK*.
- Le détail changelog version par version — voir `README.md`, section *Changelog*.

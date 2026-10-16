# Cartographie — Gestion du Budget

Document de référence technique pour reprendre le développement de l'app sans avoir à tout redécouvrir. Version couverte : **1.67.0**.

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
├── styles.css             variables du thème, @font-face DM Sans (v1.49.0)
├── fonts/                 DMSans-var.woff (police variable 400→800, sous-ensemble latin, tnum limité aux chiffres) + DMSans-OFL.txt (licence) — v1.49.0
├── views.jsx              simple point d'entrée : ré-exporte les 7 vues
├── views/
│   ├── shared.jsx         composants partagés entre vues (TagsModal, EmptyIllustration, SectionTitle, sha256hex…)
│   ├── AccueilView.jsx    ├── CagnottesView.jsx   ├── HistoriqueView.jsx
│   ├── BalanceBreakdownSheet.jsx  panneau « Calcul du solde estimé » (v1.45.0)
│   ├── MonthRecapSheet.jsx        « Clôture du mois » / bilans mensuels (v1.47.0)
│   ├── ForecastPanels.jsx         calendrier & solde jour par jour, reste à vivre, remboursements (v1.48.0) ; exporte `Sheet`
│   ├── InsightPanels.jsx          « Et si… ? » (SimulationSheet/Block), « Repéré pour toi » (InsightsList), surplus (SurplusCard/Sheet) — v1.50.0
│   ├── FixesView.jsx      ├── RapportView.jsx     ├── OptionsView.jsx
│   └── LockScreen.jsx
└── components/
    ├── index.jsx          Delta, ItemRow, Modal, ToastContainer
    └── modals.jsx         tous les formulaires modaux + NumPad + briques communes (TypeButtons, TextField, IconNameField, CategoryField, DateField, MonthField, OptionsField, FormActions)
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
| `isActiveForMonth(f, ym)` | Un frais/revenu fixe est-il actif ce mois-là ? Gère `startYM`, la pause en cours (`paused`/`pausedFrom`/`pausedUntil`) **et les pauses terminées (`pauseHistory`, v1.45.1)** | Tout filtrage de frais/revenu fixe par mois |
| `isIncomeDirection(t)` | Le sens d'une transaction (+ ou −). Respecte `adjSign` pour une opération d'équilibre (qui peut être + ou −), sinon retombe sur `isIncome(t.type)` | Tout endroit qui affiche/calcule un signe, une couleur, un total net |
| `isPointable(type)` | `true` sauf `decagnottage`/`transfer` (mouvements internes, absents d'un relevé) | Rapprochement bancaire, filtres Historique |
| `computeReconciliation(...)` / `useReconciliation(txs, fixedExpenses, fixedIncomes)` | LA seule source (le hook n'est qu'un `useMemo` autour de la fonction pure, qui garde aussi le détail des lignes en attente) pour `soldePointe`/`soldeAttente`/`nbPointed`/`totalPointable`. Inclut les frais ET revenus fixes avec leur propre `pointedMonths` | Accueil (rapprochement + base du solde estimé) |
| `computeBalanceBreakdown(...)` / `useBalanceBreakdown` / `useBalanceWithRecurring(...)` | Solde estimé = `soldePointe + soldeAttente` ± récurrentes pas encore confirmées − programmées échues, **avec le détail de chaque ligne** (chèques non encaissés séparés). `useBalanceWithRecurring` renvoie juste `.total`. **Ne recompte jamais un frais fixe non pointé une 2e fois** (déjà dans `soldeAttente`) | Le gros chiffre "Solde bancaire estimé" ET le panneau « Calcul du solde estimé » (v1.45.0) — même fonction, ne peuvent pas diverger |
| `pendingCheques(txs)` | Chèques non pointés avec âge, date limite (1 an + 8 j) et niveau `recent`/`old`/`veryold`/`expired` | Bandeau + liste chèques (Accueil) |
| `recurringRefDate(t)` (utils.js) | `issuedDate || date` : date qui décide quel mois une opération confirme pour les récurrentes. **À utiliser pour toute vérification « récurrente déjà confirmée ce mois »** | hooks, Accueil, Historique, App |
| `computeWallets(types, offEntries, txs, ym)` | Porte-monnaie par type suivi : solde = rechargements − dépenses hors compte − montants à part en complément ; rechargé/dépensé du mois (corrections exclues) ; mouvements | Mini-carte hero + panneau porte-monnaie (Accueil) |
| `computeSidePaidByCategory(txs, offEntries, type, période)` | Payé hors banque vs budget réel par catégorie | Rapport |
| `computeTagBudgets(tags, txs, ym)` | Budgets par tag : dépensé / budget / % / niveau (`ok`/`warn`/`over`). Dépenses uniquement, montant banque | Rapport (`TagBudgetBars`) ET alerte Accueil |
| `computeMonthTotals` / `computePeriodTotals` / `firstDataYM` (v1.47.1) | Totaux d'un mois / d'une période = opérations + frais fixes + revenus fixes, uniquement pour les mois vécus (≥ 1ʳᵉ opération, ≤ mois en cours). `useMonthStats`, `useYearMonths`, `useYearTotals`, `usePriorYearStats` n'en sont que des enveloppes | Tout total mensuel/annuel affiché (Accueil, Historique, Rapport). Ne jamais recalculer à la main |
| `effectiveFixesForMonth` / `effectiveIncomesForMonth` | Montant effectif d'un frais/revenu fixe pour un mois donné (respecte `isActiveForMonth` + `monthlyOverrides`) | Tout total mensuel de frais/revenus fixes |

**Rappel de conception (établi et re-confirmé plusieurs fois avec l'utilisateur)** :
- Le rapprochement d'Historique (par mois affiché) est **volontairement différent** du rapprochement de l'Accueil (cumulé depuis le début) — ce n'est pas un doublon à fusionner, ce sont deux métriques différentes.
- Les revenus fixes ne sont **jamais** comptés automatiquement dans "pointé" — ils ont leur propre `pointedMonths`, comme les frais fixes, depuis que ce système a été ajouté.
- Une récurrente ou une opération d'équilibre peut être un revenu ou une dépense : ne jamais supposer une direction fixe.

---

## 6. Où trouver telle fonctionnalité

| Fonctionnalité | Fichier(s) | Composant / fonction |
|---|---|---|
| Saisie d'une opération | `modals.jsx` | `TransModal` (+ `NumPad`, `CategoryField`, `DateField` partagés avec `OffAccountModal` — toute évolution de la catégorie ou de la date se fait dans ces composants, une seule fois). Depuis 1.44.0 : doit tenir **sans défilement sur un Pixel 8** (≈ 412 × 860 px) ; tout champ optionnel va dans le menu « Options » (superposé), jamais en ligne |
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
| Solde estimé + sparkline hero card | `hooks.js` (`useBalanceBreakdown`) + `AccueilView` (le point du mois en cours = `balance` directement) ; toucher le montant → `BalanceBreakdownSheet` | — |
| Sous-catégories | `hooks.js` (`catRootId`, `catFamilyIds`) + `store.js` (`SAVE_CATEGORY` : un seul niveau) + `modals.jsx` (`CategoryField` : ▸ et « Toute la catégorie », `CatModal` : « Rattacher à ») + `OptionsView` (arbre) + `RapportView` (agrégation top 5, seuils, détail) | — |
| Suppression protégée d'une catégorie | `hooks.js` (`categoryUsage`) + `modals.jsx` (`DeleteCategoryModal`) + `store.js` (`DELETE_CATEGORY` {id, moveTo} : déplace transactions, fixes, récurrentes, programmées, templates, hors compte, prévisionnels, seuil, budget courses, liaisons, sous-catégories) | — |
| Aperçu avant import | `App.jsx` (`handleImportFile` → `importPreview`, `handleExport` renvoie true/false) + `modals.jsx` (`ImportPreviewModal`, `summarizeData`) | — |
| Clôture du mois | `hooks.js` (`computeMonthRecap`) + `views/MonthRecapSheet.jsx` + `App.jsx` (affichage auto le 1er, `lastMonthRecapShown` / `MARK_MONTH_RECAP`) + `RapportView` (« Bilans mensuels ») | — |
| Projets avec échéance | `store.js` (`projects`, `SAVE_PROJECT` crée cagnotte/tag au besoin, `DELETE_PROJECT`) + `hooks.js` (`computeProjectStatus`) + `modals.jsx` (`ProjectModal`) + `CagnottesView` (`ProjectCard`) | — |
| Historique « Par type » | `HistoriqueView` (`viewMode` = "type" par défaut, `openTypes`, `closedWeeks`, `renderOffRow`, `renderFixesCard`, `renderIncomesCard`) | — |
| Jour de prélèvement / solde jour par jour | `fixedExpenses[].day`, `fixedIncomes[].day` (1–31) ; `hooks.js` (`dayInMonthISO`, `nextPayday` = revenu fixe daté le plus élevé, `computeDailyForecast` : part du solde estimé, ré-étale les fixes datés/récurrentes/programmées du mois, ajoute le mois suivant jusqu'à la paie, courses réparties) ; `modals.jsx` (`DayField`) ; `ForecastPanels.jsx` (`ForecastPanel`) dans le panneau À venir (onglet 2, la Liste reste l'onglet par défaut) | — |
| Reste à vivre | `hooks.js` (`computeRestToLive` : (estimé − courses − prélèvements du mois suivant avant la paie − marge) ÷ jours) ; `restSettings` {enabled, margin} ; pastille Accueil + `RestToLiveSheet` ; Options → Reste à vivre. Indicatif, jamais dans le solde | — |
| Remboursements attendus | `reimbursements[]` {amount, from, note, expectedDate, txId, status, receivedTxId} ; `store.js` (`SAVE_TRANSACTION` accepte `reimbursement` / `receiveReimbursementId`, `SAVE/DELETE/RECEIVE_REIMBURSEMENT` — Reçu crée le revenu) ; `TransModal` (option « Sera remboursé » + suggestion sur un revenu) ; `ReimbursementModal` ; `ReimbursementsSheet` ; rappel ids 500+ | — |
| Rappel du soir | `notifSettings.evening/eveningHour/eveningDays` ; `App.jsx` (`eveningReminders`, ids 900–906, reprogrammé à chaque saisie ; actions « EVENING » Saisir / Rien aujourd'hui) | — |
| Budget courses | `hooks.js` (`computeGroceryBudget`, `useGroceryBudget`, `groceryCategoryIds`) + `store.js` (`groceryBudget`, `SAVE_GROCERY_BUDGET`) + `AccueilView` (pastille) + `BalanceBreakdownSheet` (`GrocerySection`, sous le total) + `OptionsView` (feuille « grocery ») | — |
| Formulaires de saisie (tous) | `modals.jsx` — depuis 1.45.0 tous bâtis avec les mêmes briques que `TransModal` ; `FixedModal`/`FixedIncomeModal` sont deux portes d'entrée vers un unique `FixedFormModal` (bascule frais ↔ revenu à la création, via `onSaveIncome`/`onSaveExpense` passés par App.jsx). Montants lus avec `amountOf()` (évalue « 12+3 ») | — |
| Projection 3 mois | `hooks.js` (`computeProjection`, `variableNetForMonth`, `pendingEventsThisMonth`, `useProjectionAccuracy`) + `views.jsx` (`AccueilView`, carte carrousel) | — |
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
- **Tout nouveau callback passé à une vue** : vérifier qu'il est branché sur la BONNE vue dans App.jsx (bug 1.46.0 : `onSaveGroceryBudget` posé sur RapportView au lieu d'OptionsView). Un script compare les props `on*` déclarées par chaque vue et celles passées par App.
- **Tout nouveau formulaire** se construit avec les briques de `modals.jsx` (`TypeButtons`, `TextField`, `NumPad`, `CategoryField`, `DateField`/`MonthField`, `OptionsField`, `FormActions`) et doit tenir sans défilement sur un Pixel 8. Un montant se lit avec `amountOf()`, jamais `parseAmt()` (qui ignore « +3 »).
- **Tout bouton qui réagit au relâcher du doigt (`onTouchEnd`) doit commencer par `if (touchMoved()) return;`** (utils.js) — sinon un défilement démarré sur ce bouton le déclenche (bug corrigé en v1.44.2).
- **Dates toujours en heure locale**, jamais `toISOString()` (bug UTC déjà rencontré et corrigé à de nombreux endroits).
- **Préserver les champs non gérés par un formulaire lors d'une édition** — un `{ ...old, ...payload }` naïf écrase silencieusement un champ que le formulaire ne connaît pas (ex : `templateId` effacé lors de l'édition d'une opération récurrente → double comptage ; corrigé en v1.44.1 : le reducer fait `templateId: tx.templateId ?? t.templateId`). Vérifier ce risque à chaque nouveau champ optionnel ajouté à `transactions`/`fixedExpenses`/`fixedIncomes`.

---

## 8. Historique des grandes évolutions (contexte, pas exhaustif — voir `README.md` pour le changelog complet)

- **Templates rapides** (appui long FAB) — v1.39.18, emoji libre v1.39.27
- **Refonte du solde estimé** autour de `useReconciliation` — v1.39.24, ajustée en 1.39.25 (revenus fixes retirés du calcul "pointé" automatique)
- **Pause des frais/revenus fixes** avec reprise automatique — v1.39.30, non-rétroactivité corrigée dans la foulée
- **Opération d'équilibre bidirectionnelle** (`adjSign`) — v1.39.31
- **Montants à part génériques** (remplace l'ancien champ unique `mealVoucherAmount`) — v1.39.32
- **Tags** : filtre Historique + entrée Options — v1.39.34 (la base du système de tags existait déjà avant)
- **Découpage de `views.jsx`**, notifications réparées (plugin manquant), `normalizeData` — v1.40.0
- **Formulaires unifiés + détail du solde estimé** — v1.45.0
- **v1.63.0** : `src/releve.js` (pur, testable sous Node) — `readPdfRows(arrayBuffer)` (import dynamique de `pdfjs-dist/legacy/build/pdf.min.mjs` + worker `?url`, `isEvalSupported:false`, pas de polices, `task.destroy()`), `itemsToRows`, `parseStatement(pages)` (colonnes Débit/Crédit par position x de l'en-tête, sections + sous-totaux, lignes de détail rattachées, « CARTE jj/mm » = date d'achat, contrôles `checks[]`, solde du livret), `appMovements(data, start, end)`, `compareStatement(stmt, data)` → `{ matched, missing, extra, near, aside, totals }`. `views/ReleveCompare.jsx` (portail plein écran, état local uniquement, effacé à la fermeture), état `releveOpen` dans App. ⚠️ Confidentialité : ne jamais stocker ni journaliser le relevé ou son résultat ; ne lire que le tableau des opérations. Testé sur un relevé réel CMB (94 opérations, 7 contrôles OK).
- **v1.64.0** : `utils.js` — `resolveFixedDay(day, ym)` (day 1–31, ou `DAY_LAST_BD=-1` / `DAY_PREV_LAST_BD=-2` = dernier / avant-dernier jour ouvré, `frenchHolidays`, `isBusinessDay`), `fixedDayLabel`, `ymShift`, et pour un revenu `advance` (compté dans le budget du mois suivant) : `fixedCashYM(f, ym)` (mois de compte d'une occurrence), `fixedOccurrenceYM(f, cashYM)` (occurrence versée ce mois-là), `fixedCashDateISO`. `autoIncomeHistory` / `autoIncomeAmount` (`amountMode:"auto"` = moyenne des 3 derniers réels : mois pointés + opérations de la catégorie). **Règle** : budget/rapports → mois de l'occurrence (`effectiveIncomesForMonth`, inchangé) ; solde, rapprochement, paie, solde jour par jour, projection, relevé → mois de compte (`cashIncomesForMonth`, `fixedOccurrenceYM`). `dayInMonthISO` passe par `resolveFixedDay`. Store : `POINT_INCOME_AMOUNT {id, ym, amount}` (override figé + pointé + recalcul auto), `TOGGLE_POINT_INCOME` fige le montant en mode auto, `SET_FIXED_DAY` accepte -1/-2. UI : `DayField` (2 règles + prochaines dates), `FixedFormModal` (Montant prévu Fixe/Automatique, interrupteur « budget du mois suivant », prop `transactions`), `PointIncomeModal`, Fixes (occurrence `x.occ`, règles sous la grille, badge « → budget nov. »), Accueil À venir (`_ym`). `computeRestToLive` retire `payInBase` (revenus du mois versés le jour de la paie ou après). Tests : `/tmp/claude-0/t/jo` (30), e2e20 (17).
- **v1.65.0** : `computeReconciliation(…, curYM, today)` — un revenu fixe daté non pointé dont la date de versement (`fixedCashDateISO`) est après `today` n'entre ni dans « pointé » ni dans « en attente » : il va dans `futureIncomes` (exposé par `computeBalanceBreakdown().futureIncomes`). Sans `today` : aujourd'hui pour le mois en cours, fin de mois sinon. `pendingEventsThisMonth` ne retire plus ces revenus du départ (ils n'y sont pas). `computeRestToLive` : `payInBase` supprimé, `incBeforePay` (revenus datés entre aujourd'hui et la paie) ajouté au disponible. `resolveFixedDay` : règles -1/-2 calculées sur lundi–vendredi hors fériés, puis un lundi est avancé au jour ouvré précédent (`isBankCreditDay`). Frais fixes inchangés (comptés dès le début du mois).
- **v1.66.0** : `hooks.js` — `computePayRecap(data, ym)` (`computeMonthTotals` du mois de budget : `incomes`, `fixed`, `variable`, `saved` = épargne − retraits, `rest`, `toSave` = reste arrondi à la dizaine inférieure, 0 si négatif) et `mainPayIncome(data)` (revenu daté le plus élevé, utilisé aussi par `nextPayday`). `views/PayRecapSheet.jsx` (feuille en portail, cagnotte à choisir, « Verser »). App : état `payRecap {id, ym, amount}` ouvert après `POINT_INCOME_AMOUNT` ou `TOGGLE_POINT_INCOME` (pointage) de la paie ; mois du bilan = `fixedCashYM(inc, ym)` (versé fin octobre → bilan d'octobre).
- **v1.66.1** : `isActiveForMonth` déplacée de `hooks.js` vers `utils.js` (pure) ; `hooks.js` la ré-exporte (`export { isActiveForMonth }`) → les imports existants depuis hooks.js restent valides ; `releve.js` l'importe depuis utils.js (sa copie locale `isActive` est supprimée). Test de la comparaison de relevé : relevé PDF **fictif** généré par script (aucune donnée réelle), 14 vérifications.
- **v1.67.0** : revenu fixe `avgExcluded { [ym]: true }` (ignoré par `autoIncomeHistory`), posé par `POINT_INCOME_AMOUNT {…, exclude}` ; `PointIncomeModal` (prop `transactions`, interrupteur + aperçu du prévu). `data.payRecaps { [ym]: { rest, saved, date } }` (DEFAULT_DATA) via `SAVE_PAY_RECAP {ym, patch}` : `rest`/`date` posés une seule fois à l'ouverture de `PayRecapSheet` (`onSnapshot`), `saved` cumulé à chaque « Verser ». `payRecapCheck(data, ym)` → `computeMonthRecap().payCheck` (reste final = `computePayRecap().rest + saved`, `diff`, `over`) affiché dans `MonthRecapSheet`. `TransModal` : props `fixedIncomes`, `onPointIncome` ; `fixedDup` (revenu, création, catégorie d'un revenu fixe actif pour l'occurrence versée ce mois). FixesView : `advanceItems` (KPI « Revenus oct. » + note sous l'avancement). Tests : e2e20 (30), e2e22 (7), jo (40).
- **v1.62.1** : `PointRow` (HistoriqueView) — panneau d'actions rendu seulement si `swipeOffset < 0` ; fond pointé = dégradé vert posé sur `var(--surface)` (opaque). Règle : une ligne glissable ne doit jamais avoir un fond transparent.
- **v1.62.0** : `computeProjection(data, breakdown, { today, monthsAhead, alertThreshold })` remplace `useBalanceProjection` + `useVariableCashflowMedian` (supprimés). Simulation jour par jour : départ = `pendingEventsThisMonth` (opérations du mois déjà comptées dans le solde estimé, ré-étalées à leur date — **helper partagé avec `computeDailyForecast`**), reste du courant du mois = `min(0, médiane − déjà fait)`, puis événements datés + médiane/jours du mois. Dépenses avant rentrées le même jour (point bas = juste avant la paie, `isPay` = revenu fixe principal de `nextPayday`). Fourchette = quartiles 25/75 % (≥ 3 mois). `projectionSnapshots[ym].horizon = 1` : seul le mois suivant est figé (une ancienne valeur sans horizon est remplacée une fois). `balanceAsOfEndOfMonth` = définition du rapprochement (`isPointable` + `isIncomeDirection`). ⚠️ Toute nouvelle source de mouvement du solde doit être ajoutée à la fois au solde estimé ET à `computeProjection`.
- **v1.61.0** : carte Projection (hors simulation) = IIFE dans `AccueilView` : point bas = min de `projection.months`, courbe SVG (échelle serrée sur les valeurs, pas depuis 0), seuil si `alertEnabled && alertThreshold > 0`. États `projInfo` (ⓘ) et `accOpen` (fiabilité, moyenne des |écarts| des 3 derniers mois de `useProjectionAccuracy`). Réutilise `heroPill`/`heroRow`/`heroRowTitle`. CSS mort supprimé : `.hero-dot(s)`, `.dash-*`.
- **v1.60.0** : `AccueilView` — `CARD_COL`, `tintCard(col)`, `iconBox(col, emoji, size)`, `secTitle(txt, id)` ; `hasTodo` (surplus, chèques, À venir). Les classes CSS `.dash-cagnotte2` / `.dash-fixe2` ne sont plus utilisées (suppression à confirmer, comme `.hero-dot`).
- **v1.59.1** : `heroRow` en `flexWrap: wrap` (plus d'`overflowX`), `heroPill` `.66rem` / `5px 10px` avec `maxWidth: 100%` + ellipse, carte `padding: 18px 16px 16px`.
- **v1.59.0** : `AccueilView` — calcul écart/sparkline sorti dans `evo = useMemo(...)` (logique inchangée, recopiée de l'ancienne IIFE ; le dernier point reste = `balance`). Fenêtre `evoOpen` (Modal en portail). Carrousel : `heroCardRefs`, `goHero(i)`, `heroSwitch(cur)` ; hauteur du carrousel = hauteur de la carte active (`heroH`, ResizeObserver) avec `align-items: flex-start`. Points du carrousel retirés (CSS `.hero-dot` conservé, non utilisé). Ordre sous la carte : surplus → chèques → À venir → Cagnottes/Fixes → alerte budgets par tag → Bilan. La colonne verticale des arrondis devient 1–2 pastilles (« à virer » garde l'action `onMarkRoundingTransferred`).
- **v1.58.0** : action `SET_FIXED_DAY { kind: "expense"|"income", id, day }` (ne touche que `day`, borné 1–31) ; prop `onSetFixedDay` de `FixesView`. `insights = useMemo(() => detectInsights(data), [data])` dans App.jsx, placé AVANT le `if (locked) return` (règle des hooks).
- **v1.57.1** : `cagnottes[].adjustments` `[{ id, date, amount, before, after }]` — ajouté par `SAVE_CAGNOTTE` (édition) quand `current` change. **Jamais une transaction** : n'entre dans aucun solde, rapprochement ni versé/retiré ; affiché seulement dans `CagHistModal`. Supprimés : `PALETTE`, `polar` (utils.js), `useYearTotals` (hooks.js).
- **v1.57.0** : `computeCagnottesSummary(data, ym)` (hooks.js) — **seule source** du récap Cagnottes : `total`, `byType` (ordre de `cagTypes`, « Sans type » en dernier, y compris type supprimé), `month`/`prev`/`yearFlows` via `computeMonthTotals`/`computePeriodTotals` (versé = `epargne`, retiré = `decagnottage` + `dissolution_cagnotte`, virements ignorés), `goalPct` = versé de l'année / `savingsGoals[année]` (identique au Rapport), objectifs plafonnés à la cible de chaque cagnotte, versements auto actifs vers une cagnotte existante, arrondis du mois (`isRounding`). Ouverture du détail mémorisée en `localStorage` (`cag_recap_open_v1`). Anciennes pastilles du mois supprimées.
- **v1.56.0** : `data.cagTypes` `[{ id, icon, label, color }]` (défaut `DEFAULT_CAG_TYPES` dans utils.js, couleurs en hex ; `normalizeData` ne remet les défauts que si le champ est absent — une liste vide est respectée). Actions `SAVE_CAG_TYPE` (id `ct…` à la création) et `DELETE_CAG_TYPE` (cagnottes concernées → `cagType: null`). Helpers utils `cagTypeOf(cagTypes, id)` / `cagIconOf(cagTypes, c)` — **seule source** pour l'icône/couleur d'une cagnotte (les anciennes constantes `CAG_TYPES`, `CAG_TYPES_MAP`, `CAG_ICONS` sont supprimées). `CagTypesModal` (modals.jsx, rendu par App, état `cagTypesOpen`), ouvert depuis Options (`onOpenCagTypes`) ou la fiche (`CagModal.onManageTypes`). `TypeButtons` passe à la ligne au-delà de 4 options. Le type n'entre dans aucun calcul.
- **v1.55.1** : `components/charts.jsx` supprimé (plus aucun import ; bundle identique au octet près).
- **v1.55.0** : `FixesView` réécrit. `fixedStatusForMonth(f, ym, todayDay)` (exporté par FixesView.jsx) → late/next/ok/pause/later, basé sur `isActiveForMonth` + `pointedMonths` + `day` (borné au dernier jour du mois ; sans jour → « à venir »). Montant affiché = `monthlyOverrides[ym].amount ?? amount`. Nouvelles props `onTogglePointFix` / `onTogglePointIncome` (mêmes handlers que l'Historique). Pliage des groupes en `localStorage` (`fixes_fold_v1`, préférence d'affichage, pas dans les données). Supprimés car remplacés : bloc hero, 2 gros boutons, pastille « en pause », info-bulle de pause (→ ligne dans la barre d'actions), boutons « Ajouter » en pointillés (→ ＋ de la barre collée).
- **v1.54.0** : `OptionsView` — `GROUPS` réordonné par usage (budget, épargne auto, saisie, notifications, sécurité, données) ; `desc` court affiché en sous-titre (plus de ⓘ ni `infoOpenId`) ; Importer/Réinitialiser sont des items de « Mes données » (`action`, `danger`) ; bandeau `backup-alert` si `!last || daysSinceBackup > 7` ; stats globales en pied de page.
- **v1.53.1** : `computeMonthTotals` — revenus = type `income` uniquement, `dissolution_cagnotte` ajoutée à `decag` (les soldes/rapprochement ne changent pas) ; `monthFlows` (bilan mensuel) dérive de `computeMonthTotals`. ⚠️ Ne jamais remettre `animation-fill-mode: both` sur `.container` (le transform résiduel casse tous les `position: fixed` des écrans). `Modal` (components/index.jsx) passe par `createPortal(document.body)`. Code mort supprimé ; `components/charts.jsx` (ChartSVG, PatrimoineSVG) n'est plus importé nulle part (fichier supprimé en v1.55.1).
- **v1.53.0** : CagnottesView en grille compacte avec barre collée (même `stickyTop` que Historique/Rapport) ; projets en bandeau, `ProjectCard` affichée sous le bandeau au toucher ; `CagModal` reçoit `onDelete` (suppression déplacée depuis la carte). La prop `onDeleteCag` de CagnottesView n'est plus utilisée.
- **v1.52.0** : Rapport en 3 onglets (`tab` mois/annee/cats, `ym` propre au Rapport, `catPer`). `computeCategoryBreakdown(data, fromYM, toYM)` (hooks) = ancien Top 5 généralisé (sous-catégories → principale, frais fixes en ligne à part, revenus liés déduits) ; `savingsGoals` + `SAVE_SAVINGS_GOAL` ; `CategoryDetailModal` accepte `initialCatId`, `TagsModal` `initialTagId` ; sous-titre de l'en-tête remonté par `onSubtitle`. (Code mort supprimé en v1.53.1.)
- **v1.51.0** : Historique — barre collée (`position: sticky; top: stickyTop` = hauteur mesurée de `.bp-header`, ResizeObserver), `activeCount`/`activePills` remontés au niveau du composant, recherche par montant. ⚠️ Ne jamais remettre `overflow-x: hidden` sur html/body/.container : ça casse tout `position: sticky` (utiliser `clip`). (`HistDonut`, `BudgetBar`, `savMonth` supprimés en v1.53.1.)
- **v1.50.1** : Historique trié du plus récent au plus ancien (semaines `[3,2,1,0]`, départage à date égale par ordre de saisie = index dans `transactions` / `offAccountEntries`).
- **v1.50.0** : `OVERRIDE_INCOME_MONTH` (correction d'un revenu fixe pour un mois, `effectiveIncomesForMonth` la respecte) ; `categoryBudgetFor` / `categorySpentForMonth` (budget catégorie, aussi utilisés par l'alerte du Rapport) ; `simulateProjection` / `scenarioEffectForMonth` (simulation, jamais enregistrée) ; `detectInsights` (hausses de récurrentes, dépenses régulières non déclarées — `insightDismissed` + `DISMISS_INSIGHT`) ; `dailyVariableSpend` / `computeSurplus` (surplus = `computeRestToLive.available` − dépenses courantes estimées ; « ✕ » mémorisé sous `insightDismissed.surplus` = fin de cycle). Les frais fixes gardaient déjà `prevAmount`/`prevAmountYM` (affiché dans Fixes) : rien à détecter côté frais fixes.
- **Détails (DetailModal, MonthDetailModal) alignés sur `computePeriodTotals` / `computeMonthTotals`** ; helpers `livedMonths` (mois vécus d'une période) et `fixedLinesForPeriod` (fixes ligne par ligne, somme = fixExp/fixInc) dans hooks.js — v1.49.1. Toute nouvelle vue de détail doit passer par ces helpers, jamais par `useTotalFixes` + filtre de dates à la main.
- **Titres de page emoji + sous-titre** (`PAGE_TITLES` dérivé de `TABS`, `pageSubtitle` dans App.jsx ; mois de l'Historique remonté par `onMonthChange`), **bouton ☀️ retiré** (thème forcé sombre), **sous-ligne Historique sans doublon** (`txSubLabel` / `dayLabel` dans HistoriqueView), **bloc Bilan** Mois|Année sur l'Accueil (`bilanPer`, non mémorisé), **police intégrée** (`src/fonts/`) — v1.49.0
- **Jour de prélèvement, calendrier & solde jour par jour, reste à vivre, remboursements attendus, rappel du soir** — v1.48.0
- **Historique par type, sous-catégories, suppression protégée, aperçu d'import, clôture du mois, projets** — v1.47.0
- **Budget courses** (`groceryBudget` {enabled, categoryIds (null = catégories nommées « Courses »), months}, `computeGroceryBudget`) — v1.46.0 ; moyenne = (N mois complets + mois en cours) ÷ (N + jour/nbJours) depuis v1.46.1 (mois en cours au prorata, validé par Julien). **Purement informatif : ne jamais l'ajouter au solde estimé** (décision de Julien) ; affiché en pastille hero card + section sous le total du panneau de calcul + réglage Options.
- **Pauses terminées archivées** (`pauseHistory` [{from, until}], rempli par `withPauseHistory` dans le reducer à chaque réactivation ; éditable dans Options du formulaire « Pauses passées ») — v1.45.1. Ne jamais remettre `pausedFrom` à null sans archiver la période.
- **Info-bulles ⓘ dans Options** — v1.39.35, repositionnées dans le flux normal (au lieu d'un survol) en v1.39.36 pour éviter d'être coupées par les coins arrondis des cartes

---

- **Notifications** : plugin `@capacitor/local-notifications`, canal `budget`, replanifiées à chaque ouverture (après déverrouillage, +4 s, sans popup de permission). Ne jamais demander une permission au démarrage (écran noir 1.39.1).
- **Chèques** : pointer = encaisser. `TOGGLE_POINT_TX` sur un chèque déplace sa date au jour même (et la remet à `issuedDate` au dépointage) ; `CASH_CHEQUE` encaisse à une date choisie. Couleur `--chq` (bleu ardoise).
- **Hors compte** : couleur dédiée `--tr` (or/cuivre) + classes `.tr-metal-box` / `.tr-metal-text` (dégradé) dans `styles.css`. Le jaune `--warning` reste réservé à « En attente » et aux alertes.
- **Données entrantes** : tout passe par `normalizeData()` (chargement ET import de sauvegarde). Toute future migration de champ s'ajoute là.

## 9. Ce que ce document ne couvre pas

- Le contenu exact de `utils.js`, `components/index.jsx` — à demander si besoin.
- La configuration de build (`vite.config.js`, `capacitor.config.js`, workflow GitHub Actions) — voir `README.md`, section *Build APK*.
- Le détail changelog version par version — voir `README.md`, section *Changelog*.

// v1.40.0 — views.jsx n'est plus qu'un point d'entrée : chaque vue vit dans
// src/views/<Vue>.jsx, les composants partagés dans src/views/shared.jsx.
// App.jsx continue d'importer depuis "./views.jsx" sans changement.
export { LockScreen } from "./views/LockScreen.jsx";
export { AccueilView } from "./views/AccueilView.jsx";
export { CagnottesView } from "./views/CagnottesView.jsx";
export { HistoriqueView } from "./views/HistoriqueView.jsx";
export { FixesView } from "./views/FixesView.jsx";
export { RapportView } from "./views/RapportView.jsx";
export { OptionsView } from "./views/OptionsView.jsx";

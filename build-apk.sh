#!/bin/bash
# ─────────────────────────────────────────────────────────────────
#  Budget Pro 2026 — Script de build APK automatique
#  Usage: chmod +x build-apk.sh && ./build-apk.sh
# ─────────────────────────────────────────────────────────────────

set -e  # Arrête le script si une commande échoue

BOLD="\033[1m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
CYAN="\033[36m"
RESET="\033[0m"

log()  { echo -e "${GREEN}✓${RESET} $1"; }
info() { echo -e "${CYAN}→${RESET} $1"; }
warn() { echo -e "${YELLOW}⚠${RESET} $1"; }
err()  { echo -e "${RED}✗${RESET} $1"; exit 1; }

echo -e "\n${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}          Budget Pro 2026 — Build APK Android          ${RESET}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n"

# ── 1. Vérification des prérequis ─────────────────────────────────
info "Vérification des prérequis..."

command -v node  >/dev/null 2>&1 || err "Node.js non trouvé. Installe-le depuis https://nodejs.org"
command -v npm   >/dev/null 2>&1 || err "npm non trouvé."
command -v java  >/dev/null 2>&1 || err "Java non trouvé. Installe JDK 17+ depuis https://adoptium.net"
command -v python3 >/dev/null 2>&1 && HAS_PYTHON=true || HAS_PYTHON=false

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  err "Node.js 18+ requis (actuel: $(node --version))"
fi

# Vérifie ANDROID_HOME
if [ -z "$ANDROID_HOME" ] && [ -z "$ANDROID_SDK_ROOT" ]; then
  warn "ANDROID_HOME non défini."
  echo ""
  echo "  Solutions:"
  echo "  1. Installe Android Studio depuis https://developer.android.com/studio"
  echo "  2. Puis: export ANDROID_HOME=\$HOME/Android/Sdk"
  echo "  3. Puis: export PATH=\$PATH:\$ANDROID_HOME/platform-tools:\$ANDROID_HOME/tools"
  echo ""
  read -p "  Continuer quand même ? (o/N) " -n 1 -r
  echo
  [[ $REPLY =~ ^[Oo]$ ]] || exit 1
fi

log "Prérequis OK (Node $(node --version), Java $(java --version 2>&1 | head -1 | cut -d' ' -f2))"

# ── 2. Dépendances npm ────────────────────────────────────────────
info "Installation des dépendances npm..."
npm install --silent
log "Dépendances installées"

# ── 3. Génération des icônes ──────────────────────────────────────
if [ "$HAS_PYTHON" = true ]; then
  info "Génération des icônes PNG..."
  python3 generate_icons.py || warn "Génération icônes échouée — icônes par défaut seront utilisés"
  log "Icônes générés"
else
  warn "Python3 non trouvé — icônes par défaut seront utilisés (app fonctionnelle)"
fi

# ── 4. Build React ────────────────────────────────────────────────
info "Build Vite (production)..."
npm run build
log "Build React terminé → dist/"

# ── 5. Init Capacitor (si pas déjà fait) ─────────────────────────
if [ ! -f "capacitor.config.js" ] || [ ! -d "android" ]; then
  info "Initialisation Capacitor..."
  npx cap init "Budget Pro 2026" "com.budgetpro.app" --web-dir dist 2>/dev/null || true
fi

# ── 6. Ajout plateforme Android (si pas déjà faite) ──────────────
if [ ! -d "android" ]; then
  info "Ajout de la plateforme Android..."
  npx cap add android
  log "Plateforme Android ajoutée"
else
  log "Plateforme Android déjà présente"
fi

# ── 7. Sync Capacitor ─────────────────────────────────────────────
info "Synchronisation Capacitor → Android..."
npx cap sync android
log "Synchronisation terminée"

# ── 8. Patch Android pour plein écran ─────────────────────────────
STYLES_XML="android/app/src/main/res/values/styles.xml"
if [ -f "$STYLES_XML" ]; then
  # Assure le fond sombre au démarrage
  if ! grep -q "windowBackground" "$STYLES_XML"; then
    sed -i 's|<style name="AppTheme.NoActionBar">|<style name="AppTheme.NoActionBar">\n        <item name="android:windowBackground">@color/ic_launcher_background</item>|g' "$STYLES_XML" 2>/dev/null || true
  fi
fi

# Couleur de fond dark dans colors.xml
COLORS_XML="android/app/src/main/res/values/colors.xml"
if [ -f "$COLORS_XML" ]; then
  sed -i 's|#FFFFFF|#080C12|g' "$COLORS_XML" 2>/dev/null || true
fi

# ── 9. Build APK ──────────────────────────────────────────────────
echo ""
echo -e "${BOLD}Type de build :${RESET}"
echo "  1) Debug APK  (rapide, installable directement)"
echo "  2) Release APK (optimisé, nécessite une signature)"
echo "  3) Ouvrir Android Studio (recommandé pour la première fois)"
echo ""
read -p "Choix [1/2/3] (défaut: 1): " -n 1 -r BUILD_TYPE
echo
BUILD_TYPE=${BUILD_TYPE:-1}

case $BUILD_TYPE in
  1)
    info "Build APK Debug..."
    cd android
    ./gradlew assembleDebug
    cd ..
    APK_PATH=$(find android/app/build/outputs/apk/debug -name "*.apk" | head -1)
    if [ -f "$APK_PATH" ]; then
      mkdir -p output
      cp "$APK_PATH" "output/BudgetPro2026-debug.apk"
      echo ""
      echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
      echo -e "${BOLD}${GREEN}  ✓  APK généré avec succès !${RESET}"
      echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
      echo ""
      echo -e "  📦 Fichier : ${BOLD}output/BudgetPro2026-debug.apk${RESET}"
      echo -e "  📏 Taille  : $(du -h output/BudgetPro2026-debug.apk | cut -f1)"
      echo ""
      echo -e "  ${BOLD}Installation sur ton téléphone :${RESET}"
      echo "  Option A — USB:"
      echo "    adb install output/BudgetPro2026-debug.apk"
      echo ""
      echo "  Option B — Fichier:"
      echo "    Copie l'APK sur ton téléphone puis ouvre-le"
      echo "    (active 'Sources inconnues' dans Paramètres > Sécurité)"
      echo ""
    else
      err "APK introuvable. Vérifie les erreurs Gradle ci-dessus."
    fi
    ;;

  2)
    info "Build APK Release..."
    echo ""
    echo -e "${YELLOW}Un APK Release nécessite une clé de signature.${RESET}"
    echo "Si tu n'en as pas encore:"
    echo "  keytool -genkey -v -keystore budgetpro.keystore -alias budgetpro -keyalg RSA -keysize 2048 -validity 10000"
    echo ""
    read -p "Chemin vers le keystore: " KEYSTORE_PATH
    read -p "Alias du keystore: " KEYSTORE_ALIAS

    cd android
    ./gradlew assembleRelease \
      -Pandroid.injected.signing.store.file="$(pwd)/../$KEYSTORE_PATH" \
      -Pandroid.injected.signing.store.password="" \
      -Pandroid.injected.signing.key.alias="$KEYSTORE_ALIAS" \
      -Pandroid.injected.signing.key.password=""
    cd ..
    APK_PATH=$(find android/app/build/outputs/apk/release -name "*.apk" | head -1)
    if [ -f "$APK_PATH" ]; then
      mkdir -p output
      cp "$APK_PATH" "output/BudgetPro2026-release.apk"
      log "APK Release → output/BudgetPro2026-release.apk"
    fi
    ;;

  3)
    info "Ouverture d'Android Studio..."
    npx cap open android
    echo ""
    echo "Dans Android Studio:"
    echo "  Build > Build Bundle(s) / APK(s) > Build APK(s)"
    ;;
esac

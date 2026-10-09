#!/bin/bash
# IGTS Veille — lance l'application en local (base MySQL Docker + API NestJS + interface Next.js)
# Double-cliquez sur ce fichier dans le Finder. Fermez la fenêtre (ou Ctrl+C) pour tout arrêter.
export PATH="/opt/homebrew/bin:/usr/local/bin:/Applications/Docker.app/Contents/Resources/bin:$PATH"
REPO="$(cd "$(dirname "$0")/.." && pwd)" || exit 1
LOGS="$REPO/.tunnel"
mkdir -p "$LOGS"

pause() { read -r -p "Appuyez sur Entrée pour fermer." _; }

echo "IGTS Veille — démarrage local"
echo

# 1. Database (Docker)
if command -v docker >/dev/null 2>&1; then
  if ! docker info >/dev/null 2>&1; then
    echo "Démarrage de Docker Desktop…"
    open -a Docker
    for _ in $(seq 1 60); do docker info >/dev/null 2>&1 && break; sleep 2; done
  fi
  echo "Base de données…"
  (cd "$REPO" && docker compose up -d) || { echo "La base n'a pas pu démarrer."; pause; exit 1; }
else
  echo "Docker est introuvable : la base MySQL doit déjà tourner sur le port 3306."
fi

# Libraries added since the last install (e.g. pdf-lib for the JORT collection)
if ! (cd "$REPO/backend" && node -e "require.resolve('pdf-lib')" >/dev/null 2>&1); then
  echo "Installation des nouvelles dépendances de l'API…"
  (cd "$REPO/backend" && npm install --no-audit --no-fund) || echo "Avertissement : npm install a échoué dans backend/."
fi

# 2. API (NestJS) in the background, logs in .tunnel/backend.log
if curl -s -o /dev/null http://localhost:3001; then
  echo "L'API tourne déjà."
else
  echo "API (journal : .tunnel/backend.log)…"
  (cd "$REPO/backend" && npm run start:dev >"$LOGS/backend.log" 2>&1) &
  BACK=$!
fi

cleanup() {
  echo
  echo "Arrêt de l'application…"
  [ -n "$BACK" ] && pkill -P "$BACK" 2>/dev/null; [ -n "$BACK" ] && kill "$BACK" 2>/dev/null
  [ -n "$FRONT" ] && pkill -P "$FRONT" 2>/dev/null; [ -n "$FRONT" ] && kill "$FRONT" 2>/dev/null
  exit 0
}
trap cleanup INT TERM HUP

# 3. Interface (Next.js)
if curl -s -o /dev/null http://localhost:3000; then
  echo "L'interface tourne déjà."
else
  echo "Interface (journal : .tunnel/frontend.log)…"
  (cd "$REPO/frontend" && npm run dev >"$LOGS/frontend.log" 2>&1) &
  FRONT=$!
fi

echo "Attente de l'interface…"
for _ in $(seq 1 90); do curl -s -o /dev/null http://localhost:3000/login && break; sleep 2; done
if curl -s -o /dev/null http://localhost:3000/login; then
  echo
  echo "Prêt : http://localhost:3000"
  open "http://localhost:3000/login"
else
  echo "L'interface ne répond pas. Voir .tunnel/frontend.log et .tunnel/backend.log."
fi
echo
echo "Laissez cette fenêtre ouverte pendant l'utilisation. Ctrl+C ou fermer la fenêtre pour tout arrêter."
# Keep the Mac awake while the app runs
caffeinate -dims -w $$ &
wait

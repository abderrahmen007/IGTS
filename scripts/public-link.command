#!/bin/bash
# IGTS Veille — lien public temporaire vers l'application locale (http://localhost:3000)
# Double-cliquez sur ce fichier dans le Finder. Fermez la fenêtre (ou Ctrl+C) pour couper le lien.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")/.." || exit 1
mkdir -p .tunnel

echo "IGTS Veille — lien public temporaire"
echo "Attention : ce lien donne accès à la copie locale de la base (données clients) derrière l'écran de connexion."
echo "Partagez-le seulement avec le superviseur et fermez cette fenêtre après la démonstration."
echo

if ! curl -s -o /dev/null http://localhost:3000; then
  echo "L'application ne répond pas sur http://localhost:3000. Lancez d'abord 'npm run dev' dans frontend/ et 'npm run start:dev' dans backend/."
  read -r -p "Appuyez sur Entrée pour fermer." _; exit 1
fi

if ! command -v cloudflared >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    echo "Installation de cloudflared (Homebrew)…"
    brew install cloudflared || { read -r -p "Échec de l'installation. Entrée pour fermer." _; exit 1; }
  else
    echo "cloudflared est introuvable et Homebrew n'est pas installé."
    echo "Installez cloudflared : https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
    read -r -p "Appuyez sur Entrée pour fermer." _; exit 1
  fi
fi

echo "Ouverture du lien… l'adresse https://….trycloudflare.com s'affiche ci-dessous dans quelques secondes."
cloudflared tunnel --no-autoupdate --url http://localhost:3000 2>&1 | tee .tunnel/tunnel.log

#!/bin/bash
# IGTS Veille — installe les bibliothèques d'interface (shadcn/ui, Aceternity, React Bits, Lenis)
# et répare les dépendances de test du backend. Double-cliquez sur ce fichier dans le Finder.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
REPO="$(cd "$(dirname "$0")/.." && pwd)" || exit 1

echo "IGTS Veille — installation des bibliothèques d'interface"
echo

cd "$REPO/frontend" || exit 1
# shadcn/ui : primitives Radix, utilitaires de classes, animations Tailwind, palette de commandes, graphiques
# Aceternity UI et React Bits : motion · défilement fluide : lenis
npm install radix-ui class-variance-authority clsx tailwind-merge tw-animate-css cmdk recharts motion lenis \
  || { read -r -p "Échec de l'installation (frontend). Entrée pour fermer." _; exit 1; }

echo
echo "Réparation des dépendances du backend (tests)…"
cd "$REPO/backend" && npm install || echo "Avertissement : npm install a échoué dans backend/ (l'application reste utilisable)."

echo
echo "Terminé. Si la page affiche une erreur « Module not found », arrêtez puis relancez 'npm run dev' dans frontend/."
read -r -p "Appuyez sur Entrée pour fermer." _

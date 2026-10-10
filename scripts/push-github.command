#!/bin/bash
# IGTS Veille — envoie les commits du Mac sur GitHub (dépôt privé abderrahmen007/IGTS).
# Double-cliquez sur ce fichier dans le Finder.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
REPO="$(cd "$(dirname "$0")/.." && pwd)" || exit 1
cd "$REPO" || exit 1
pause() { read -r -p "Appuyez sur Entrée pour fermer." _; }

echo "IGTS Veille — envoi sur GitHub"
echo

# 1. Données clients et secrets : jamais dans git
SENSITIVE='(^|/)\.env$|\.sql$|\.rar$|^veille/|^backend/(data|uploads|outbox)/|^\.tunnel/'
if git ls-files | grep -Eq "$SENSITIVE"; then
  echo "ARRÊT : des fichiers sensibles sont suivis par git :"
  git ls-files | grep -E "$SENSITIVE"
  pause; exit 1
fi

# 2. Le dépôt doit rester privé (un dépôt privé est invisible sans identifiants : réponse 404)
URL="$(git remote get-url origin)"
SLUG="$(echo "$URL" | sed -E 's#^(https://github.com/|git@github.com:)##; s#\.git$##')"
CODE="$(curl -s -o /dev/null -w '%{http_code}' "https://api.github.com/repos/$SLUG")"
if [ "$CODE" = "200" ]; then
  echo "ARRÊT : le dépôt $SLUG est PUBLIC sur GitHub. Rendez-le privé (Settings › General › Danger Zone) avant d'envoyer."
  pause; exit 1
fi

# 3. Rien à perdre : on n'envoie que si GitHub n'a pas de commits absents du Mac
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
git fetch origin || { echo "Impossible de joindre GitHub (connexion ou identifiants)."; pause; exit 1; }
BEHIND="$(git rev-list --count "$BRANCH..origin/$BRANCH" 2>/dev/null || echo 0)"
AHEAD="$(git rev-list --count "origin/$BRANCH..$BRANCH" 2>/dev/null || echo 0)"
if [ "$BEHIND" -gt 0 ]; then
  echo "GitHub contient $BEHIND commit(s) absent(s) de ce Mac : rien n'est envoyé."
  echo "Récupérez-les d'abord (git pull --rebase), puis relancez ce fichier."
  pause; exit 1
fi
if [ "$AHEAD" -eq 0 ]; then
  echo "Rien à envoyer : GitHub est déjà à jour."
  pause; exit 0
fi

echo "$AHEAD commit(s) à envoyer sur $SLUG ($BRANCH) :"
git log --oneline "origin/$BRANCH..$BRANCH" | head -40
echo
if git push origin "$BRANCH"; then
  echo
  echo "Envoyé sur GitHub."
else
  echo
  echo "Échec de l'envoi. Si GitHub demande un mot de passe, utilisez un jeton d'accès personnel (Settings › Developer settings › Tokens)."
fi
pause

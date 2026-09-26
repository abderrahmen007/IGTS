# IGTS Veille — nouvelle plateforme

Refonte de la plateforme de veille réglementaire IGTS (anciennement Symfony 5).

| Dossier     | Rôle                                  | Stack                          |
|-------------|---------------------------------------|--------------------------------|
| `backend/`  | API REST (`/api/...`)                 | NestJS 11, Prisma 5, MySQL     |
| `frontend/` | Interface web (entreprises et admin)  | Next.js 16, React 19, Tailwind 4 |
| `veille/`   | Ancienne application (référence seule, non versionnée) | Symfony 5 |

## Démarrer en local

```bash
# 1. Base de données : copie locale de veille_db.sql
docker compose up -d            # MySQL 8 sur localhost:3306

# 2. API
cd backend
cp .env.example .env            # puis renseigner JWT_SECRET (32+ caractères)
npm install
npx prisma generate
node --env-file=.env create-admin.js      # créer votre compte administrateur
npm run start:dev               # → http://localhost:3001/api

# 3. Interface
cd ../frontend
cp .env.example .env.local
npm install
npm run dev                     # → http://localhost:3000
```

Connexion : onglet **Entreprise** pour les clients (et leurs sous-comptes),
onglet **Administration IGTS** pour le back-office. Les mots de passe de
l'ancienne plateforme (argon2id) fonctionnent tels quels.

## Règles métier reprises de l'ancienne plateforme

- Un **sous-compte** (`company.multicompte = id parent`) voit et évalue les textes de son entreprise parente.
- **Applicabilité** : Applicable / Non applicable / Non analysé (`applicabilite`).
- **Conformité** (si applicable) : Conforme / Non conforme / À titre indicatif / Non analysé (`gestionetat`).
- Chaque évaluation met à jour `texte_societe` et ajoute une ligne dans `historiqueetat`.
- **Plans d'action** : table `plusaction` (+ trace dans `historiqueaction`). Statuts : En cours / Efficace / Non efficace.
  La colonne `courrielResponsable` contient en réalité l'**effectivité en %** (reprise de l'ancien écran).
- **Taux de conformité** affiché = conformes ÷ (conformes + non conformes).

## Espace administrateur (parité avec Symfony)

| Écran | Fonctions |
|---|---|
| Entreprises | créer, modifier, mot de passe, activer/désactiver, supprimer (logique) ; fiche avec secteurs et thèmes suivis, textes de la veille (ajout/retrait), utilisateurs rattachés (multicompte) |
| Textes réglementaires | créer (avec PDF), modifier, supprimer, supprimer définitivement, affecter à des entreprises |
| Secteurs, thèmes, types | créer, renommer, supprimer (refusé s'ils sont utilisés) |
| Administrateurs | créer, modifier, mot de passe, activer/désactiver, supprimer |

Règles reprises de Symfony :
- Un nouveau texte est ajouté automatiquement (statut « Non analysé ») à toutes les entreprises abonnées à son secteur + thème, avec une notification.
- Retirer un secteur ou un thème d'une entreprise supprime les textes, évaluations, actions et notifications correspondants (confirmation obligatoire, avec le nombre d'éléments impactés).
- La désactivation d'une entreprise utilise la colonne `activated` (celle que vérifie la connexion).
- Les PDF envoyés depuis la nouvelle plateforme sont stockés dans `backend/uploads/textes` ; les anciens PDF sont servis depuis veille.inter-gts.com.

## Points d'attention

- Ne jamais lancer `prisma migrate` / `db push` sur la base de production tant que Symfony l'utilise.
- Le scraper nocturne est désactivé (`SCRAPER_ENABLED=false`) : le connecteur iort.gov.tn reste à écrire.
  Il n'enregistre que des brouillons (`enabled = false`) à valider par IGTS.
- Un compte administrateur de l'ancienne base a encore un hash bcrypt : son mot de passe doit être réinitialisé.

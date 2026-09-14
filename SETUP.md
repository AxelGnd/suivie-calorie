# Mise en route — Fondation comptes + synchro

## 1. Créer le projet Supabase

1. Va sur https://supabase.com et crée un compte (gratuit).
2. Clique sur **New project**.
3. Choisis un nom, un mot de passe pour la base de données (garde-le de côté), et une région proche de toi.
4. Attends 1-2 minutes que le projet soit prêt.

## 2. Créer les tables (base de données)

1. Dans le menu de gauche, ouvre **SQL Editor**.
2. Clique sur **New query**.
3. Colle tout le contenu du fichier `supabase/schema.sql` de ce projet.
4. Clique sur **Run**.
5. Vérifie dans **Table Editor** qu'une table `profiles` est bien apparue.

## 3. Récupérer tes clés d'API

1. Menu de gauche > **Project Settings** > **API**.
2. Copie la **Project URL**.
3. Copie la clé **anon public** (pas la `service_role`, celle-là ne doit jamais être utilisée côté navigateur).

## 4. Configurer l'application

Ouvre `js/supabaseClient.js` et remplace :

```js
const SUPABASE_URL = "REMPLACE_PAR_TON_URL_SUPABASE";
const SUPABASE_ANON_KEY = "REMPLACE_PAR_TA_CLE_ANON_SUPABASE";
```

par tes vraies valeurs récupérées à l'étape 3.

## 5. (Recommandé pour l'instant) Désactiver la confirmation par email

Le temps de tester tranquillement, pour ne pas devoir vérifier ta boîte mail à chaque compte de test :

1. **Authentication** > **Providers** > **Email**.
2. Désactive **Confirm email**.
3. Sauvegarde.

Tu pourras la réactiver quand l'appli sera prête pour de vrais utilisateurs.

## 6. Tester en local

Comme l'appli utilise des modules JavaScript (`type="module"`), tu ne peux pas juste double-cliquer sur `index.html` (les navigateurs bloquent les modules chargés via `file://`). Il faut un petit serveur local :

- Avec Python déjà installé : ouvre un terminal dans le dossier du projet et lance `python3 -m http.server 8000`, puis ouvre `http://localhost:8000` dans ton navigateur.
- Avec VS Code : l'extension "Live Server" fait ça en un clic.

## 7. Déployer sur GitHub Pages

Rien ne change par rapport à avant : tu pousses tous les fichiers (`index.html`, `css/`, `js/`) sur ton dépôt GitHub, et GitHub Pages sert le tout tel quel — aucune étape de build nécessaire.

## Ce qui est en place à ce stade

- Inscription / connexion par email + mot de passe
- Un profil par utilisateur, isolé des autres (sécurité au niveau de la base de données)
- Un sélecteur de thème (4 thèmes) qui se synchronise entre appareils
- Un écran d'accueil vide, prêt à accueillir les prochains modules (nutrition, sport, poids, habitudes, recettes)

## Prochaine étape

Une fois que tu as testé la connexion/inscription et le changement de thème avec un vrai projet Supabase, on attaque le premier module (nutrition, en reprenant la logique déjà solide qu'on avait corrigée, mais connectée à la base de données au lieu du localStorage).

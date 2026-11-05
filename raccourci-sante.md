# Créer le raccourci « Synchro pas » (une seule fois, par toi)

Un site ne peut pas créer de raccourci sur ton iPhone. Il faut donc le créer une fois dans l'app Raccourcis,
le partager par lien iCloud, puis coller ce lien dans `js/sport.js` (constante `SHORTCUT_URL`).
Ensuite, chaque utilisateur l'ajoute en un geste depuis le bouton « Lier mon compte Santé ».

Les noms d'actions peuvent varier légèrement selon la version d'iOS.

## Création
1. App **Raccourcis** > **+** > nomme-le exactement **Synchro pas** (même nom que `SHORTCUT_NAME`, sans apostrophe ni accent : un caractère différent suffit à le rendre introuvable).
2. Action **Texte** : laisse-le vide. Touche-le et renomme la variable en « Code ».
3. Action **Trouver des échantillons Santé** : Type = **Pas**, Date de début = **est aujourd’hui**.
4. Action **Calculer les statistiques** : **Somme** des échantillons trouvés.
5. Action **Date actuelle**, puis **Formater la date** : format **Personnalisé**, `yyyy-MM-dd`.
6. Action **Obtenir le contenu de l’URL** :
   - URL : `https://mqodxfqyswnfzpvsxvoj.supabase.co/functions/v1/health-sync`
   - Méthode : **POST**
   - En-têtes : `Authorization` = `Bearer ` suivi de la variable **Code** ; `Content-Type` = `application/json`
   - Corps de la requête : **JSON**, avec `steps` (type **Nombre**) = le résultat des statistiques, et `date` (type **Texte**) = la date formatée.
7. Facultatif : action **Afficher la notification** « Pas envoyés ».

## Question d’import (pour que chacun colle son code)
Réglages du raccourci (icône i) > **Questions d’importation** > ajoute une question sur l’action **Texte** :
« Colle ton code de liaison ».

## Partage
Réglages du raccourci > **Partager** > **Copier le lien iCloud**. Colle ce lien dans `SHORTCUT_URL` de `js/sport.js`.

## Première utilisation par un nouvel utilisateur (autorisations)
Après avoir ajouté le raccourci et collé son code, l'utilisateur doit **le lancer une première fois depuis l'appli**
(bouton « Synchroniser mes pas »). iOS demande alors, selon la version :
- l'accès aux pas dans Santé : répondre « Autoriser » ;
- l'envoi de données vers supabase.co : répondre « Autoriser » ou « Toujours autoriser ».

Sans ces autorisations, le raccourci s'arrête avant l'envoi et l'appli affiche « Pas encore synchronisé ».
Si le total reste à 0 : Réglages > Santé > Accès aux données et appareils > Raccourcis > autoriser « Pas ».

## Synchronisation quotidienne (facultatif, à faire par chaque utilisateur)
Raccourcis > **Automatisation** > **+** > **Heure de la journée** (ex. 22 h) > **Exécuter le raccourci** >
choisir « Synchro pas » > **Exécuter immédiatement**. Apple ne permet pas de créer cette automatisation à sa place.
Sinon, le bouton « Synchroniser mes pas » de l’appli lance le raccourci à la demande.

## À vérifier
- Au premier lancement, iOS demande l'autorisation de lire les pas.
- Avec une Apple Watch, compare le total envoyé avec celui de Santé : si les pas sont comptés deux fois (iPhone et Watch),
  ajoute un filtre sur la source dans l'action « Trouver des échantillons Santé ».

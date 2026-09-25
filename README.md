# DALTEK

**Système numérique de gestion de files d'attente et de tickets**

Daltek est un système complet de gestion de files d'attente avec synchronisation en temps réel. Il permet à un établissement de distribuer des tickets numérotés, d'appeler les numéros depuis une interface de gestion, et d'afficher le numéro actuellement appelé sur tous les appareils connectés (site web, application Android, écran d'affichage) — instantanément et sans rechargement.

---

## Fonctionnalités

- **Prise de ticket** : un visiteur obtient automatiquement le prochain numéro disponible
- **Interface de gestion** (agent/admin) : appeler le prochain, appeler un numéro précis, rappeler, terminer, annuler
- **Synchronisation temps réel** : tous les appareils connectés affichent le même numéro instantanément
- **Écran d'affichage** : mode plein écran pour télévision ou grand écran, numéro en très grand format
- **Historique** : journal complet des actions avec filtres (date, action, agent)
- **Authentification** : comptes avec rôles (admin, agent, utilisateur, écran)
- **Paramètres** : nom de l'établissement, numéro de départ, nombre max de tickets, son, thème
- **Application Android** : générée via Capacitor, installable en APK ou AAB
- **Design responsive** : fonctionne sur PC, tablette et téléphone

---

## 1. Installation

### Prérequis

- Node.js 18 ou supérieur
- npm (inclus avec Node.js)
- Pour générer l'APK Android : Android Studio + JDK 17

### Étapes

```bash
# Cloner ou récupérer le projet, puis dans le dossier du projet :

# Installer les dépendances
npm install
```

---

## 2. Configuration des variables d'environnement

Les variables de connexion à Supabase sont déjà pré-remplies dans le fichier `.env`. Si vous utilisez votre propre projet Supabase, copiez le fichier d'exemple et modifiez-le :

```bash
cp .env.example .env
```

Variables nécessaires :

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | URL de votre projet Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clé anonyme (anon key) de Supabase |

---

## 3. Configuration de la base de données

La base de données Supabase est déjà configurée avec les tables et fonctions suivantes :

- **establishments** : établissements
- **profiles** : profils utilisateurs avec rôles (lié à auth.users)
- **tickets** : tickets de la file d'attente
- **current_calls** : numéro actuellement appelé (un par établissement)
- **settings** : paramètres par établissement
- **ticket_history** : journal des actions

Les politiques de sécurité (RLS) et les fonctions SQL (SECURITY DEFINER) sont déjà appliquées. Aucune configuration supplémentaire n'est nécessaire.

---

## 4. Lancer le site web

```bash
npm run dev
```

Le site est accessible sur `http://localhost:5173`.

Pour construire la version de production :

```bash
npm run build
```

Les fichiers sont générés dans le dossier `dist/`.

---

## 5. Créer un compte administrateur

1. Ouvrez le site dans votre navigateur
2. Cliquez sur **Connexion** puis **Créer un compte**
3. Inscrivez-vous avec votre email et un mot de passe
4. Par défaut, votre compte a le rôle **Utilisateur**
5. Pour accéder à la gestion, vous devez avoir le rôle **Agent** ou **Admin**

### Attribuer le rôle Admin

Pour changer votre rôle en admin, exécutez cette commande dans l'éditeur SQL de Supabase (Dashboard > SQL Editor) :

```sql
UPDATE profiles SET role = 'admin' WHERE email = 'votre@email.com';
```

Une fois admin, vous pourrez changer les rôles des autres utilisateurs depuis la page **Paramètres**.

---

## 6. Application Android

### Préparation

Le projet utilise **Capacitor** pour emballer l'application web en application Android native.

```bash
# Ajouter la plateforme Android (première fois seulement)
npm run build
npx cap add android
```

### Lancer sur un appareil ou émulateur

```bash
# Construire le web et synchroniser avec Android
npm run android:dev

# Cela ouvre Android Studio
# Dans Android Studio, sélectionnez un appareil/émulateur et cliquez "Run"
```

---

## 7. Générer l'APK

### APK de test (debug)

```bash
npm run apk:debug
# Puis :
cd android && ./gradlew assembleDebug
```

L'APK est généré dans :
```
android/app/build/outputs/apk/debug/app-debug.apk
```

### APK release

```bash
npm run apk:release
# Puis :
cd android && ./gradlew assembleRelease
```

L'APK est généré dans :
```
android/app/build/outputs/apk/release/app-release.apk
```

> Pour la release, vous devez signer l'APK. Créez un fichier `keystore` et configurez-le dans `android/app/build.gradle`.

---

## 8. Générer l'AAB (Google Play)

```bash
npm run aab:release
# Puis :
cd android && ./gradlew bundleRelease
```

L'AAB est généré dans :
```
android/app/build/outputs/bundle/release/app-release.aab
```

> L'AAB est le format requis pour publier sur Google Play Store.

---

## 9. Tester la synchronisation temps réel

### Test rapide

1. Ouvrez le site sur un PC (page **Gestion**)
2. Ouvrez le site sur un autre appareil ou un autre onglet (page **Accueil**)
3. Prenez un ticket depuis la page **Prendre un ticket**
4. Cliquez **Appeler le prochain** sur la page de gestion
5. Le numéro doit apparaître instantanément sur l'autre appareil, sans rechargement

### Test multi-appareils

1. Ouvrez **Écran d'affichage** sur un PC connecté à une télévision
2. Ouvrez **Gestion** sur un autre PC ou tablette
3. Ouvrez l'application Android sur un téléphone
4. Prenez des tickets et appelez-les depuis la gestion
5. Vérifiez que tous les écrans affichent le même numéro simultanément

### Test de persistance

1. Prenez des tickets et appelez un numéro
2. Fermez le navigateur ou l'application
3. Rouvrez — l'état actuel (numéro appelé, file d'attente) est récupéré depuis le serveur

---

## 10. Déploiement

### Site web

Le dossier `dist/` peut être déployé sur n'importe quel hébergeur statique :

- **Netlify** : connectez votre dépôt, le build se fait automatiquement
- **Vercel** : `vercel --prod` après `npm run build`
- **Hébergement classique** : copiez le contenu de `dist/` sur votre serveur

### Application Android

1. Générez l'AAB (voir section 8)
2. Créez un compte sur [Google Play Console](https://play.google.com/console)
3. Créez une application et téléversez l'AAB
4. Configurez la fiche de l'application et publiez

---

## Structure du projet

```
daltek/
├── src/
│   ├── components/       # Composants réutilisables (Logo, Navigation, etc.)
│   ├── lib/              # Logique métier (Supabase, auth, service de file)
│   ├── pages/            # Pages de l'application
│   ├── types/            # Types TypeScript
│   ├── App.tsx           # Composant racine avec routage
│   ├── main.tsx          # Point d'entrée
│   └── index.css         # Styles globaux
├── public/               # Fichiers statiques (logo, manifest)
├── supabase/
│   └── migrations/       # Migrations de base de données
├── capacitor.config.ts   # Configuration Android (Capacitor)
├── package.json
└── .env                  # Variables d'environnement
```

---

## Technologies utilisées

- **React 18** + **TypeScript** — interface utilisateur
- **Vite** — bundler et serveur de développement
- **Tailwind CSS** — design et styles
- **Supabase** — base de données, authentification, temps réel
- **Capacitor** — application Android native
- **React Router** — navigation

---

## Licence

Projet Daltek — Tous droits réservés.

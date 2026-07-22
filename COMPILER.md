# Obtenir l'installeur .exe

Deux chemins. Le premier ne demande rien à installer sur votre poste.

---

## Méthode A — GitHub compile à votre place (recommandée)

GitHub met à disposition des machines Windows gratuitement pour les dépôts
publics. Vous poussez le code, elles rendent l'installeur.

### 1. Créer le dépôt

Sur github.com, **New repository**. Nommez-le `nexora`. Laissez
tout par défaut et validez.

### 2. Envoyer le code

Si Git est installé sur votre poste :

```bash
cd nexora
git init
git add .
git commit -m "Version initiale"
git branch -M main
git remote add origin https://github.com/VOTRE-COMPTE/nexora.git
git push -u origin main
```

Sans Git, l'interface web fait l'affaire : sur la page du dépôt vide,
**uploading an existing file**, puis glissez le contenu du dossier. Veillez à
conserver les sous-dossiers, en particulier `.github/workflows/`.

### 3. Récupérer l'installeur

L'onglet **Actions** montre la compilation en cours, trois à cinq minutes.
Une fois terminée, ouvrez le run et téléchargez l'artefact
**Nexora-Installeur**. Il contient
`Nexora-Installeur-1.0.0.exe`.

Pour les versions suivantes, un tag suffit :

```bash
git tag v1.0.1 && git push --tags
```

L'installeur est alors publié dans l'onglet **Releases**, avec un lien
permanent que vous pouvez transmettre à vos utilisateurs.

> **Dépôt privé ?** Les minutes de compilation Windows sont facturées au-delà
> du quota gratuit. Pour un dépôt public, c'est illimité. Aucun secret n'étant
> stocké dans le code — les mots de passe SMTP vivent sur le poste de
> l'utilisateur, pas dans le dépôt — le public ne pose pas de problème.

---

## Méthode B — compiler sur votre poste

### Prérequis

**Node.js 20 ou plus**, depuis nodejs.org. C'est la seule installation
nécessaire : le projet n'utilise aucun module natif, donc ni Python ni Visual
Studio Build Tools.

### Compilation

```bash
cd nexora
npm install          # environ 3 minutes
npm test             # 34 tests, doivent tous passer
npm run package      # environ 5 minutes
```

L'installeur apparaît dans `release/Nexora-Installeur-1.0.0.exe`.

### Voir l'application avant de compiler

```bash
npm run dev
```

L'application se lance en rechargement à chaud : les modifications de
l'interface s'affichent immédiatement.

---

## Ce que produit l'installeur

- Un `.exe` d'environ 90 Mo — le poids d'Electron, qui embarque son moteur de
  rendu.
- Installation **sans droits administrateur**, dans le profil de
  l'utilisateur (`%LOCALAPPDATA%\Programs\Nexora`) : vous n'avez pas besoin
  du service informatique, et les mises à jour automatiques s'appliquent
  sans jamais demander d'élévation de droits.
- Raccourcis bureau et menu Démarrer, dossier d'installation modifiable.
- Installeur en français.
- Désinstallation par le panneau de configuration Windows classique.

L'historique et les paramètres vivent dans
`%APPDATA%\Nexora\`, hors du dossier d'installation : une mise à
jour ne les efface pas.

---

## Signature du code

Non signé, l'installeur déclenche l'écran bleu **« Windows a protégé votre
ordinateur »**. L'utilisateur doit cliquer sur *Informations complémentaires*
puis *Exécuter quand même*.

C'est sans danger — l'avertissement signale simplement un éditeur inconnu de
Microsoft — mais c'est déroutant pour un utilisateur non technique. Deux
options :

- **Ne rien faire** et prévenir les utilisateurs. Suffisant pour trois postes
  internes.
- **Acheter un certificat de signature de code**, entre 200 et 400 € par an.
  Justifié si vous distribuez l'application au-delà de votre entreprise.

Pour la signature, ajoutez dans `electron-builder.yml` :

```yaml
win:
  certificateFile: chemin/vers/certificat.pfx
  certificatePassword: ${env.CSC_KEY_PASSWORD}
```

---

## Publier une mise à jour

Nexora se met à jour toute seule. Pour diffuser une nouvelle version :

1. Modifiez le numéro dans `package.json`, par exemple `"version": "1.1.0"`
2. Envoyez le code, puis posez un tag correspondant :

```bash
git tag v1.1.0
git push --tags
```

GitHub compile l'installeur et publie dans les *Releases* le `.exe`
accompagné du fichier `latest.yml`. **Ce fichier est indispensable** :
c'est lui que l'application interroge pour savoir qu'une version plus
récente existe.

Les postes installés détectent la nouveauté au démarrage suivant,
téléchargent en arrière-plan, puis proposent de redémarrer. Rien ne
s'installe sans accord de l'utilisateur.

Le numéro du tag doit correspondre à celui de `package.json`, sans quoi
la détection ne fonctionnera pas.

## Réinstaller par-dessus

Relancer l'installeur sur un poste où Nexora est déjà présent met à jour
l'installation existante : même dossier, mêmes raccourcis. Les réglages,
le mot de passe SMTP et l'historique vivent dans `%APPDATA%\Nexora\` et
ne sont jamais touchés, ni par une mise à jour ni par une désinstallation.

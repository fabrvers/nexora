# Obtenir l'installeur .exe

Deux chemins. Le premier ne demande rien à installer sur votre poste.

---

## Méthode A — GitHub compile à votre place (recommandée)

GitHub met à disposition des machines Windows gratuitement pour les dépôts
publics. Vous poussez le code, elles rendent l'installeur.

### 1. Créer le dépôt

Sur github.com, **New repository**. Nommez-le `passerelle-pennylane`. Laissez
tout par défaut et validez.

### 2. Envoyer le code

Si Git est installé sur votre poste :

```bash
cd passerelle-pennylane-windows
git init
git add .
git commit -m "Version initiale"
git branch -M main
git remote add origin https://github.com/VOTRE-COMPTE/passerelle-pennylane.git
git push -u origin main
```

Sans Git, l'interface web fait l'affaire : sur la page du dépôt vide,
**uploading an existing file**, puis glissez le contenu du dossier. Veillez à
conserver les sous-dossiers, en particulier `.github/workflows/`.

### 3. Récupérer l'installeur

L'onglet **Actions** montre la compilation en cours, trois à cinq minutes.
Une fois terminée, ouvrez le run et téléchargez l'artefact
**Passerelle-Pennylane-Setup**. Il contient
`Passerelle-Pennylane-Setup-1.0.0.exe`.

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
cd passerelle-pennylane-windows
npm install          # environ 3 minutes
npm test             # 34 tests, doivent tous passer
npm run package      # environ 5 minutes
```

L'installeur apparaît dans `release/Passerelle-Pennylane-Setup-1.0.0.exe`.

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
  l'utilisateur : vous n'avez pas besoin du service informatique.
- Raccourcis bureau et menu Démarrer, dossier d'installation modifiable.
- Installeur en français.
- Désinstallation par le panneau de configuration Windows classique.

L'historique et les paramètres vivent dans
`%APPDATA%\Passerelle Pennylane\`, hors du dossier d'installation : une mise à
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

## Diffuser les mises à jour

Sans mécanisme automatique, il vous faut redistribuer le `.exe` à chaque
version : l'installeur écrase l'ancienne sans toucher aux données.

Si cela devient pénible sur plusieurs postes, `electron-updater` branché sur
les Releases GitHub permet à l'application de se mettre à jour seule. À
ajouter quand le besoin se fait sentir, pas avant.

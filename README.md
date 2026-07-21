# Passerelle Pennylane — application Windows

Surveille deux dossiers, transmet les factures à Pennylane dès leur dépôt, et
bloque tout document qui n'en est pas une.

L'application ne lit ni les montants ni les tiers, et ne crée aucune écriture :
l'OCR et la comptabilisation restent chez Pennylane. Elle transmet, elle trace,
elle bloque.

## Pourquoi cette application

Le connecteur Google Drive de Pennylane ne relève les dossiers que toutes les
8 heures. Ici, l'envoi est déclenché par le dépôt du fichier : le document part
en quelques secondes.

## Développement

Pour obtenir directement l'installeur `.exe`, voir **COMPILER.md**.

```bash
npm install
npm run dev      # application en mode développement
npm test         # 34 tests : classification, lecture PDF, périodes, stockage
npm run package  # produit release/Passerelle-Pennylane-Setup-1.0.0.exe
```

## Organisation

```
electron/          processus principal — n'est jamais exposé à l'interface
  classifier.ts    reconnaissance facture / bon de livraison / devis
  watcher.ts       surveillance des dossiers, file d'envoi, réessais
  pdf.ts           extraction du texte via pdfjs-dist
  mailer.ts        envoi SMTP et traduction des erreurs serveur
  settings.ts      paramètres, mot de passe chiffré via DPAPI
  db.ts            historique en fichier JSON, écriture atomique
  main.ts          fenêtre, zone de notification, ponts IPC
  preload.ts       seule surface exposée au rendu

src/               interface React
  components/      tableau TanStack, filtres, aperçu
  lib/periods.ts   bornes de période, dont l'exercice à cheval
  pages/           Documents et Paramètres
```

## Règles de fonctionnement

**Les fichiers ne sont jamais déplacés ni renommés.** L'état vit dans la ligne
du tableau. Vos dossiers restent tels que vos utilisateurs les connaissent.

**Rien ne part sur un doute.** Un document dont le type n'est pas identifié
passe en « À vérifier » et attend une décision. Un document non transmis se
rattrape en un clic ; un bon de livraison comptabilisé en facture se découvre
au bilan.

**Le terme le plus haut l'emporte.** Une facture mentionnant « suite à votre
bon de commande n°42 » reste une facture : c'est la position du terme dans le
document qui donne sa nature.

**Aucun contenu n'est envoyé deux fois.** L'empreinte SHA-256 de chaque fichier
est mémorisée. Un même document redéposé sous un autre nom n'est pas renvoyé.

**Une seule instance.** Deux surveillances sur le même dossier enverraient
chaque facture en double.

## Limites connues

- Le poste doit être allumé. Un fichier déposé pendant que le PC est éteint est
  transmis au démarrage suivant, lors du balayage initial.
- Aucun accusé de réception applicatif. L'application garantit que le message
  est parti ; la présence effective se vérifie dans Pennylane, après quelques
  minutes d'OCR.
- Les mots-clés de classification sont figés dans le code
  (`electron/classifier.ts`). Une liste modifiable dérive vite vers des règles
  trop larges qui laissent passer ce qu'elles devaient bloquer.

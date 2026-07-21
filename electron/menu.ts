/**
 * Menu de la fenetre, en francais et reduit a l'utile.
 *
 * Le menu par defaut d'Electron expose des entrees de developpement
 * (outils de developpement, rechargement forcé) qui n'ont rien a faire
 * dans une application de production.
 */
import { app, BrowserWindow, dialog, Menu, shell, type MenuItemConstructorOptions } from "electron";

export function construireMenu(actions: {
  analyser: () => void;
  ouvrirParametres: () => void;
  ouvrirDossier: (flux: "achat" | "vente") => void;
  verifierMaj: () => void;
  version: () => string;
}): void {
  const modele: MenuItemConstructorOptions[] = [
    {
      label: "Fichier",
      submenu: [
        {
          label: "Analyser les dossiers",
          accelerator: "F5",
          click: () => actions.analyser(),
        },
        { type: "separator" },
        {
          label: "Ouvrir le dossier des achats",
          click: () => actions.ouvrirDossier("achat"),
        },
        {
          label: "Ouvrir le dossier des ventes",
          click: () => actions.ouvrirDossier("vente"),
        },
        { type: "separator" },
        {
          label: "Paramètres",
          accelerator: "CmdOrCtrl+,",
          click: () => actions.ouvrirParametres(),
        },
        { type: "separator" },
        { label: "Quitter", accelerator: "Alt+F4", role: "quit" },
      ],
    },
    {
      label: "Édition",
      submenu: [
        { label: "Annuler", role: "undo" },
        { label: "Rétablir", role: "redo" },
        { type: "separator" },
        { label: "Couper", role: "cut" },
        { label: "Copier", role: "copy" },
        { label: "Coller", role: "paste" },
        { label: "Tout sélectionner", role: "selectAll" },
      ],
    },
    {
      label: "Affichage",
      submenu: [
        { label: "Agrandir le texte", role: "zoomIn", accelerator: "CmdOrCtrl+Plus" },
        { label: "Réduire le texte", role: "zoomOut" },
        { label: "Taille normale", role: "resetZoom" },
        { type: "separator" },
        { label: "Plein écran", role: "togglefullscreen" },
      ],
    },
    {
      label: "Aide",
      submenu: [
        {
          label: "Rechercher les mises à jour",
          click: () => actions.verifierMaj(),
        },
        { type: "separator" },
        {
          label: "Guide d'utilisation",
          click: () => void shell.openExternal("https://pennylane.readme.io"),
        },
        { type: "separator" },
        {
          label: "À propos de Nexora",
          click: () => {
            const fenetre = BrowserWindow.getFocusedWindow();
            const details = [
              `Version ${actions.version()}`,
              "Auteur : FV",
              "",
              "Transmet automatiquement les factures déposées",
              "dans vos dossiers vers Pennylane.",
              "",
              `Electron ${process.versions.electron} · Chromium ${process.versions.chrome}`,
            ].join("\n");

            if (fenetre) {
              void dialog.showMessageBox(fenetre, {
                type: "info", title: "À propos de Nexora",
                message: "Nexora", detail: details, buttons: ["Fermer"],
              });
            }
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(modele));
}

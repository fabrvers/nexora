/**
 * Mises a jour.
 *
 * Deux mecanismes complementaires :
 *
 * 1. L'installeur NSIS reconnait une installation existante au meme
 *    identifiant applicatif : il remplace les fichiers en place, conserve le
 *    dossier d'installation choisi la premiere fois, et ne touche pas aux
 *    donnees rangees dans %APPDATA% (parametres, historique).
 *
 * 2. L'application interroge les publications GitHub au demarrage. Si une
 *    version plus recente existe, elle la telecharge en arriere-plan puis
 *    propose de redemarrer. Rien ne s'installe sans accord de l'utilisateur.
 */
import { app, BrowserWindow, dialog, type IpcMain } from "electron";
import electronUpdater from "electron-updater";

const { autoUpdater } = electronUpdater;

export type EtatMaj =
  | { phase: "inactif" }
  | { phase: "verification" }
  | { phase: "a-jour"; version: string }
  | { phase: "disponible"; version: string }
  | { phase: "telechargement"; pourcentage: number }
  | { phase: "prete"; version: string }
  | { phase: "erreur"; message: string };

let etat: EtatMaj = { phase: "inactif" };
let fenetre: BrowserWindow | null = null;

function publier(nouvel: EtatMaj): void {
  etat = nouvel;
  fenetre?.webContents.send("maj:etat", etat);
}

export function initialiserMaj(cible: BrowserWindow, ipcMain: IpcMain): void {
  fenetre = cible;

  autoUpdater.autoDownload = true;
  // L'installation ne se declenche jamais toute seule a la fermeture :
  // c'est l'utilisateur qui choisit le moment.
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on("checking-for-update", () => publier({ phase: "verification" }));
  autoUpdater.on("update-not-available", () =>
    publier({ phase: "a-jour", version: app.getVersion() }));
  autoUpdater.on("update-available", (info) =>
    publier({ phase: "disponible", version: info.version }));
  autoUpdater.on("download-progress", (progression) =>
    publier({ phase: "telechargement", pourcentage: Math.round(progression.percent) }));
  autoUpdater.on("update-downloaded", (info) => {
    publier({ phase: "prete", version: info.version });
    void proposerRedemarrage(info.version);
  });
  autoUpdater.on("error", (erreur) =>
    publier({ phase: "erreur", message: lisible(erreur) }));

  ipcMain.handle("maj:etat", () => etat);
  ipcMain.handle("maj:verifier", () => verifier(true));
  ipcMain.handle("maj:installer", () => autoUpdater.quitAndInstall(false, true));

  // Au demarrage, en differe : la surveillance des dossiers passe avant.
  setTimeout(() => void verifier(false), 8000);
}

async function verifier(manuel: boolean): Promise<EtatMaj> {
  if (!app.isPackaged) {
    // En developpement il n'y a pas de version publiee a comparer.
    publier({ phase: "a-jour", version: app.getVersion() });
    return etat;
  }
  try {
    await autoUpdater.checkForUpdates();
  } catch (erreur) {
    publier({ phase: "erreur", message: lisible(erreur) });
    if (manuel && fenetre) {
      void dialog.showMessageBox(fenetre, {
        type: "warning",
        title: "Mise à jour",
        message: "Impossible de vérifier les mises à jour",
        detail: lisible(erreur),
        buttons: ["Fermer"],
      });
    }
  }
  return etat;
}

async function proposerRedemarrage(version: string): Promise<void> {
  if (!fenetre) return;
  const reponse = await dialog.showMessageBox(fenetre, {
    type: "info",
    title: "Mise à jour prête",
    message: `La version ${version} est prête à être installée.`,
    detail:
      "Nexora va se fermer le temps de l'installation, puis se rouvrir.\n\n"
      + "Vos dossiers surveillés, vos réglages et votre historique sont conservés.\n"
      + "La surveillance reprend au redémarrage.",
    buttons: ["Plus tard", "Redémarrer et installer"],
    defaultId: 1,
    cancelId: 0,
    noLink: true,
  });
  if (reponse.response === 1) autoUpdater.quitAndInstall(false, true);
}

function lisible(erreur: unknown): string {
  const message = String((erreur as Error)?.message ?? erreur);
  if (message.includes("ENOTFOUND") || message.includes("ETIMEDOUT")) {
    return "Serveur de mise à jour injoignable. Vérifiez la connexion Internet.";
  }
  if (message.includes("404") || message.includes("406") || message.includes("latest version")) {
    return "Aucune version publiée trouvée. Si la publication GitHub existe encore "
      + "à l'état de brouillon, ouvrez-la et cliquez sur « Publish release ».";
  }
  return message;
}

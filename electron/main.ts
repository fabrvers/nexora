/** Processus principal : fenetre, icone de notification, ponts IPC. */
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, nativeTheme, Notification, shell, Tray } from "electron";
import archiver from "archiver";
import fs from "node:fs";
import path from "node:path";
import * as db from "./db.js";
import { tester } from "./mailer.js";
import * as parametres from "./settings.js";
import { arreter, balayer, demarrer, transmettre } from "./watcher.js";
import { construireMenu } from "./menu.js";
import * as imap from "./imap.js";
import { initialiserMaj } from "./maj.js";

let fenetre: BrowserWindow | null = null;
let icone: Tray | null = null;
let quitteVraiment = false;

const DEV = !app.isPackaged;

function creerFenetre(): void {
  construireMenu({
    analyser: () => void balayer(),
    ouvrirParametres: () => fenetre?.webContents.send("aller-a:parametres"),
    verifierMaj: () => void fenetre?.webContents.send("aller-a:parametres"),
    version: () => versionApplication(),
    ouvrirDossier: (flux) => {
      const p = parametres.lire();
      const dossier = flux === "achat" ? p.dossierAchats : p.dossierVentes;
      if (dossier) void shell.openPath(dossier);
    },
  });

  fenetre = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    // Cadre natif de Windows : c'est lui qui fournit les dispositions de
    // fenetre au survol du bouton Agrandir sous Windows 11.
    frame: true,
    maximizable: true,
    show: false,
    // Couleur de fond avant le premier rendu : evite un flash blanc en
    // theme sombre, et inversement.
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#0d1015" : "#f4f6f9",
    title: "Nexora",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (DEV) void fenetre.loadURL("http://localhost:5173");
  else void fenetre.loadFile(path.join(__dirname, "../dist/index.html"));

  fenetre.once("ready-to-show", () => fenetre?.show());
  initialiserMaj(fenetre, ipcMain);

  fenetre.on("close", (evenement) => {
    // Fermer la fenetre ne doit pas arreter la surveillance.
    if (!quitteVraiment && parametres.lire().reduireDansBarre) {
      evenement.preventDefault();
      fenetre?.hide();
    }
  });
}

/**
 * Chemin de l'icone selon le contexte : dist/ existe une fois compile,
 * public/ pendant le developpement. Sans ce repli, Tray plante au demarrage
 * de npm run dev.
 */
function cheminIcone(): string | null {
  const candidats = [
    path.join(__dirname, "../dist/icone.png"),
    path.join(process.cwd(), "public/icone.png"),
  ];
  return candidats.find((c) => fs.existsSync(c)) ?? null;
}

function creerIcone(): void {
  const chemin = cheminIcone();
  icone = new Tray(chemin ? chemin : nativeImage.createEmpty());
  icone.setToolTip("Nexora");
  icone.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Ouvrir", click: () => fenetre?.show() },
      { label: "Analyser les dossiers", click: () => void balayer() },
      { type: "separator" },
      { label: "Quitter", click: () => { quitteVraiment = true; app.quit(); } },
    ]),
  );
  icone.on("double-click", () => fenetre?.show());
}

/** Pastille rouge sur l'icone : nombre de documents demandant une action. */
function majBadge(): void {
  const c = db.compteurs();
  const enAttenteAction = (c.bloquee ?? 0) + (c.a_verifier ?? 0) + (c.echec ?? 0);
  icone?.setToolTip(
    enAttenteAction ? `Nexora — ${enAttenteAction} document(s) à traiter` : "Nexora",
  );
  // setBadgeCount n'est pas pris en charge partout : un echec ici ne doit
  // pas empecher l'application de tourner.
  try {
    app.setBadgeCount(enAttenteAction);
  } catch {
    /* sans consequence */
  }
}

function notifier(evenement: string, charge?: any): void {
  fenetre?.webContents.send("documents:changement");
  majBadge();

  if (evenement === "document:bloque") {
    new Notification({
      title: `${charge.type} détecté — non transmis`,
      body: `${charge.nom}\n${charge.motif}`,
    }).show();
  }
  if (evenement === "document:echec") {
    new Notification({
      title: "Envoi impossible",
      body: `${charge.nom}\n${charge.motif}`,
    }).show();
  }
}

// --- Ponts IPC -------------------------------------------------------------

ipcMain.handle("documents:liste", () => db.tous());
ipcMain.handle("documents:compteurs", () => db.compteurs());
ipcMain.handle("document:envoyer", (_e, id: number) => transmettre(id, true));
ipcMain.handle("document:ignorer", (_e, id: number) => {
  db.majStatut(id, { statut: "ignoree", motif: "Écarté manuellement" });
  notifier("document:maj");
});

ipcMain.handle("document:ouvrir-dossier", (_e, id: number) => {
  const doc = db.parId(id);
  if (doc) shell.showItemInFolder(doc.chemin);
});

ipcMain.handle("document:contenu", (_e, id: number) => {
  const doc = db.parId(id);
  if (!doc || !fs.existsSync(doc.chemin)) return null;
  return { nom: doc.nom_fichier, donnees: fs.readFileSync(doc.chemin).buffer };
});

ipcMain.handle("documents:telecharger", async (_e, ids: number[]) => {
  const docs = ids.map(db.parId).filter(Boolean) as db.Document[];
  if (!docs.length) return { ok: false, message: "Aucun document sélectionné" };

  // Un seul document : enregistrement direct, sans archive.
  if (docs.length === 1) {
    const cible = await dialog.showSaveDialog({ defaultPath: docs[0].nom_fichier });
    if (cible.canceled || !cible.filePath) return { ok: false, message: "Annulé" };
    fs.copyFileSync(docs[0].chemin, cible.filePath);
    return { ok: true, message: "Document enregistré" };
  }

  const cible = await dialog.showSaveDialog({
    defaultPath: `factures-${new Date().toISOString().slice(0, 10)}.zip`,
    filters: [{ name: "Archive ZIP", extensions: ["zip"] }],
  });
  if (cible.canceled || !cible.filePath) return { ok: false, message: "Annulé" };

  await new Promise<void>((resoudre, rejeter) => {
    const sortie = fs.createWriteStream(cible.filePath!);
    const archive = archiver("zip", { zlib: { level: 6 } });
    sortie.on("close", () => resoudre());
    archive.on("error", rejeter);
    archive.pipe(sortie);
    for (const doc of docs) {
      if (!fs.existsSync(doc.chemin)) continue;
      const sousDossier = doc.flux === "achat" ? "Achats" : "Ventes";
      archive.file(doc.chemin, { name: `${sousDossier}/${doc.nom_fichier}` });
    }
    void archive.finalize();
  });

  return { ok: true, message: `${docs.length} documents enregistrés` };
});

/**
 * Supprime des lignes de l'historique et envoie les fichiers a la corbeille.
 *
 * Les deux vont ensemble : garder le fichier dans le dossier surveille tout
 * en oubliant son empreinte le ferait redetecter, donc renvoyer, au balayage
 * suivant. La corbeille laisse une porte de sortie en cas d'erreur.
 */
/**
 * Suppression de lignes.
 *
 * L'application decide seule du sort du fichier, pour eviter a l'utilisateur
 * un choix technique a chaque clic :
 *   - fichier encore dans un dossier surveille  -> ligne + fichier a la corbeille ;
 *     sans cela, il serait redetecte au prochain balayage et renvoye a Pennylane ;
 *   - fichier absent, deplace, ou range ailleurs -> seule la ligne est retiree.
 *
 * Un fichier situe hors des dossiers surveilles n'est jamais touche : il ne
 * releve pas de cette application.
 */
ipcMain.handle("documents:supprimer", async (_e, ids: number[]) => {
  const docs = ids.map(db.parId).filter(Boolean) as db.Document[];
  if (!docs.length) return { supprimes: 0, fichiersEffaces: 0 };

  const p = parametres.lire();
  const dossiers = [p.dossierAchats, p.dossierVentes]
    .filter(Boolean)
    .map((d) => path.resolve(d));

  const avecFichier = docs.filter(
    (d) => fs.existsSync(d.chemin) && dossiers.includes(path.dirname(path.resolve(d.chemin))),
  );
  const sansFichier = docs.length - avecFichier.length;

  const lignes: string[] = [];
  if (avecFichier.length) {
    lignes.push(
      avecFichier.length === 1
        ? "1 fichier sera envoyé à la corbeille Windows, avec sa ligne."
        : `${avecFichier.length} fichiers seront envoyés à la corbeille Windows, avec leurs lignes.`,
    );
    lignes.push(
      "Sans cela, ils seraient de nouveau détectés au prochain balayage et retransmis à Pennylane.",
    );
  }
  if (sansFichier) {
    if (lignes.length) lignes.push("");
    lignes.push(
      sansFichier === 1
        ? "1 ligne sera simplement retirée : son fichier n'est plus dans un dossier surveillé."
        : `${sansFichier} lignes seront simplement retirées : leurs fichiers ne sont plus dans un dossier surveillé.`,
    );
  }

  const reponse = await dialog.showMessageBox(fenetre!, {
    type: "warning",
    title: "Supprimer",
    message: docs.length === 1
      ? `Supprimer « ${docs[0].nom_fichier} » ?`
      : `Supprimer ces ${docs.length} documents ?`,
    detail: lignes.join("\n"),
    buttons: ["Annuler", "Supprimer"],
    defaultId: 1,
    cancelId: 0,
    noLink: true,
  });

  if (reponse.response !== 1) return { supprimes: 0, fichiersEffaces: 0 };

  let fichiersEffaces = 0;
  for (const doc of avecFichier) {
    try {
      // Corbeille et non suppression definitive : sur des pieces comptables,
      // une erreur de clic doit rester rattrapable.
      await shell.trashItem(doc.chemin);
      fichiersEffaces++;
    } catch {
      /* fichier verrouille : la ligne part quand meme */
    }
  }

  const supprimes = db.supprimer(docs.map((d) => d.id));
  notifier("document:maj");
  return { supprimes, fichiersEffaces };
});

ipcMain.handle("dossiers:balayer", () => balayer());

ipcMain.handle("documents:choisir-fichiers", async () => {
  const resultat = await dialog.showOpenDialog({
    properties: ["openFile", "multiSelections"],
    filters: [{ name: "Factures PDF", extensions: ["pdf"] }],
  });
  return resultat.canceled ? [] : resultat.filePaths;
});

/**
 * Copie les fichiers deposes dans le dossier surveille du flux, puis laisse
 * la surveillance faire son travail habituel. Un fichier deja present dans
 * le dossier n'est pas duplique.
 */
ipcMain.handle("documents:deposer", async (_e, flux: "achat" | "vente", chemins: string[]) => {
  const p = parametres.lire();
  const cible = flux === "achat" ? p.dossierAchats : p.dossierVentes;
  if (!cible) return { ajoutes: 0, ignores: chemins.length };

  let ajoutes = 0;
  let ignores = 0;

  for (const source of chemins) {
    try {
      if (!fs.existsSync(source) || fs.statSync(source).isDirectory()) { ignores++; continue; }
      if (path.dirname(path.resolve(source)) === path.resolve(cible)) { ajoutes++; continue; }

      // Jamais d'ecrasement : un homonyme recoit un suffixe.
      const { name, ext } = path.parse(source);
      let destination = path.join(cible, `${name}${ext}`);
      let compteur = 1;
      while (fs.existsSync(destination)) {
        destination = path.join(cible, `${name}-${compteur}${ext}`);
        compteur += 1;
      }
      fs.copyFileSync(source, destination);
      ajoutes++;
    } catch {
      ignores++;
    }
  }

  await balayer();
  return { ajoutes, ignores };
});
ipcMain.handle("parametres:lire", () => ({
  ...parametres.lire(),
  motDePasseDefini: Boolean(parametres.lireMotDePasse()),
  motDePasseImapDefini: Boolean(parametres.lireMotDePasseImap()),
  manquants: parametres.manquants(),
}));

ipcMain.handle("parametres:ecrire", (_e, valeurs: any, motDePasse?: string, motDePasseImap?: string) => {
  const fusion = parametres.ecrire({ ...valeurs, configure: true });
  if (typeof motDePasse === "string") parametres.ecrireMotDePasse(motDePasse);
  if (typeof motDePasseImap === "string") parametres.ecrireMotDePasseImap(motDePasseImap);
  app.setLoginItemSettings({ openAtLogin: fusion.demarrageAutomatique });
  demarrer(notifier); // les dossiers ont pu changer
  demarrerReleveImap();
  return { ...fusion, manquants: parametres.manquants(fusion) };
});

ipcMain.handle("parametres:choisir-dossier", async () => {
  const resultat = await dialog.showOpenDialog({ properties: ["openDirectory"] });
  return resultat.canceled ? null : resultat.filePaths[0];
});

ipcMain.handle("parametres:tester-smtp", () => tester());
ipcMain.handle("parametres:tester-imap", () => imap.tester());

let journalReleve: string[] = [];

ipcMain.handle("imap:relever", async () => {
  journalReleve = [];
  const resultat = await imap.relever((ligne) => journalReleve.push(ligne));
  if (resultat.pdfDeposes) await balayer();
  return { ...resultat, journal: journalReleve };
});

ipcMain.handle("imap:journal", () => journalReleve);

/**
 * Version de l'application.
 *
 * Hors paquet, app.getVersion() renvoie celle d'Electron : on lit alors
 * directement le package.json pour ne pas afficher un numero trompeur.
 */
function versionApplication(): string {
  if (app.isPackaged) return app.getVersion();
  for (const racine of [app.getAppPath(), process.cwd(), path.join(__dirname, "..")]) {
    try {
      const contenu = fs.readFileSync(path.join(racine, "package.json"), "utf8");
      const version = JSON.parse(contenu).version;
      if (version) return version;
    } catch {
      /* on essaie l'emplacement suivant */
    }
  }
  return app.getVersion();
}

ipcMain.handle("application:version", () => ({
  version: versionApplication(),
  auteur: "FV",
  electron: process.versions.electron,
}));

// --- Cycle de vie ----------------------------------------------------------

// Une seule instance : deux surveillances sur le meme dossier enverraient
// chaque facture en double.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    fenetre?.show();
    fenetre?.focus();
  });

  void app.whenReady().then(async () => {
    db.ouvrir(app.getPath("userData"));
    creerFenetre();
    creerIcone();
    majBadge();
    if (!parametres.manquants().length) {
      demarrer(notifier);
      await balayer();
      demarrerReleveImap();
    }
  });
}

/** (Re)lance la relève de la boîte selon les réglages en vigueur. */
function demarrerReleveImap(): void {
  imap.demarrerReleve(
    (ligne) => {
      journalReleve.push(ligne);
      if (journalReleve.length > 200) journalReleve = journalReleve.slice(-200);
    },
    () => void balayer(),
  );
}

app.on("before-quit", () => {
  quitteVraiment = true;
  arreter();
  imap.arreterReleve();
});
app.on("window-all-closed", () => { /* l'application vit dans la barre des taches */ });

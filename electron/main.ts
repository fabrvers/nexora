/** Processus principal : fenetre, icone de notification, ponts IPC. */
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, Notification, shell, Tray } from "electron";
import archiver from "archiver";
import fs from "node:fs";
import path from "node:path";
import * as db from "./db.js";
import { tester } from "./mailer.js";
import * as parametres from "./settings.js";
import { arreter, balayer, demarrer, transmettre } from "./watcher.js";

let fenetre: BrowserWindow | null = null;
let icone: Tray | null = null;
let quitteVraiment = false;

const DEV = !app.isPackaged;

function creerFenetre(): void {
  fenetre = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: "#0b0d10",
    title: "Passerelle Pennylane",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (DEV) void fenetre.loadURL("http://localhost:5173");
  else void fenetre.loadFile(path.join(__dirname, "../dist/index.html"));

  fenetre.once("ready-to-show", () => fenetre?.show());

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
  icone.setToolTip("Passerelle Pennylane");
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
    enAttenteAction
      ? `Passerelle Pennylane — ${enAttenteAction} document(s) à traiter`
      : "Passerelle Pennylane",
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

ipcMain.handle("dossiers:balayer", () => balayer());
ipcMain.handle("parametres:lire", () => ({
  ...parametres.lire(),
  motDePasseDefini: Boolean(parametres.lireMotDePasse()),
  manquants: parametres.manquants(),
}));

ipcMain.handle("parametres:ecrire", (_e, valeurs: any, motDePasse?: string) => {
  const fusion = parametres.ecrire({ ...valeurs, configure: true });
  if (typeof motDePasse === "string") parametres.ecrireMotDePasse(motDePasse);
  app.setLoginItemSettings({ openAtLogin: fusion.demarrageAutomatique });
  demarrer(notifier); // les dossiers ont pu changer
  return { ...fusion, manquants: parametres.manquants(fusion) };
});

ipcMain.handle("parametres:choisir-dossier", async () => {
  const resultat = await dialog.showOpenDialog({ properties: ["openDirectory"] });
  return resultat.canceled ? null : resultat.filePaths[0];
});

ipcMain.handle("parametres:tester-smtp", () => tester());

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
    }
  });
}

app.on("before-quit", () => { quitteVraiment = true; arreter(); });
app.on("window-all-closed", () => { /* l'application vit dans la barre des taches */ });

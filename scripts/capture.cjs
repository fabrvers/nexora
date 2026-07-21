/**
 * Outil de developpement : lance l'application et enregistre des captures.
 * Ne fait pas partie de l'application livree.
 */
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

require("../dist-electron/main.js");

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const sortie = process.env.DOSSIER_CAPTURES || "/tmp/captures";

app.whenReady().then(async () => {
  fs.mkdirSync(sortie, { recursive: true });
  await attendre(2500);

  const fenetre = BrowserWindow.getAllWindows()[0];
  if (!fenetre) { console.error("aucune fenetre"); app.exit(1); return; }

  fenetre.webContents.on("console-message", (_e, niveau, message) =>
    console.log("[rendu]", message));
  fenetre.webContents.on("did-fail-load", (_e, code, description) =>
    console.log("[echec chargement]", code, description));

  fenetre.show();
  fenetre.setSize(1440, 900);
  await attendre(1500);
  console.log("URL:", fenetre.webContents.getURL());
  const etatDom = await fenetre.webContents.executeJavaScript(
    "({racine: document.getElementById('root')?.innerHTML.length, api: typeof window.api})");
  console.log("DOM:", JSON.stringify(etatDom));

  const etapes = JSON.parse(process.env.ETAPES || '[["depart",""]]');
  for (const [nom, script] of etapes) {
    if (script) {
      try { await fenetre.webContents.executeJavaScript(script); } catch (e) {
        console.error("script", nom, ":", e.message);
      }
      await attendre(700);
    }
    const image = await fenetre.webContents.capturePage();
    fs.writeFileSync(path.join(sortie, `${nom}.png`), image.toPNG());
    console.log("capture:", nom);
  }
  app.exit(0);
});

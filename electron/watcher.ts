/**
 * Surveillance des dossiers et file d'envoi.
 *
 * Le fichier reste toujours a sa place : c'est le statut de la ligne qui
 * porte l'information. Rien n'est deplace, rien n'est renomme.
 */
import chokidar, { type FSWatcher } from "chokidar";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { classifier, LIBELLES_TYPE } from "./classifier.js";
import { texteDuPdf } from "./pdf.js";
import * as db from "./db.js";
import { envoyer, lisible } from "./mailer.js";
import { lire } from "./settings.js";

const EXTENSIONS = new Set([".pdf", ".jpg", ".jpeg", ".png"]);
/** Espacement des tentatives : 1 min, 5 min, 15 min. */
const ATTENTES = [60_000, 300_000, 900_000];

type Notifier = (evenement: string, charge?: unknown) => void;

let surveillants: FSWatcher[] = [];
let prevenir: Notifier = () => {};

export function demarrer(notifier: Notifier): void {
  prevenir = notifier;
  arreter();
  const p = lire();

  for (const [flux, dossier] of [
    ["achat", p.dossierAchats],
    ["vente", p.dossierVentes],
  ] as const) {
    if (!dossier) continue;
    const surveillant = chokidar.watch(dossier, {
      depth: 0,
      ignoreInitial: false,
      awaitWriteFinish: {
        // Attend que la copie soit terminee : un fichier arrivant par le
        // reseau grossit progressivement.
        stabilityThreshold: p.delaiStabiliteMs,
        pollInterval: 200,
      },
    });
    surveillant.on("add", (chemin) => void traiter(chemin, flux));
    surveillants.push(surveillant);
  }
}

export function arreter(): void {
  surveillants.forEach((s) => void s.close());
  surveillants = [];
}

/** Reprend les fichiers deposes pendant que l'application etait fermee. */
export async function balayer(): Promise<void> {
  const p = lire();
  for (const [flux, dossier] of [
    ["achat", p.dossierAchats],
    ["vente", p.dossierVentes],
  ] as const) {
    if (!dossier || !fs.existsSync(dossier)) continue;
    for (const nom of fs.readdirSync(dossier)) {
      const chemin = path.join(dossier, nom);
      if (fs.statSync(chemin).isFile()) await traiter(chemin, flux);
    }
  }
}

function empreinte(chemin: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(chemin)).digest("hex");
}

async function traiter(chemin: string, flux: "achat" | "vente"): Promise<void> {
  if (!EXTENSIONS.has(path.extname(chemin).toLowerCase())) return;
  if (path.basename(chemin).startsWith("~$")) return; // fichier temporaire Office

  let sha256: string;
  let taille: number;
  try {
    sha256 = empreinte(chemin);
    taille = fs.statSync(chemin).size;
  } catch {
    return; // fichier disparu entre-temps
  }

  const connu = db.parEmpreinte(sha256);
  if (connu) {
    // Deja vu : on ne renvoie jamais deux fois le meme contenu.
    if (connu.chemin !== chemin) db.majStatut(connu.id, { chemin });
    return;
  }

  const verdict = classifier(path.basename(chemin), await texteDuPdf(chemin));
  const p = lire();
  const destinataire = flux === "achat" ? p.emailAchats : p.emailVentes;

  const id = db.inserer({
    sha256,
    nom_fichier: path.basename(chemin),
    chemin,
    flux,
    type_detecte: verdict.type,
    statut: verdict.verdict === "envoyer" ? "en_attente"
      : verdict.verdict === "bloquer" ? "bloquee" : "a_verifier",
    destinataire: verdict.verdict === "envoyer" ? destinataire : null,
    message_id: null,
    motif: verdict.motif,
    detecte_le: new Date().toISOString(),
    envoye_le: null,
    tentatives: 0,
    taille_octets: taille,
  });

  prevenir("document:nouveau");

  if (verdict.verdict === "envoyer") {
    await transmettre(id);
  } else {
    prevenir("document:bloque", {
      nom: path.basename(chemin),
      type: LIBELLES_TYPE[verdict.type],
      motif: verdict.motif,
    });
  }
}

/** Envoie, avec trois tentatives espacees en cas d'echec. */
export async function transmettre(id: number, forcer = false): Promise<void> {
  const doc = db.parId(id);
  if (!doc) return;
  if (!forcer && doc.statut === "transmise") return;

  const p = lire();
  const destinataire = doc.flux === "achat" ? p.emailAchats : p.emailVentes;
  if (!destinataire) {
    db.majStatut(id, { statut: "echec", motif: "Aucune adresse Pennylane configurée pour ce flux" });
    prevenir("document:maj");
    return;
  }

  db.majStatut(id, { statut: "en_attente", destinataire });
  prevenir("document:maj");

  try {
    const messageId = await envoyer(doc.chemin, destinataire);
    db.majStatut(id, {
      statut: "transmise",
      message_id: messageId,
      envoye_le: new Date().toISOString(),
      motif: null,
    });
    prevenir("document:maj");
  } catch (erreur) {
    const tentatives = doc.tentatives + 1;
    const message = lisible(erreur);
    db.majStatut(id, { tentatives, statut: "echec", motif: message });
    prevenir("document:maj");

    if (tentatives <= ATTENTES.length) {
      setTimeout(() => void transmettre(id, true), ATTENTES[tentatives - 1]);
    } else {
      prevenir("document:echec", { nom: doc.nom_fichier, motif: message });
    }
  }
}

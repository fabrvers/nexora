/**
 * Historique local des documents.
 *
 * Stockage en fichier JSON plutot qu'en base SQLite : le volume reste de
 * l'ordre de quelques milliers de lignes, et cela evite un module natif qui
 * imposerait Visual Studio Build Tools pour compiler l'application.
 *
 * L'ecriture est atomique : on ecrit dans un fichier temporaire puis on le
 * renomme, pour qu'une coupure de courant ne laisse jamais un fichier tronque.
 */
import fs from "node:fs";
import path from "node:path";

export type Statut =
  | "transmise" | "en_attente" | "a_verifier" | "bloquee" | "echec" | "ignoree";

export interface Document {
  id: number;
  sha256: string;
  nom_fichier: string;
  chemin: string;
  flux: "achat" | "vente";
  type_detecte: string;
  statut: Statut;
  destinataire: string | null;
  message_id: string | null;
  motif: string | null;
  detecte_le: string;
  envoye_le: string | null;
  tentatives: number;
  taille_octets: number;
}

interface Contenu {
  version: number;
  prochainId: number;
  documents: Document[];
}

let etat: Contenu = { version: 1, prochainId: 1, documents: [] };
/** Index sur l'empreinte : la deduplication est l'operation la plus frequente. */
let parSha = new Map<string, Document>();
let fichier = "";
let ecritureEnAttente: NodeJS.Timeout | null = null;

/** @param dossierDonnees dossier de l'application ; passe par l'appelant pour
 *  que ce module reste testable sans Electron. */
export function ouvrir(dossierDonnees: string): void {
  fs.mkdirSync(dossierDonnees, { recursive: true });
  fichier = path.join(dossierDonnees, "historique.json");
  try {
    const brut = JSON.parse(fs.readFileSync(fichier, "utf8")) as Contenu;
    etat = { version: 1, prochainId: brut.prochainId ?? 1, documents: brut.documents ?? [] };
  } catch {
    etat = { version: 1, prochainId: 1, documents: [] };
  }
  reindexer();
}

function reindexer(): void {
  parSha = new Map(etat.documents.map((d) => [d.sha256, d]));
}

/**
 * Les envois arrivent souvent par rafales. On regroupe les ecritures sur
 * 200 ms plutot que de reecrire le fichier a chaque ligne modifiee.
 */
function planifierEcriture(): void {
  if (ecritureEnAttente) return;
  ecritureEnAttente = setTimeout(() => {
    ecritureEnAttente = null;
    ecrireMaintenant();
  }, 200);
  // Ce minuteur ne doit pas retenir le processus a la fermeture.
  ecritureEnAttente.unref?.();
}

export function ecrireMaintenant(): void {
  if (!fichier) return;
  const temporaire = `${fichier}.tmp`;
  fs.writeFileSync(temporaire, JSON.stringify(etat), "utf8");
  fs.renameSync(temporaire, fichier);
}

export const parEmpreinte = (sha256: string): Document | undefined => parSha.get(sha256);

export const parId = (id: number): Document | undefined =>
  etat.documents.find((d) => d.id === id);

/** Du plus recent au plus ancien : l'interface affiche cet ordre par defaut. */
export const tous = (): Document[] =>
  [...etat.documents].sort((a, b) => b.detecte_le.localeCompare(a.detecte_le));

export function inserer(doc: Omit<Document, "id">): number {
  const complet: Document = { ...doc, id: etat.prochainId++ };
  etat.documents.push(complet);
  parSha.set(complet.sha256, complet);
  planifierEcriture();
  return complet.id;
}

export function majStatut(id: number, champs: Partial<Document>): void {
  const doc = parId(id);
  if (!doc) return;
  Object.assign(doc, champs);
  if (champs.sha256) reindexer();
  planifierEcriture();
}

/** Compteurs par statut, pour la barre de filtres. */
export function compteurs(): Record<string, number> {
  const total: Record<string, number> = {};
  for (const doc of etat.documents) total[doc.statut] = (total[doc.statut] ?? 0) + 1;
  return total;
}

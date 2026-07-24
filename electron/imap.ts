/**
 * Relève d'une boîte e-mail.
 *
 * L'utilisateur transfere une facture a une adresse dediee ; Nexora releve la
 * boite, extrait le PDF joint et le depose dans le dossier surveille. Le
 * pipeline habituel prend le relais : classification, deduplication, envoi.
 *
 * L'apport par rapport a un transfert direct vers Pennylane : les images du
 * corps du message — logo de signature, bannieres, icones de reseaux sociaux —
 * ne sont pas importees. Pennylane les traite aujourd'hui comme autant de
 * justificatifs, ce qui encombre la boite de reception.
 *
 * Le routage se fait par dossier IMAP, donc cote serveur : deux postes qui
 * consultent la meme boite voient le meme classement, et Nexora n'a pas
 * besoin de tourner sur un poste particulier.
 */
import fs from "node:fs";
import path from "node:path";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { nomSur, trier, type PieceJointe } from "./pieces-jointes.js";
import { lire, lireMotDePasseImap } from "./settings.js";

export interface ResultatReleve {
  messages: number;
  pdfDeposes: number;
  piecesEcartees: number;
  erreur?: string;
}

type Journal = (message: string) => void;

let releveEnCours = false;
let minuteur: NodeJS.Timeout | null = null;

/** Empeche deux relèves simultanées, qui doubleraient les dépôts. */
export function releveActive(): boolean {
  return releveEnCours;
}

async function connecter(): Promise<ImapFlow> {
  const p = lire();
  const client = new ImapFlow({
    host: p.imapHote,
    port: p.imapPort,
    secure: p.imapChiffrement === "tls",
    auth: { user: p.imapUtilisateur, pass: lireMotDePasseImap() },
    logger: false,
    // Une boite injoignable ne doit pas bloquer l'application.
    socketTimeout: 60_000,
  });
  await client.connect();
  return client;
}

export async function tester(): Promise<{ ok: boolean; message: string }> {
  const p = lire();
  if (!p.imapHote || !p.imapUtilisateur) {
    return { ok: false, message: "Serveur et identifiant sont nécessaires." };
  }
  let client: ImapFlow | null = null;
  try {
    client = await connecter();
    const dossiers = (await client.list()).map((dossier) => dossier.path);
    const manquants = [p.imapDossierAchats, p.imapDossierVentes]
      .filter(Boolean)
      .filter((d) => !dossiers.includes(d));

    if (manquants.length) {
      return {
        ok: false,
        message: `Connexion réussie, mais ces dossiers sont introuvables : ${manquants.join(", ")}. `
          + `Dossiers disponibles : ${dossiers.slice(0, 12).join(", ")}`,
      };
    }
    return { ok: true, message: `Connexion réussie. ${dossiers.length} dossiers visibles.` };
  } catch (erreur) {
    return { ok: false, message: lisible(erreur) };
  } finally {
    await client?.logout().catch(() => {});
  }
}

/** Profondeur maximale d'imbrication : un transfert de transfert suffit. */
const IMBRICATION_MAX = 3;

/**
 * Ouvre un message, depose ses PDF, et recommence sur les messages qu'il
 * transporte lui-meme en piece jointe.
 *
 * « Transferer en piece jointe » sous Outlook produit un .eml : sans cette
 * recursion, la facture resterait enfermee dedans.
 */
async function extraire(
  source: Buffer,
  cible: string,
  secours: string,
  journal: Journal,
  resultat: ResultatReleve,
  profondeur: number,
): Promise<void> {
  const analyse = await simpleParser(source);
  const jointes = analyse.attachments ?? [];

  const tri = trier(jointes.map((a) => ({
    filename: a.filename,
    contentType: a.contentType,
    contentDisposition: a.contentDisposition,
    cid: a.cid,
    related: a.related,
    size: a.size,
  })));

  resultat.piecesEcartees += tri.rejetees.length;
  for (const rejet of tri.rejetees) {
    journal(`Écarté : ${rejet.piece.filename ?? "sans nom"} — ${rejet.motif}`);
  }

  for (const retenue of tri.retenues) {
    const jointe = jointes.find(
      (a) => a.filename === retenue.filename && a.size === retenue.size,
    );
    if (!jointe) continue;

    let destination = path.join(cible, nomSur(retenue, secours));
    let compteur = 1;
    while (fs.existsSync(destination)) {
      const { name, ext } = path.parse(destination);
      destination = path.join(cible, `${name}-${compteur}${ext}`);
      compteur++;
    }
    fs.writeFileSync(destination, jointe.content);
    resultat.pdfDeposes++;
    journal(`Déposé : ${path.basename(destination)} (de « ${analyse.subject ?? "sans objet"} »)`);
  }

  for (const imbrique of tri.aOuvrir) {
    if (profondeur >= IMBRICATION_MAX) {
      journal(`Ignoré : ${imbrique.filename ?? "message imbriqué"} — trop de niveaux de transfert`);
      continue;
    }
    const jointe = jointes.find(
      (a) => a.filename === imbrique.filename && a.size === imbrique.size,
    );
    if (!jointe) continue;

    journal(`Ouverture du message transféré : ${imbrique.filename ?? "sans nom"}`);
    try {
      await extraire(jointe.content, cible, secours, journal, resultat, profondeur + 1);
    } catch {
      resultat.piecesEcartees++;
      journal(`Écarté : ${imbrique.filename ?? "message imbriqué"} — message imbriqué illisible`);
    }
  }
}

/**
 * Relève un dossier IMAP et dépose les PDF dans le dossier du flux.
 * Les messages traités sont marqués comme lus, pour ne pas être repris.
 */
async function releverDossier(
  client: ImapFlow,
  dossierImap: string,
  cible: string,
  journal: Journal,
  resultat: ResultatReleve,
): Promise<void> {
  const verrou = await client.getMailboxLock(dossierImap);
  try {
    const messages = client.fetch({ seen: false }, { source: true, uid: true });

    for await (const message of messages) {
      resultat.messages++;
      await extraire(message.source as Buffer, cible, `message-${message.uid}`,
                     journal, resultat, 0);

      // Marque le message comme lu, meme sans piece retenue : sinon il serait
      // repris a chaque releve.
      await client.messageFlagsAdd({ uid: String(message.uid) }, ["\\Seen"], { uid: true });
    }
  } finally {
    verrou.release();
  }
}

export async function relever(journal: Journal = () => {}): Promise<ResultatReleve> {
  const resultat: ResultatReleve = { messages: 0, pdfDeposes: 0, piecesEcartees: 0 };
  const p = lire();

  if (!p.imapActif || !p.imapHote) return resultat;
  if (releveEnCours) {
    resultat.erreur = "Une relève est déjà en cours.";
    return resultat;
  }

  releveEnCours = true;
  let client: ImapFlow | null = null;
  try {
    client = await connecter();
    const paires: [string, string][] = [
      [p.imapDossierAchats, p.dossierAchats],
      [p.fluxVenteActif ? p.imapDossierVentes : "", p.dossierVentes],
    ];
    for (const [dossierImap, cible] of paires) {
      if (!dossierImap || !cible) continue;
      await releverDossier(client, dossierImap, cible, journal, resultat);
    }
  } catch (erreur) {
    resultat.erreur = lisible(erreur);
    journal(`Relève impossible : ${resultat.erreur}`);
  } finally {
    await client?.logout().catch(() => {});
    releveEnCours = false;
  }
  return resultat;
}

export function demarrerReleve(journal: Journal, apres: () => void): void {
  arreterReleve();
  const p = lire();
  if (!p.imapActif) return;

  const tourner = async () => {
    const r = await relever(journal);
    if (r.pdfDeposes) apres();
  };

  void tourner();
  minuteur = setInterval(() => void tourner(), Math.max(1, p.imapIntervalleMinutes) * 60_000);
}

export function arreterReleve(): void {
  if (minuteur) {
    clearInterval(minuteur);
    minuteur = null;
  }
}

/** Traduit les erreurs IMAP courantes en phrases actionnables. */
function lisible(erreur: unknown): string {
  const message = String((erreur as Error)?.message ?? erreur);
  if (/authenticate|AUTHENTICATIONFAILED|Invalid credentials/i.test(message)) {
    return "Identifiants refusés. Sur Gmail ou Microsoft 365, un mot de passe "
      + "d'application est nécessaire.";
  }
  if (/ENOTFOUND|getaddrinfo/i.test(message)) {
    return "Serveur introuvable. Vérifiez le nom du serveur IMAP.";
  }
  if (/ECONNREFUSED|ETIMEDOUT/i.test(message)) {
    return "Le serveur n'a pas répondu. Vérifiez le port et le pare-feu.";
  }
  if (/NONEXISTENT|Mailbox doesn't exist/i.test(message)) {
    return "Dossier introuvable sur le serveur. Vérifiez son nom exact.";
  }
  return message;
}

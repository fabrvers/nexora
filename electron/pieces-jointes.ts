/**
 * Tri des pieces jointes d'un message.
 *
 * Le point de la fonctionnalite : un e-mail de fournisseur transporte presque
 * toujours, en plus de la facture, le logo de la signature, une banniere de
 * promotion, des icones de reseaux sociaux. Pennylane les importe comme
 * autant de justificatifs, ce qui encombre la boite de reception. Ici on ne
 * retient que les PDF reellement joints.
 *
 * Module sans dependance : c'est la partie a eprouver par des tests.
 */

export interface PieceJointe {
  filename?: string;
  contentType?: string;
  /** « attachment » ou « inline » selon l'en-tete Content-Disposition. */
  contentDisposition?: string;
  /** Renseigne pour les images referencees dans le corps HTML. */
  cid?: string;
  related?: boolean;
  size?: number;
}

/**
 * Vrai pour un message transfere en piece jointe.
 *
 * « Transferer en piece jointe » sous Outlook produit un .eml : la facture
 * est alors enfermee dans ce fichier et resterait invisible sans ouverture
 * du message imbrique.
 */
export function estMessageImbrique(piece: PieceJointe): boolean {
  const type = (piece.contentType ?? "").toLowerCase();
  const nom = (piece.filename ?? "").toLowerCase();
  return type === "message/rfc822" || nom.endsWith(".eml") || nom.endsWith(".msg");
}

export type MotifRejet =
  | "image en ligne dans le corps du message"
  | "format non accepté"
  | "fichier vide"
  | "fichier trop volumineux"
  | "message imbriqué illisible";

export interface TriPiecesJointes {
  retenues: PieceJointe[];
  rejetees: { piece: PieceJointe; motif: MotifRejet }[];
  /** Messages transferes en piece jointe, a ouvrir puis trier a leur tour. */
  aOuvrir: PieceJointe[];
}

/** Au-dela, le fichier n'est pas une facture mais un catalogue ou une video. */
const TAILLE_MAX = 25 * 1024 * 1024;

/** Une facture PDF fait rarement moins de 2 Ko ; en dessous, c'est un leurre. */
const TAILLE_MIN = 2048;

function estPdf(piece: PieceJointe): boolean {
  const type = (piece.contentType ?? "").toLowerCase();
  const nom = (piece.filename ?? "").toLowerCase();
  return type === "application/pdf"
    || type === "application/x-pdf"
    || type === "application/octet-stream" && nom.endsWith(".pdf")
    || nom.endsWith(".pdf");
}

/**
 * Vrai pour une piece affichee dans le corps du message : signature, logo,
 * banniere. Trois indices, qui se completent car les clients de messagerie
 * ne les renseignent pas tous.
 */
export function estImageEnLigne(piece: PieceJointe): boolean {
  if (piece.cid) return true;                              // referencee par le HTML
  if (piece.related) return true;                          // partie multipart/related
  const disposition = (piece.contentDisposition ?? "").toLowerCase();
  if (disposition === "inline") return true;
  // Une image sans nom de fichier n'a pas ete jointe volontairement.
  const type = (piece.contentType ?? "").toLowerCase();
  if (type.startsWith("image/") && !piece.filename) return true;
  return false;
}

export function trier(pieces: PieceJointe[]): TriPiecesJointes {
  const resultat: TriPiecesJointes = { retenues: [], rejetees: [], aOuvrir: [] };

  for (const piece of pieces) {
    // Un message imbrique se traite avant tout : la facture est dedans.
    if (estMessageImbrique(piece)) {
      resultat.aOuvrir.push(piece);
      continue;
    }

    // L'ordre compte : une image en ligne est ecartee avant tout autre
    // controle, pour que le motif affiche soit le plus parlant.
    if (estImageEnLigne(piece)) {
      resultat.rejetees.push({ piece, motif: "image en ligne dans le corps du message" });
      continue;
    }
    if (!estPdf(piece)) {
      resultat.rejetees.push({ piece, motif: "format non accepté" });
      continue;
    }
    if ((piece.size ?? 0) < TAILLE_MIN) {
      resultat.rejetees.push({ piece, motif: "fichier vide" });
      continue;
    }
    if ((piece.size ?? 0) > TAILLE_MAX) {
      resultat.rejetees.push({ piece, motif: "fichier trop volumineux" });
      continue;
    }
    resultat.retenues.push(piece);
  }

  return resultat;
}

/**
 * Nom de fichier sur, derive de la piece jointe.
 * Les caracteres interdits par Windows sont remplaces, et un nom absent
 * donne un nom horodate plutot qu'un echec.
 */
export function nomSur(piece: PieceJointe, secours: string): string {
  const brut = (piece.filename ?? "").trim() || `${secours}.pdf`;
  const nettoye = brut
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 120);
  return nettoye.toLowerCase().endsWith(".pdf") ? nettoye : `${nettoye}.pdf`;
}

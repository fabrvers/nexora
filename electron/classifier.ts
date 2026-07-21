/**
 * Reconnaissance du type de document.
 *
 * Regle directrice : rien ne part sur un doute. Un document non transmis se
 * rattrape en un clic ; un bon de livraison comptabilise en facture se
 * decouvre au bilan.
 *
 * Les listes de termes sont figees dans l'application : une liste modifiable
 * derive vite vers des regles trop larges qui laissent passer ce qu'elles
 * devaient bloquer.
 */

export type TypeDocument =
  | "facture" | "avoir" | "bon_livraison" | "bon_commande"
  | "devis" | "relance" | "inconnu";

export type Verdict = "envoyer" | "bloquer" | "verifier";

export interface Classification {
  type: TypeDocument;
  verdict: Verdict;
  /** Phrase lisible, affichee telle quelle dans la colonne Motif. */
  motif: string;
  /** Terme ayant emporte la decision, pour la mise au point. */
  terme?: string;
}

interface Regle {
  type: TypeDocument;
  libelle: string;
  termes: string[];
}

/** Documents a ne jamais transmettre. L'ordre vaut priorite. */
const BLOQUANTS: Regle[] = [
  {
    type: "bon_livraison",
    libelle: "Bon de livraison",
    termes: [
      "bon de livraison", "bordereau de livraison", "delivery note",
      "packing list", "bl",
    ],
  },
  {
    type: "bon_commande",
    libelle: "Bon de commande",
    termes: [
      "bon de commande", "purchase order", "order confirmation",
      "confirmation de commande", "accuse de reception de commande", "bdc",
    ],
  },
  {
    type: "devis",
    libelle: "Devis",
    termes: [
      "devis", "proforma", "pro forma", "quotation",
      "offre de prix", "proposition commerciale",
    ],
  },
  {
    type: "relance",
    libelle: "Relance",
    termes: [
      "relance", "rappel de paiement", "mise en demeure",
      "payment reminder", "impaye",
    ],
  },
];

/** Documents attendus. */
const ACCEPTES: Regle[] = [
  {
    type: "avoir",
    libelle: "Avoir",
    termes: ["avoir", "note de credit", "credit note", "credit memo"],
  },
  {
    type: "facture",
    libelle: "Facture",
    termes: [
      "facture", "invoice", "rechnung", "factura",
      "note d honoraires", "quittance",
    ],
  },
];

/**
 * Minuscules, accents retires, separateurs unifies.
 * « Bon_de-Livraison N°42.pdf » et « bon de livraison » se rejoignent.
 */
export function normaliser(texte: string): string {
  return (texte ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\-.,;:/\\()[\]]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function echapper(valeur: string): string {
  return valeur.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Cherche le terme correspondant le plus tot dans le sujet, en respectant les
 * frontieres de mot : « bl » ne doit pas mordre dans « table », ni « avoir »
 * dans « nous avoir transmis ».
 */
function chercher(
  regles: Regle[],
  sujet: string,
): { regle: Regle; terme: string; index: number } | null {
  let meilleur: { regle: Regle; terme: string; index: number } | null = null;

  for (const regle of regles) {
    for (const terme of regle.termes) {
      const motif = new RegExp(`(^|\\s)${echapper(normaliser(terme))}(\\s|$)`);
      const trouve = motif.exec(sujet);
      if (trouve && (meilleur === null || trouve.index < meilleur.index)) {
        meilleur = { regle, terme, index: trouve.index };
      }
    }
  }
  return meilleur;
}

/**
 * Arbitre un sujet ou les deux familles de termes peuvent coexister.
 *
 * Une facture mentionnant « suite a votre bon de commande n°42 » reste une
 * facture : c'est le terme le plus haut qui donne la nature du document.
 */
function arbitrer(sujet: string, ou: string): Classification | null {
  const bloquant = chercher(BLOQUANTS, sujet);
  const accepte = chercher(ACCEPTES, sujet);

  if (bloquant && (!accepte || bloquant.index < accepte.index)) {
    return {
      type: bloquant.regle.type,
      verdict: "bloquer",
      motif: `${bloquant.regle.libelle} identifié ${ou}`,
      terme: bloquant.terme,
    };
  }
  if (accepte) {
    return {
      type: accepte.regle.type,
      verdict: "envoyer",
      motif: `${accepte.regle.libelle} reconnue ${ou}`,
      terme: accepte.terme,
    };
  }
  return null;
}

/**
 * @param nomFichier nom d'origine, extension comprise
 * @param texteDebut premiers caracteres du PDF, chaine vide si illisible
 */
export function classifier(nomFichier: string, texteDebut: string): Classification {
  const nom = normaliser((nomFichier ?? "").replace(/\.[^.]+$/, ""));
  const texte = texteDebut ?? "";
  // L'en-tete porte le titre du document ; plus bas, on trouve souvent des
  // mentions parasites du type « suite a votre bon de commande n°42 ».
  const entete = normaliser(texte.slice(0, 600));
  const corps = normaliser(texte.slice(0, 2000));

  // 1. Le nom du fichier prime : c'est ce que l'utilisateur maitrise.
  const parNom = arbitrer(nom, "dans le nom du fichier");
  if (parNom) return parNom;

  // 2. Puis le haut de page, qui porte le titre du document.
  const parEntete = arbitrer(entete, "en tête du document");
  if (parEntete) return parEntete;

  // 3. Terme bloquant plus bas dans la page : suspect sans etre tranchant.
  const bloqCorps = chercher(BLOQUANTS, corps);
  if (bloqCorps) {
    return {
      type: bloqCorps.regle.type,
      verdict: "verifier",
      motif: `Mention « ${bloqCorps.terme} » trouvée dans le document, sans titre clair`,
      terme: bloqCorps.terme,
    };
  }

  // 4. Rien d'exploitable.
  if (!texte.trim()) {
    return {
      type: "inconnu",
      verdict: "verifier",
      motif: "Document scanné : aucun texte lisible pour identifier le type",
    };
  }

  return {
    type: "inconnu",
    verdict: "verifier",
    motif: "Type de document non identifié, ni dans le nom ni dans le contenu",
  };
}

export const LIBELLES_TYPE: Record<TypeDocument, string> = {
  facture: "Facture",
  avoir: "Avoir",
  bon_livraison: "Bon de livraison",
  bon_commande: "Bon de commande",
  devis: "Devis",
  relance: "Relance",
  inconnu: "Non identifié",
};

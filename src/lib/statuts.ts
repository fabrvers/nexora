import type { DocumentLigne } from "./api";

export type CleStatut = DocumentLigne["statut"];

export interface DefinitionStatut {
  libelle: string;
  /** Couleur de la pastille et du point, exprimee en classes Tailwind. */
  teinte: string;
  point: string;
  /** Le document attend une decision de l'utilisateur. */
  action: boolean;
}

export const STATUTS: Record<CleStatut, DefinitionStatut> = {
  transmise:  { libelle: "Transmise",  teinte: "bg-valide/10 text-valide",   point: "bg-valide",  action: false },
  en_attente: { libelle: "En attente", teinte: "bg-doux/10 text-doux",       point: "bg-doux",    action: false },
  a_verifier: { libelle: "À vérifier", teinte: "bg-attente/10 text-attente", point: "bg-attente", action: true },
  bloquee:    { libelle: "Bloquée",    teinte: "bg-attente/10 text-attente", point: "bg-attente", action: true },
  echec:      { libelle: "Échec",      teinte: "bg-refus/10 text-refus",     point: "bg-refus",   action: true },
  ignoree:    { libelle: "Ignorée",    teinte: "bg-doux/10 text-doux",       point: "bg-trait",   action: false },
};

/**
 * Statuts demandant une intervention. C'est le filtre applique par defaut :
 * une liste vide signifie que tout est parti.
 */
export const STATUTS_A_TRAITER: CleStatut[] = ["a_verifier", "bloquee", "echec"];

/** Ordre d'affichage : ce qui demande une action d'abord. */
export const ORDRE_STATUTS: CleStatut[] = [
  "a_verifier", "bloquee", "echec", "en_attente", "transmise", "ignoree",
];

export const LIBELLES_TYPE: Record<string, string> = {
  facture: "Facture",
  avoir: "Avoir",
  bon_livraison: "Bon de livraison",
  bon_commande: "Bon de commande",
  devis: "Devis",
  relance: "Relance",
  inconnu: "Non identifié",
};

export const formatDate = (iso: string | null): string =>
  iso
    ? new Date(iso).toLocaleString("fr-FR", {
        day: "2-digit", month: "2-digit", year: "2-digit",
        hour: "2-digit", minute: "2-digit",
      })
    : "—";

export const formatTaille = (octets: number): string =>
  octets >= 1_048_576
    ? `${(octets / 1_048_576).toFixed(1)} Mo`
    : `${Math.max(1, Math.round(octets / 1024))} Ko`;

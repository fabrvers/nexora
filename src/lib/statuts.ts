import type { DocumentLigne } from "./api";

export type CleStatut = DocumentLigne["statut"];

export interface DefinitionStatut {
  libelle: string;
  /** Classes de la pastille dans le tableau. */
  pastille: string;
  point: string;
  /** Demande une action de l'utilisateur. */
  action: boolean;
}

export const STATUTS: Record<CleStatut, DefinitionStatut> = {
  transmise: {
    libelle: "Transmise",
    pastille: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    point: "bg-emerald-500",
    action: false,
  },
  en_attente: {
    libelle: "En attente",
    pastille: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
    point: "bg-zinc-400",
    action: false,
  },
  a_verifier: {
    libelle: "À vérifier",
    pastille: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    point: "bg-amber-500",
    action: true,
  },
  bloquee: {
    libelle: "Bloquée",
    pastille: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    point: "bg-amber-600",
    action: true,
  },
  echec: {
    libelle: "Échec",
    pastille: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
    point: "bg-red-500",
    action: true,
  },
  ignoree: {
    libelle: "Ignorée",
    pastille: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
    point: "bg-zinc-300",
    action: false,
  },
};

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
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "—";

export const formatTaille = (octets: number): string =>
  octets >= 1_048_576
    ? `${(octets / 1_048_576).toFixed(1)} Mo`
    : `${Math.max(1, Math.round(octets / 1024))} Ko`;

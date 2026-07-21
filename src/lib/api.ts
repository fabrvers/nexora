/** Typage de la surface exposee par le preload. */
export interface DocumentLigne {
  id: number;
  sha256: string;
  nom_fichier: string;
  chemin: string;
  flux: "achat" | "vente";
  type_detecte: string;
  statut: "transmise" | "en_attente" | "a_verifier" | "bloquee" | "echec" | "ignoree";
  destinataire: string | null;
  message_id: string | null;
  motif: string | null;
  detecte_le: string;
  envoye_le: string | null;
  tentatives: number;
  taille_octets: number;
}

export interface ParametresUI {
  dossierAchats: string; dossierVentes: string;
  emailAchats: string; emailVentes: string;
  smtpHote: string; smtpPort: number; smtpUtilisateur: string;
  smtpExpediteur: string; smtpChiffrement: "starttls" | "tls" | "aucun";
  delaiStabiliteMs: number; moisDebutExercice: number;
  demarrageAutomatique: boolean; reduireDansBarre: boolean;
  configure: boolean; motDePasseDefini: boolean; manquants: string[];
}

declare global {
  interface Window {
    api: {
      documents(): Promise<DocumentLigne[]>;
      compteurs(): Promise<Record<string, number>>;
      envoyer(id: number): Promise<void>;
      ignorer(id: number): Promise<void>;
      telecharger(ids: number[]): Promise<{ ok: boolean; message: string }>;
      ouvrirDossier(id: number): Promise<void>;
      lireFichier(id: number): Promise<{ nom: string; donnees: ArrayBuffer } | null>;
      balayer(): Promise<void>;
      parametres(): Promise<ParametresUI>;
      enregistrerParametres(v: Partial<ParametresUI>, motDePasse?: string): Promise<ParametresUI>;
      choisirDossier(): Promise<string | null>;
      testerSmtp(): Promise<{ ok: boolean; message: string }>;
      surChangement(rappel: () => void): () => void;
    };
  }
}
export {};

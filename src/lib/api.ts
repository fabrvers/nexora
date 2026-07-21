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
  theme: "clair" | "sombre" | "systeme";
  demarrageAutomatique: boolean; reduireDansBarre: boolean;
  configure: boolean; motDePasseDefini: boolean; manquants: string[];
}

export type EtatMaj =
  | { phase: "inactif" }
  | { phase: "verification" }
  | { phase: "a-jour"; version: string }
  | { phase: "disponible"; version: string }
  | { phase: "telechargement"; pourcentage: number }
  | { phase: "prete"; version: string }
  | { phase: "erreur"; message: string };

declare global {
  interface Window {
    api: {
      documents(): Promise<DocumentLigne[]>;
      compteurs(): Promise<Record<string, number>>;
      envoyer(id: number): Promise<void>;
      ignorer(id: number): Promise<void>;
      supprimer(ids: number[]): Promise<{ supprimes: number; fichiersEffaces: number }>;
      supprimer(ids: number[]): Promise<{ supprimes: number; fichiersEffaces: number }>;
      telecharger(ids: number[]): Promise<{ ok: boolean; message: string }>;
      ouvrirDossier(id: number): Promise<void>;
      lireFichier(id: number): Promise<{ nom: string; donnees: ArrayBuffer } | null>;
      balayer(): Promise<void>;
      cheminDuFichier(fichier: File): string;
      choisirFichiers(): Promise<string[]>;
      deposer(flux: "achat" | "vente", chemins: string[]): Promise<{ ajoutes: number; ignores: number }>;
      version(): Promise<{ version: string; auteur: string; electron: string }>;
      majEtat(): Promise<EtatMaj>;
      majVerifier(): Promise<EtatMaj>;
      majInstaller(): Promise<void>;
      surMaj(rappel: (etat: EtatMaj) => void): () => void;
      parametres(): Promise<ParametresUI>;
      enregistrerParametres(v: Partial<ParametresUI>, motDePasse?: string): Promise<ParametresUI>;
      choisirDossier(): Promise<string | null>;
      testerSmtp(): Promise<{ ok: boolean; message: string }>;
      surNavigation(rappel: () => void): () => void;
      surChangement(rappel: () => void): () => void;
    };
  }
}
export {};

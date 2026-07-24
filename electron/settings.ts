/**
 * Parametres persistants.
 *
 * Le mot de passe SMTP est chiffre via safeStorage, qui s'appuie sur DPAPI
 * sous Windows : il n'est jamais ecrit en clair sur le disque.
 */
import { app, safeStorage } from "electron";
import fs from "node:fs";
import path from "node:path";

export interface Parametres {
  dossierAchats: string;
  dossierVentes: string;
  emailAchats: string;
  emailVentes: string;
  smtpHote: string;
  smtpPort: number;
  smtpUtilisateur: string;
  smtpExpediteur: string;
  smtpChiffrement: "starttls" | "tls" | "aucun";
  imapActif: boolean;
  imapHote: string;
  imapPort: number;
  imapUtilisateur: string;
  imapChiffrement: "tls" | "starttls";
  imapDossierAchats: string;
  imapDossierVentes: string;
  imapIntervalleMinutes: number;
  fluxVenteActif: boolean;
  delaiStabiliteMs: number;
  moisDebutExercice: number;
  theme: "clair" | "sombre" | "systeme";
  demarrageAutomatique: boolean;
  reduireDansBarre: boolean;
  configure: boolean;
}

const DEFAUTS: Parametres = {
  dossierAchats: "",
  dossierVentes: "",
  emailAchats: "",
  emailVentes: "",
  smtpHote: "",
  smtpPort: 587,
  smtpUtilisateur: "",
  smtpExpediteur: "",
  smtpChiffrement: "starttls",
  imapActif: false,
  imapHote: "",
  imapPort: 993,
  imapUtilisateur: "",
  imapChiffrement: "tls",
  imapDossierAchats: "INBOX",
  imapDossierVentes: "",
  imapIntervalleMinutes: 2,
  // Actif par defaut : une installation existante ne doit jamais cesser
  // de surveiller son dossier de ventes a la faveur d'une mise a jour.
  fluxVenteActif: true,
  delaiStabiliteMs: 2000,
  moisDebutExercice: 1,
  theme: "clair",
  demarrageAutomatique: true,
  reduireDansBarre: true,
  configure: false,
};

const fichier = () => path.join(app.getPath("userData"), "parametres.json");
const fichierSecret = () => path.join(app.getPath("userData"), "smtp.bin");
const fichierSecretImap = () => path.join(app.getPath("userData"), "imap.bin");

export function lire(): Parametres {
  try {
    const brut = JSON.parse(fs.readFileSync(fichier(), "utf8"));
    return { ...DEFAUTS, ...brut };
  } catch {
    return { ...DEFAUTS };
  }
}

export function ecrire(valeurs: Partial<Parametres>): Parametres {
  const fusion = { ...lire(), ...valeurs };
  fs.mkdirSync(path.dirname(fichier()), { recursive: true });
  fs.writeFileSync(fichier(), JSON.stringify(fusion, null, 2), "utf8");
  return fusion;
}

export function ecrireMotDePasse(motDePasse: string): void {
  if (!motDePasse) {
    fs.rmSync(fichierSecret(), { force: true });
    return;
  }
  const donnees = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(motDePasse)
    : Buffer.from(motDePasse, "utf8");
  fs.writeFileSync(fichierSecret(), donnees);
}

export function lireMotDePasse(): string {
  try {
    const donnees = fs.readFileSync(fichierSecret());
    return safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(donnees)
      : donnees.toString("utf8");
  } catch {
    return "";
  }
}

export function ecrireMotDePasseImap(motDePasse: string): void {
  if (!motDePasse) {
    fs.rmSync(fichierSecretImap(), { force: true });
    return;
  }
  const donnees = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(motDePasse)
    : Buffer.from(motDePasse, "utf8");
  fs.writeFileSync(fichierSecretImap(), donnees);
}

export function lireMotDePasseImap(): string {
  try {
    const donnees = fs.readFileSync(fichierSecretImap());
    return safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(donnees)
      : donnees.toString("utf8");
  } catch {
    return "";
  }
}

/** Reglages obligatoires manquants, pour l'assistant de premier lancement. */
export function manquants(p: Parametres = lire()): string[] {
  const requis: [keyof Parametres, string][] = [
    ["dossierAchats", "Dossier des factures d'achat"],
    ["emailAchats", "Adresse Pennylane des achats"],
    ["smtpHote", "Serveur d'envoi"],
    ["smtpExpediteur", "Adresse d'expédition"],
  ];
  // Les reglages de vente ne sont exiges que si le flux est actif.
  if (p.fluxVenteActif) {
    requis.push(
      ["dossierVentes", "Dossier des factures de vente"],
      ["emailVentes", "Adresse Pennylane des ventes"],
    );
  }
  return requis.filter(([cle]) => !p[cle]).map(([, libelle]) => libelle);
}

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
  delaiStabiliteMs: number;
  moisDebutExercice: number;
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
  delaiStabiliteMs: 2000,
  moisDebutExercice: 1,
  demarrageAutomatique: true,
  reduireDansBarre: true,
  configure: false,
};

const fichier = () => path.join(app.getPath("userData"), "parametres.json");
const fichierSecret = () => path.join(app.getPath("userData"), "smtp.bin");

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

/** Reglages obligatoires manquants, pour l'assistant de premier lancement. */
export function manquants(p: Parametres = lire()): string[] {
  const requis: [keyof Parametres, string][] = [
    ["dossierAchats", "Dossier des factures d'achat"],
    ["dossierVentes", "Dossier des factures de vente"],
    ["emailAchats", "Adresse Pennylane des achats"],
    ["emailVentes", "Adresse Pennylane des ventes"],
    ["smtpHote", "Serveur d'envoi"],
    ["smtpExpediteur", "Adresse d'expédition"],
  ];
  return requis.filter(([cle]) => !p[cle]).map(([, libelle]) => libelle);
}

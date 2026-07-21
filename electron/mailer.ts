/** Transmission d'un justificatif vers une adresse de transfert Pennylane. */
import nodemailer, { type Transporter } from "nodemailer";
import fs from "node:fs";
import path from "node:path";
import { lire, lireMotDePasse } from "./settings.js";

function transport(): Transporter {
  const p = lire();
  return nodemailer.createTransport({
    host: p.smtpHote,
    port: p.smtpPort,
    secure: p.smtpChiffrement === "tls",
    requireTLS: p.smtpChiffrement === "starttls",
    auth: p.smtpUtilisateur ? { user: p.smtpUtilisateur, pass: lireMotDePasse() } : undefined,
    connectionTimeout: 30_000,
  });
}

export async function tester(): Promise<{ ok: boolean; message: string }> {
  try {
    await transport().verify();
    return { ok: true, message: "Connexion réussie. Le serveur accepte vos identifiants." };
  } catch (erreur: any) {
    return { ok: false, message: lisible(erreur) };
  }
}

export async function envoyer(chemin: string, destinataire: string): Promise<string> {
  const p = lire();
  const info = await transport().sendMail({
    from: p.smtpExpediteur,
    to: destinataire,
    subject: path.parse(chemin).name,
    text: `Justificatif transmis automatiquement.\nFichier : ${path.basename(chemin)}\n`,
    attachments: [{ filename: path.basename(chemin), content: fs.createReadStream(chemin) }],
  });
  return info.messageId;
}

/** Traduit les erreurs SMTP courantes en phrases actionnables. */
export function lisible(erreur: any): string {
  const code = erreur?.code ?? "";
  const message = String(erreur?.message ?? erreur);

  if (code === "EAUTH")
    return "Identifiants refusés par le serveur. Sur Gmail ou Microsoft 365, un mot de passe d'application est nécessaire.";
  if (code === "ECONNREFUSED")
    return "Le serveur a refusé la connexion. Vérifiez le nom du serveur et le port.";
  if (code === "ETIMEDOUT" || code === "ECONNECTION")
    return "Le serveur n'a pas répondu. Connexion coupée, ou port bloqué par le pare-feu.";
  if (code === "EDNS" || message.includes("getaddrinfo"))
    return "Nom du serveur introuvable. Vérifiez l'orthographe de l'adresse.";
  if (code === "EMESSAGE" && message.includes("size"))
    return "Fichier trop volumineux pour le serveur d'envoi.";
  return message;
}

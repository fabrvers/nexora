/**
 * Chaine complete de detection : lecture du PDF puis classification.
 *
 * C'est le test qui aurait attrape la panne silencieuse de pdf-parse :
 * l'extraction renvoyait une chaine vide une fois l'application empaquetee,
 * et toute facture d'achat partait en « a verifier ».
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { texteDuPdf } from "../electron/pdf.ts";
import { classifier } from "../electron/classifier.ts";

const dossier = fs.mkdtempSync(path.join(os.tmpdir(), "passerelle-pdf-"));

/** Fabrique un PDF minimal mais valide, contenant une ligne de texte. */
function creerPdf(texte: string, nom: string): string {
  const flux = `BT /F1 24 Tf 72 720 Td (${texte}) Tj ET`;
  const objets = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] " +
      "/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${flux.length} >>\nstream\n${flux}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let sortie = "%PDF-1.4\n";
  const positions: number[] = [];
  objets.forEach((objet, index) => {
    positions.push(sortie.length);
    sortie += `${index + 1} 0 obj\n${objet}\nendobj\n`;
  });
  const xref = sortie.length;
  sortie += `xref\n0 ${objets.length + 1}\n0000000000 65535 f \n`;
  for (const position of positions) {
    sortie += `${String(position).padStart(10, "0")} 00000 n \n`;
  }
  sortie += `trailer\n<< /Size ${objets.length + 1} /Root 1 0 R >>\n` +
            `startxref\n${xref}\n%%EOF\n`;

  const chemin = path.join(dossier, nom);
  fs.writeFileSync(chemin, sortie, "latin1");
  return chemin;
}

test("le texte d'un PDF est bien extrait", async () => {
  const chemin = creerPdf("FACTURE N 2026-0142 - OVH SAS", "doc-3421.pdf");
  const texte = await texteDuPdf(chemin);
  assert.ok(texte.includes("FACTURE"), `texte obtenu : ${JSON.stringify(texte)}`);
});

test("une facture au nom neutre est reconnue par son contenu", async () => {
  const chemin = creerPdf("FACTURE N 2026-0142 - OVH SAS", "doc-9999.pdf");
  const resultat = classifier(path.basename(chemin), await texteDuPdf(chemin));
  assert.equal(resultat.verdict, "envoyer");
  assert.equal(resultat.type, "facture");
});

test("un bon de livraison au nom neutre est bloque par son contenu", async () => {
  const chemin = creerPdf("BON DE LIVRAISON N 42", "doc-8888.pdf");
  const resultat = classifier(path.basename(chemin), await texteDuPdf(chemin));
  assert.equal(resultat.verdict, "bloquer");
  assert.equal(resultat.type, "bon_livraison");
});

test("un fichier illisible ne fait pas planter et part en verification", async () => {
  const chemin = path.join(dossier, "corrompu.pdf");
  fs.writeFileSync(chemin, "ceci n'est pas un PDF");
  const texte = await texteDuPdf(chemin);
  assert.equal(texte, "");
  assert.equal(classifier("corrompu.pdf", texte).verdict, "verifier");
});

test("les fichiers non PDF sont ignores sans erreur", async () => {
  const chemin = path.join(dossier, "photo.jpg");
  fs.writeFileSync(chemin, "donnees");
  assert.equal(await texteDuPdf(chemin), "");
});

test("nettoyage", () => {
  fs.rmSync(dossier, { recursive: true, force: true });
});

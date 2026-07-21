import { test } from "node:test";
import assert from "node:assert/strict";
import { classifier, normaliser } from "../electron/classifier.ts";

const cas: [string, string, string, string][] = [
  // nom fichier, texte pdf, verdict attendu, libelle du cas
  ["Facture_FA-2026-0142.pdf", "FACTURE N° FA-2026-0142\nOVH SAS", "envoyer", "facture evidente"],
  ["FA2026-0001.pdf", "FACTURE\nDiagnostic Sud", "envoyer", "titre PDF seul"],
  ["BL-2026-0142.pdf", "BON DE LIVRAISON", "bloquer", "BL dans le nom"],
  ["document-3421.pdf", "BON DE LIVRAISON N°42\nExpedition du 12/07", "bloquer", "BL dans l'en-tete"],
  ["commande_fournisseur.pdf", "BON DE COMMANDE", "bloquer", "bon de commande"],
  ["Devis-toiture.pdf", "DEVIS N°128", "bloquer", "devis"],
  ["proforma_2026.pdf", "PRO FORMA", "bloquer", "proforma"],
  ["Avoir_AV-2026-003.pdf", "AVOIR\nremboursement", "envoyer", "avoir accepte"],
  ["scan0001.pdf", "", "verifier", "scan sans texte"],
  ["document-3421.pdf", "Merci de votre confiance", "verifier", "rien d'identifiable"],
  ["Facture_juillet.pdf", "FACTURE\nSuite a votre bon de commande n°42", "envoyer", "BDC en simple reference"],
  ["releve.pdf", "Recapitulatif\nvotre bon de livraison du 3 juillet", "bloquer", "BL en tete sans titre facture"],
  ["Rappel_paiement.pdf", "RELANCE", "bloquer", "relance"],
  ["Table_des_matieres.pdf", "FACTURE N°1", "envoyer", "'table' ne doit pas declencher BL"],
];

for (const [nom, texte, attendu, libelle] of cas) {
  test(libelle, () => {
    const r = classifier(nom, texte);
    assert.equal(r.verdict, attendu, `${nom} -> ${r.verdict} (${r.motif})`);
  });
}

test("normalisation des accents et separateurs", () => {
  assert.equal(normaliser("Bon_de-Livraison N°42.pdf"), "bon de livraison n°42 pdf");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  compteurs, ecrireMaintenant, inserer, majStatut, ouvrir, parEmpreinte, parId, tous,
} from "../electron/db.ts";

const dossier = path.join(os.tmpdir(), `passerelle-test-${Date.now()}`);
const fichier = path.join(dossier, "historique.json");
ouvrir(dossier);

const modele = (sha: string, statut: any = "en_attente") => ({
  sha256: sha,
  nom_fichier: `${sha}.pdf`,
  chemin: `C:/Factures/${sha}.pdf`,
  flux: "achat" as const,
  type_detecte: "facture",
  statut,
  destinataire: null,
  message_id: null,
  motif: null,
  detecte_le: new Date().toISOString(),
  envoye_le: null,
  tentatives: 0,
  taille_octets: 1024,
});

test("insertion et recherche par empreinte", () => {
  const id = inserer(modele("aaa"));
  assert.equal(id, 1);
  assert.equal(parEmpreinte("aaa")?.nom_fichier, "aaa.pdf");
  assert.equal(parEmpreinte("inconnu"), undefined);
});

test("les identifiants ne se reutilisent pas", () => {
  assert.equal(inserer(modele("bbb")), 2);
  assert.equal(inserer(modele("ccc")), 3);
});

test("mise a jour du statut", () => {
  majStatut(1, { statut: "transmise", envoye_le: "2026-07-21T10:00:00Z" });
  assert.equal(parId(1)?.statut, "transmise");
  assert.equal(parId(1)?.envoye_le, "2026-07-21T10:00:00Z");
});

test("compteurs par statut", () => {
  const c = compteurs();
  assert.equal(c.transmise, 1);
  assert.equal(c.en_attente, 2);
});

test("ordre du plus recent au plus ancien", () => {
  const liste = tous();
  assert.equal(liste.length, 3);
  assert.ok(liste[0].detecte_le >= liste[liste.length - 1].detecte_le);
});

test("ecriture atomique relisible", () => {
  ecrireMaintenant();
  const relu = JSON.parse(fs.readFileSync(fichier, "utf8"));
  assert.equal(relu.documents.length, 3);
  assert.equal(relu.prochainId, 4);
  assert.ok(!fs.existsSync(`${fichier}.tmp`), "le fichier temporaire doit avoir disparu");
  fs.rmSync(dossier, { recursive: true, force: true });
});

/**
 * Tri des pieces jointes : c'est ici que se joue l'interet de la
 * fonctionnalite, puisque Pennylane importe aujourd'hui les logos de
 * signature comme des justificatifs.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { estImageEnLigne, nomSur, trier, type PieceJointe } from "../electron/pieces-jointes.ts";

const facture: PieceJointe = {
  filename: "Facture_2026-0142.pdf",
  contentType: "application/pdf",
  contentDisposition: "attachment",
  size: 180_000,
};

test("une facture PDF jointe est retenue", () => {
  const r = trier([facture]);
  assert.equal(r.retenues.length, 1);
  assert.equal(r.rejetees.length, 0);
});

test("le logo de signature référencé par le HTML est écarté", () => {
  const logo: PieceJointe = {
    filename: "logo.png", contentType: "image/png",
    cid: "logo@societe.fr", size: 12_000,
  };
  const r = trier([facture, logo]);
  assert.equal(r.retenues.length, 1);
  assert.equal(r.rejetees[0].motif, "image en ligne dans le corps du message");
});

test("une image inline sans cid est écartée", () => {
  const banniere: PieceJointe = {
    filename: "banniere.jpg", contentType: "image/jpeg",
    contentDisposition: "inline", size: 40_000,
  };
  assert.ok(estImageEnLigne(banniere));
  assert.equal(trier([banniere]).retenues.length, 0);
});

test("une partie multipart/related est écartée", () => {
  const piece: PieceJointe = {
    filename: "image001.png", contentType: "image/png",
    related: true, size: 8_000,
  };
  assert.equal(trier([piece]).retenues.length, 0);
});

test("une image sans nom de fichier est écartée", () => {
  const piece: PieceJointe = { contentType: "image/gif", size: 1_500 };
  assert.equal(trier([piece]).retenues.length, 0);
});

test("une image volontairement jointe reste écartée : seul le PDF passe", () => {
  const photo: PieceJointe = {
    filename: "facture-scannee.jpg", contentType: "image/jpeg",
    contentDisposition: "attachment", size: 900_000,
  };
  const r = trier([photo]);
  assert.equal(r.retenues.length, 0);
  assert.equal(r.rejetees[0].motif, "format non accepté");
});

test("un PDF envoyé en octet-stream est reconnu", () => {
  const piece: PieceJointe = {
    filename: "FA-2026-88.PDF", contentType: "application/octet-stream",
    contentDisposition: "attachment", size: 95_000,
  };
  assert.equal(trier([piece]).retenues.length, 1);
});

test("un PDF minuscule est écarté", () => {
  const piece: PieceJointe = {
    filename: "vide.pdf", contentType: "application/pdf",
    contentDisposition: "attachment", size: 300,
  };
  assert.equal(trier([piece]).rejetees[0].motif, "fichier vide");
});

test("un fichier de plus de 25 Mo est écarté", () => {
  const piece: PieceJointe = {
    filename: "catalogue.pdf", contentType: "application/pdf",
    contentDisposition: "attachment", size: 40 * 1024 * 1024,
  };
  assert.equal(trier([piece]).rejetees[0].motif, "fichier trop volumineux");
});

test("cas réel : facture + logo + icônes sociales", () => {
  const pieces: PieceJointe[] = [
    facture,
    { filename: "logo.png", contentType: "image/png", cid: "a@b", size: 9_000 },
    { filename: "linkedin.gif", contentType: "image/gif", cid: "c@d", size: 900 },
    { filename: "twitter.gif", contentType: "image/gif", cid: "e@f", size: 850 },
    { filename: "signature.jpg", contentType: "image/jpeg", contentDisposition: "inline", size: 22_000 },
  ];
  const r = trier(pieces);
  assert.equal(r.retenues.length, 1, "seule la facture doit passer");
  assert.equal(r.retenues[0].filename, "Facture_2026-0142.pdf");
  assert.equal(r.rejetees.length, 4);
});

test("nom de fichier assaini", () => {
  assert.equal(nomSur({ filename: 'Facture 07/2026 <urgent>.pdf' }, "x"), "Facture 07-2026 -urgent-.pdf");
  assert.equal(nomSur({ filename: "document" }, "x"), "document.pdf");
  assert.equal(nomSur({}, "message-42"), "message-42.pdf");
});

test("un message transféré en pièce jointe est ouvert, pas rejeté", () => {
  const eml: PieceJointe = {
    filename: "Facture OVH.eml", contentType: "message/rfc822",
    contentDisposition: "attachment", size: 320_000,
  };
  const r = trier([eml]);
  assert.equal(r.aOuvrir.length, 1);
  assert.equal(r.retenues.length, 0);
  assert.equal(r.rejetees.length, 0);
});

test("un .msg Outlook est également signalé à ouvrir", () => {
  const msg: PieceJointe = {
    filename: "facture.msg", contentType: "application/octet-stream", size: 90_000,
  };
  assert.equal(trier([msg]).aOuvrir.length, 1);
});

test("transfert en pièce jointe accompagné de la signature du transféreur", () => {
  const pieces: PieceJointe[] = [
    { filename: "Message transféré.eml", contentType: "message/rfc822", size: 400_000 },
    { filename: "logo-societe.png", contentType: "image/png", cid: "sig@nous", size: 11_000 },
  ];
  const r = trier(pieces);
  assert.equal(r.aOuvrir.length, 1);
  assert.equal(r.rejetees.length, 1);
  assert.equal(r.rejetees[0].motif, "image en ligne dans le corps du message");
});

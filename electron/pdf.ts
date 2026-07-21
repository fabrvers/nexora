/**
 * Extraction du texte d'un PDF.
 *
 * pdfjs-dist est utilise directement plutot que pdf-parse : ce dernier charge
 * pdf.js par un require a chemin calcule a l'execution, que les empaqueteurs
 * ne savent pas resoudre. Une fois l'application installee il n'y a plus de
 * node_modules, l'appel echouait, et toute facture d'achat finissait en
 * « a verifier » sans le moindre message.
 *
 * Module volontairement independant d'Electron, pour rester testable.
 */
import fs from "node:fs";
import path from "node:path";

const EXTENSIONS_TEXTE = new Set([".pdf"]);

/**
 * Renvoie le texte de la premiere page, ou une chaine vide si le document
 * est illisible : un scan sans couche texte, un fichier corrompu, une image.
 * L'appelant traite la chaine vide comme « type indetermine ».
 */
export async function texteDuPdf(chemin: string, pages = 1): Promise<string> {
  if (!EXTENSIONS_TEXTE.has(path.extname(chemin).toLowerCase())) return "";

  let document: any = null;
  try {
    // La construction « legacy » est celle qui fonctionne hors navigateur.
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    document = await pdfjs.getDocument({
      data: new Uint8Array(fs.readFileSync(chemin)),
      useSystemFonts: false,
      isEvalSupported: false,
      useWorkerFetch: false,
    }).promise;

    const morceaux: string[] = [];
    const total = Math.min(pages, document.numPages);
    for (let numero = 1; numero <= total; numero++) {
      const page = await document.getPage(numero);
      const contenu = await page.getTextContent();
      morceaux.push(
        contenu.items.map((e: any) => ("str" in e ? e.str : "")).join(" "),
      );
    }
    return morceaux.join("\n").trim();
  } catch {
    return "";
  } finally {
    try {
      await document?.destroy();
    } catch {
      /* sans consequence */
    }
  }
}

import { useEffect, useState } from "react";
import type { DocumentLigne } from "../lib/api";
import { formatDate, formatTaille, LIBELLES_TYPE, STATUTS } from "../lib/statuts";

/** Panneau lateral : apercu du document et rappel de son etat. */
export function ApercuPdf({
  document: doc, onFermer,
}: {
  document: DocumentLigne | null;
  onFermer: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!doc) return;
    let revoquer: string | null = null;
    setUrl(null);
    setErreur(null);

    void window.api.lireFichier(doc.id).then((res) => {
      if (!res) {
        setErreur("Le fichier n'est plus à son emplacement d'origine.");
        return;
      }
      const type = doc.nom_fichier.toLowerCase().endsWith(".pdf")
        ? "application/pdf" : "image/*";
      revoquer = URL.createObjectURL(new Blob([res.donnees], { type }));
      setUrl(revoquer);
    });

    return () => { if (revoquer) URL.revokeObjectURL(revoquer); };
  }, [doc?.id]);

  if (!doc) return null;
  const statut = STATUTS[doc.statut];

  return (
    <aside className="flex w-[42%] min-w-[380px] flex-col border-l border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <header className="flex items-start justify-between gap-3 border-b border-zinc-200 p-4 dark:border-zinc-800">
        <div className="min-w-0">
          <p className="truncate font-mono text-sm">{doc.nom_fichier}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span className={`pastille ${statut.pastille}`}>
              <span className={`point ${statut.point}`} />
              {statut.libelle}
            </span>
            <span>{LIBELLES_TYPE[doc.type_detecte] ?? doc.type_detecte}</span>
            <span>·</span>
            <span className="tabulaire">{formatTaille(doc.taille_octets)}</span>
            <span>·</span>
            <span className="tabulaire">{formatDate(doc.envoye_le ?? doc.detecte_le)}</span>
          </div>
          {doc.motif && (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{doc.motif}</p>
          )}
        </div>
        <button
          onClick={onFermer}
          aria-label="Fermer l'aperçu"
          className="rounded p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          ✕
        </button>
      </header>

      <div className="flex-1 overflow-hidden bg-zinc-100 dark:bg-zinc-950">
        {erreur ? (
          <p className="p-6 text-sm text-zinc-500">{erreur}</p>
        ) : url ? (
          <iframe src={url} title="Aperçu du document" className="h-full w-full border-0" />
        ) : (
          <p className="p-6 text-sm text-zinc-500">Chargement…</p>
        )}
      </div>

      <footer className="flex gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800">
        <button
          onClick={() => void window.api.telecharger([doc.id])}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Télécharger
        </button>
        <button
          onClick={() => void window.api.ouvrirDossier(doc.id)}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Ouvrir le dossier
        </button>
      </footer>
    </aside>
  );
}

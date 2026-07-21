import { useEffect, useState } from "react";
import type { DocumentLigne } from "../lib/api";
import { formatDate, formatTaille, LIBELLES_TYPE, STATUTS } from "../lib/statuts";

/** Panneau latéral : le document et l'essentiel de son état. */
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
    let aRevoquer: string | null = null;
    setUrl(null);
    setErreur(null);

    void window.api.lireFichier(doc.id).then((res) => {
      if (!res) {
        setErreur("Ce fichier n'est plus à son emplacement d'origine.");
        return;
      }
      const type = doc.nom_fichier.toLowerCase().endsWith(".pdf")
        ? "application/pdf"
        : "image/png";
      aRevoquer = URL.createObjectURL(new Blob([res.donnees], { type }));
      setUrl(aRevoquer);
    });

    return () => { if (aRevoquer) URL.revokeObjectURL(aRevoquer); };
  }, [doc?.id]);

  // Échap referme le panneau.
  useEffect(() => {
    const touche = (e: KeyboardEvent) => { if (e.key === "Escape") onFermer(); };
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [onFermer]);

  if (!doc) return null;
  const statut = STATUTS[doc.statut];

  return (
    <aside className="apparition flex w-[40%] min-w-[360px] flex-col border-l border-trait bg-surface">
      <header className="border-b border-trait px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 truncate font-mono text-petit">{doc.nom_fichier}</p>
          <button onClick={onFermer} aria-label="Fermer l'aperçu" className="bouton-nu -mr-1 px-2 py-0.5">
            ✕
          </button>
        </div>

        <dl className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-micro text-doux">
          <dd className={`pastille ${statut.teinte}`}>
            <span className={`point ${statut.point}`} />
            {statut.libelle}
          </dd>
          <dd>{LIBELLES_TYPE[doc.type_detecte] ?? doc.type_detecte}</dd>
          <dd className="tabulaire font-mono">{formatTaille(doc.taille_octets)}</dd>
          <dd className="tabulaire font-mono">{formatDate(doc.envoye_le ?? doc.detecte_le)}</dd>
        </dl>

        {doc.motif && <p className="mt-2 text-petit leading-snug">{doc.motif}</p>}

        {doc.destinataire && doc.statut === "transmise" && (
          <p className="mt-1.5 truncate font-mono text-micro text-doux">
            → {doc.destinataire}
          </p>
        )}
      </header>

      <div className="min-h-0 flex-1 bg-releve">
        {erreur ? (
          <p className="p-6 text-petit text-doux">{erreur}</p>
        ) : url ? (
          <iframe src={url} title="Aperçu du document" className="h-full w-full border-0" />
        ) : (
          <p className="p-6 text-petit text-doux">Ouverture du document…</p>
        )}
      </div>

      <footer className="flex gap-1.5 border-t border-trait px-3 py-2.5">
        <button onClick={() => void window.api.telecharger([doc.id])} className="bouton-discret py-1.5 text-petit">
          Télécharger
        </button>
        <button onClick={() => void window.api.ouvrirDossier(doc.id)} className="bouton-discret py-1.5 text-petit">
          Ouvrir le dossier
        </button>
        <button
          onClick={() => { void window.api.supprimer([doc.id]); onFermer(); }}
          className="bouton-nu py-1.5 text-petit hover:bg-refus/10 hover:text-refus"
        >
          Supprimer
        </button>
        {STATUTS[doc.statut].action && (
          <button
            onClick={() => void window.api.envoyer(doc.id)}
            className="bouton-principal ml-auto py-1.5 text-petit"
          >
            {doc.statut === "echec" ? "Réessayer l'envoi" : "Envoyer quand même"}
          </button>
        )}
      </footer>
    </aside>
  );
}

import { useEffect, useMemo, useState } from "react";
import type { RowSelectionState } from "@tanstack/react-table";
import type { DocumentLigne } from "../lib/api";
import { bornes, dansPeriode, dateReference } from "../lib/periods";
import { STATUTS, STATUTS_A_TRAITER } from "../lib/statuts";
import { BarreStatuts, type FiltreStatut } from "../components/BarreStatuts";
import { FiltrePeriode, type EtatPeriode } from "../components/FiltrePeriode";
import { TableauDocuments } from "../components/TableauDocuments";
import { ApercuPdf } from "../components/ApercuPdf";
import { Bannette } from "../components/ZoneDepot";

export function Documents({
  flux, libelle, documents, moisDebutExercice, onDepot,
}: {
  flux: "achat" | "vente";
  libelle: string;
  documents: DocumentLigne[];
  moisDebutExercice: number;
  onDepot: (flux: "achat" | "vente", chemins: string[]) => void;
}) {
  const [recherche, setRecherche] = useState("");
  // Par defaut on n'affiche que ce qui attend une decision : une liste vide
  // signifie que tout est parti.
  const [statut, setStatut] = useState<FiltreStatut>("a_traiter");
  const [periode, setPeriode] = useState<EtatPeriode>({ cle: "tout" });
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [apercu, setApercu] = useState<DocumentLigne | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Changer d'onglet remet la sélection à zéro : elle ne vaut que pour un flux.
  useEffect(() => { setSelection({}); setApercu(null); }, [flux]);

  const duFlux = useMemo(
    () => documents.filter((d) => d.flux === flux),
    [documents, flux],
  );

  const compteurs = useMemo(() => {
    const total: Record<string, number> = {};
    for (const d of duFlux) total[d.statut] = (total[d.statut] ?? 0) + 1;
    return total;
  }, [duFlux]);

  const filtres = useMemo(() => {
    const b = bornes(periode.cle, {
      moisDebutExercice,
      debutPersonnalise: periode.debut ? new Date(periode.debut) : undefined,
      finPersonnalisee: periode.fin ? new Date(periode.fin) : undefined,
      moisChoisi: periode.mois,
      anneeChoisie: periode.annee,
    });
    const correspond = (s: string) =>
      statut === "tout" ||
      (statut === "a_traiter" ? STATUTS_A_TRAITER.includes(s as never) : s === statut);

    return duFlux.filter((d) => correspond(d.statut) && dansPeriode(dateReference(d), b));
  }, [duFlux, statut, periode, moisDebutExercice]);

  const selectionnes = Object.keys(selection).filter((k) => selection[k]).map(Number);
  const aTraiter = duFlux.filter((d) => STATUTS[d.statut].action);

  const annoncer = (texte: string) => {
    setMessage(texte);
    setTimeout(() => setMessage(null), 4000);
  };

  return (
    <div className="flex h-full min-h-0">
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="space-y-3 px-5 py-4">
          <Bannette flux={flux} libelle={libelle} onDepot={onDepot} />

          {aTraiter.length > 0 && statut !== "a_traiter" && (
            <button
              onClick={() => setStatut(aTraiter[0].statut)}
              className="flex w-full items-center gap-3 rounded-bloc border border-attente/30 bg-attente/8 px-4 py-2.5 text-left transition-colors duration-rapide hover:bg-attente/12"
            >
              <span className="tabulaire font-titre text-titre text-attente">
                {aTraiter.length}
              </span>
              <span className="min-w-0 flex-1 text-petit">
                <span className="font-medium">
                  {aTraiter.length > 1 ? "documents non transmis" : "document non transmis"}
                </span>
                <span className="ml-2 text-doux">{aTraiter[0].motif}</span>
              </span>
              <span className="surtitre shrink-0">Voir</span>
            </button>
          )}

          <BarreStatuts compteurs={compteurs} actif={statut} onChange={setStatut} />

          <div className="flex flex-wrap items-center gap-2">
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher un fichier, un type, un motif…"
              className="champ min-w-[240px] flex-1 py-1.5 text-petit"
            />
            <FiltrePeriode valeur={periode} onChange={setPeriode} />
            <button
              onClick={() => void window.api.balayer()}
              title="La surveillance est permanente : ce bouton ne sert qu'à forcer une vérification immédiate."
              className="bouton-nu py-1.5 text-petit"
            >
              Vérifier maintenant
            </button>
          </div>
        </div>

        {selectionnes.length > 0 && (
          <div className="flex items-center gap-3 border-y border-trait bg-releve px-5 py-2">
            <span className="tabulaire text-petit font-medium">
              {selectionnes.length} sélectionné{selectionnes.length > 1 ? "s" : ""}
            </span>
            {selectionnes.length === filtres.length && filtres.length < duFlux.length && (
              <button
                onClick={() => setSelection(Object.fromEntries(duFlux.map((d) => [d.id, true])))}
                className="text-petit text-vert underline underline-offset-2 hover:no-underline"
              >
                Sélectionner les {duFlux.length} documents de l'historique
              </button>
            )}
            <div className="ml-auto flex gap-1.5">
              <button
                onClick={async () => annoncer((await window.api.telecharger(selectionnes)).message)}
                className="bouton-principal py-1.5 text-petit"
              >
                Télécharger
              </button>
              <button
                onClick={() => selectionnes.forEach((id) => void window.api.envoyer(id))}
                className="bouton-discret py-1.5 text-petit"
              >
                Envoyer
              </button>
              <button
                onClick={async () => {
                  const r = await window.api.supprimer(selectionnes);
                  if (!r.supprimes) return;
                  setSelection({});
                  annoncer(
                    r.fichiersEffaces
                      ? `${r.supprimes} ligne(s) supprimée(s), ${r.fichiersEffaces} fichier(s) à la corbeille`
                      : `${r.supprimes} ligne(s) supprimée(s)`,
                  );
                }}
                className="bouton-nu py-1.5 text-petit hover:bg-refus/10 hover:text-refus"
              >
                Supprimer
              </button>
              <button onClick={() => setSelection({})} className="bouton-nu py-1.5 text-petit">
                Annuler
              </button>
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 border-t border-trait">
          <TableauDocuments
            messageVide={
              statut === "a_traiter"
                ? "Rien à traiter : tous les documents sont partis chez Pennylane."
                : "Aucun document ne correspond aux filtres."
            }
            documents={filtres}
            recherche={recherche}
            selection={selection}
            onSelection={setSelection}
            onOuvrir={setApercu}
            ligneActive={apercu?.id ?? null}
          />
        </div>

        <footer className="flex items-center gap-3 border-t border-trait px-5 py-1.5">
          <span className="tabulaire font-mono text-micro text-doux">
            {filtres.length} / {duFlux.length}
          </span>
          {message && <span className="text-petit text-doux">{message}</span>}
        </footer>
      </section>

      <ApercuPdf document={apercu} onFermer={() => setApercu(null)} />
    </div>
  );
}

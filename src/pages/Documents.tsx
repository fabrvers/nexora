import { useEffect, useMemo, useState } from "react";
import type { RowSelectionState } from "@tanstack/react-table";
import type { DocumentLigne } from "../lib/api";
import { bornes, dansPeriode, dateReference, type ClePeriode } from "../lib/periods";
import { STATUTS, type CleStatut } from "../lib/statuts";
import { BarreStatuts } from "../components/BarreStatuts";
import { FiltrePeriode } from "../components/FiltrePeriode";
import { TableauDocuments } from "../components/TableauDocuments";
import { ApercuPdf } from "../components/ApercuPdf";

export function Documents({ moisDebutExercice }: { moisDebutExercice: number }) {
  const [documents, setDocuments] = useState<DocumentLigne[]>([]);
  const [compteurs, setCompteurs] = useState<Record<string, number>>({});
  const [recherche, setRecherche] = useState("");
  const [statut, setStatut] = useState<CleStatut | "tout">("tout");
  const [flux, setFlux] = useState<"tout" | "achat" | "vente">("tout");
  const [periode, setPeriode] = useState<ClePeriode>("tout");
  const [debut, setDebut] = useState<string>();
  const [fin, setFin] = useState<string>();
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [apercu, setApercu] = useState<DocumentLigne | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const recharger = async () => {
    setDocuments(await window.api.documents());
    setCompteurs(await window.api.compteurs());
  };

  useEffect(() => {
    void recharger();
    return window.api.surChangement(() => void recharger());
  }, []);

  const filtres = useMemo(() => {
    const b = bornes(periode, {
      moisDebutExercice,
      debutPersonnalise: debut ? new Date(debut) : undefined,
      finPersonnalisee: fin ? new Date(fin) : undefined,
    });
    return documents.filter(
      (d) =>
        (statut === "tout" || d.statut === statut) &&
        (flux === "tout" || d.flux === flux) &&
        dansPeriode(dateReference(d), b),
    );
  }, [documents, statut, flux, periode, debut, fin, moisDebutExercice]);

  const selectionnes = Object.keys(selection).filter((k) => selection[k]).map(Number);
  const aTraiter = documents.filter((d) => STATUTS[d.statut].action);

  const telecharger = async () => {
    const res = await window.api.telecharger(selectionnes);
    setMessage(res.message);
    setTimeout(() => setMessage(null), 4000);
  };

  return (
    <div className="flex h-full">
      <section className="flex min-w-0 flex-1 flex-col">
        {aTraiter.length > 0 && (
          <div className="flex items-center justify-between gap-4 border-b border-amber-200 bg-amber-50 px-5 py-3 dark:border-amber-900 dark:bg-amber-950/40">
            <p className="text-sm text-amber-900 dark:text-amber-200">
              <strong className="tabulaire">{aTraiter.length}</strong>{" "}
              {aTraiter.length > 1
                ? "documents n'ont pas été transmis"
                : "document n'a pas été transmis"}
              {" — "}
              {aTraiter[0].motif}
              {aTraiter.length > 1 && `, et ${aTraiter.length - 1} autre(s)`}
            </p>
            <button
              onClick={() => setStatut("bloquee")}
              className="shrink-0 rounded-lg bg-amber-900 px-3 py-1.5 text-sm font-medium text-amber-50 hover:bg-amber-800 dark:bg-amber-200 dark:text-amber-950"
            >
              Voir
            </button>
          </div>
        )}

        <div className="space-y-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <BarreStatuts compteurs={compteurs} actif={statut} onChange={setStatut} />

          <div className="flex flex-wrap items-center gap-2">
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher un fichier, un type, un motif…"
              className="min-w-[260px] flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
            />
            <select
              value={flux}
              onChange={(e) => setFlux(e.target.value as any)}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <option value="tout">Achats et ventes</option>
              <option value="achat">Achats</option>
              <option value="vente">Ventes</option>
            </select>
            <FiltrePeriode
              valeur={periode}
              debut={debut}
              fin={fin}
              onChange={(v, d, f) => { setPeriode(v); setDebut(d); setFin(f); }}
            />
            <button
              onClick={() => void window.api.balayer()}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Analyser les dossiers
            </button>
          </div>

          <p className="tabulaire text-xs text-zinc-500">
            {filtres.length} document(s) affiché(s) sur {documents.length}
          </p>
        </div>

        {selectionnes.length > 0 && (
          <div className="flex items-center gap-3 border-b border-indigo-200 bg-indigo-50 px-5 py-2.5 text-sm dark:border-indigo-900 dark:bg-indigo-950/40">
            <span className="tabulaire font-medium">{selectionnes.length} sélectionné(s)</span>
            {selectionnes.length === filtres.length && filtres.length < documents.length && (
              <button
                onClick={() => setSelection(Object.fromEntries(documents.map((d) => [d.id, true])))}
                className="underline underline-offset-2 hover:no-underline"
              >
                Sélectionner les {documents.length} documents de l'historique
              </button>
            )}
            <div className="ml-auto flex gap-2">
              <button
                onClick={telecharger}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-500"
              >
                Télécharger la sélection
              </button>
              <button
                onClick={() => selectionnes.forEach((id) => void window.api.envoyer(id))}
                className="rounded-lg border border-indigo-300 px-3 py-1.5 hover:bg-white dark:border-indigo-800"
              >
                Envoyer
              </button>
              <button
                onClick={() => setSelection({})}
                className="rounded-lg px-3 py-1.5 text-zinc-600 hover:bg-white dark:text-zinc-300"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1">
          <TableauDocuments
            documents={filtres}
            recherche={recherche}
            selection={selection}
            onSelection={setSelection}
            onOuvrir={setApercu}
            ligneActive={apercu?.id ?? null}
          />
        </div>

        {message && (
          <div className="border-t border-zinc-200 bg-white px-5 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900">
            {message}
          </div>
        )}
      </section>

      <ApercuPdf document={apercu} onFermer={() => setApercu(null)} />
    </div>
  );
}

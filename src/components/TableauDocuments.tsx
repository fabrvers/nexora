import { useMemo, useState } from "react";
import {
  createColumnHelper, flexRender, getCoreRowModel, getFilteredRowModel,
  getSortedRowModel, useReactTable, type SortingState, type RowSelectionState,
} from "@tanstack/react-table";
import type { DocumentLigne } from "../lib/api";
import { formatDate, formatTaille, LIBELLES_TYPE, STATUTS } from "../lib/statuts";

const colonne = createColumnHelper<DocumentLigne>();

/** Surligne les occurrences de la recherche dans une cellule. */
function Surligne({ texte, terme }: { texte: string; terme: string }) {
  if (!terme.trim()) return <>{texte}</>;
  const morceaux = texte.split(new RegExp(`(${terme.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig"));
  return (
    <>
      {morceaux.map((m, i) =>
        m.toLowerCase() === terme.toLowerCase() ? (
          <mark key={i} className="rounded bg-indigo-100 px-0.5 text-inherit dark:bg-indigo-900">{m}</mark>
        ) : (
          <span key={i}>{m}</span>
        ),
      )}
    </>
  );
}

export function TableauDocuments({
  documents, recherche, selection, onSelection, onOuvrir, ligneActive,
}: {
  documents: DocumentLigne[];
  recherche: string;
  selection: RowSelectionState;
  onSelection: (s: RowSelectionState) => void;
  onOuvrir: (d: DocumentLigne) => void;
  ligneActive: number | null;
}) {
  const [tri, setTri] = useState<SortingState>([{ id: "detecte_le", desc: true }]);

  const colonnes = useMemo(
    () => [
      colonne.display({
        id: "selection",
        size: 40,
        header: ({ table }) => (
          <input
            type="checkbox"
            aria-label="Tout sélectionner"
            checked={table.getIsAllRowsSelected()}
            ref={(el) => { if (el) el.indeterminate = table.getIsSomeRowsSelected(); }}
            onChange={table.getToggleAllRowsSelectedHandler()}
            className="h-4 w-4 rounded border-zinc-300 accent-indigo-600"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label={`Sélectionner ${row.original.nom_fichier}`}
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 rounded border-zinc-300 accent-indigo-600"
          />
        ),
      }),
      colonne.accessor("nom_fichier", {
        header: "Fichier",
        cell: (info) => (
          <div className="min-w-0">
            <p className="truncate font-mono text-[13px]">
              <Surligne texte={info.getValue()} terme={recherche} />
            </p>
            <p className="tabulaire text-xs text-zinc-400">
              {formatTaille(info.row.original.taille_octets)}
            </p>
          </div>
        ),
      }),
      colonne.accessor("flux", {
        header: "Flux",
        cell: (info) => (info.getValue() === "achat" ? "Achat" : "Vente"),
      }),
      colonne.accessor("type_detecte", {
        header: "Type détecté",
        cell: (info) => LIBELLES_TYPE[info.getValue()] ?? info.getValue(),
      }),
      colonne.accessor((d) => d.envoye_le ?? d.detecte_le, {
        id: "detecte_le",
        header: "Date",
        cell: (info) => (
          <span className="tabulaire text-[13px]">{formatDate(info.getValue())}</span>
        ),
      }),
      colonne.accessor("statut", {
        header: "État",
        cell: (info) => {
          const s = STATUTS[info.getValue()];
          return (
            <span className={`pastille ${s.pastille}`}>
              <span className={`point ${s.point}`} />
              {s.libelle}
            </span>
          );
        },
      }),
      colonne.accessor("motif", {
        header: "Motif",
        enableSorting: false,
        cell: (info) => (
          <p className="max-w-[34ch] text-[13px] leading-snug text-zinc-600 dark:text-zinc-300">
            <Surligne texte={info.getValue() ?? ""} terme={recherche} />
          </p>
        ),
      }),
      colonne.display({
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const d = row.original;
          const rejouable = d.statut === "echec" || d.statut === "bloquee" || d.statut === "a_verifier";
          return (
            <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
              {rejouable && (
                <button
                  onClick={() => void window.api.envoyer(d.id)}
                  title={d.statut === "echec" ? "Réessayer l'envoi" : "Envoyer quand même"}
                  className="rounded px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-950"
                >
                  {d.statut === "echec" ? "Réessayer" : "Envoyer"}
                </button>
              )}
              <button
                onClick={() => void window.api.telecharger([d.id])}
                title="Télécharger"
                className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Télécharger
              </button>
            </div>
          );
        },
      }),
    ],
    [recherche],
  );

  const table = useReactTable({
    data: documents,
    columns: colonnes,
    state: { sorting: tri, rowSelection: selection, globalFilter: recherche },
    onSortingChange: setTri,
    onRowSelectionChange: (m) =>
      onSelection(typeof m === "function" ? m(selection) : m),
    getRowId: (ligne) => String(ligne.id),
    enableRowSelection: true,
    globalFilterFn: (ligne, _colId, valeur) => {
      // Recherche sur tous les champs affiches, accents ignores.
      const d = ligne.original;
      const sujet = [
        d.nom_fichier, d.flux, LIBELLES_TYPE[d.type_detecte] ?? d.type_detecte,
        STATUTS[d.statut].libelle, d.motif ?? "",
      ].join(" ").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const terme = String(valeur).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return sujet.includes(terme);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  if (!documents.length) {
    return (
      <div className="m-6 rounded-xl border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
        <p className="text-sm text-zinc-500">
          Aucun document ne correspond. Déposez une facture dans un dossier surveillé,
          ou élargissez les filtres.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-zinc-50/95 backdrop-blur dark:bg-zinc-950/95">
          {table.getHeaderGroups().map((groupe) => (
            <tr key={groupe.id} className="border-b border-zinc-200 dark:border-zinc-800">
              {groupe.headers.map((entete) => (
                <th
                  key={entete.id}
                  className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500"
                >
                  {entete.column.getCanSort() ? (
                    <button
                      onClick={entete.column.getToggleSortingHandler()}
                      className="flex items-center gap-1 hover:text-zinc-800 dark:hover:text-zinc-200"
                    >
                      {flexRender(entete.column.columnDef.header, entete.getContext())}
                      <span className="text-[10px]">
                        {{ asc: "▲", desc: "▼" }[entete.column.getIsSorted() as string] ?? ""}
                      </span>
                    </button>
                  ) : (
                    flexRender(entete.column.columnDef.header, entete.getContext())
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((ligne) => {
            const demandeAction = STATUTS[ligne.original.statut].action;
            return (
              <tr
                key={ligne.id}
                onClick={() => onOuvrir(ligne.original)}
                className={[
                  "cursor-pointer border-b border-zinc-100 transition-colors dark:border-zinc-800/60",
                  ligneActive === ligne.original.id
                    ? "bg-indigo-50 dark:bg-indigo-950/40"
                    : demandeAction
                      ? "bg-amber-50/40 hover:bg-amber-50 dark:bg-amber-950/10 dark:hover:bg-amber-950/20"
                      : "hover:bg-zinc-50 dark:hover:bg-zinc-900",
                ].join(" ")}
              >
                {ligne.getVisibleCells().map((cellule) => (
                  <td key={cellule.id} className="px-3 py-2.5 align-top">
                    {flexRender(cellule.column.columnDef.cell, cellule.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

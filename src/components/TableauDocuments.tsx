import { useMemo, useState } from "react";
import {
  createColumnHelper, flexRender, getCoreRowModel, getFilteredRowModel,
  getSortedRowModel, useReactTable, type RowSelectionState, type SortingState,
} from "@tanstack/react-table";
import type { DocumentLigne } from "../lib/api";
import { formatDate, formatTaille, LIBELLES_TYPE, STATUTS } from "../lib/statuts";

const colonne = createColumnHelper<DocumentLigne>();

const sansAccents = (texte: string) =>
  texte.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Surligne les occurrences de la recherche. */
function Surligne({ texte, terme }: { texte: string; terme: string }) {
  if (!terme.trim() || !texte) return <>{texte}</>;
  const motif = new RegExp(`(${terme.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig");
  return (
    <>
      {texte.split(motif).map((morceau, i) =>
        morceau.toLowerCase() === terme.toLowerCase() ? (
          <mark key={i} className="rounded-sm bg-vert/20 text-inherit">{morceau}</mark>
        ) : (
          <span key={i}>{morceau}</span>
        ),
      )}
    </>
  );
}

export function TableauDocuments({
  documents, recherche, selection, onSelection, onOuvrir, ligneActive, messageVide,
}: {
  documents: DocumentLigne[];
  messageVide: string;
  recherche: string;
  selection: RowSelectionState;
  onSelection: (s: RowSelectionState) => void;
  onOuvrir: (d: DocumentLigne) => void;
  ligneActive: number | null;
}) {
  const [tri, setTri] = useState<SortingState>([{ id: "date", desc: true }]);

  const colonnes = useMemo(
    () => [
      colonne.display({
        id: "selection",
        size: 36,
        header: ({ table }) => (
          <input
            type="checkbox"
            aria-label="Tout sélectionner"
            checked={table.getIsAllRowsSelected()}
            ref={(el) => { if (el) el.indeterminate = table.getIsSomeRowsSelected(); }}
            onChange={table.getToggleAllRowsSelectedHandler()}
            className="h-3.5 w-3.5 rounded border-trait accent-vert"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label={`Sélectionner ${row.original.nom_fichier}`}
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            onClick={(e) => e.stopPropagation()}
            className="h-3.5 w-3.5 rounded border-trait accent-vert"
          />
        ),
      }),
      colonne.accessor("nom_fichier", {
        header: "Fichier",
        cell: (info) => (
          <div className="min-w-0">
            <p className="truncate font-mono text-petit">
              <Surligne texte={info.getValue()} terme={recherche} />
            </p>
            <p className="tabulaire text-micro text-doux">
              {formatTaille(info.row.original.taille_octets)}
            </p>
          </div>
        ),
      }),
      colonne.accessor("type_detecte", {
        header: "Type",
        cell: (info) => (
          <span className="text-petit">
            {LIBELLES_TYPE[info.getValue()] ?? info.getValue()}
          </span>
        ),
      }),
      colonne.accessor((d) => d.envoye_le ?? d.detecte_le, {
        id: "date",
        header: "Date",
        cell: (info) => (
          <span className="tabulaire font-mono text-petit text-doux">
            {formatDate(info.getValue())}
          </span>
        ),
      }),
      colonne.accessor("statut", {
        header: "État",
        cell: (info) => {
          const s = STATUTS[info.getValue()];
          return (
            <span className={`pastille ${s.teinte}`}>
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
          <p className="max-w-[38ch] text-petit leading-snug text-doux">
            <Surligne texte={info.getValue() ?? ""} terme={recherche} />
          </p>
        ),
      }),
      colonne.display({
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const d = row.original;
          const rejouable = ["echec", "bloquee", "a_verifier"].includes(d.statut);
          return (
            <div className="flex justify-end gap-1 opacity-0 transition-opacity duration-rapide group-hover:opacity-100 focus-within:opacity-100"
                 onClick={(e) => e.stopPropagation()}>
              {rejouable && (
                <button
                  onClick={() => void window.api.envoyer(d.id)}
                  className="bouton-nu px-2 py-1 text-petit text-vert"
                >
                  {d.statut === "echec" ? "Réessayer" : "Envoyer"}
                </button>
              )}
              <button
                onClick={() => void window.api.telecharger([d.id])}
                className="bouton-nu px-2 py-1 text-petit"
              >
                Télécharger
              </button>
              <button
                onClick={() => void window.api.supprimer([d.id])}
                title="Supprimer cette ligne"
                aria-label={`Supprimer ${d.nom_fichier}`}
                className="bouton-nu px-2 py-1 text-petit hover:bg-refus/10 hover:text-refus"
              >
                Supprimer
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
    onRowSelectionChange: (m) => onSelection(typeof m === "function" ? m(selection) : m),
    getRowId: (ligne) => String(ligne.id),
    enableRowSelection: true,
    globalFilterFn: (ligne, _col, valeur) => {
      const d = ligne.original;
      const sujet = sansAccents([
        d.nom_fichier, LIBELLES_TYPE[d.type_detecte] ?? d.type_detecte,
        STATUTS[d.statut].libelle, d.motif ?? "", formatDate(d.envoye_le ?? d.detecte_le),
      ].join(" "));
      return sujet.includes(sansAccents(String(valeur)));
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  if (!documents.length) {
    return (
      <div className="flex h-full items-center justify-center p-10">
        <p className="max-w-[46ch] text-center text-petit text-doux">{messageVide}</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10 bg-papier">
          {table.getHeaderGroups().map((groupe) => (
            <tr key={groupe.id} className="border-b border-trait">
              {groupe.headers.map((entete) => (
                <th key={entete.id} className="px-3 py-2 text-left">
                  {entete.column.getCanSort() ? (
                    <button
                      onClick={entete.column.getToggleSortingHandler()}
                      className="surtitre flex items-center gap-1 hover:text-encre"
                    >
                      {flexRender(entete.column.columnDef.header, entete.getContext())}
                      <span aria-hidden className="text-[9px]">
                        {{ asc: "▲", desc: "▼" }[entete.column.getIsSorted() as string] ?? ""}
                      </span>
                    </button>
                  ) : (
                    <span className="surtitre">
                      {flexRender(entete.column.columnDef.header, entete.getContext())}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((ligne) => {
            const actionRequise = STATUTS[ligne.original.statut].action;
            const active = ligneActive === ligne.original.id;
            return (
              <tr
                key={ligne.id}
                onClick={() => onOuvrir(ligne.original)}
                className={[
                  "group cursor-pointer border-b border-trait/60 transition-colors duration-rapide",
                  active
                    ? "bg-vert/10 shadow-[inset_3px_0_0_rgb(var(--vert))]"
                    : "hover:bg-releve",
                ].join(" ")}
              >
                {ligne.getVisibleCells().map((cellule, index) => (
                  <td key={cellule.id} className="relative px-3 py-2 align-middle">
                    {/* Filet vertical : signale une ligne demandant une action,
                        sans teinter toute la rangee. */}
                    {index === 0 && actionRequise && (
                      <span className={`absolute inset-y-0 left-0 w-[3px] ${STATUTS[ligne.original.statut].point}`} />
                    )}
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

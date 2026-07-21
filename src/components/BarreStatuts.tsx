import { STATUTS, type CleStatut } from "../lib/statuts";

/**
 * Filtres par statut, avec compteurs.
 *
 * C'est la piece maitresse de la lisibilite : le nombre de documents bloques
 * est visible en permanence, sans deplier de menu.
 */
export function BarreStatuts({
  compteurs, actif, onChange,
}: {
  compteurs: Record<string, number>;
  actif: CleStatut | "tout";
  onChange: (cle: CleStatut | "tout") => void;
}) {
  const total = Object.values(compteurs).reduce((a, b) => a + b, 0);
  const ordre: CleStatut[] = ["transmise", "en_attente", "a_verifier", "bloquee", "echec", "ignoree"];

  const Bouton = ({ cle, libelle, nombre, point }: {
    cle: CleStatut | "tout"; libelle: string; nombre: number; point?: string;
  }) => {
    const selectionne = actif === cle;
    return (
      <button
        onClick={() => onChange(cle)}
        aria-pressed={selectionne}
        className={[
          "group flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
          selectionne
            ? "border-indigo-500 bg-indigo-50 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-100"
            : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700",
        ].join(" ")}
      >
        {point && <span className={`point ${point}`} />}
        <span>{libelle}</span>
        <span className="tabulaire rounded bg-zinc-100 px-1.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {nombre}
        </span>
      </button>
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Bouton cle="tout" libelle="Tous" nombre={total} />
      {ordre.map((cle) => (
        <Bouton
          key={cle}
          cle={cle}
          libelle={STATUTS[cle].libelle}
          nombre={compteurs[cle] ?? 0}
          point={STATUTS[cle].point}
        />
      ))}
    </div>
  );
}

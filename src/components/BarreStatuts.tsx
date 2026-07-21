import { ORDRE_STATUTS, STATUTS, type CleStatut } from "../lib/statuts";

/**
 * Filtres par statut, avec compteurs permanents.
 *
 * Les statuts demandant une action sont places en tete : c'est ce que
 * l'utilisateur doit voir sans chercher.
 */
export function BarreStatuts({
  compteurs, actif, onChange,
}: {
  compteurs: Record<string, number>;
  actif: CleStatut | "tout";
  onChange: (cle: CleStatut | "tout") => void;
}) {
  const total = Object.values(compteurs).reduce((a, b) => a + b, 0);

  const Onglet = ({ cle, libelle, nombre, point }: {
    cle: CleStatut | "tout"; libelle: string; nombre: number; point?: string;
  }) => {
    const choisi = actif === cle;
    const vide = nombre === 0 && cle !== "tout";
    return (
      <button
        onClick={() => onChange(cle)}
        aria-pressed={choisi}
        disabled={vide}
        className={[
          "flex items-center gap-2 rounded-bloc border px-2.5 py-1.5 text-petit",
          "transition-colors duration-rapide",
          choisi
            ? "border-vert bg-vert/8 text-encre"
            : "border-transparent text-doux hover:bg-releve hover:text-encre",
          vide && "opacity-40 hover:bg-transparent",
        ].filter(Boolean).join(" ")}
      >
        {point && <span className={`point ${point}`} />}
        <span>{libelle}</span>
        <span className="tabulaire font-mono text-micro">{nombre}</span>
      </button>
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Onglet cle="tout" libelle="Tous" nombre={total} />
      <span className="mx-1 h-4 w-px bg-trait" />
      {ORDRE_STATUTS.map((cle) => (
        <Onglet
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

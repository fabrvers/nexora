import { ORDRE_STATUTS, STATUTS, STATUTS_A_TRAITER, type CleStatut } from "../lib/statuts";

export type FiltreStatut = CleStatut | "tout" | "a_traiter";

/**
 * Filtres par statut, avec compteurs permanents.
 *
 * « À traiter » est en tete et selectionne par defaut : la liste ne montre
 * alors que ce qui attend une decision. Une liste vide veut dire que tout
 * est parti chez Pennylane.
 */
export function BarreStatuts({
  compteurs, actif, onChange,
}: {
  compteurs: Record<string, number>;
  actif: FiltreStatut;
  onChange: (cle: FiltreStatut) => void;
}) {
  const total = Object.values(compteurs).reduce((a, b) => a + b, 0);
  const aTraiter = STATUTS_A_TRAITER.reduce((n, cle) => n + (compteurs[cle] ?? 0), 0);

  const Onglet = ({ cle, libelle, nombre, point, fort }: {
    cle: FiltreStatut; libelle: string; nombre: number; point?: string; fort?: boolean;
  }) => {
    const choisi = actif === cle;
    const vide = nombre === 0 && cle !== "tout" && cle !== "a_traiter";
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
        <span className={fort ? "font-medium" : undefined}>{libelle}</span>
        <span
          className={[
            "tabulaire font-mono text-micro",
            fort && nombre > 0 ? "rounded-bloc bg-attente/15 px-1.5 text-attente" : "",
          ].join(" ")}
        >
          {nombre}
        </span>
      </button>
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Onglet cle="a_traiter" libelle="À traiter" nombre={aTraiter} fort />
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

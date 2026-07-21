import { useState } from "react";
import { LIBELLES_PERIODE, type ClePeriode } from "../lib/periods";

const CHOIX: ClePeriode[] = [
  "tout", "mois_courant", "mois_precedent", "annee_courante", "annee_precedente",
  "semestre_1", "semestre_2", "exercice_courant", "personnalisee",
];

export function FiltrePeriode({
  valeur, debut, fin, onChange,
}: {
  valeur: ClePeriode;
  debut?: string;
  fin?: string;
  onChange: (v: ClePeriode, debut?: string, fin?: string) => void;
}) {
  const [ouvert, setOuvert] = useState(valeur === "personnalisee");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={valeur}
        onChange={(e) => {
          const v = e.target.value as ClePeriode;
          setOuvert(v === "personnalisee");
          onChange(v, debut, fin);
        }}
        className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        {CHOIX.map((c) => (
          <option key={c} value={c}>{LIBELLES_PERIODE[c]}</option>
        ))}
      </select>

      {ouvert && (
        <div className="flex items-center gap-2 text-sm">
          <input
            type="date" value={debut ?? ""}
            onChange={(e) => onChange("personnalisee", e.target.value, fin)}
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 dark:border-zinc-800 dark:bg-zinc-900"
          />
          <span className="text-zinc-400">au</span>
          <input
            type="date" value={fin ?? ""}
            onChange={(e) => onChange("personnalisee", debut, e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 dark:border-zinc-800 dark:bg-zinc-900"
          />
        </div>
      )}
    </div>
  );
}

import { LIBELLES_PERIODE, type ClePeriode } from "../lib/periods";

/**
 * Filtre de période.
 *
 * Les entrées suivies de points de suspension ouvrent un second champ :
 * un mois précis, une année précise, ou deux dates. Les autres s'appliquent
 * immédiatement.
 */
const GROUPES: { titre: string; choix: ClePeriode[] }[] = [
  { titre: "Mois", choix: ["mois_courant", "mois_precedent", "mois_choisi"] },
  { titre: "Année", choix: ["annee_courante", "annee_precedente", "annee_choisie"] },
  { titre: "Semestre", choix: ["semestre_1", "semestre_2"] },
  { titre: "Comptabilité", choix: ["exercice_courant", "personnalisee"] },
];

export interface EtatPeriode {
  cle: ClePeriode;
  debut?: string;
  fin?: string;
  mois?: string;
  annee?: number;
}

export function FiltrePeriode({
  valeur, onChange,
}: {
  valeur: EtatPeriode;
  onChange: (v: EtatPeriode) => void;
}) {
  const anneeCourante = new Date().getFullYear();
  const annees = Array.from({ length: 8 }, (_, i) => anneeCourante - i);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={valeur.cle}
        onChange={(e) => {
          const cle = e.target.value as ClePeriode;
          onChange({
            ...valeur,
            cle,
            // Valeurs par defaut raisonnables pour eviter un filtre vide.
            mois: cle === "mois_choisi" && !valeur.mois
              ? new Date().toISOString().slice(0, 7) : valeur.mois,
            annee: cle === "annee_choisie" && !valeur.annee ? anneeCourante : valeur.annee,
          });
        }}
        className="champ w-auto py-1.5 text-petit"
        aria-label="Période"
      >
        <option value="tout">{LIBELLES_PERIODE.tout}</option>
        {GROUPES.map(({ titre, choix }) => (
          <optgroup key={titre} label={titre}>
            {choix.map((c) => (
              <option key={c} value={c}>{LIBELLES_PERIODE[c]}</option>
            ))}
          </optgroup>
        ))}
      </select>

      {valeur.cle === "mois_choisi" && (
        <input
          type="month" value={valeur.mois ?? ""} aria-label="Mois"
          onChange={(e) => onChange({ ...valeur, mois: e.target.value })}
          className="champ tabulaire w-auto py-1.5 text-petit"
        />
      )}

      {valeur.cle === "annee_choisie" && (
        <select
          value={valeur.annee ?? anneeCourante} aria-label="Année"
          onChange={(e) => onChange({ ...valeur, annee: Number(e.target.value) })}
          className="champ tabulaire w-auto py-1.5 text-petit"
        >
          {annees.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      )}

      {valeur.cle === "personnalisee" && (
        <div className="flex items-center gap-1.5">
          <input
            type="date" value={valeur.debut ?? ""} aria-label="Début de période"
            onChange={(e) => onChange({ ...valeur, debut: e.target.value })}
            className="champ tabulaire w-auto py-1.5 text-petit"
          />
          <span className="text-petit text-doux">au</span>
          <input
            type="date" value={valeur.fin ?? ""} aria-label="Fin de période"
            onChange={(e) => onChange({ ...valeur, fin: e.target.value })}
            className="champ tabulaire w-auto py-1.5 text-petit"
          />
        </div>
      )}
    </div>
  );
}

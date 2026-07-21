/**
 * Calcul des bornes de periode pour le filtre de la liste.
 *
 * Le filtre porte sur la date d'envoi ; pour un document jamais transmis,
 * sur sa date de detection. La comparaison se fait sur des horodatages ISO.
 */

export type ClePeriode =
  | "tout"
  | "mois_courant" | "mois_precedent"
  | "annee_courante" | "annee_precedente"
  | "semestre_1" | "semestre_2"
  | "exercice_courant"
  | "personnalisee";

export interface Bornes {
  debut: Date;
  /** Exclusive : simplifie les comparaisons de fin de mois. */
  fin: Date;
}

export interface OptionsPeriode {
  /** Mois de debut de l'exercice, 1 = janvier. */
  moisDebutExercice: number;
  /** Injectable pour les tests. */
  maintenant?: Date;
  /** Bornes saisies pour la periode personnalisee. */
  debutPersonnalise?: Date;
  finPersonnalisee?: Date;
}

const jour = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function bornes(cle: ClePeriode, options: OptionsPeriode): Bornes | null {
  const maintenant = options.maintenant ?? new Date();
  const annee = maintenant.getFullYear();
  const mois = maintenant.getMonth();

  switch (cle) {
    case "tout":
      return null;

    case "mois_courant":
      return { debut: new Date(annee, mois, 1), fin: new Date(annee, mois + 1, 1) };

    case "mois_precedent":
      return { debut: new Date(annee, mois - 1, 1), fin: new Date(annee, mois, 1) };

    case "annee_courante":
      return { debut: new Date(annee, 0, 1), fin: new Date(annee + 1, 0, 1) };

    case "annee_precedente":
      return { debut: new Date(annee - 1, 0, 1), fin: new Date(annee, 0, 1) };

    case "semestre_1":
      return { debut: new Date(annee, 0, 1), fin: new Date(annee, 6, 1) };

    case "semestre_2":
      return { debut: new Date(annee, 6, 1), fin: new Date(annee + 1, 0, 1) };

    case "exercice_courant": {
      // Exercice a cheval : si le mois de debut n'est pas encore atteint
      // cette annee, l'exercice courant a commence l'annee derniere.
      const decalage = options.moisDebutExercice - 1;
      const anneeDebut = mois >= decalage ? annee : annee - 1;
      return {
        debut: new Date(anneeDebut, decalage, 1),
        fin: new Date(anneeDebut + 1, decalage, 1),
      };
    }

    case "personnalisee": {
      if (!options.debutPersonnalise || !options.finPersonnalisee) return null;
      const fin = jour(options.finPersonnalisee);
      fin.setDate(fin.getDate() + 1); // borne de fin incluse pour l'utilisateur
      return { debut: jour(options.debutPersonnalise), fin };
    }
  }
}

/** Date de reference d'un document : envoi si connu, detection sinon. */
export function dateReference(doc: { envoye_le?: string | null; detecte_le: string }): Date {
  return new Date(doc.envoye_le ?? doc.detecte_le);
}

export function dansPeriode(date: Date, b: Bornes | null): boolean {
  if (!b) return true;
  return date >= b.debut && date < b.fin;
}

export const LIBELLES_PERIODE: Record<ClePeriode, string> = {
  tout: "Toute la période",
  mois_courant: "Ce mois-ci",
  mois_precedent: "Mois précédent",
  annee_courante: "Cette année",
  annee_precedente: "Année précédente",
  semestre_1: "1er semestre",
  semestre_2: "2nd semestre",
  exercice_courant: "Exercice courant",
  personnalisee: "Période personnalisée",
};

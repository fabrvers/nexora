import { useEffect, useState } from "react";

/**
 * Depot de fichiers par glisser-deposer.
 *
 * Deux surfaces complementaires :
 *  - une bannette permanente dans l'onglet courant ;
 *  - au survol de la fenetre avec des fichiers, un voile qui se scinde en
 *    deux moities, Achats et Ventes. C'est l'endroit du relachement qui
 *    decide de la destination, ce qui evite l'erreur la plus couteuse :
 *    une facture de vente rangee dans les achats.
 */

const FORMATS = "Fichiers PDF uniquement";

function contientDesFichiers(evenement: DragEvent | React.DragEvent): boolean {
  return Array.from(evenement.dataTransfer?.types ?? []).includes("Files");
}

async function cheminsDepuis(transfert: DataTransfer): Promise<string[]> {
  return Array.from(transfert.files)
    .map((fichier) => window.api.cheminDuFichier(fichier))
    .filter(Boolean);
}

/** Bannette affichee en permanence dans l'onglet courant. */
export function Bannette({
  flux, libelle, onDepot,
}: {
  flux: "achat" | "vente";
  libelle: string;
  onDepot: (flux: "achat" | "vente", chemins: string[]) => void;
}) {
  const [survol, setSurvol] = useState(false);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setSurvol(true); }}
      onDragLeave={() => setSurvol(false)}
      onDrop={async (e) => {
        e.preventDefault();
        setSurvol(false);
        onDepot(flux, await cheminsDepuis(e.dataTransfer));
      }}
      className={[
        "flex items-center justify-between gap-4 rounded-bloc border border-dashed px-4 py-3",
        "transition-colors duration-rapide",
        survol ? "border-vert bg-vert/5" : "border-trait bg-surface",
      ].join(" ")}
    >
      <div className="min-w-0">
        <p className="text-base font-medium">
          Déposez vos {libelle.toLowerCase()} ici
        </p>
        <p className="text-petit text-doux">
          {FORMATS} — copiés dans le dossier surveillé, puis transmis aussitôt.
        </p>
      </div>
      <button
        onClick={async () => {
          const chemins = await window.api.choisirFichiers();
          if (chemins.length) onDepot(flux, chemins);
        }}
        className="bouton-discret shrink-0"
      >
        Parcourir…
      </button>
    </div>
  );
}

/** Voile plein écran, scindé par flux, actif pendant un glisser. */
export function VoileDepot({
  onDepot,
}: {
  onDepot: (flux: "achat" | "vente", chemins: string[]) => void;
}) {
  const [actif, setActif] = useState(false);
  const [cote, setCote] = useState<"achat" | "vente" | null>(null);

  useEffect(() => {
    let compteur = 0;

    const entree = (e: DragEvent) => {
      if (!contientDesFichiers(e)) return;
      compteur += 1;
      setActif(true);
    };
    const sortie = () => {
      compteur = Math.max(0, compteur - 1);
      if (compteur === 0) { setActif(false); setCote(null); }
    };
    const survol = (e: DragEvent) => { if (contientDesFichiers(e)) e.preventDefault(); };
    const relacher = () => { compteur = 0; setActif(false); setCote(null); };

    window.addEventListener("dragenter", entree);
    window.addEventListener("dragleave", sortie);
    window.addEventListener("dragover", survol);
    window.addEventListener("drop", relacher);
    return () => {
      window.removeEventListener("dragenter", entree);
      window.removeEventListener("dragleave", sortie);
      window.removeEventListener("dragover", survol);
      window.removeEventListener("drop", relacher);
    };
  }, []);

  if (!actif) return null;

  const Moitie = ({ flux, libelle, aide }: {
    flux: "achat" | "vente"; libelle: string; aide: string;
  }) => (
    <div
      onDragOver={(e) => { e.preventDefault(); setCote(flux); }}
      onDrop={async (e) => {
        e.preventDefault();
        onDepot(flux, await cheminsDepuis(e.dataTransfer));
      }}
      className={[
        "flex flex-1 flex-col items-center justify-center gap-2 border-2 border-dashed",
        "transition-colors duration-rapide",
        cote === flux
          ? "border-vert bg-vert/10"
          : "border-trait bg-surface/60",
      ].join(" ")}
    >
      <span className="surtitre">{aide}</span>
      <span className="font-titre text-chiffre">{libelle}</span>
    </div>
  );

  return (
    <div className="apparition fixed inset-0 z-50 flex gap-3 bg-papier/95 p-3 backdrop-blur-sm">
      <Moitie flux="achat" libelle="Achats" aide="Relâchez à gauche" />
      <Moitie flux="vente" libelle="Ventes" aide="Relâchez à droite" />
    </div>
  );
}

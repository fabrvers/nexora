import { useEffect, useRef, useState } from "react";

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

function cheminsDepuis(transfert: DataTransfer): string[] {
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
      onDrop={(e) => {
        e.preventDefault();
        setSurvol(false);
        onDepot(flux, cheminsDepuis(e.dataTransfer));
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

/**
 * Voile plein ecran, actif pendant un glisser.
 *
 * La fermeture ne repose pas sur un comptage de dragenter/dragleave : ce
 * comptage se desynchronise des qu'un glisser est abandonne hors de la
 * fenetre, et le voile restait alors affiche. On surveille plutot la
 * fraicheur du dernier dragover : sans nouvel evenement pendant un court
 * instant, le glisser est termine, quelle qu'en soit la raison.
 */
export function VoileDepot({
  onDepot, venteActive,
}: {
  onDepot: (flux: "achat" | "vente", chemins: string[]) => void;
  venteActive: boolean;
}) {
  const [actif, setActif] = useState(false);
  const [cote, setCote] = useState<"achat" | "vente" | null>(null);
  const dernierSurvol = useRef(0);

  useEffect(() => {
    const DELAI_FERMETURE = 220;

    const survol = (e: DragEvent) => {
      if (!contientDesFichiers(e)) return;
      e.preventDefault();
      dernierSurvol.current = Date.now();
      setActif(true);
    };

    const fermer = () => { setActif(false); setCote(null); };

    const echappe = (e: KeyboardEvent) => { if (e.key === "Escape") fermer(); };

    // Un glisser abandonne n'emet plus de dragover : la surveillance de
    // fraicheur ferme le voile sans dependre d'un evenement de fin.
    const veille = setInterval(() => {
      if (dernierSurvol.current && Date.now() - dernierSurvol.current > DELAI_FERMETURE) {
        dernierSurvol.current = 0;
        fermer();
      }
    }, 100);

    window.addEventListener("dragover", survol);
    window.addEventListener("drop", fermer);
    window.addEventListener("dragend", fermer);
    window.addEventListener("keydown", echappe);
    // Sortir de la fenetre par le bord interrompt aussi le glisser.
    document.addEventListener("mouseleave", fermer);

    return () => {
      clearInterval(veille);
      window.removeEventListener("dragover", survol);
      window.removeEventListener("drop", fermer);
      window.removeEventListener("dragend", fermer);
      window.removeEventListener("keydown", echappe);
      document.removeEventListener("mouseleave", fermer);
    };
  }, []);

  if (!actif) return null;

  const Moitie = ({ flux, libelle, aide }: {
    flux: "achat" | "vente"; libelle: string; aide: string;
  }) => (
    <div
      onDragOver={(e) => { e.preventDefault(); setCote(flux); }}
      onDrop={(e) => {
        e.preventDefault();
        setActif(false);
        setCote(null);
        onDepot(flux, cheminsDepuis(e.dataTransfer));
      }}
      className={[
        "flex flex-1 flex-col items-center justify-center gap-2 border-2 border-dashed",
        "transition-colors duration-rapide",
        cote === flux ? "border-vert bg-vert/10" : "border-trait bg-surface/60",
      ].join(" ")}
    >
      <span className="surtitre">{aide}</span>
      <span className="font-titre text-chiffre">{libelle}</span>
    </div>
  );

  return (
    <div className="apparition fixed inset-0 z-50 flex gap-3 bg-papier/95 p-3 backdrop-blur-sm">
      {venteActive ? (
        <>
          <Moitie flux="achat" libelle="Achats" aide="Relâchez à gauche" />
          <Moitie flux="vente" libelle="Ventes" aide="Relâchez à droite" />
        </>
      ) : (
        // Flux vente desactive : une seule cible, sur toute la largeur.
        <Moitie flux="achat" libelle="Factures d'achat" aide="Relâchez pour déposer" />
      )}
    </div>
  );
}

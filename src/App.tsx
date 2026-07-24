import { useCallback, useEffect, useState } from "react";
import type { DocumentLigne, ParametresUI } from "./lib/api";
import { appliquerTheme } from "./lib/theme";
import { STATUTS } from "./lib/statuts";
import { Documents } from "./pages/Documents";
import { Parametres } from "./pages/Parametres";
import { VoileDepot } from "./components/ZoneDepot";

type Vue = "achat" | "vente" | "parametres";

export default function App() {
  const [vue, setVue] = useState<Vue>("achat");
  const [parametres, setParametres] = useState<ParametresUI | null>(null);
  const [documents, setDocuments] = useState<DocumentLigne[]>([]);
  const [version, setVersion] = useState<string>("");

  const recharger = useCallback(async () => {
    setDocuments(await window.api.documents());
  }, []);

  useEffect(() => {
    void recharger();
    return window.api.surChangement(() => void recharger());
  }, [recharger]);

  useEffect(() => window.api.surNavigation(() => setVue("parametres")), []);
  useEffect(() => { void window.api.version().then((v) => setVersion(v.version)); }, []);

  useEffect(() => {
    void window.api.parametres().then((p) => {
      setParametres(p);
      if (p.manquants.length) setVue("parametres");
    });
  }, []);

  useEffect(() => appliquerTheme(parametres?.theme ?? "clair"), [parametres?.theme]);

  // Desactiver le flux vente alors qu'on le consulte doit ramener aux achats.
  useEffect(() => {
    if (parametres && !parametres.fluxVenteActif && vue === "vente") setVue("achat");
  }, [parametres?.fluxVenteActif, vue]);

  const deposer = useCallback(async (flux: "achat" | "vente", chemins: string[]) => {
    if (!chemins.length) return;
    await window.api.deposer(flux, chemins);
    setVue(flux);
  }, []);

  const aTraiter = (flux: "achat" | "vente") =>
    documents.filter((d) => d.flux === flux && STATUTS[d.statut].action).length;

  const Onglet = ({ cle, libelle }: { cle: Vue; libelle: string }) => {
    const choisi = vue === cle;
    const alertes = cle === "parametres" ? 0 : aTraiter(cle);
    return (
      <button
        onClick={() => setVue(cle)}
        aria-current={choisi ? "page" : undefined}
        className={[
          "relative flex items-center gap-2 px-1 pb-3 pt-1 text-base transition-colors duration-rapide",
          choisi ? "text-white" : "text-white/60 hover:text-white/90",
        ].join(" ")}
      >
        {libelle}
        {alertes > 0 && (
          <span className="tabulaire rounded-bloc bg-white/15 px-1.5 py-0.5 font-mono text-micro">
            {alertes}
          </span>
        )}
        {choisi && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-vert" />}
      </button>
    );
  };

  // Tant que les parametres ne sont pas charges, on suppose le flux actif :
  // masquer puis reafficher l'onglet serait plus deroutant que l'inverse.
  const venteActive = parametres?.fluxVenteActif ?? true;
  const incomplet = parametres && parametres.manquants.length > 0;

  return (
    <div className="flex h-full flex-col">
      {/* Bandeau marine repris du logo : il ancre l'application et separe
          nettement la navigation du plan de travail. */}
      <header className="flex items-end gap-6 bg-marine px-5 pt-3 text-white">
        <div className="flex items-center gap-2.5 pb-2.5">
          <img src="./icone.png" alt="" className="h-6 w-6 rounded-[3px]" />
          <p className="font-titre text-titre tracking-tight">Nexora</p>
          {version && (
            <span className="tabulaire font-mono text-micro text-white/40">v{version}</span>
          )}
        </div>

        <nav className="flex items-end gap-5">
          <Onglet cle="achat" libelle="Factures d'achat" />
          {venteActive && <Onglet cle="vente" libelle="Factures de vente" />}
        </nav>

        <div className="ml-auto flex items-center gap-2 pb-2.5">
          {incomplet && vue !== "parametres" && (
            <button
              onClick={() => setVue("parametres")}
              className="rounded-bloc bg-attente/20 px-2.5 py-1 text-petit text-attente"
            >
              Surveillance à l'arrêt — configuration incomplète
            </button>
          )}
          <button
            onClick={() => setVue("parametres")}
            aria-current={vue === "parametres" ? "page" : undefined}
            className={[
              "rounded-bloc px-2.5 py-1 text-petit transition-colors duration-rapide",
              vue === "parametres"
                ? "bg-white/15 text-white"
                : "text-white/60 hover:bg-white/10 hover:text-white",
            ].join(" ")}
          >
            Paramètres
          </button>
        </div>
      </header>

      <main className="min-h-0 flex-1">
        {vue === "parametres" ? (
          <Parametres onEnregistre={setParametres} />
        ) : (
          <Documents
            key={vue}
            flux={vue}
            libelle={vue === "achat" ? "Factures d'achat" : "Factures de vente"}
            documents={documents}
            moisDebutExercice={parametres?.moisDebutExercice ?? 1}
            onDepot={deposer}
          />
        )}
      </main>

      {!incomplet && <VoileDepot onDepot={deposer} venteActive={venteActive} />}
    </div>
  );
}

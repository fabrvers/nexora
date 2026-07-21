import { useEffect, useState } from "react";
import type { ParametresUI } from "./lib/api";
import { Documents } from "./pages/Documents";
import { Parametres } from "./pages/Parametres";

export default function App() {
  const [vue, setVue] = useState<"documents" | "parametres">("documents");
  const [parametres, setParametres] = useState<ParametresUI | null>(null);

  useEffect(() => {
    void window.api.parametres().then((p) => {
      setParametres(p);
      // Premiere ouverture : on emmene directement l'utilisateur au bon endroit.
      if (p.manquants.length) setVue("parametres");
    });
  }, []);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-6 border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
        <h1 className="text-sm font-semibold">Passerelle Pennylane</h1>
        <nav className="flex gap-1">
          {([["documents", "Documents"], ["parametres", "Paramètres"]] as const).map(
            ([cle, libelle]) => (
              <button
                key={cle}
                onClick={() => setVue(cle)}
                aria-current={vue === cle}
                className={[
                  "rounded-lg px-3 py-1.5 text-sm transition-colors",
                  vue === cle
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
                ].join(" ")}
              >
                {libelle}
              </button>
            ),
          )}
        </nav>
        {parametres && parametres.manquants.length > 0 && vue === "documents" && (
          <button
            onClick={() => setVue("parametres")}
            className="ml-auto rounded-lg bg-amber-100 px-3 py-1.5 text-sm text-amber-900 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-200"
          >
            Configuration incomplète — la surveillance est à l'arrêt
          </button>
        )}
      </header>

      <main className="min-h-0 flex-1 overflow-hidden">
        {vue === "documents" ? (
          <Documents moisDebutExercice={parametres?.moisDebutExercice ?? 1} />
        ) : (
          <div className="h-full overflow-auto">
            <Parametres onEnregistre={setParametres} />
          </div>
        )}
      </main>
    </div>
  );
}

import { useEffect, useState } from "react";
import type { ParametresUI } from "../lib/api";

const MOIS = ["Janvier","Février","Mars","Avril","Mai","Juin",
              "Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

function Champ({ label, aide, children }: {
  label: string; aide?: string; children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {aide && <span className="mt-1 block text-xs text-zinc-500">{aide}</span>}
    </label>
  );
}

const champClasses =
  "mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900";

export function Parametres({ onEnregistre }: { onEnregistre: (p: ParametresUI) => void }) {
  const [p, setP] = useState<ParametresUI | null>(null);
  const [motDePasse, setMotDePasse] = useState("");
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);
  const [enregistre, setEnregistre] = useState(false);

  useEffect(() => { void window.api.parametres().then(setP); }, []);
  if (!p) return null;

  const set = (champs: Partial<ParametresUI>) => setP({ ...p, ...champs });

  const choisir = async (cle: "dossierAchats" | "dossierVentes") => {
    const dossier = await window.api.choisirDossier();
    if (dossier) set({ [cle]: dossier } as any);
  };

  const enregistrer = async () => {
    const maj = await window.api.enregistrerParametres(p, motDePasse || undefined);
    setP(maj);
    setMotDePasse("");
    onEnregistre(maj);
    setEnregistre(true);
    setTimeout(() => setEnregistre(false), 3000);
  };

  /** Avertit si l'adresse ne correspond pas au domaine attendu du flux. */
  const alerteDomaine = (adresse: string, attendu: string, flux: string) =>
    adresse && !adresse.endsWith(attendu)
      ? `Cette adresse ne se termine pas par ${attendu} : les factures ${flux} risquent d'arriver dans le mauvais onglet.`
      : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Dossiers surveillés
        </h2>
        {([
          ["dossierAchats", "Dossier des factures d'achat"],
          ["dossierVentes", "Dossier des factures de vente"],
        ] as const).map(([cle, label]) => (
          <Champ key={cle} label={label}>
            <div className="mt-1.5 flex gap-2">
              <input
                readOnly value={p[cle]}
                placeholder="Aucun dossier sélectionné"
                className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm dark:border-zinc-800 dark:bg-zinc-900"
              />
              <button
                onClick={() => void choisir(cle)}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Parcourir…
              </button>
            </div>
          </Champ>
        ))}
        {p.dossierAchats && p.dossierAchats === p.dossierVentes && (
          <p className="text-sm text-red-600">
            Les deux dossiers sont identiques : les ventes partiraient vers les achats.
          </p>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Adresses Pennylane
        </h2>
        <p className="text-sm text-zinc-500">
          À activer dans Pennylane : Paramètres Entreprise → Transmission factures → Adresses e-mail.
        </p>
        <Champ
          label="Adresse pour les achats"
          aide={alerteDomaine(p.emailAchats, "@suppliers.pennylane.com", "d'achat")}
        >
          <input
            value={p.emailAchats} onChange={(e) => set({ emailAchats: e.target.value })}
            placeholder="entreprise-xxxxxxxx@suppliers.pennylane.com"
            className={`${champClasses} font-mono`}
          />
        </Champ>
        <Champ
          label="Adresse pour les ventes"
          aide={alerteDomaine(p.emailVentes, "@customers.pennylane.com", "de vente")}
        >
          <input
            value={p.emailVentes} onChange={(e) => set({ emailVentes: e.target.value })}
            placeholder="entreprise-xxxxxxxx@customers.pennylane.com"
            className={`${champClasses} font-mono`}
          />
        </Champ>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Serveur d'envoi
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Champ label="Serveur SMTP">
              <input value={p.smtpHote} onChange={(e) => set({ smtpHote: e.target.value })}
                placeholder="smtp.votredomaine.fr" className={champClasses} />
            </Champ>
          </div>
          <Champ label="Port">
            <input type="number" value={p.smtpPort}
              onChange={(e) => set({ smtpPort: Number(e.target.value) })}
              className={`${champClasses} tabulaire`} />
          </Champ>
        </div>
        <Champ label="Identifiant">
          <input value={p.smtpUtilisateur} onChange={(e) => set({ smtpUtilisateur: e.target.value })}
            className={champClasses} />
        </Champ>
        <Champ
          label="Mot de passe"
          aide={
            p.motDePasseDefini
              ? "Un mot de passe est enregistré. Laissez vide pour le conserver."
              : "Sur Gmail ou Microsoft 365, utilisez un mot de passe d'application."
          }
        >
          <input type="password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)}
            placeholder={p.motDePasseDefini ? "••••••••" : ""} className={champClasses} />
        </Champ>
        <Champ label="Adresse d'expédition">
          <input value={p.smtpExpediteur} onChange={(e) => set({ smtpExpediteur: e.target.value })}
            className={champClasses} />
        </Champ>
        <Champ label="Chiffrement">
          <select value={p.smtpChiffrement}
            onChange={(e) => set({ smtpChiffrement: e.target.value as any })}
            className={champClasses}>
            <option value="starttls">STARTTLS (port 587)</option>
            <option value="tls">TLS implicite (port 465)</option>
            <option value="aucun">Aucun</option>
          </select>
        </Champ>

        <div className="flex items-center gap-3">
          <button
            onClick={async () => setTest(await window.api.testerSmtp())}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Tester la connexion
          </button>
          {test && (
            <p className={`text-sm ${test.ok ? "text-emerald-600" : "text-red-600"}`}>
              {test.message}
            </p>
          )}
        </div>
        <p className="text-xs text-zinc-500">
          Enregistrez avant de tester : le test utilise les valeurs déjà sauvegardées.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Comportement
        </h2>
        <Champ label="Premier mois de l'exercice comptable"
               aide="Sert au filtre « Exercice courant » de la liste.">
          <select value={p.moisDebutExercice}
            onChange={(e) => set({ moisDebutExercice: Number(e.target.value) })}
            className={champClasses}>
            {MOIS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </Champ>
        <Champ label="Délai avant envoi (secondes)"
               aide="Laisse le temps à un fichier copié depuis le réseau d'arriver entièrement.">
          <input type="number" min={1} max={60}
            value={Math.round(p.delaiStabiliteMs / 1000)}
            onChange={(e) => set({ delaiStabiliteMs: Number(e.target.value) * 1000 })}
            className={`${champClasses} tabulaire`} />
        </Champ>
        {([
          ["demarrageAutomatique", "Démarrer avec Windows"],
          ["reduireDansBarre", "Réduire dans la zone de notification au lieu de fermer"],
        ] as const).map(([cle, label]) => (
          <label key={cle} className="flex items-center gap-2.5 text-sm">
            <input type="checkbox" checked={p[cle]}
              onChange={(e) => set({ [cle]: e.target.checked } as any)}
              className="h-4 w-4 rounded accent-indigo-600" />
            {label}
          </label>
        ))}
      </section>

      <div className="sticky bottom-0 flex items-center gap-3 border-t border-zinc-200 bg-zinc-50/95 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <button
          onClick={enregistrer}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Enregistrer
        </button>
        {enregistre && <span className="text-sm text-emerald-600">Paramètres enregistrés.</span>}
        {p.manquants.length > 0 && (
          <span className="text-sm text-amber-700 dark:text-amber-400">
            Encore à renseigner : {p.manquants.join(", ")}.
          </span>
        )}
      </div>
    </div>
  );
}

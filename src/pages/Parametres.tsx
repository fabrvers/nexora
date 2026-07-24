import { useEffect, useState } from "react";
import type { EtatMaj, ParametresUI } from "../lib/api";
import { LIBELLES_THEME, type Theme } from "../lib/theme";

const MOIS = ["Janvier","Février","Mars","Avril","Mai","Juin",
              "Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

type Rubrique = "dossiers" | "boite" | "pennylane" | "envoi" | "apparence" | "fonctionnement" | "apropos";

const RUBRIQUES: { cle: Rubrique; libelle: string; aide: string }[] = [
  { cle: "dossiers", libelle: "Dossiers", aide: "Où Nexora surveille les dépôts" },
  { cle: "boite", libelle: "Boîte e-mail", aide: "Factures reçues par transfert" },
  { cle: "pennylane", libelle: "Pennylane", aide: "Adresses de transmission" },
  { cle: "envoi", libelle: "Serveur d'envoi", aide: "Compte SMTP utilisé" },
  { cle: "apparence", libelle: "Apparence", aide: "Thème de l'application" },
  { cle: "fonctionnement", libelle: "Fonctionnement", aide: "Exercice, délais, démarrage" },
  { cle: "apropos", libelle: "À propos", aide: "Version et mises à jour" },
];

const MESSAGE_MAJ: Record<EtatMaj["phase"], (e: EtatMaj) => string> = {
  inactif: () => "",
  verification: () => "Vérification en cours…",
  "a-jour": (e) => `Vous êtes à jour (version ${"version" in e ? e.version : ""}).`,
  disponible: (e) => `Version ${"version" in e ? e.version : ""} disponible, téléchargement en cours…`,
  telechargement: (e) => `Téléchargement : ${"pourcentage" in e ? e.pourcentage : 0} %`,
  prete: (e) => `La version ${"version" in e ? e.version : ""} est prête à être installée.`,
  erreur: (e) => ("message" in e ? e.message : "Erreur inconnue"),
};

/** Rubriques concernées par chaque réglage manquant, pour la pastille d'alerte. */
const RUBRIQUE_DU_MANQUANT: Record<string, Rubrique> = {
  "Dossier des factures d'achat": "dossiers",
  "Dossier des factures de vente": "dossiers",
  "Adresse Pennylane des achats": "pennylane",
  "Adresse Pennylane des ventes": "pennylane",
  "Serveur d'envoi": "envoi",
  "Adresse d'expédition": "envoi",
};

function Champ({ label, aide, alerte, children }: {
  label: string; aide?: string; alerte?: string; children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-petit font-medium">{label}</span>
      <div className="mt-1.5">{children}</div>
      {alerte && <span className="mt-1 block text-petit text-attente">{alerte}</span>}
      {!alerte && aide && <span className="mt-1 block text-petit text-doux">{aide}</span>}
    </label>
  );
}

export function Parametres({ onEnregistre }: { onEnregistre: (p: ParametresUI) => void }) {
  const [p, setP] = useState<ParametresUI | null>(null);
  const [rubrique, setRubrique] = useState<Rubrique>("dossiers");
  const [motDePasse, setMotDePasse] = useState("");
  const [motDePasseImap, setMotDePasseImap] = useState("");
  const [testImap, setTestImap] = useState<{ ok: boolean; message: string } | null>(null);
  const [releve, setReleve] = useState<{ resume: string; journal: string[] } | null>(null);
  const [releveEnCours, setReleveEnCours] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);
  const [enregistre, setEnregistre] = useState(false);
  const [apropos, setApropos] = useState<{ version: string; auteur: string; electron: string } | null>(null);
  const [maj, setMaj] = useState<EtatMaj>({ phase: "inactif" });

  useEffect(() => { void window.api.parametres().then(setP); }, []);
  useEffect(() => { void window.api.version().then(setApropos); }, []);
  useEffect(() => {
    void window.api.majEtat().then(setMaj);
    return window.api.surMaj(setMaj);
  }, []);
  if (!p) return null;

  const set = (champs: Partial<ParametresUI>) => setP({ ...p, ...champs });

  const manquantsDe = (cle: Rubrique) =>
    p.manquants.filter((m) => RUBRIQUE_DU_MANQUANT[m] === cle).length;

  const choisir = async (cle: "dossierAchats" | "dossierVentes") => {
    const dossier = await window.api.choisirDossier();
    if (dossier) set({ [cle]: dossier } as Partial<ParametresUI>);
  };

  const enregistrer = async () => {
    const maj = await window.api.enregistrerParametres(
      p, motDePasse || undefined, motDePasseImap || undefined,
    );
    setP(maj);
    setMotDePasse("");
    setMotDePasseImap("");
    onEnregistre(maj);
    setEnregistre(true);
    setTimeout(() => setEnregistre(false), 3000);
  };

  const alerteDomaine = (adresse: string, attendu: string, flux: string) =>
    adresse && !adresse.endsWith(attendu)
      ? `Cette adresse ne finit pas par ${attendu}. Les factures ${flux} arriveraient dans le mauvais onglet Pennylane.`
      : undefined;

  const DossierChamp = ({ cle, label }: {
    cle: "dossierAchats" | "dossierVentes"; label: string;
  }) => (
    <Champ label={label}>
      <div className="flex gap-2">
        <input
          readOnly value={p[cle]} placeholder="Aucun dossier choisi"
          className="champ flex-1 font-mono text-petit"
        />
        <button onClick={() => void choisir(cle)} className="bouton-discret shrink-0">
          Parcourir…
        </button>
      </div>
    </Champ>
  );

  return (
    <div className="flex h-full min-h-0">
      {/* Navigation par rubrique : chaque écran tient sans défilement. */}
      <nav className="w-60 shrink-0 border-r border-trait bg-releve p-2">
        {RUBRIQUES.map(({ cle, libelle, aide }) => {
          const actif = rubrique === cle;
          const restant = manquantsDe(cle);
          return (
            <button
              key={cle}
              onClick={() => setRubrique(cle)}
              aria-current={actif ? "page" : undefined}
              className={[
                "mb-0.5 flex w-full items-center gap-2 rounded-bloc px-3 py-2 text-left",
                "transition-colors duration-rapide",
                actif ? "bg-surface shadow-[inset_2px_0_0_rgb(var(--vert))]" : "hover:bg-surface/60",
              ].join(" ")}
            >
              <span className="min-w-0 flex-1">
                <span className={`block text-petit ${actif ? "font-medium" : ""}`}>{libelle}</span>
                <span className="block truncate text-micro text-doux">{aide}</span>
              </span>
              {restant > 0 && (
                <span className="tabulaire rounded-bloc bg-attente/15 px-1.5 font-mono text-micro text-attente">
                  {restant}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="max-w-2xl space-y-5 p-6">
            {rubrique === "dossiers" && (
              <>
                <p className="text-petit text-doux">
                  Tout fichier déposé dans ces dossiers part vers Pennylane.
                  Un dossier réseau fonctionne.
                </p>
                <DossierChamp cle="dossierAchats" label="Factures d'achat" />

                <label className="flex items-center gap-2.5 border-t border-trait pt-4 text-petit">
                  <input
                    type="checkbox" checked={p.fluxVenteActif}
                    onChange={(e) => set({ fluxVenteActif: e.target.checked })}
                    className="h-4 w-4 rounded-bloc border-trait accent-vert"
                  />
                  Gérer aussi les factures de vente
                </label>
                {!p.fluxVenteActif && (
                  <p className="text-petit text-doux">
                    L'onglet « Factures de vente » est masqué et le dossier
                    correspondant n'est plus surveillé. Les documents déjà
                    transmis restent dans l'historique.
                  </p>
                )}

                {p.fluxVenteActif && (
                  <DossierChamp cle="dossierVentes" label="Factures de vente" />
                )}
                {p.fluxVenteActif && p.dossierAchats && p.dossierAchats === p.dossierVentes && (
                  <p className="text-petit text-refus">
                    Les deux dossiers sont identiques : vos ventes partiraient vers les achats.
                  </p>
                )}
              </>
            )}

            {rubrique === "boite" && (
              <>
                <p className="text-petit text-doux">
                  Transférez les factures reçues vers une adresse dédiée. Nexora
                  relève cette boîte et n'en extrait que les PDF réellement joints :
                  logos de signature, bannières et icônes du corps du message sont
                  écartés. Un message transféré en pièce jointe est ouvert pour
                  y chercher la facture.
                </p>
                <p className="text-petit text-doux">
                  Cette boîte n'est utilisée qu'en lecture : Nexora n'envoie jamais
                  depuis cette adresse. L'expédition vers Pennylane se règle dans
                  « Serveur d'envoi ».
                </p>

                <label className="flex items-center gap-2.5 text-petit">
                  <input
                    type="checkbox" checked={p.imapActif}
                    onChange={(e) => set({ imapActif: e.target.checked })}
                    className="h-4 w-4 rounded-bloc border-trait accent-vert"
                  />
                  Relever une boîte e-mail
                </label>

                {p.imapActif && (
                  <>
                    <div className="grid grid-cols-[1fr_7rem] gap-3">
                      <Champ label="Serveur IMAP">
                        <input
                          value={p.imapHote} onChange={(e) => set({ imapHote: e.target.value })}
                          placeholder="imap.votredomaine.fr" className="champ"
                        />
                      </Champ>
                      <Champ label="Port">
                        <input
                          type="number" value={p.imapPort}
                          onChange={(e) => set({ imapPort: Number(e.target.value) })}
                          className="champ tabulaire"
                        />
                      </Champ>
                    </div>
                    <Champ label="Identifiant">
                      <input
                        value={p.imapUtilisateur}
                        onChange={(e) => set({ imapUtilisateur: e.target.value })}
                        placeholder="factures@votredomaine.fr" className="champ"
                      />
                    </Champ>
                    <Champ
                      label="Mot de passe"
                      aide={p.motDePasseImapDefini
                        ? "Un mot de passe est enregistré. Laissez vide pour le garder."
                        : "Sur Gmail ou Microsoft 365, il faut un mot de passe d'application."}
                    >
                      <input
                        type="password" value={motDePasseImap}
                        onChange={(e) => setMotDePasseImap(e.target.value)}
                        placeholder={p.motDePasseImapDefini ? "••••••••" : ""} className="champ"
                      />
                    </Champ>
                    <Champ label="Chiffrement">
                      <select
                        value={p.imapChiffrement}
                        onChange={(e) => set({ imapChiffrement: e.target.value as ParametresUI["imapChiffrement"] })}
                        className="champ"
                      >
                        <option value="tls">SSL/TLS — port 993</option>
                        <option value="starttls">STARTTLS — port 143</option>
                      </select>
                    </Champ>

                    <Champ
                      label="Dossier des achats"
                      aide="Les messages non lus de ce dossier alimentent les factures d'achat."
                    >
                      <input
                        value={p.imapDossierAchats}
                        onChange={(e) => set({ imapDossierAchats: e.target.value })}
                        placeholder="INBOX" className="champ font-mono text-petit"
                      />
                    </Champ>
                    {p.fluxVenteActif && (
                      <Champ
                        label="Dossier des ventes"
                        aide="Facultatif. Laissez vide si vous ne recevez pas de factures de vente par e-mail."
                      >
                        <input
                          value={p.imapDossierVentes}
                          onChange={(e) => set({ imapDossierVentes: e.target.value })}
                          placeholder="Ventes" className="champ font-mono text-petit"
                        />
                      </Champ>
                    )}
                    <Champ label="Fréquence de relève">
                      <div className="flex items-center gap-2">
                        <input
                          type="number" min={1} max={60} value={p.imapIntervalleMinutes}
                          onChange={(e) => set({ imapIntervalleMinutes: Number(e.target.value) })}
                          className="champ tabulaire w-24"
                        />
                        <span className="text-petit text-doux">minutes</span>
                      </div>
                    </Champ>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        onClick={async () => setTestImap(await window.api.testerImap())}
                        className="bouton-discret"
                      >
                        Tester la connexion
                      </button>
                      <button
                        onClick={async () => {
                          setReleveEnCours(true);
                          const r = await window.api.releverBoite();
                          setReleveEnCours(false);
                          setReleve({
                            resume: r.erreur
                              ? r.erreur
                              : `${r.messages} message(s) lus, ${r.pdfDeposes} PDF déposé(s), `
                                + `${r.piecesEcartees} pièce(s) écartée(s).`,
                            journal: r.journal,
                          });
                        }}
                        disabled={releveEnCours}
                        className="bouton-discret disabled:opacity-50"
                      >
                        {releveEnCours ? "Relève en cours…" : "Relever maintenant"}
                      </button>
                    </div>
                    {testImap && (
                      <p className={`text-petit ${testImap.ok ? "text-valide" : "text-refus"}`}>
                        {testImap.message}
                      </p>
                    )}
                    {releve && (
                      <div className="space-y-1.5 rounded-bloc border border-trait bg-releve p-3">
                        <p className="text-petit">{releve.resume}</p>
                        {releve.journal.length > 0 && (
                          <ul className="max-h-40 space-y-0.5 overflow-auto font-mono text-micro text-doux">
                            {releve.journal.map((ligne, i) => <li key={i}>{ligne}</li>)}
                          </ul>
                        )}
                      </div>
                    )}
                    <p className="text-petit text-doux">
                      Le test et la relève utilisent les valeurs déjà enregistrées :
                      enregistrez d'abord.
                    </p>
                  </>
                )}
              </>
            )}

            {rubrique === "pennylane" && (
              <>
                <p className="text-petit text-doux">
                  À activer dans Pennylane : Paramètres Entreprise → Transmission
                  factures → Adresses e-mail.
                </p>
                <Champ
                  label="Adresse des achats"
                  alerte={alerteDomaine(p.emailAchats, "@suppliers.pennylane.com", "d'achat")}
                >
                  <input
                    value={p.emailAchats} onChange={(e) => set({ emailAchats: e.target.value })}
                    placeholder="entreprise-xxxxxxxx@suppliers.pennylane.com"
                    className="champ font-mono text-petit"
                  />
                </Champ>
                {p.fluxVenteActif ? (
                  <Champ
                    label="Adresse des ventes"
                    alerte={alerteDomaine(p.emailVentes, "@customers.pennylane.com", "de vente")}
                  >
                    <input
                      value={p.emailVentes} onChange={(e) => set({ emailVentes: e.target.value })}
                      placeholder="entreprise-xxxxxxxx@customers.pennylane.com"
                      className="champ font-mono text-petit"
                    />
                  </Champ>
                ) : (
                  <p className="text-petit text-doux">
                    Les factures de vente sont désactivées : seule l'adresse des
                    achats est utilisée.
                  </p>
                )}
              </>
            )}

            {rubrique === "envoi" && (
              <>
                <p className="text-petit text-doux">
                  Utilisez un compte dédié plutôt que la boîte principale de l'entreprise.
                </p>
                <div className="grid grid-cols-[1fr_7rem] gap-3">
                  <Champ label="Serveur SMTP">
                    <input
                      value={p.smtpHote} onChange={(e) => set({ smtpHote: e.target.value })}
                      placeholder="smtp.votredomaine.fr" className="champ"
                    />
                  </Champ>
                  <Champ label="Port">
                    <input
                      type="number" value={p.smtpPort}
                      onChange={(e) => set({ smtpPort: Number(e.target.value) })}
                      className="champ tabulaire"
                    />
                  </Champ>
                </div>
                <Champ label="Identifiant">
                  <input
                    value={p.smtpUtilisateur}
                    onChange={(e) => set({ smtpUtilisateur: e.target.value })}
                    className="champ"
                  />
                </Champ>
                <Champ
                  label="Mot de passe"
                  aide={p.motDePasseDefini
                    ? "Un mot de passe est enregistré. Laissez vide pour le garder."
                    : "Sur Gmail ou Microsoft 365, il faut un mot de passe d'application."}
                >
                  <input
                    type="password" value={motDePasse}
                    onChange={(e) => setMotDePasse(e.target.value)}
                    placeholder={p.motDePasseDefini ? "••••••••" : ""} className="champ"
                  />
                </Champ>
                <Champ label="Adresse d'expédition">
                  <input
                    value={p.smtpExpediteur}
                    onChange={(e) => set({ smtpExpediteur: e.target.value })}
                    className="champ"
                  />
                </Champ>
                <Champ label="Chiffrement">
                  <select
                    value={p.smtpChiffrement}
                    onChange={(e) => set({ smtpChiffrement: e.target.value as ParametresUI["smtpChiffrement"] })}
                    className="champ"
                  >
                    <option value="starttls">STARTTLS — port 587</option>
                    <option value="tls">TLS implicite — port 465</option>
                    <option value="aucun">Aucun</option>
                  </select>
                </Champ>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={async () => setTest(await window.api.testerSmtp())}
                    className="bouton-discret"
                  >
                    Tester la connexion
                  </button>
                  {test && (
                    <p className={`text-petit ${test.ok ? "text-valide" : "text-refus"}`}>
                      {test.message}
                    </p>
                  )}
                </div>
                <p className="text-petit text-doux">
                  Le test utilise les valeurs déjà enregistrées : enregistrez d'abord.
                </p>
              </>
            )}

            {rubrique === "apparence" && (
              <Champ
                label="Thème"
                aide="Le mode Windows suit le réglage du système, y compris s'il change en cours de journée."
              >
                <div className="flex gap-1.5">
                  {(["clair", "sombre", "systeme"] as Theme[]).map((cle) => (
                    <button
                      key={cle}
                      onClick={() => set({ theme: cle })}
                      aria-pressed={p.theme === cle}
                      className={[
                        "flex-1 rounded-bloc border px-3 py-2 text-petit transition-colors duration-rapide",
                        p.theme === cle
                          ? "border-vert bg-vert/8 text-encre"
                          : "border-trait text-doux hover:bg-releve hover:text-encre",
                      ].join(" ")}
                    >
                      {LIBELLES_THEME[cle]}
                    </button>
                  ))}
                </div>
              </Champ>
            )}

            {rubrique === "apropos" && (
              <>
                <dl className="divide-y divide-trait border-y border-trait">
                  {([
                    ["Application", "Nexora"],
                    ["Version", apropos?.version ?? "—"],
                    ["Auteur", apropos?.auteur ?? "FV"],
                    ["Socle technique", apropos ? `Electron ${apropos.electron}` : "—"],
                  ] as const).map(([cle, valeur]) => (
                    <div key={cle} className="flex items-baseline justify-between gap-4 py-2">
                      <dt className="text-petit text-doux">{cle}</dt>
                      <dd className="tabulaire font-mono text-petit">{valeur}</dd>
                    </div>
                  ))}
                </dl>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => void window.api.majVerifier()}
                      disabled={maj.phase === "verification" || maj.phase === "telechargement"}
                      className="bouton-discret disabled:opacity-50"
                    >
                      Rechercher une mise à jour
                    </button>
                    {maj.phase === "prete" && (
                      <button onClick={() => void window.api.majInstaller()} className="bouton-principal">
                        Redémarrer et installer
                      </button>
                    )}
                  </div>
                  {maj.phase !== "inactif" && (
                    <p className={`text-petit ${maj.phase === "erreur" ? "text-refus" : "text-doux"}`}>
                      {MESSAGE_MAJ[maj.phase](maj)}
                    </p>
                  )}
                  <p className="text-petit text-doux">
                    Nexora vérifie les mises à jour au démarrage. Rien ne s'installe
                    sans votre accord, et vos réglages comme votre historique sont
                    conservés d'une version à l'autre.
                  </p>
                </div>
              </>
            )}

            {rubrique === "fonctionnement" && (
              <>
                <Champ label="Premier mois de l'exercice comptable"
                       aide="Sert au filtre « Exercice courant » de la liste.">
                  <select
                    value={p.moisDebutExercice}
                    onChange={(e) => set({ moisDebutExercice: Number(e.target.value) })}
                    className="champ"
                  >
                    {MOIS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </select>
                </Champ>
                <Champ label="Délai avant envoi"
                       aide="Laisse le temps à un fichier copié depuis le réseau d'arriver entièrement.">
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min={1} max={60}
                      value={Math.round(p.delaiStabiliteMs / 1000)}
                      onChange={(e) => set({ delaiStabiliteMs: Number(e.target.value) * 1000 })}
                      className="champ tabulaire w-24"
                    />
                    <span className="text-petit text-doux">secondes</span>
                  </div>
                </Champ>
                {([
                  ["demarrageAutomatique", "Démarrer avec Windows"],
                  ["reduireDansBarre", "Fermer la fenêtre réduit dans la zone de notification"],
                ] as const).map(([cle, label]) => (
                  <label key={cle} className="flex items-center gap-2.5 text-petit">
                    <input
                      type="checkbox" checked={p[cle]}
                      onChange={(e) => set({ [cle]: e.target.checked } as Partial<ParametresUI>)}
                      className="h-4 w-4 rounded-bloc border-trait accent-vert"
                    />
                    {label}
                  </label>
                ))}
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-trait bg-papier px-6 py-3">
          <button onClick={enregistrer} className="bouton-principal">Enregistrer</button>
          {enregistre && <span className="text-petit text-valide">Paramètres enregistrés.</span>}
          {p.manquants.length > 0 && (
            <span className="text-petit text-attente">
              Reste à renseigner : {p.manquants.join(", ")}.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

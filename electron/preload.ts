import { contextBridge, ipcRenderer, webUtils } from "electron";

/** Seule surface exposee a l'interface : pas d'acces direct au systeme. */
contextBridge.exposeInMainWorld("api", {
  documents: () => ipcRenderer.invoke("documents:liste"),
  compteurs: () => ipcRenderer.invoke("documents:compteurs"),
  envoyer: (id: number) => ipcRenderer.invoke("document:envoyer", id),
  ignorer: (id: number) => ipcRenderer.invoke("document:ignorer", id),
  supprimer: (ids: number[]) => ipcRenderer.invoke("documents:supprimer", ids),
  telecharger: (ids: number[]) => ipcRenderer.invoke("documents:telecharger", ids),
  ouvrirDossier: (id: number) => ipcRenderer.invoke("document:ouvrir-dossier", id),
  lireFichier: (id: number) => ipcRenderer.invoke("document:contenu", id),
  balayer: () => ipcRenderer.invoke("dossiers:balayer"),

  // Glisser-deposer : depuis Electron 32, File.path n'existe plus. Seul
  // webUtils, accessible ici, sait retrouver le chemin reel d'un fichier.
  cheminDuFichier: (fichier: File) => {
    try {
      return webUtils.getPathForFile(fichier);
    } catch {
      return "";
    }
  },
  choisirFichiers: () => ipcRenderer.invoke("documents:choisir-fichiers"),
  deposer: (flux: "achat" | "vente", chemins: string[]) =>
    ipcRenderer.invoke("documents:deposer", flux, chemins),

  version: () => ipcRenderer.invoke("application:version"),
  majEtat: () => ipcRenderer.invoke("maj:etat"),
  majVerifier: () => ipcRenderer.invoke("maj:verifier"),
  majInstaller: () => ipcRenderer.invoke("maj:installer"),
  surMaj: (rappel: (etat: unknown) => void) => {
    const ecouteur = (_e: unknown, etat: unknown) => rappel(etat);
    ipcRenderer.on("maj:etat", ecouteur as never);
    return () => ipcRenderer.removeListener("maj:etat", ecouteur as never);
  },

  parametres: () => ipcRenderer.invoke("parametres:lire"),
  enregistrerParametres: (valeurs: unknown, motDePasse?: string) =>
    ipcRenderer.invoke("parametres:ecrire", valeurs, motDePasse),
  choisirDossier: () => ipcRenderer.invoke("parametres:choisir-dossier"),
  testerSmtp: () => ipcRenderer.invoke("parametres:tester-smtp"),

  // Le menu Fichier > Paramètres pilote la navigation de l'interface.
  surNavigation: (rappel: () => void) => {
    const ecouteur = () => rappel();
    ipcRenderer.on("aller-a:parametres", ecouteur);
    return () => ipcRenderer.removeListener("aller-a:parametres", ecouteur);
  },

  surChangement: (rappel: () => void) => {
    const ecouteur = () => rappel();
    ipcRenderer.on("documents:changement", ecouteur);
    return () => ipcRenderer.removeListener("documents:changement", ecouteur);
  },
});

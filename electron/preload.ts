import { contextBridge, ipcRenderer } from "electron";

/** Seule surface exposee a l'interface : pas d'acces direct au systeme. */
contextBridge.exposeInMainWorld("api", {
  documents: () => ipcRenderer.invoke("documents:liste"),
  compteurs: () => ipcRenderer.invoke("documents:compteurs"),
  envoyer: (id: number) => ipcRenderer.invoke("document:envoyer", id),
  ignorer: (id: number) => ipcRenderer.invoke("document:ignorer", id),
  telecharger: (ids: number[]) => ipcRenderer.invoke("documents:telecharger", ids),
  ouvrirDossier: (id: number) => ipcRenderer.invoke("document:ouvrir-dossier", id),
  lireFichier: (id: number) => ipcRenderer.invoke("document:contenu", id),
  balayer: () => ipcRenderer.invoke("dossiers:balayer"),

  parametres: () => ipcRenderer.invoke("parametres:lire"),
  enregistrerParametres: (valeurs: unknown, motDePasse?: string) =>
    ipcRenderer.invoke("parametres:ecrire", valeurs, motDePasse),
  choisirDossier: () => ipcRenderer.invoke("parametres:choisir-dossier"),
  testerSmtp: () => ipcRenderer.invoke("parametres:tester-smtp"),

  surChangement: (rappel: () => void) => {
    const ecouteur = () => rappel();
    ipcRenderer.on("documents:changement", ecouteur);
    return () => ipcRenderer.removeListener("documents:changement", ecouteur);
  },
});

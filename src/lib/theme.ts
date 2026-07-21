/**
 * Application du theme : jour, nuit, ou suivi des reglages du poste.
 *
 * Tailwind est configure en darkMode « class » : on pose ou retire la classe
 * sur <html>. Le suivi systeme reste actif tant que l'utilisateur n'a pas
 * choisi explicitement, et reagit si Windows bascule en cours de session.
 */
export type Theme = "clair" | "sombre" | "systeme";

export const LIBELLES_THEME: Record<Theme, string> = {
  clair: "Jour",
  sombre: "Nuit",
  systeme: "Comme Windows",
};

const requete = () => window.matchMedia("(prefers-color-scheme: dark)");

function poser(sombre: boolean): void {
  document.documentElement.classList.toggle("dark", sombre);
}

/**
 * Applique le theme et renvoie une fonction de desabonnement.
 * A rappeler a chaque changement de reglage.
 */
export function appliquerTheme(theme: Theme): () => void {
  if (theme !== "systeme") {
    poser(theme === "sombre");
    return () => {};
  }

  const media = requete();
  poser(media.matches);
  const reagir = (evenement: MediaQueryListEvent) => poser(evenement.matches);
  media.addEventListener("change", reagir);
  return () => media.removeEventListener("change", reagir);
}

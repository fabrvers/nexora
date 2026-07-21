import { test } from "node:test";
import assert from "node:assert/strict";
import { bornes, dansPeriode } from "../src/lib/periods.ts";

const maintenant = new Date(2026, 6, 21); // 21 juillet 2026
const base = { moisDebutExercice: 1, maintenant };

// Comparaison sur les composants locaux : toISOString bascule en UTC et
// decalerait les bornes selon le fuseau du poste.
const local = (d: Date) => [d.getFullYear(), d.getMonth() + 1, d.getDate()].join("-");

test("mois courant", () => {
  const b = bornes("mois_courant", base)!;
  assert.equal(local(b.debut), "2026-7-1");
  assert.equal(local(b.fin), "2026-8-1");
});

test("exercice civil = annee civile", () => {
  const b = bornes("exercice_courant", base)!;
  assert.equal(b.debut.getFullYear(), 2026);
  assert.equal(b.debut.getMonth(), 0);
  assert.equal(b.fin.getFullYear(), 2027);
});

test("exercice a cheval demarrant en octobre", () => {
  // En juillet 2026, l'exercice ouvert en octobre a commence en 2025.
  const b = bornes("exercice_courant", { ...base, moisDebutExercice: 10 })!;
  assert.equal(b.debut.getFullYear(), 2025);
  assert.equal(b.debut.getMonth(), 9);
  assert.equal(b.fin.getFullYear(), 2026);
  assert.ok(dansPeriode(new Date(2026, 6, 1), b), "juillet 2026 doit y etre");
  assert.ok(!dansPeriode(new Date(2025, 8, 30), b), "septembre 2025 doit en sortir");
});

test("exercice a cheval apres la date d'ouverture", () => {
  const novembre = new Date(2026, 10, 5);
  const b = bornes("exercice_courant", { moisDebutExercice: 10, maintenant: novembre })!;
  assert.equal(b.debut.getFullYear(), 2026);
});

test("semestres", () => {
  const s1 = bornes("semestre_1", base)!;
  const s2 = bornes("semestre_2", base)!;
  assert.ok(dansPeriode(new Date(2026, 2, 15), s1));
  assert.ok(!dansPeriode(new Date(2026, 8, 15), s1));
  assert.ok(dansPeriode(new Date(2026, 8, 15), s2));
});

test("periode personnalisee, borne de fin incluse", () => {
  const b = bornes("personnalisee", {
    ...base,
    debutPersonnalise: new Date(2026, 3, 1),
    finPersonnalisee: new Date(2026, 3, 30),
  })!;
  assert.ok(dansPeriode(new Date(2026, 3, 30, 23, 59), b), "le 30 avril doit etre inclus");
  assert.ok(!dansPeriode(new Date(2026, 4, 1), b));
});

test("toute la periode ne filtre rien", () => {
  assert.equal(bornes("tout", base), null);
  assert.ok(dansPeriode(new Date(1999, 0, 1), null));
});

test("mois au choix", () => {
  const b = bornes("mois_choisi", { ...base, moisChoisi: "2026-03" })!;
  assert.ok(dansPeriode(new Date(2026, 2, 15), b), "mars 2026 doit y être");
  assert.ok(!dansPeriode(new Date(2026, 3, 1), b), "avril doit en sortir");
  assert.ok(!dansPeriode(new Date(2026, 1, 28), b), "février doit en sortir");
});

test("mois au choix sans valeur ne filtre pas", () => {
  assert.equal(bornes("mois_choisi", base), null);
});

test("année au choix", () => {
  const b = bornes("annee_choisie", { ...base, anneeChoisie: 2024 })!;
  assert.ok(dansPeriode(new Date(2024, 11, 31), b));
  assert.ok(!dansPeriode(new Date(2025, 0, 1), b));
});

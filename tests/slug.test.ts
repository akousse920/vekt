import assert from "node:assert/strict";
import test from "node:test";

import { generateSlug } from "../lib/utils";

test("slugs keep accented letters as their plain equivalent", () => {
  assert.equal(generateSlug("Caissier / Caissière"), "caissier-caissiere");
  assert.equal(generateSlug("Vendeur / Vendeuse au comptoir"), "vendeur-vendeuse-au-comptoir");
  assert.equal(generateSlug("Chargé(e) d’accueil — Bénin"), "chargee-daccueil-benin");
});

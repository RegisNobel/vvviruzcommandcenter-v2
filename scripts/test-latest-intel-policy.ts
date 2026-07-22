import assert from "node:assert/strict";

import {shouldShowLatestIntel} from "../lib/latest-intel";

const customHubs = ["links", "fan-hub"];

for (const pathname of [
  "/",
  "/about",
  "/music",
  "/music/mad-bunny",
  "/projects",
  "/projects/multiversus"
]) {
  assert.equal(shouldShowLatestIntel(pathname, customHubs), true, `${pathname} should show Intel`);
}

for (const pathname of [
  "/commissions",
  "/exclusive",
  "/exclusives",
  "/fan-hub",
  "/links",
  "/listen/nerd-2d-core",
  "/listen/nerd-2d-core/will",
  "/unsubscribe",
  "/vault"
]) {
  assert.equal(shouldShowLatestIntel(pathname, customHubs), false, `${pathname} should hide Intel`);
}

console.log("Latest Intel route policy checks passed.");

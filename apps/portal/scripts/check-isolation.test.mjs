import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("entry do portal não importa shell interno", () => {
  const source = readFileSync(new URL("../src/portal-app.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /HomePage|features\/pcm\/pages|features\/financeiro\/pages|features\/atendimento/);
});

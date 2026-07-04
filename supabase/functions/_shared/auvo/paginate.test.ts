// paginate.test.ts — teste unitário puro do helper de paginação (sem rede, mocks de página).
// Rodar localmente (requer Deno CLI, indisponível neste ambiente):
//   deno test supabase/functions/_shared/auvo/paginate.test.ts

import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { auvoPaginate } from "./paginate.ts";

/** Gera uma função fetchPage que serve `total` itens divididos em páginas de `pageSize`. */
function fakeSource(total: number) {
  const items = Array.from({ length: total }, (_, i) => i + 1);
  return (pageNumber: number, pageSize: number): Promise<number[]> => {
    const start = (pageNumber - 1) * pageSize;
    return Promise.resolve(items.slice(start, start + pageSize));
  };
}

Deno.test("auvoPaginate — páginas completas + última página parcial (250 itens, pageSize 100)", async () => {
  const all = await auvoPaginate(fakeSource(250), { pageSize: 100 });
  assertEquals(all.length, 250);
  assertEquals(all[0], 1);
  assertEquals(all[249], 250);
});

Deno.test("auvoPaginate — total múltiplo exato do pageSize para com página vazia seguinte", async () => {
  // 200 itens / pageSize 100 → páginas 1 e 2 cheias, página 3 vazia (length 0 < 100) encerra.
  let pagesFetched = 0;
  const src = fakeSource(200);
  const all = await auvoPaginate((p, s) => {
    pagesFetched++;
    return src(p, s);
  }, { pageSize: 100 });
  assertEquals(all.length, 200);
  assertEquals(pagesFetched, 3); // duas cheias + uma vazia para detectar o fim
});

Deno.test("auvoPaginate — página vazia logo na primeira chamada devolve []", async () => {
  const all = await auvoPaginate(fakeSource(0), { pageSize: 100 });
  assertEquals(all, []);
});

Deno.test("auvoPaginate — última página parcial encerra sem buscar página extra", async () => {
  let pagesFetched = 0;
  const src = fakeSource(150);
  const all = await auvoPaginate((p, s) => {
    pagesFetched++;
    return src(p, s);
  }, { pageSize: 100 });
  assertEquals(all.length, 150);
  assertEquals(pagesFetched, 2); // página 2 tem 50 (< 100) → não busca a 3
});

Deno.test("auvoPaginate — erro no meio da paginação propaga (não devolve acumulado parcial)", async () => {
  await assertRejects(
    () =>
      auvoPaginate((pageNumber) => {
        if (pageNumber === 2) return Promise.reject(new Error("Auvo 503 na página 2"));
        return Promise.resolve(Array.from({ length: 100 }, (_, i) => i));
      }, { pageSize: 100 }),
    Error,
    "Auvo 503 na página 2",
  );
});

Deno.test("auvoPaginate — usa DEFAULT_PAGE_SIZE (100) quando não especificado", async () => {
  let seenPageSize = 0;
  await auvoPaginate((_p, pageSize) => {
    seenPageSize = pageSize;
    return Promise.resolve([]);
  });
  assertEquals(seenPageSize, 100);
});

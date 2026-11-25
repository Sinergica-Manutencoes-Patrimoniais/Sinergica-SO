// deno test supabase/functions/_shared/marketing/meta-ads.test.ts
// Sem rede: prova as conversões da borda e o determinismo da fixture (E06-S01).

import { assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { criarMetaAdsFixture, paraCentavos, somarLeads } from "./meta-ads.ts";
import fixture from "./fixtures/conta-demonstracao.json" with { type: "json" };

Deno.test("paraCentavos converte a string decimal da Meta sem ponto flutuante vazando", () => {
  assertEquals(paraCentavos("123.45"), 12345);
  assertEquals(paraCentavos("0.10"), 10);
  // O clássico: 0.1 + 0.2 em float. Arredondar na borda é o que impede isso de virar centavo.
  assertEquals(paraCentavos("19.99"), 1999);
  assertEquals(paraCentavos(7.3), 730);
});

Deno.test("paraCentavos trata ausência e lixo como zero, nunca como NaN", () => {
  assertEquals(paraCentavos(undefined), 0);
  assertEquals(paraCentavos("não é número"), 0);
  assertEquals(paraCentavos("-5"), 0);
});

Deno.test("somarLeads soma os tipos de ação que contam como lead e ignora o resto", () => {
  const acoes = [
    { action_type: "lead", value: "2" },
    { action_type: "onsite_conversion.lead_grouped", value: "1" },
    { action_type: "offsite_conversion.fb_pixel_lead", value: "3" },
    { action_type: "link_click", value: "90" },
    { action_type: "post_engagement", value: "40" },
  ];
  assertEquals(somarLeads(acoes), 6);
});

Deno.test("somarLeads sem ações não inventa lead", () => {
  assertEquals(somarLeads(undefined), 0);
  assertEquals(somarLeads([]), 0);
  assertEquals(somarLeads([{ action_type: "link_click", value: "10" }]), 0);
});

Deno.test("AC-10: a fixture devolve a hierarquia inteira, com a campanha que não converte", async () => {
  const porta = criarMetaAdsFixture(fixture);
  const hierarquia = await porta.hierarquia("0");
  assertEquals(hierarquia.campanhas.length, 3);
  assertEquals(hierarquia.conjuntos.length, 4);
  assertEquals(hierarquia.anuncios.length, 5);
  // O anúncio institucional existe de propósito: gasta e não gera lead (prova de AC-5/AC-18).
  const institucional = fixture.numerosPorAnuncio["700000000000005"];
  assertEquals(institucional.leads, 0);
  assertNotEquals(institucional.gastoCentavos, 0);
});

Deno.test("AC-9: a fixture é determinística — a mesma janela devolve os mesmos números", async () => {
  const porta = criarMetaAdsFixture(fixture);
  const primeira = await porta.numerosDiarios("0", "2026-11-19", "2026-11-25");
  const segunda = await porta.numerosDiarios("0", "2026-11-19", "2026-11-25");
  assertEquals(primeira, segunda);
  // 7 dias × 5 anúncios.
  assertEquals(primeira.length, 35);
});

Deno.test("a fixture varia entre dias — número congelado esconderia erro de agregação", async () => {
  const porta = criarMetaAdsFixture(fixture);
  const numeros = await porta.numerosDiarios("0", "2026-11-19", "2026-11-20");
  const doAnuncio = numeros.filter((n) => n.anuncioExternoId === "700000000000001");
  assertEquals(doAnuncio.length, 2);
  assertNotEquals(doAnuncio[0].gastoCentavos, doAnuncio[1].gastoCentavos);
});

Deno.test("a janela de um dia só devolve esse dia", async () => {
  const porta = criarMetaAdsFixture(fixture);
  const numeros = await porta.numerosDiarios("0", "2026-11-25", "2026-11-25");
  assertEquals(numeros.length, 5);
  assertEquals(new Set(numeros.map((n) => n.dia)).size, 1);
});

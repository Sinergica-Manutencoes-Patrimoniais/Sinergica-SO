import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  comporContextoCliente,
  comporContextoClienteComOrcamento,
  limitesMemoria,
  montarTextoParaResumo,
  selecionarMensagensParaResumo,
} from "./memoria-cliente.ts";

Deno.test("comporContextoCliente — sem alma nem resumo devolve null (sem ruído no prompt)", () => {
  assertEquals(comporContextoCliente(null, null), null);
  assertEquals(comporContextoCliente("", ""), null);
  assertEquals(comporContextoCliente("   ", undefined), null);
});

Deno.test("comporContextoCliente — só alma", () => {
  const contexto = comporContextoCliente("Síndico prefere áudio, é direto", null);
  assertStringIncludes(contexto ?? "", "Síndico prefere áudio");
});

Deno.test("comporContextoCliente — só resumo", () => {
  const contexto = comporContextoCliente(null, "Cliente reclamou de vazamento em 2026-06");
  assertStringIncludes(contexto ?? "", "vazamento");
});

Deno.test("comporContextoCliente — alma + resumo, seções distintas", () => {
  const contexto = comporContextoCliente("prefere áudio", "vazamento resolvido em junho");
  assertStringIncludes(contexto ?? "", "prefere áudio");
  assertStringIncludes(contexto ?? "", "vazamento resolvido");
});

Deno.test("comporContextoCliente — isolamento: contexto de um cliente nunca vaza pro outro (mesma chamada nunca mistura 2 clientes)", () => {
  const clienteA = comporContextoCliente("info do cliente A", null);
  const clienteB = comporContextoCliente("info do cliente B", null);
  assertEquals(clienteA?.includes("cliente B"), false);
  assertEquals(clienteB?.includes("cliente A"), false);
});

// ── AC-3: janela crua × resumo rolante ────────────────────────────────────────────────────────

const AGORA = new Date("2026-11-25T12:00:00Z");

function mensagem(diasAtras: number, conteudo: string | null, autor = "Cliente") {
  return {
    criadoEm: new Date(AGORA.getTime() - diasAtras * 24 * 60 * 60 * 1000).toISOString(),
    autor,
    conteudo,
  };
}

Deno.test("limitesMemoria — janela crua de 30 dias, retenção de 90", () => {
  const limites = limitesMemoria(AGORA);
  assertEquals(limites.janelaCruaDesde.toISOString(), "2026-10-26T12:00:00.000Z");
  assertEquals(limites.resumoDesde.toISOString(), "2026-08-27T12:00:00.000Z");
});

Deno.test("selecionarMensagensParaResumo — só o que saiu da janela crua e está dentro da retenção", () => {
  const limites = limitesMemoria(AGORA);
  const selecionadas = selecionarMensagensParaResumo(
    [
      mensagem(2, "mensagem de ontem — ainda é janela crua"),
      mensagem(45, "vazamento no 3º andar"),
      mensagem(120, "antiga demais, fora da retenção"),
      mensagem(60, "   "),
      mensagem(50, null),
    ],
    limites,
  );
  assertEquals(selecionadas.length, 1);
  assertStringIncludes(selecionadas[0].conteudo ?? "", "vazamento");
});

Deno.test("selecionarMensagensParaResumo — ordena da mais antiga pra mais nova", () => {
  const limites = limitesMemoria(AGORA);
  const selecionadas = selecionarMensagensParaResumo(
    [mensagem(40, "depois"), mensagem(80, "antes")],
    limites,
  );
  assertEquals(
    selecionadas.map((m) => m.conteudo),
    ["antes", "depois"],
  );
});

Deno.test("selecionarMensagensParaResumo — data inválida é descartada, não quebra", () => {
  const limites = limitesMemoria(AGORA);
  const selecionadas = selecionarMensagensParaResumo(
    [{ criadoEm: "não é data", autor: "Cliente", conteudo: "texto" }],
    limites,
  );
  assertEquals(selecionadas.length, 0);
});

Deno.test("montarTextoParaResumo — transcrição datada, trunca descartando o mais antigo", () => {
  const texto = montarTextoParaResumo(
    [mensagem(80, "mensagem antiga"), mensagem(40, "mensagem recente")],
    40,
  );
  assertEquals(texto.includes("mensagem antiga"), false);
  assertStringIncludes(texto, "mensagem recente");
});

Deno.test("comporContextoClienteComOrcamento — cabe no orçamento: nada truncado", () => {
  const { contexto, resumoTruncado } = comporContextoClienteComOrcamento(
    "prefere áudio",
    "resolveu vazamento",
    1000,
  );
  assertEquals(resumoTruncado, false);
  assertStringIncludes(contexto ?? "", "resolveu vazamento");
});

Deno.test("comporContextoClienteComOrcamento — estourou: alma inteira, resumo truncado", () => {
  const alma = "prefere áudio";
  const { contexto, resumoTruncado } = comporContextoClienteComOrcamento(
    alma,
    "x".repeat(5000),
    120,
  );
  assertEquals(resumoTruncado, true);
  assertStringIncludes(contexto ?? "", alma);
  assertEquals((contexto ?? "").length <= 120, true);
});

Deno.test("comporContextoClienteComOrcamento — orçamento menor que a alma: resumo sai inteiro", () => {
  const { contexto, resumoTruncado } = comporContextoClienteComOrcamento(
    "a".repeat(300),
    "resumo qualquer",
    50,
  );
  assertEquals(resumoTruncado, true);
  assertEquals((contexto ?? "").includes("resumo qualquer"), false);
});

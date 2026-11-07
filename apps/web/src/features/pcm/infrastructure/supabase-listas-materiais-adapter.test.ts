import { beforeEach, expect, it, vi } from "vitest";

const banco = vi.hoisted(() => ({ dados: [] as unknown[], resultadoCriacao: null as unknown, resultadoEdicao: null as unknown, resultadoEvento: null as unknown, rpc: "" }));
vi.mock("../../../lib/supabase-client", () => ({
  supabase: { schema: () => ({ rpc: (nome: string) => { banco.rpc = nome; return Promise.resolve({ data: nome.startsWith("sso_registrar_lista_materiais") ? banco.resultadoCriacao : nome.startsWith("sso_salvar_linhas_materiais") ? banco.resultadoEdicao : nome.startsWith("sso_informar_material") ? banco.resultadoEvento : banco.dados, error: null }); } }) },
}));

import { supabaseListasMateriaisAdapter } from "./supabase-listas-materiais-adapter";

const cliente = "17900000-0000-4000-8000-000000000001";
const os = "abcdefab-0000-4000-8000-000000000002";

beforeEach(() => {
  banco.rpc = "";
  banco.dados = [{
    id: "17900000-0000-4000-8000-000000000003",
    ordem_servico_id: os,
    responsavel: "cliente",
    texto_original: "Material",
    estado: "levantada",
    revisao: 1,
  }];
});

it("aceita filtro UUID em maiúsculas para a mesma OS devolvida pelo banco", async () => {
  await expect(supabaseListasMateriaisAdapter.consultarCentral(cliente, os.toUpperCase(), null, 20, null))
    .resolves.toHaveLength(1);
});

it("continua rejeitando lista de outra OS", async () => {
  await expect(supabaseListasMateriaisAdapter.consultarCentral(cliente, "abcdefab-0000-4000-8000-000000000099", null, 20, null))
    .rejects.toThrow("Página inválida.");
});

it("consulta pela entrada mediada, sem fallback para núcleo privado", async () => {
  await supabaseListasMateriaisAdapter.consultarCentral(cliente, null, null, 20, null);
  expect(banco.rpc).toBe("sso_consultar_central_materiais_mediada");
});

it("lista materiais da OS pela entrada mediada, aceitando UUID equivalente", async () => {
  await expect(supabaseListasMateriaisAdapter.listar(cliente, os.toUpperCase(), 20, null)).resolves.toHaveLength(1);
  expect(banco.rpc).toBe("sso_listar_listas_materiais_mediada");
});

it("cria pela entrada mediada, preservando a identidade do pedido", async () => {
  const pedido = "17900000-0000-4000-8000-000000000004";
  const lista = "17900000-0000-4000-8000-000000000003";
  banco.resultadoCriacao = { aggregateId: lista, revision: 1, state: "levantada", created: true, linkedIds: { ordemServicoId: os }, warnings: [], requestId: pedido };
  await supabaseListasMateriaisAdapter.criar({ requestId: pedido, expectedRevision: 0, listaId: lista, ordemServicoId: os, responsavel: "cliente", textoOriginal: "Material" });
  expect(banco.rpc).toBe("sso_registrar_lista_materiais_mediada");
});

it("salva linhas pela entrada mediada e preserva revisão e pedido", async () => {
  const pedido = "17900000-0000-4000-8000-000000000004";
  const lista = "17900000-0000-4000-8000-000000000003";
  banco.resultadoEdicao = { aggregateId: lista, revision: 2, state: "levantada", created: false, linkedIds: {}, warnings: [], requestId: pedido };
  await supabaseListasMateriaisAdapter.salvarLinhas({ requestId: pedido, listaId: lista, expectedRevision: 1, linhas: [] });
  expect(banco.rpc).toBe("sso_salvar_linhas_materiais_mediada");
});

it("registra disponibilidade pela entrada mediada", async () => {
  const pedido = "17900000-0000-4000-8000-000000000004";
  const lista = "17900000-0000-4000-8000-000000000003";
  banco.resultadoEvento = { aggregateId: lista, revision: 2, state: "informada_disponivel", created: false, linkedIds: {}, warnings: [], requestId: pedido };
  await supabaseListasMateriaisAdapter.informar({ requestId: pedido, listaId: lista, expectedRevision: 1, evento: { tipo: "disponibilidade", dados: { situacao: "informada_disponivel" } } });
  expect(banco.rpc).toBe("sso_informar_material_mediado");
});

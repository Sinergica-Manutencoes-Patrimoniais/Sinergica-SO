import { afterEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../lib/supabase-client", () => ({
  supabase: { schema: () => ({ rpc: api.rpc }) },
}));

import { listarAgendaProjetada } from "./supabase-agenda-projecao-adapter";

afterEach(() => vi.clearAllMocks());

const LINHA = {
  visita_id: "11111111-1111-4111-8111-111111111111",
  cliente_id: "22222222-2222-4222-8222-222222222222",
  cliente_nome: "Cliente A",
  funcionario_id: "33333333-3333-4333-8333-333333333333",
  funcionario_nome: "Ana",
  papel: "Técnica",
  data: "2026-11-23",
  periodo: "manha",
  horarios_auvo: ["20:42"],
  inicio_em: "2026-11-23T11:00:00+00:00",
  fim_em: "2026-11-23T15:00:00+00:00",
  estado: "planejada",
  natureza: "regular",
  os_numeros: ["OS-1", "OS-2"],
  quantidade_os: 2,
};

it("AC-1/AC-2: a semana com Visita devolve a alocação com as OS vinculadas", async () => {
  api.rpc.mockReturnValue({ abortSignal: () => Promise.resolve({ data: [LINHA], error: null }) });
  const alocacoes = await listarAgendaProjetada("2026-11-23", null, new AbortController().signal);
  expect(alocacoes).toHaveLength(1);
  expect(alocacoes[0]?.osNumeros).toEqual(["OS-1", "OS-2"]);
  expect(alocacoes[0]?.quantidadeOs).toBe(2);
  expect(alocacoes[0]?.horariosAuvo).toEqual(["20:42"]);
  expect(api.rpc).toHaveBeenCalledWith("sso_listar_agenda_tecnico_com_horarios_auvo", {
    p_cliente_id: null,
    p_semana_inicio: "2026-11-23",
    p_limite: 500,
  });
});

it("AC-2: Visita sem OS vinculada vira lista vazia, não some da agenda", async () => {
  api.rpc.mockReturnValue({
    abortSignal: () =>
      Promise.resolve({
        data: [{ ...LINHA, os_numeros: null, quantidade_os: 0, horarios_auvo: [] }],
        error: null,
      }),
  });
  const [alocacao] = await listarAgendaProjetada("2026-11-23", null, new AbortController().signal);
  expect(alocacao?.osNumeros).toEqual([]);
  expect(alocacao?.quantidadeOs).toBe(0);
  expect(alocacao?.horariosAuvo).toEqual([]);
});

it("DEF-03: a RPC anterior mantém a Agenda disponível durante o deploy", async () => {
  const { horarios_auvo: _, ...linhaAnterior } = LINHA;
  api.rpc
    .mockResolvedValueOnce({ data: null, error: { code: "PGRST202" } })
    .mockResolvedValueOnce({ data: [linhaAnterior], error: null });

  const [alocacao] = await listarAgendaProjetada("2026-11-23", null);

  expect(api.rpc).toHaveBeenLastCalledWith("sso_listar_agenda_tecnico_projetada", {
    p_cliente_id: null,
    p_semana_inicio: "2026-11-23",
    p_limite: 500,
  });
  expect(alocacao?.horariosAuvo).toEqual([]);
});

it("AC-6: erro nomeado do banco sobe cru — nunca vira lista vazia aqui", async () => {
  api.rpc.mockReturnValue({
    abortSignal: () =>
      Promise.resolve({ data: null, error: { message: "agenda_capacidade_bloqueada" } }),
  });
  await expect(
    listarAgendaProjetada("2026-11-23", null, new AbortController().signal),
  ).rejects.toMatchObject({ message: "agenda_capacidade_bloqueada" });
});

it("AC-9: semana em formato inválido nem chega ao banco", async () => {
  await expect(listarAgendaProjetada("23/11/2026", null)).rejects.toThrow("Semana inválida.");
  expect(api.rpc).not.toHaveBeenCalled();
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const rede = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("../../../lib/supabase-client", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  return { supabase: createClient("https://sso-test.invalid", "chave-teste", { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: rede.fetch } }) };
});
import { supabase } from "../../../lib/supabase-client";
import { prepararCronogramaAutenticado } from "./exportacao-cronograma-autenticada";

const userId = "00000000-0000-4000-8000-000000000001";
const ids = { clienteId: "00000000-0000-4000-8000-000000000002", planoId: "00000000-0000-4000-8000-000000000003", versaoId: "00000000-0000-4000-8000-000000000004" };
const rotinaId = "00000000-0000-4000-8000-000000000005";
const alvoId = "00000000-0000-4000-8000-000000000006";
const janela = { inicio: "2026-01-01", fim: "2026-01-31", feriadosInformados: [] };
const token = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.fake`;
const user = { id: userId, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2025-01-01T00:00:00Z" };
const resposta = (dados: unknown, status = 200) => new Response(JSON.stringify(dados), { status, headers: { "Content-Type": "application/json" } });
const foto = { ...ids, planoNome: "Plano", versaoNumero: 1, vigenciaInicio: "2026-01-01", vigenciaFim: null, snapshotHash: "a".repeat(32), total: 1, posicao: 0, proximaPosicao: null, capacidadeIncluida: false, cronogramaOperacionalIncluido: false,
  rotinas: [{ id: rotinaId, planoId: ids.planoId, versaoId: ids.versaoId, nome: "Mensal", alvoTipo: "sistema", alvoId, alvoNome: "Bomba", modo: "calendario", intervalo: 1, unidade: "meses", dataBase: "2026-01-01", tempoMinutos: null, tipoTempo: null, toleranciaAntes: 0, toleranciaDepois: 0 }] };
const ocorrencia = { tipo: "calendario", id: "00000000-0000-4000-8000-000000000007", cliente_id: ids.clienteId, plano_id: ids.planoId, versao_id: ids.versaoId, rotina_id: rotinaId, alvo_id: alvoId, vencimento_original: "2026-01-01", data_programada: null, visita_estado: null, visita_revisao: null, snapshot_hash: foto.snapshotHash, completude: "desconhecida" };

beforeEach(async () => {
  rede.fetch.mockReset().mockResolvedValue(resposta(user));
  const { error } = await supabase.auth.setSession({ access_token: token, refresh_token: "sintetico" });
  if (error) throw error;
  rede.fetch.mockReset();
});

describe("exportação de cronograma com SDK Supabase e rede simulada", () => {
  it("consulta e reconfere fotografia e fonte antes de entregar XLSX", async () => {
    rede.fetch.mockImplementation(async (url: unknown) => {
      const endereco = String(url);
      if (endereco.includes("/auth/v1/user")) return resposta(user);
      if (endereco.includes("/rpc/sso_snapshot_exportacao_conferido")) return resposta(foto);
      if (endereco.includes("/rpc/sso_ocorrencias_cronograma_conferidas")) return resposta([ocorrencia]);
      throw new Error("Requisição inesperada.");
    });
    const arquivo = await prepararCronogramaAutenticado(userId, ids, janela, {}, "xlsx");
    expect(arquivo.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(rede.fetch.mock.calls.filter(([url]) => String(url).includes("/rpc/sso_snapshot_exportacao_conferido"))).toHaveLength(2);
    expect(rede.fetch.mock.calls.filter(([url]) => String(url).includes("/rpc/sso_ocorrencias_cronograma_conferidas"))).toHaveLength(2);
  });

  it("recusa arquivo quando a consulta final da fonte perde autorização", async () => {
    let consultasFonte = 0;
    rede.fetch.mockImplementation(async (url: unknown) => {
      const endereco = String(url);
      if (endereco.includes("/auth/v1/user")) return resposta(user);
      if (endereco.includes("/rpc/sso_snapshot_exportacao_conferido")) return resposta(foto);
      if (endereco.includes("/rpc/sso_ocorrencias_cronograma_conferidas")) return ++consultasFonte === 1 ? resposta([ocorrencia]) : resposta({ code: "42501", message: "sem_acesso" }, 403);
      throw new Error("Requisição inesperada.");
    });
    await expect(prepararCronogramaAutenticado(userId, ids, janela, {}, "xlsx")).rejects.toMatchObject({ code: "42501" });
  });

  it("recusa arquivo se verificação de identidade mudar após leitura", async () => {
    let mudou = false;
    rede.fetch.mockImplementation(async (url: unknown) => {
      const endereco = String(url);
      if (endereco.includes("/auth/v1/user")) return resposta(mudou ? { ...user, id: ids.clienteId } : user);
      if (endereco.includes("/rpc/sso_snapshot_exportacao_conferido")) { mudou = true; return resposta(foto); }
      throw new Error("Consulta inesperada após troca.");
    });
    await expect(prepararCronogramaAutenticado(userId, ids, janela, {}, "xlsx")).rejects.toThrow("Sessão alterada");
    expect(rede.fetch.mock.calls.some(([url]) => String(url).includes("/rpc/sso_ocorrencias_cronograma_conferidas"))).toBe(false);
  });
});

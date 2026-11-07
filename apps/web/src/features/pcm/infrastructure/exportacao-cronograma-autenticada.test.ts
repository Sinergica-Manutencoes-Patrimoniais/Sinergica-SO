import { expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getUser: vi.fn(), foto: vi.fn(), fonte: vi.fn(), gerar: vi.fn() }));
vi.mock("../../../lib/supabase-client", () => ({ supabase: { auth: { getUser: api.getUser } } }));
vi.mock("./supabase-snapshot-exportacao", () => ({ obterPaginaSnapshotExportacao: api.foto }));
vi.mock("./supabase-fonte-cronograma", () => ({ obterPaginaCronograma: api.fonte }));
vi.mock("./exportar-cronograma-fotografia", () => ({ gerarPdfCronogramaFotografia: api.gerar, gerarXlsxCronogramaFotografia: api.gerar }));
import { prepararCronogramaAutenticado } from "./exportacao-cronograma-autenticada";

const userId = "00000000-0000-4000-8000-000000000001";
const ids = { clienteId: "00000000-0000-4000-8000-000000000002", planoId: "00000000-0000-4000-8000-000000000003", versaoId: "00000000-0000-4000-8000-000000000004" };
const janela = { inicio: "2026-01-01", fim: "2026-01-31", feriadosInformados: [] };
const fotografia = { ...ids, planoNome: "Plano", versaoNumero: 1, vigenciaInicio: "2026-01-01", vigenciaFim: null, snapshotHash: "a".repeat(32), total: 0, posicao: 0, proximaPosicao: null, rotinas: [], capacidadeIncluida: false, cronogramaOperacionalIncluido: false };

it("prepara arquivo mantendo a identidade verificada durante as leituras", async () => {
  api.getUser.mockReset().mockResolvedValue({ data: { user: { id: userId } }, error: null });
  api.foto.mockReset().mockResolvedValue(fotografia);
  api.fonte.mockReset().mockResolvedValue([]);
  api.gerar.mockReset().mockResolvedValue(new Blob(["arquivo"]));
  expect(await prepararCronogramaAutenticado(userId, ids, janela, {}, "xlsx")).toBeInstanceOf(Blob);
  expect(api.foto).toHaveBeenCalledTimes(2);
  expect(api.fonte).toHaveBeenCalledTimes(2);
});

it("não entrega arquivo quando usuário muda durante leitura", async () => {
  api.getUser.mockReset().mockResolvedValueOnce({ data: { user: { id: userId } }, error: null }).mockResolvedValue({ data: { user: { id: ids.clienteId } }, error: null });
  api.foto.mockReset().mockResolvedValue(fotografia);
  api.fonte.mockReset().mockResolvedValue([]);
  api.gerar.mockReset();
  await expect(prepararCronogramaAutenticado(userId, ids, janela, {}, "xlsx")).rejects.toThrow();
  expect(api.gerar).not.toHaveBeenCalled();
});

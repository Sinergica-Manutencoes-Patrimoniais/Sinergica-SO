// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const permissao = vi.hoisted(() => vi.fn());
vi.mock("../../infrastructure/supabase-capacidades-sso-adapter", () => ({
  supabaseCapacidadesSsoAdapter: { autorizarAcao: permissao },
}));
import { ExportarPreviaCiclos } from "./ExportarPreviaCiclos";

const criarUrl = vi.fn();
const revogarUrl = vi.fn();
let clicar: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.stubEnv("VITE_SSO_EXPORTAR_PREVIA_CICLOS_CSV_ENABLED", "true");
  permissao.mockResolvedValue(true);
  vi.stubGlobal("URL", Object.assign(class extends URL {}, { createObjectURL: criarUrl, revokeObjectURL: revogarUrl }));
  criarUrl.mockReturnValue("blob:previa-teste");
  clicar = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.clearAllMocks(); });

function montar(ciclos = [{ ciclo: 1, vencimento: "2026-12-25", toleranciaAntes: 2, toleranciaDepois: 3 }]) {
  render(<ExportarPreviaCiclos clienteId="=cliente" planoId="plano" versaoId="versao" rotinaId="rotina" inicio="2026-12-01" fim="2026-12-31" ciclos={ciclos} feriados={["2026-12-25"]}/>);
}
function lerBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => { const leitor = new FileReader(); leitor.onload = () => resolve(String(leitor.result)); leitor.onerror = () => reject(leitor.error); leitor.readAsText(blob); });
}

it("exporta ciclos reais com escopo, tolerâncias, simulação e proteção contra fórmula", async () => {
  montar(); fireEvent.click(screen.getByRole("button", { name: "Exportar prévia parcial em CSV" }));
  await waitFor(() => expect(criarUrl).toHaveBeenCalledTimes(1));
  const csv = await lerBlob(criarUrl.mock.calls[0]?.[0] as Blob);
  expect(csv).toContain("Prévia parcial");
  expect(csv).toContain('"\'=cliente"');
  expect(csv).toContain('"2026-12-25";"2";"3"');
  expect(csv).toContain("hipotético informado; vencimento mantido");
  expect(csv).toContain("não é cronograma operacional");
  expect(permissao).toHaveBeenCalledTimes(2);
  expect(clicar).toHaveBeenCalledTimes(1);
  expect(revogarUrl).toHaveBeenCalledWith("blob:previa-teste");
});

it("preserva identificação do período quando não há ciclos", async () => {
  montar([]); fireEvent.click(screen.getByRole("button", { name: "Exportar prévia parcial em CSV" }));
  await waitFor(() => expect(criarUrl).toHaveBeenCalledTimes(1));
  const csv = await lerBlob(criarUrl.mock.calls[0]?.[0] as Blob);
  expect(csv).toContain("nenhum ciclo retornado");
  expect(csv).toContain('"2026-12-01";"2026-12-31"');
  expect(csv).toContain("fonte oficial de feriados não consultada");
});

it("não cria download se a autorização for revogada durante a geração", async () => {
  permissao.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
  montar(); fireEvent.click(screen.getByRole("button", { name: "Exportar prévia parcial em CSV" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível exportar");
  expect(criarUrl).not.toHaveBeenCalled(); expect(clicar).not.toHaveBeenCalled();
});

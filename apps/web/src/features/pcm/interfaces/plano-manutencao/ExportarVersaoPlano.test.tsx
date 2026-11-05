// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type {
  PlanoResumo,
  RotinaDetalhe,
  VersaoPlano,
} from "../../application/plano-manutencao-gateway";
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: () => ({}) } }));
import { ExportarVersaoPlano } from "./ExportarVersaoPlano";
import { supabaseCapacidadesSsoAdapter } from "../../infrastructure/supabase-capacidades-sso-adapter";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("bloqueia PDF, CSV e XLSX ao misturar Rotina de outra versão", () => {
  vi.stubEnv("VITE_SSO_EXPORTAR_PLANO_CSV_ENABLED", "true");
  vi.stubEnv("VITE_SSO_EXPORTAR_PLANO_XLSX_ENABLED", "true");
  const plano = { id: "p", clienteId: "c", nome: "Plano" } as PlanoResumo;
  const versao = { id: "v", planoId: "p", numero: 1, estado: "aprovado" } as VersaoPlano;
  const rotinas = [{ id: "r", planoId: "p", versaoId: "outra" }] as RotinaDetalhe[];
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ExportarVersaoPlano clienteId="c" plano={plano} versao={versao} rotinas={rotinas} completo />
    </QueryClientProvider>,
  );
  expect(screen.getByRole("alert")).toHaveTextContent(/inconsistentes/);
  expect(screen.getByRole("button", { name: "Exportar versão em PDF" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Exportar versão em CSV" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Exportar versão em XLSX" })).toBeDisabled();
});

it("disponibiliza XLSX quando autorização permanece válida", async () => {
  vi.stubEnv("VITE_SSO_EXPORTAR_PLANO_XLSX_ENABLED", "true");
  const criarUrl = vi.fn((_arquivo: Blob) => "blob:teste");
  const revogarUrl = vi.fn();
  vi.stubGlobal("URL", { createObjectURL: criarUrl, revokeObjectURL: revogarUrl });
  const autorizar = vi
    .spyOn(supabaseCapacidadesSsoAdapter, "autorizarAcao")
    .mockResolvedValue(true);
  const clicar = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  const plano = { id: "p", clienteId: "c", nome: "Plano" } as PlanoResumo;
  const versao = {
    id: "v",
    planoId: "p",
    numero: 1,
    estado: "aprovado",
    vigenciaInicio: null,
    vigenciaFim: null,
  } as VersaoPlano;
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ExportarVersaoPlano clienteId="c" plano={plano} versao={versao} rotinas={[]} completo />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Exportar versão em XLSX" }));
  await waitFor(() => expect(clicar).toHaveBeenCalledTimes(1));
  expect(autorizar).toHaveBeenCalledTimes(2);
  expect(criarUrl.mock.calls[0]?.[0]).toBeInstanceOf(Blob);
  expect(revogarUrl).toHaveBeenCalledWith("blob:teste");
});

it("não disponibiliza XLSX após revogação durante geração", async () => {
  vi.stubEnv("VITE_SSO_EXPORTAR_PLANO_XLSX_ENABLED", "true");
  const criarUrl = vi.fn(() => "blob:teste");
  vi.stubGlobal("URL", { createObjectURL: criarUrl, revokeObjectURL: vi.fn() });
  vi.spyOn(supabaseCapacidadesSsoAdapter, "autorizarAcao")
    .mockResolvedValueOnce(true)
    .mockResolvedValueOnce(false);
  const plano = { id: "p", clienteId: "c", nome: "Plano" } as PlanoResumo;
  const versao = {
    id: "v",
    planoId: "p",
    numero: 1,
    estado: "aprovado",
    vigenciaInicio: null,
    vigenciaFim: null,
  } as VersaoPlano;
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ExportarVersaoPlano clienteId="c" plano={plano} versao={versao} rotinas={[]} completo />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Exportar versão em XLSX" }));
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível exportar o XLSX"),
  );
  expect(criarUrl).not.toHaveBeenCalled();
});

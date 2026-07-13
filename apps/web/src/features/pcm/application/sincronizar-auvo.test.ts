import { describe, expect, it, vi } from "vitest";
import {
  buscarUltimaRunSincronizacaoAuvo,
  consultarRunSincronizacaoAuvo,
  deveRetomarAcompanhamento,
  iniciarSincronizacaoAuvo,
} from "./sincronizar-auvo";
import type { SincronizacaoAuvoRun, SincronizarAuvoGateway } from "./sincronizar-auvo-gateway";

// specs/E01-S67-sync-incremental-background — sync em background, polling em auvo_sync_runs.

function gatewayMock(overrides: Partial<SincronizarAuvoGateway> = {}): SincronizarAuvoGateway {
  return {
    iniciar: vi.fn(async () => ({ runId: "run-1" })),
    consultarRun: vi.fn(async () => runFixture()),
    buscarUltimaRun: vi.fn(async () => null),
    ...overrides,
  };
}

function runFixture(overrides: Partial<SincronizacaoAuvoRun> = {}): SincronizacaoAuvoRun {
  return {
    id: "run-1",
    status: "running",
    ok: null,
    etapas: [],
    startedAt: new Date().toISOString(),
    finishedAt: null,
    ...overrides,
  };
}

describe("iniciarSincronizacaoAuvo / consultarRunSincronizacaoAuvo / buscarUltimaRunSincronizacaoAuvo", () => {
  it("delega ao gateway", async () => {
    const gateway = gatewayMock();
    await iniciarSincronizacaoAuvo(gateway);
    await consultarRunSincronizacaoAuvo(gateway, "run-1");
    await buscarUltimaRunSincronizacaoAuvo(gateway);
    expect(gateway.iniciar).toHaveBeenCalledOnce();
    expect(gateway.consultarRun).toHaveBeenCalledWith("run-1");
    expect(gateway.buscarUltimaRun).toHaveBeenCalledOnce();
  });
});

describe("deveRetomarAcompanhamento", () => {
  const agora = new Date("2026-07-13T12:00:00Z");

  it("não retoma quando não há run nenhuma", () => {
    expect(deveRetomarAcompanhamento(null, agora)).toBe(false);
  });

  it("não retoma run já concluída (succeeded)", () => {
    const run = runFixture({ status: "succeeded", startedAt: "2026-07-13T11:59:00Z" });
    expect(deveRetomarAcompanhamento(run, agora)).toBe(false);
  });

  it("não retoma run já concluída (failed)", () => {
    const run = runFixture({ status: "failed", startedAt: "2026-07-13T11:59:00Z" });
    expect(deveRetomarAcompanhamento(run, agora)).toBe(false);
  });

  it("retoma run 'running' iniciada há poucos minutos", () => {
    const run = runFixture({ status: "running", startedAt: "2026-07-13T11:55:00Z" });
    expect(deveRetomarAcompanhamento(run, agora)).toBe(true);
  });

  it("NÃO retoma run 'running' travada há mais de 10 minutos (worker morreu sem finalizar)", () => {
    const run = runFixture({ status: "running", startedAt: "2026-07-13T11:45:00Z" });
    expect(deveRetomarAcompanhamento(run, agora)).toBe(false);
  });

  it("borda: exatamente 10 minutos não retoma (limite exclusivo)", () => {
    const run = runFixture({ status: "running", startedAt: "2026-07-13T11:50:00Z" });
    expect(deveRetomarAcompanhamento(run, agora)).toBe(false);
  });
});

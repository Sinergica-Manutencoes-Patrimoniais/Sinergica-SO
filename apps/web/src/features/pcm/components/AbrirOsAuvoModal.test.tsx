// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("../../../lib/supabase-client", () => ({
  supabase: { functions: { invoke } },
}));

const PREVIEW_ABRIVEL = {
  jaAberta: false,
  taskIdExistente: null,
  podeAbrir: true,
  pendencias: [],
  payload: { customerId: 1, taskTypeId: 2, priority: 1, orientation: "Trocar disjuntor" },
  conferenciaPcm: {
    cliente: "Cliente teste",
    tecnico: "Não atribuído",
    dataAgendada: null,
    local: null,
  },
};

describe("AbrirOsAuvoModal — E01-S196 AC-9", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("exige motivo antes de confirmar — não deixa abrir manual sem contingência registrada", async () => {
    invoke.mockResolvedValueOnce({ data: PREVIEW_ABRIVEL, error: null });
    const { AbrirOsAuvoModal } = await import("./AbrirOsAuvoModal");
    const usuario = userEvent.setup();
    render(<AbrirOsAuvoModal osId="os-1" onFechar={vi.fn()} onAberta={vi.fn()} />);
    await screen.findByText("Conferência PCM");
    await usuario.click(screen.getByRole("button", { name: "Confirmar abertura" }));
    expect(await screen.findByText(/Informe o motivo/i)).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledTimes(1); // só o preview — a confirmação não chegou a sair
  });

  it("confirma com motivo — envia requestId e motivo pra Edge Function", async () => {
    invoke
      .mockResolvedValueOnce({ data: PREVIEW_ABRIVEL, error: null })
      .mockResolvedValueOnce({ data: { ok: true, taskId: 123 }, error: null });
    const onAberta = vi.fn();
    const { AbrirOsAuvoModal } = await import("./AbrirOsAuvoModal");
    const usuario = userEvent.setup();
    render(<AbrirOsAuvoModal osId="os-1" onFechar={vi.fn()} onAberta={onAberta} />);
    await screen.findByText("Conferência PCM");
    await usuario.type(
      screen.getByLabelText(/Motivo da abertura manual/i),
      "Auvo fora do ar, PCM abriu manualmente pra não atrasar a visita",
    );
    await usuario.click(screen.getByRole("button", { name: "Confirmar abertura" }));
    await waitFor(() => expect(onAberta).toHaveBeenCalled());
    expect(invoke).toHaveBeenCalledWith(
      "pcm-auvo-open-task",
      expect.objectContaining({
        body: expect.objectContaining({
          osId: "os-1",
          dryRun: false,
          motivo: "Auvo fora do ar, PCM abriu manualmente pra não atrasar a visita",
        }),
      }),
    );
  });
});

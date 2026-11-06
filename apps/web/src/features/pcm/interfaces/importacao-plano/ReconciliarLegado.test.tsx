// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ReconciliarLegado } from "./ReconciliarLegado";

const lote = { id: "00000000-0000-4000-8000-000000000002", fonte: "Rimini", revisao: 2, criadoEm: "2026-10-30T00:00:00Z", reconciliado: false };
const props = { userId: "00000000-0000-4000-8000-000000000004", clienteId: "cliente-a", lote };
afterEach(() => { sessionStorage.clear(); vi.restoreAllMocks(); });

it("exige motivo e conferência antes de solicitar transporte", async () => {
  const enviar = vi.fn().mockResolvedValue(undefined);
  render(<ReconciliarLegado {...props} enviar={enviar} />);
  expect(screen.getByRole("button", { name: "Solicitar reconciliação" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Motivo da reconciliação"), { target: { value: "Conferido pelo PCM" } });
  fireEvent.click(screen.getByLabelText("Conferi o lote e a revisão"));
  fireEvent.click(screen.getByRole("button", { name: "Solicitar reconciliação" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Reconciliação registrada"));
  expect(enviar).toHaveBeenCalledWith(expect.objectContaining({ atorId: props.userId, clienteId: "cliente-a", loteId: lote.id, revisao: 2, motivo: "Conferido pelo PCM" }));
  expect(screen.queryByRole("button", { name: "Solicitar reconciliação" })).not.toBeInTheDocument();
});

it("repete exatamente a tentativa após resultado incerto", async () => {
  const enviar = vi.fn().mockRejectedValueOnce(new Error("incerto")).mockResolvedValueOnce(undefined);
  render(<ReconciliarLegado {...props} enviar={enviar} />);
  fireEvent.change(screen.getByLabelText("Motivo da reconciliação"), { target: { value: "Conferido" } });
  fireEvent.click(screen.getByLabelText("Conferi o lote e a revisão"));
  fireEvent.click(screen.getByRole("button", { name: "Solicitar reconciliação" }));
  fireEvent.click(await screen.findByRole("button", { name: "Repetir mesma tentativa" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Reconciliação registrada"));
  expect(enviar).toHaveBeenCalledTimes(2);
  expect(enviar.mock.calls[1]?.[0]).toEqual(enviar.mock.calls[0]?.[0]);
});

it("exige nova confirmação se revisão muda antes do envio", () => {
  const enviar = vi.fn();
  const { rerender } = render(<ReconciliarLegado {...props} enviar={enviar} />);
  fireEvent.change(screen.getByLabelText("Motivo da reconciliação"), { target: { value: "Conferido" } });
  fireEvent.click(screen.getByLabelText("Conferi o lote e a revisão"));
  rerender(<ReconciliarLegado {...props} lote={{ ...lote, revisao: 3 }} enviar={enviar} />);
  expect(screen.getByRole("button", { name: "Solicitar reconciliação" })).toBeDisabled();
  expect(enviar).not.toHaveBeenCalled();
});

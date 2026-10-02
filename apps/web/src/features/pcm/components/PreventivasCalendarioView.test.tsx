// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PreventivasCalendarioView } from "./PreventivasCalendarioView";

describe("PreventivasCalendarioView", () => {
  it("posiciona a ocorrência no mês e abre o histórico correspondente", async () => {
    const onSelecionar = vi.fn();
    render(
      <PreventivasCalendarioView
        mesInicial={new Date(2026, 9, 1)}
        onSelecionar={onSelecionar}
        ocorrencias={[
          {
            id: "ocorrencia-1",
            nomePlano: "Preventiva ar condicionado",
            vencimento: "2026-10-14",
            visitaEm: null,
            estado: "prevista",
          },
        ]}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Preventiva ar condicionado/ }));
    expect(onSelecionar).toHaveBeenCalledWith("ocorrencia-1");
  });
});

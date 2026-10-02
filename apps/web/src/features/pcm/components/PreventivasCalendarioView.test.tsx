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

  it("filtra o calendário pelo resultado consolidado sem ocultar a navegação mensal", async () => {
    const user = userEvent.setup();
    render(
      <PreventivasCalendarioView
        mesInicial={new Date(2026, 9, 1)}
        onSelecionar={vi.fn()}
        ocorrencias={[
          {
            id: "ocorrencia-ok",
            nomePlano: "Preventiva aprovada",
            vencimento: "2026-10-14",
            visitaEm: null,
            estado: "concluida",
            resultado: "ok",
          },
          {
            id: "ocorrencia-nao-ok",
            nomePlano: "Preventiva com achado",
            vencimento: "2026-10-15",
            visitaEm: null,
            estado: "concluida",
            resultado: "nao_ok",
          },
        ]}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Filtrar por resultado"), "nao_ok");

    expect(screen.queryByRole("button", { name: /Preventiva aprovada/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Preventiva com achado/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Próximo mês" })).toBeEnabled();
  });

  it("muda de mês preservando a ocorrência na data de visita agendada", async () => {
    const user = userEvent.setup();
    render(
      <PreventivasCalendarioView
        mesInicial={new Date(2026, 9, 1)}
        onSelecionar={vi.fn()}
        ocorrencias={[
          {
            id: "ocorrencia-visita",
            nomePlano: "Preventiva com visita",
            vencimento: "2026-10-14",
            visitaEm: "2026-11-03T13:00:00.000Z",
            estado: "agendada",
          },
        ]}
      />,
    );

    expect(screen.getByText("outubro de 2026")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Preventiva com visita: Agendada/ }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Próximo mês" }));

    expect(screen.getByText("novembro de 2026")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Preventiva com visita: Agendada/ }),
    ).toBeInTheDocument();
  });
});

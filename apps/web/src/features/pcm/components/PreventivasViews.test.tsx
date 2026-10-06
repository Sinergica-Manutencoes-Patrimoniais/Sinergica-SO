// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ItemCalendarioPreventiva } from "./PreventivasCalendarioView";
import { PreventivasListaView } from "./PreventivasListaView";
import { PreventivasTimelineView } from "./PreventivasTimelineView";

const ocorrencias: ItemCalendarioPreventiva[] = [
  {
    id: "occ-1",
    nomePlano: "Extintores",
    vencimento: "2026-10-10",
    visitaEm: null,
    estado: "prevista",
    resultado: "pendente",
  },
  {
    id: "occ-2",
    nomePlano: "Bombas",
    vencimento: "2026-10-08",
    visitaEm: "2026-10-09T10:00:00Z",
    estado: "agendada",
    resultado: "ok",
  },
];

describe("visões de preventivas — E01-S163", () => {
  it("lista todas as ocorrências e abre o mesmo detalhe", async () => {
    const onSelecionar = vi.fn();
    render(<PreventivasListaView ocorrencias={ocorrencias} onSelecionar={onSelecionar} />);

    expect(screen.getAllByRole("button", { name: /ver preventiva/i })).toHaveLength(2);
    await userEvent.click(screen.getByRole("button", { name: /ver preventiva extintores/i }));
    expect(onSelecionar).toHaveBeenCalledWith("occ-1");
  });

  it("mantém as mesmas ocorrências na timeline ordenada pela data operacional", () => {
    render(<PreventivasTimelineView ocorrencias={ocorrencias} onSelecionar={vi.fn()} />);

    expect(screen.getAllByRole("button", { name: /ver preventiva/i })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /ver preventiva/i })[0]).toHaveTextContent(
      "Bombas",
    );
  });
});

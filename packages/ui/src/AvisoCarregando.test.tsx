// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AvisoCarregando } from "./AvisoCarregando";

describe("AvisoCarregando — E00-S29", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("não pinta nada antes de 200ms — resposta rápida não chega a tremer a tela", () => {
    const { container } = render(<AvisoCarregando>Carregando escopo…</AvisoCarregando>);
    expect(container.textContent).toBe("");
    act(() => vi.advanceTimersByTime(199));
    expect(container.textContent).toBe("");
  });

  it("aparece depois de 200ms, como status anunciável", () => {
    render(<AvisoCarregando>Carregando escopo…</AvisoCarregando>);
    act(() => vi.advanceTimersByTime(200));
    const aviso = screen.getByRole("status");
    expect(aviso).toHaveTextContent("Carregando escopo…");
    expect(aviso.tagName).toBe("OUTPUT");
  });
});

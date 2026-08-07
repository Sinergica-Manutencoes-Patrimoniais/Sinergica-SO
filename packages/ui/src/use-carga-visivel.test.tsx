import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCargaVisivel } from "./use-carga-visivel";

describe("useCargaVisivel — E00-S17 AC-2", () => {
  it("requisição rápida (< 200ms) nunca mostra o skeleton", async () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ carregando }) => useCargaVisivel(carregando), {
      initialProps: { carregando: true },
    });
    expect(result.current).toBe(false);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender({ carregando: false });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe(false);
    vi.useRealTimers();
  });

  it("depois de 200ms carregando, passa a mostrar", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCargaVisivel(true));
    expect(result.current).toBe(false);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe(true);
    vi.useRealTimers();
  });

  it("uma vez visível, fica pelo menos 400ms mesmo se carregando virar false antes", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ carregando }) => useCargaVisivel(carregando), {
      initialProps: { carregando: true },
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe(true);
    act(() => {
      vi.advanceTimersByTime(50);
    });
    rerender({ carregando: false });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe(true); // ainda dentro dos 400ms mínimos (mostrou há 150ms)
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe(false);
    vi.useRealTimers();
  });
});

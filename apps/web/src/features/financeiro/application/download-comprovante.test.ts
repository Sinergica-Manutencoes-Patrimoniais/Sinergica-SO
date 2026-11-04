// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { nomeSeguroComprovante, salvarComprovante } from "./robustez";

describe("download de comprovante", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([
    [[0x25, 0x50, 0x44, 0x46, 0x2d], "comprovante.pdf"],
    [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "comprovante.png"],
    [[0xff, 0xd8, 0xff], "comprovante.jpg"],
    [[0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50], "comprovante.webp"],
    [[0x3c, 0x73, 0x76, 0x67, 0x3e], "comprovante.bin"],
  ])(
    "identifica extensão por assinatura e mantém tipo desconhecido genérico",
    async (bytes, nome) => {
      const arquivo = new Blob([new Uint8Array(bytes)], { type: "application/octet-stream" });
      expect(await nomeSeguroComprovante(arquivo)).toBe(nome);
    },
  );

  it("baixa o arquivo sem depender de abertura de janela após resposta assíncrona", () => {
    const arquivo = new Blob(["conteúdo"], { type: "application/octet-stream" });
    const criar = vi.fn().mockReturnValue("blob:comprovante");
    const revogar = vi.fn();
    vi.stubGlobal(
      "URL",
      Object.assign(class extends URL {}, { createObjectURL: criar, revokeObjectURL: revogar }),
    );
    const clique = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      expect(this.href).toBe("blob:comprovante");
      expect(this.download).toBe("comprovante.bin");
    });
    vi.useFakeTimers();
    salvarComprovante(arquivo);
    expect(criar).toHaveBeenCalledWith(arquivo);
    expect(clique).toHaveBeenCalledOnce();
    expect(revogar).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revogar).toHaveBeenCalledWith("blob:comprovante");
  });
});

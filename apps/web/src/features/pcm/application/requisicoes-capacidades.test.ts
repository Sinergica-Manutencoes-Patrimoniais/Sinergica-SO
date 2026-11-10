import { describe, expect, it, vi } from "vitest";
import { criarRegistroRequisicoes } from "./requisicoes-capacidades";

describe("repetição segura de comandos", () => {
  it("preserva o pedido incerto quando o conteúdo muda", () => {
    const gerar = vi.fn().mockReturnValueOnce("id-1").mockReturnValueOnce("id-2");
    const registro = criarRegistroRequisicoes(gerar);
    expect(registro.obter("form", { ativo: true })).toBe("id-1");
    expect(() => registro.obter("form", { ativo: false })).toThrow();
    expect(registro.obter("form", { ativo: true })).toBe("id-1");
    registro.concluir("form", "id-1");
    expect(registro.obter("form", { ativo: false })).toBe("id-2");
  });

  it("não apaga pedido novo ao receber conclusão antiga", () => {
    const gerar = vi.fn().mockReturnValueOnce("id-1").mockReturnValueOnce("id-2");
    const registro = criarRegistroRequisicoes(gerar);
    registro.obter("form", { ativo: true });
    registro.concluir("form", "id-1");
    registro.obter("form", { ativo: false });
    registro.concluir("form", "id-1");
    expect(registro.obter("form", { ativo: false })).toBe("id-2");
  });

  it("recupera pedido incerto em nova montagem e bloqueia outro comando", () => {
    const storage = new Map<string, string>();
    const banco = {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => {
        storage.set(k, v);
      },
      removeItem: (k: string) => {
        storage.delete(k);
      },
    };
    const primeiro = criarRegistroRequisicoes(() => "id-1", banco, "usuario");
    primeiro.obter("nova-concessao", { ativa: true });
    const segundo = criarRegistroRequisicoes(() => "id-2", banco, "usuario");
    expect(segundo.pendente()).toEqual({
      chave: "nova-concessao",
      payload: { ativa: true },
      id: "id-1",
    });
    expect(() => segundo.obter("outro", {})).toThrow();
    expect(segundo.obter("nova-concessao", { ativa: true })).toBe("id-1");
    segundo.concluir("nova-concessao", "id-1");
    expect(segundo.pendente()).toBeNull();
  });

  it("não apaga nem sobrescreve registro corrompido", () => {
    const banco = { getItem: () => "inválido", setItem: vi.fn(), removeItem: vi.fn() };
    const registro = criarRegistroRequisicoes(() => "id-1", banco, "usuario");
    expect(() => registro.pendente()).toThrow();
    expect(() => registro.obter("form", {})).toThrow();
    expect(banco.setItem).not.toHaveBeenCalled();
    expect(banco.removeItem).not.toHaveBeenCalled();
  });

  it("isola os pedidos de usuários na mesma sessão", () => {
    const storage = new Map<string, string>();
    const banco = {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => {
        storage.set(k, v);
      },
      removeItem: (k: string) => {
        storage.delete(k);
      },
    };
    criarRegistroRequisicoes(() => "id-1", banco, "um").obter("form", { ativo: true });
    const outro = criarRegistroRequisicoes(() => "id-2", banco, "dois");
    expect(outro.pendente()).toBeNull();
    expect(outro.obter("form", { ativo: false })).toBe("id-2");
    expect(criarRegistroRequisicoes(() => "id-3", banco, "um").pendente()?.id).toBe("id-1");
  });
});

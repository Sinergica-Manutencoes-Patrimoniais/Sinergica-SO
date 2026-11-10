import { beforeEach, describe, expect, it, vi } from "vitest";

const controle = vi.hoisted(() => ({
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
  onAuthStateChange: vi.fn(),
}));
vi.mock("../../../lib/supabase-client", () => {
  const query = { select: () => query, eq: () => query, maybeSingle: controle.maybeSingle };
  return {
    supabase: {
      auth: { getUser: controle.getUser, onAuthStateChange: controle.onAuthStateChange },
      schema: () => ({ from: () => query }),
    },
  };
});

import { confirmarAcessoVersaoPdf, observarMudancaSessaoPdf } from "./supabase-proposta-adapter";

describe("revalidação de acesso à versão PDF", () => {
  beforeEach(() => vi.clearAllMocks());

  it("nega quando RLS não retorna a versão", async () => {
    controle.getUser.mockResolvedValue({ data: { user: { id: "u" } }, error: null });
    controle.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await confirmarAcessoVersaoPdf("u", "p", "v")).toBe(false);
  });

  it("nega quando usuário muda durante revalidação", async () => {
    controle.getUser
      .mockResolvedValueOnce({ data: { user: { id: "u" } }, error: null })
      .mockResolvedValueOnce({ data: { user: { id: "outro" } }, error: null });
    controle.maybeSingle.mockResolvedValue({ data: { id: "v" }, error: null });
    expect(await confirmarAcessoVersaoPdf("u", "p", "v")).toBe(false);
  });

  it("invalida a operação na troca de sessão e limpa assinatura", () => {
    let notificar!: (evento: string) => void;
    const unsubscribe = vi.fn();
    controle.onAuthStateChange.mockImplementation((callback) => {
      notificar = callback;
      return { data: { subscription: { unsubscribe } } };
    });
    const invalidar = vi.fn();
    const limpar = observarMudancaSessaoPdf(invalidar);
    notificar("SIGNED_OUT");
    notificar("SIGNED_IN");
    notificar("USER_UPDATED");
    notificar("TOKEN_REFRESHED");
    expect(invalidar).toHaveBeenCalledTimes(3);
    limpar();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});

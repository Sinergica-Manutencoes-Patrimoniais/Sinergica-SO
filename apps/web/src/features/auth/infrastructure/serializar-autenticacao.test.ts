import { describe, expect, it, vi } from "vitest";
import { serializarAutenticacao } from "./serializar-autenticacao";

describe("operações de autenticação no mesmo cliente", () => {
  it("espera saída terminar antes de executar próxima entrada", async () => {
    let terminar!: () => void;
    const auth = {
      signOut: vi.fn(
        () =>
          new Promise<{ error: null }>((resolve) => {
            terminar = () => resolve({ error: null });
          }),
      ),
      signInWithPassword: vi.fn(async () => ({ data: { session: null }, error: null })),
      getSession: vi.fn(async () => ({ data: { session: { user: { id: "A" } } }, error: null })),
    };
    const fila = serializarAutenticacao(auth);
    const saida = fila.signOut();
    await vi.waitFor(() => expect(auth.signOut).toHaveBeenCalledOnce());
    const entrada = fila.signInWithPassword({ email: "b@teste", password: "senha" });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
    terminar();
    await Promise.all([saida, entrada]);
    expect(auth.signInWithPassword).toHaveBeenCalledOnce();
  });
  it("não encerra outra identidade quando perfil antigo não existe", async () => {
    const auth = {
      signOut: vi.fn(async () => ({ error: null })),
      signInWithPassword: vi.fn(),
      getSession: vi.fn(async () => ({ data: { session: { user: { id: "B" } } }, error: null })),
    };
    await serializarAutenticacao(auth).signOut("A");
    expect(auth.signOut).not.toHaveBeenCalled();
  });
  it("libera fila quando operação falha", async () => {
    const auth = {
      signOut: vi.fn().mockRejectedValueOnce(new Error("falha")),
      signInWithPassword: vi.fn(async () => ({ data: { session: null }, error: null })),
      getSession: vi.fn(),
    };
    const fila = serializarAutenticacao(auth);
    await expect(fila.signOut()).rejects.toThrow("falha");
    await fila.signInWithPassword({ email: "b@teste", password: "senha" });
    expect(auth.signInWithPassword).toHaveBeenCalledOnce();
  });
});

interface AuthSerializavel<T> {
  signInWithPassword(credenciais: { email: string; password: string }): Promise<T>;
  signOut(): Promise<{ error: unknown }>;
  getSession(): Promise<{ data: { session: { user: { id: string } } | null }; error: unknown }>;
}

/** Coordena apenas operações feitas pelo mesmo cliente nesta instância da aplicação. */
export function serializarAutenticacao<T>(auth: AuthSerializavel<T>) {
  let anterior: Promise<unknown> = Promise.resolve();
  function executar<R>(operacao: () => Promise<R>): Promise<R> {
    const atual = anterior.then(operacao);
    anterior = atual.catch(() => undefined);
    return atual;
  }
  return {
    signInWithPassword: (credenciais: { email: string; password: string }) =>
      executar(() => auth.signInWithPassword(credenciais)),
    signOut: (usuarioEsperado?: string) =>
      executar(async () => {
        if (usuarioEsperado) {
          const { data, error } = await auth.getSession();
          if (error) throw error;
          if (data.session?.user.id !== usuarioEsperado) return;
        }
        const { error } = await auth.signOut();
        if (error) throw error;
      }),
  };
}

type Armazenamento = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type Pendente = { chave: string; payload: object; id: string };

/** Uma alteração incerta por usuário/sessão; armazenamento falho bloqueia novas escritas. */
export function criarRegistroRequisicoes(
  gerar: () => string = () => crypto.randomUUID(),
  armazenamento?: Armazenamento,
  usuarioId?: string,
) {
  let memoria: string | null = null;
  const chaveStorage = `sso-capacidades-pendente:${usuarioId ?? "memoria"}`;
  const ler = (): Pendente | null => {
    const texto = armazenamento ? armazenamento.getItem(chaveStorage) : memoria;
    if (texto === null) return null;
    const valor: unknown = JSON.parse(texto);
    if (
      !valor ||
      typeof valor !== "object" ||
      Array.isArray(valor) ||
      !("chave" in valor) ||
      typeof valor.chave !== "string" ||
      !valor.chave ||
      !("id" in valor) ||
      typeof valor.id !== "string" ||
      !valor.id ||
      !("payload" in valor) ||
      !valor.payload ||
      typeof valor.payload !== "object" ||
      Array.isArray(valor.payload)
    )
      throw new Error("Pedido de capacidade inválido.");
    return { chave: valor.chave, id: valor.id, payload: valor.payload };
  };
  const gravar = (valor: Pendente) => {
    const texto = JSON.stringify(valor);
    if (armazenamento) armazenamento.setItem(chaveStorage, texto);
    else memoria = texto;
  };
  return {
    pendente: ler,
    obter(chave: string, payload: object): string {
      const atual = ler();
      if (atual) {
        if (atual.chave === chave && JSON.stringify(atual.payload) === JSON.stringify(payload))
          return atual.id;
        throw new Error("Existe uma alteração pendente com outros dados.");
      }
      const id = gerar();
      gravar({ chave, payload, id });
      return id;
    },
    concluir(chave: string, id: string, payload?: object): boolean {
      const atual = ler();
      if (atual?.chave !== chave || atual.id !== id || (payload !== undefined && JSON.stringify(atual.payload) !== JSON.stringify(payload))) return false;
      if (armazenamento) armazenamento.removeItem(chaveStorage);
      else memoria = null;
      return true;
    },
  };
}

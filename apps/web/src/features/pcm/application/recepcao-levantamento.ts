import { z } from "zod";

const linhaSchema = z
  .object({
    chave: z.string().trim().min(1).max(200),
    tipo: z.enum([
      "area",
      "local",
      "sublocal",
      "sistema",
      "equipamento",
      "componente",
      "grupo_quantitativo",
    ]),
    atributos: z.object({
      nome: z.string().trim().min(1).max(4000),
      observacoes: z.string().max(4000).optional(),
      quantidade: z.number().finite().nonnegative().optional(),
      codigoInformado: z.string().max(4000).optional(),
      referenciaPai: z.string().max(4000).optional(),
      sistemaProvisorio: z.string().max(4000).optional(),
      localProvisorio: z.string().max(4000).optional(),
      classificacao: z.string().max(4000).optional(),
    }).strict(),
  })
  .strict();
const dadosSchema = z
  .object({
    origem: z.enum(["planilha", "auvo", "campo"]).nullable(),
    chaveOrigem: z.string().trim().min(1).max(200),
    linhas: z.array(linhaSchema).min(1).max(1000),
  })
  .strict();
const pedidoSchema = dadosSchema.extend({ requestId: z.string().uuid() }).strict();
export type RecepcaoLevantamento = z.infer<typeof pedidoSchema>;
export function validarRecepcaoLevantamento(valor: unknown): RecepcaoLevantamento {
  return pedidoSchema.parse(valor);
}
type Dados = z.infer<typeof dadosSchema>;
type StorageLocal = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export function criarRegistroRecepcao(
  userId: string,
  clienteId: string,
  storage: StorageLocal,
  gerar = () => crypto.randomUUID(),
) {
  if (!userId || !clienteId) throw new Error("Identidade e Cliente são obrigatórios.");
  const chave = `sso-levantamento-pendente:${JSON.stringify([userId, clienteId])}`;
  const pendente = (): RecepcaoLevantamento | null => {
    const texto = storage.getItem(chave);
    if (texto === null) return null;
    return pedidoSchema.parse(JSON.parse(texto));
  };
  return {
    pendente,
    preparar(dados: Dados, requestIdReservado?: string): RecepcaoLevantamento {
      const validado = dadosSchema.parse(dados);
      if (new Set(validado.linhas.map((linha) => linha.chave)).size !== validado.linhas.length)
        throw new Error("Chave de linha duplicada.");
      if (new TextEncoder().encode(JSON.stringify(validado.linhas)).length > 1_048_576)
        throw new Error("Lote muito grande.");
      const anterior = pendente();
      if (anterior) {
        const { requestId: _id, ...anteriorDados } = anterior;
        if ((requestIdReservado !== undefined && anterior.requestId !== requestIdReservado) || JSON.stringify(anteriorDados) !== JSON.stringify(validado))
          throw new Error("Existe pedido pendente com outros dados.");
        return anterior;
      }
      const pedido = pedidoSchema.parse({ ...validado, requestId: requestIdReservado ?? gerar() });
      storage.setItem(chave, JSON.stringify(pedido));
      return pedido;
    },
    corresponde(pedido: RecepcaoLevantamento): boolean {
      const atual = pendente();
      return atual !== null && JSON.stringify(atual) === JSON.stringify(pedidoSchema.parse(pedido));
    },
    concluir(requestId: string, esperado?: RecepcaoLevantamento): boolean {
      const atual = pendente();
      if (!atual || atual.requestId !== requestId || (esperado && JSON.stringify(atual) !== JSON.stringify(pedidoSchema.parse(esperado)))) return false;
      storage.removeItem(chave);
      return true;
    },
  };
}

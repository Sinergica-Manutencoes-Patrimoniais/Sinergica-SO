import { auvoGet, auvoPatchUmaVez, auvoPostUmaVez } from "./client.ts";
import type { ContratoLeituraT24, TransporteT24 } from "./fornecedor-t24.ts";
import type { LeitorPaginaIdentidadeT24 } from "./busca-identidade-t24.ts";

type Dependencias = {
  contrato: () => Promise<ContratoLeituraT24>;
  buscarPagina: LeitorPaginaIdentidadeT24;
  extrairCriacao: (resposta: unknown) => unknown;
  extrairLeitura: (resposta: unknown) => unknown;
};

/** Composição local: não registra rota nem comprova o contrato ou a cobertura da busca. */
export function criarTransporteHttpT24(d: Dependencias): TransporteT24 {
  const caminho = (id: string) => {
    if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)))
      throw new Error("Identidade remota inválida.");
    return `/tasks/${id}`;
  };
  return {
    contrato: d.contrato,
    buscarPagina: d.buscarPagina,
    async criar(payload) {
      return d.extrairCriacao(await auvoPostUmaVez<unknown>("/tasks", payload));
    },
    async atualizar(id, patch) {
      await auvoPatchUmaVez<unknown>(caminho(id), patch);
    },
    async ler(id) {
      return d.extrairLeitura(await auvoGet<unknown>(caminho(id)));
    },
  };
}

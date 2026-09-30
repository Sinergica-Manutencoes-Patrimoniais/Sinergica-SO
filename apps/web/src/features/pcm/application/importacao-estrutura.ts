import type { PlanoImportacao, ResultadoPlano } from "../domain/importacao-estrutura";

export interface RelatorioImportacao {
  numero: number;
  status: "OK" | "FALHOU" | "PULADA";
  mensagem: string;
}

/** Executor propositalmente sequencial: protege outbox/drain Auvo e preserva dependências. */
export async function executarPlanoImportacao(
  plano: PlanoImportacao,
  executarLinha: (resultado: ResultadoPlano) => Promise<void>,
  onProgresso: (atual: number, total: number) => void,
): Promise<RelatorioImportacao[]> {
  const executaveis = plano.resultados.filter((resultado) =>
    ["CRIAR", "EDITAR", "EXCLUIR"].includes(resultado.resultado),
  );
  const falhas = new Set<number>();
  const relatorio: RelatorioImportacao[] = [];
  for (const [indice, resultado] of executaveis.entries()) {
    onProgresso(indice + 1, executaveis.length);
    if (resultado.dependeDe.some((linha) => falhas.has(linha))) {
      relatorio.push({
        numero: resultado.linha.numero,
        status: "PULADA",
        mensagem: "Depende de linha que falhou.",
      });
      continue;
    }
    try {
      await executarLinha(resultado);
      relatorio.push({ numero: resultado.linha.numero, status: "OK", mensagem: "Aplicada." });
    } catch (erro) {
      falhas.add(resultado.linha.numero);
      relatorio.push({
        numero: resultado.linha.numero,
        status: "FALHOU",
        mensagem: erro instanceof Error ? erro.message : "Falha ao aplicar linha.",
      });
    }
  }
  return relatorio;
}

/** Portas do Marketing (E06-S01). O `application/` conhece estas interfaces; quem as implementa
 * é `infrastructure/marketing-supabase.ts`. Nenhuma delas escreve na plataforma de anúncios —
 * escrever na Meta está fora de escopo (FR-017, ADR-1699 §6). */

import type { LinhaDeAnuncio } from "../domain/indicadores";
import type { Periodo } from "../domain/periodo";
import type { LinhaDeReceita } from "../domain/receita-campanha";

export interface ContaDeAnuncio {
  readonly id: string;
  readonly nome: string;
  readonly contaExternaId: string;
  readonly moeda: string;
  readonly ativa: boolean;
  readonly sincronizadaEm: string | null;
}

export type OrigemDosDados = "meta" | "demonstracao";

export interface Sincronizacao {
  readonly id: string;
  readonly janelaDe: string;
  readonly janelaAte: string;
  readonly origem: OrigemDosDados;
  readonly resultado: "sucesso" | "falha";
  readonly campanhas: number;
  readonly conjuntos: number;
  readonly anuncios: number;
  readonly metricas: number;
  readonly detalhe: string | null;
  readonly concluidaEm: string;
}

export interface ResultadoDaSincronizacao {
  readonly sincronizacaoId: string;
  readonly origem: OrigemDosDados;
  readonly janela: Periodo;
  readonly gravados: {
    readonly campanhas: number;
    readonly conjuntos: number;
    readonly anuncios: number;
    readonly metricas: number;
  };
}

export interface NovoLinkRastreado {
  readonly anuncioId: string;
  readonly urlDestino: string;
  readonly rotulo?: string;
}

export interface LinkRastreado {
  readonly id: string;
  readonly anuncioId: string;
  readonly token: string;
  readonly urlDestino: string;
  readonly rotulo: string | null;
  readonly ativo: boolean;
}

/** Erro de domínio que a tela sabe traduzir. `sem_permissao_comercial` existe porque a recusa da
 * RPC de receita (AC-17) precisa virar uma frase útil, não um código cru na tela. */
export class ErroDoMarketing extends Error {
  constructor(
    readonly codigo:
      | "sem_permissao"
      | "sem_permissao_comercial"
      | "periodo_invalido"
      | "oportunidade_ja_vinculada"
      | "indisponivel",
    mensagem?: string,
  ) {
    super(mensagem ?? codigo);
    this.name = "ErroDoMarketing";
  }
}

export interface MarketingGateway {
  listarContas(): Promise<ContaDeAnuncio[]>;
  /** AC-1/AC-2/AC-3: grão anúncio no período; a árvore é montada no domínio. */
  metricasDoPeriodo(periodo: Periodo): Promise<LinhaDeAnuncio[]>;
  /** AC-16/AC-17: exige permissão no Marketing **e** no Comercial, verificada no servidor. */
  receitaPorCampanha(periodo: Periodo): Promise<LinhaDeReceita[]>;
  /** AC-11: histórico de execuções, para a tela dizer de quando é o número que mostra. */
  ultimasSincronizacoes(limite: number): Promise<Sincronizacao[]>;
  /** AC-8/AC-10/AC-12: dispara a Edge Function; autorização conferida no servidor. */
  sincronizar(contaId: string, janelaDias?: number): Promise<ResultadoDaSincronizacao>;
  /** AC-13 */
  criarLinkRastreado(novo: NovoLinkRastreado): Promise<LinkRastreado>;
  listarLinksRastreados(): Promise<LinkRastreado[]>;
  /** AC-15 */
  vincularOportunidade(entradaId: string, oportunidadeId: string): Promise<void>;
}

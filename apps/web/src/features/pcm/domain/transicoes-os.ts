// E01-S200 — matriz de movimentações permitidas da OS (BL 007 AC-7 do Pacote Consolidado do
// Fabrício: "arrastar respeita transições permitidas").
//
// ESCOPO DELIBERADO: esta matriz governa a movimentação MANUAL — arrastar no quadro, o seletor de
// status do cartão, o botão do painel de detalhe e a ação em lote. Ela NÃO governa o que a
// automação escreve.
//
// O inventário que precedeu este arquivo (24/11/2026) encontrou seis caminhos de banco que
// escrevem `pcm.ordens_servico.status` sem passar pela UI:
//   0011  trigger de planejamento → Auvo
//   1047  conversão integral do Chamado
//   1343  confirmação do efeito T−24
//   1420  processamento de origem de campo (OS criada pelo Auvo)
//   1612  avanço de execução vindo do campo
//   1832  cancelamento forçado do Chamado
// Aplicar a matriz a esses caminhos travaria operação legítima — o campo não pede licença ao
// quadro para avançar. Por isso a regra vive aqui, na borda manual, e não num gatilho de banco.

import {
  type OrdemServicoOperacional,
  type StatusOrdemServico,
  ehCardChamadoAberto,
} from "./ordens-servico";

/** Status que o fluxo aprovado prevê como etapa de tratamento da OS. "demanda" é estado do
 * Chamado, não da OS, e por isso não aparece como destino aqui. */
const FLUXO_APROVADO: StatusOrdemServico[] = [
  "solicitacao",
  "planejamento",
  "em_execucao",
  "validacao_pcm",
  "finalizado",
  "cancelado",
];

/** Status legados: ainda existem em registros antigos, mas o fluxo aprovado não os prevê. Pode-se
 * SAIR deles (é como uma OS presa no passado volta ao fluxo) e nunca ENTRAR. */
const LEGADOS: StatusOrdemServico[] = ["corretiva", "backlog"];

/** Destinos manuais permitidos a partir de cada status.
 *
 * As idas e voltas vêm do próprio pacote: "Chamado adiado por curto prazo retorna para Demanda";
 * "retorno do Auvo envia para Validação PCM"; "o Chamado somente é encerrado após as OS
 * necessárias e a validação do PCM". Daí Validação PCM poder devolver a OS para execução quando o
 * PCM reprova o retorno, e Planejamento poder voltar para Solicitação quando o escopo cai. */
const DESTINOS: Record<string, StatusOrdemServico[]> = {
  solicitacao: ["planejamento", "cancelado"],
  planejamento: ["em_execucao", "solicitacao", "cancelado"],
  em_execucao: ["validacao_pcm", "planejamento", "cancelado"],
  validacao_pcm: ["finalizado", "em_execucao", "planejamento", "cancelado"],
  // Terminais no caminho manual: reabrir OS finalizada e reativar OS cancelada são fluxos
  // próprios, com registro e autorização de quem reabre — não um arrastar de cartão.
  finalizado: [],
  cancelado: [],
  // Legados: saída livre para o fluxo aprovado, para desencalhar registro antigo.
  corretiva: ["solicitacao", "planejamento", "em_execucao", "validacao_pcm", "cancelado"],
  backlog: ["solicitacao", "planejamento", "cancelado"],
};

export interface ResultadoTransicao {
  readonly permitida: boolean;
  /** Frase pronta para a tela quando `permitida` é falso. Nunca vazia nesse caso. */
  readonly motivo: string;
}

const PERMITIDA: ResultadoTransicao = { permitida: true, motivo: "" };

export function transicaoPermitida(de: string, para: StatusOrdemServico): ResultadoTransicao {
  if (de === para) return PERMITIDA;

  if (LEGADOS.includes(para))
    return {
      permitida: false,
      motivo: `"${rotulo(para)}" é um status antigo, fora do fluxo aprovado — não é possível mover uma OS para ele.`,
    };

  const destinos = Object.hasOwn(DESTINOS, de) ? DESTINOS[de] : undefined;
  if (destinos === undefined)
    return {
      permitida: false,
      motivo: `Status de origem desconhecido ("${de}"). Confira a OS antes de movê-la.`,
    };

  if (destinos.includes(para)) return PERMITIDA;

  if (de === "finalizado")
    return {
      permitida: false,
      motivo: "OS finalizada não volta pelo quadro: reabertura é um fluxo próprio, com registro.",
    };
  if (de === "cancelado")
    return {
      permitida: false,
      motivo: "OS cancelada não volta pelo quadro: reativação é um fluxo próprio, com registro.",
    };
  if (para === "finalizado")
    return {
      permitida: false,
      motivo: "A OS só é finalizada depois da validação do PCM.",
    };

  return {
    permitida: false,
    motivo: `Movimentação de "${rotulo(de)}" para "${rotulo(para)}" não faz parte do fluxo aprovado.`,
  };
}

/** Cards sintéticos de demanda podem abrir a conversão, antes de existir uma OS. */
export function transicaoManualOrdem(
  ordem: Pick<OrdemServicoOperacional, "id" | "status">,
  destino: StatusOrdemServico,
): ResultadoTransicao {
  if (ehCardChamadoAberto(ordem.id) && ordem.status === "demanda" && destino === "planejamento")
    return PERMITIDA;
  return transicaoPermitida(ordem.status, destino);
}

/** Destinos manuais de um status — usado para montar o seletor só com o que é possível, em vez de
 * deixar o operador escolher algo que será recusado depois. */
export function destinosPermitidos(de: StatusOrdemServico): StatusOrdemServico[] {
  return DESTINOS[de] ?? [];
}

export function ehStatusLegado(status: string): boolean {
  return LEGADOS.includes(status as StatusOrdemServico);
}

export function ehStatusDoFluxoAprovado(status: string): boolean {
  return FLUXO_APROVADO.includes(status as StatusOrdemServico);
}

function rotulo(status: string): string {
  const mapa: Record<string, string> = {
    solicitacao: "Solicitação",
    planejamento: "Planejamento",
    em_execucao: "Em execução",
    validacao_pcm: "Validação PCM",
    finalizado: "Finalizado",
    cancelado: "Cancelado",
    corretiva: "Corretiva",
    backlog: "Backlog",
  };
  return mapa[status] ?? status;
}

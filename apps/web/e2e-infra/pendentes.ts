/**
 * E00-S31: testes FORA da suíte E2E padrão até a story E00-S32 atualizá-los.
 *
 * Levantados na primeira execução contra o Supabase local com seed fictício (2026-11-27): 45
 * passaram, estes 43 falharam. Nenhum vai ganhar fixture de produção; quem precisa de dado
 * recebe dado fictício no `seed-e2e.sql` ou cria o próprio dado no teste.
 *
 * Categorias:
 * - `desatualizado`: a tela mudou depois que o spec foi escrito; falharia em qualquer banco.
 * - `producao`: depende de um registro que só existe em produção.
 * - `dado-local`: precisa de dado que o banco local ainda não tem (fictício, a criar).
 * - `ambiente`: depende de integração externa (Edge Function/Auvo) indisponível no local.
 * - `a-confirmar`: falha na tela; sem evidência de dependência de produção, causa a apurar.
 *
 * Ao corrigir um teste, tire a linha daqui: ele volta sozinho para a suíte padrão.
 */

export type CategoriaPendente =
  | "desatualizado"
  | "producao"
  | "dado-local"
  | "ambiente"
  | "a-confirmar";

export interface TestePendente {
  arquivo: string;
  /** Título exato do teste; ausente = arquivo inteiro. */
  teste?: string;
  categoria: CategoriaPendente;
  motivo: string;
}

export const TESTES_PENDENTES: TestePendente[] = [
  // ── dependem de dado de produção ──
  {
    arquivo: "inspecao-gutd.spec.ts",
    categoria: "producao",
    motivo: "busca o cliente real 'Portal Recantos de Rimini'",
  },
  {
    arquivo: "ordens-servico-kanban-status.spec.ts",
    categoria: "producao",
    motivo: "move a OS real 'CH-0061 / teste titulo' no Kanban",
  },
  {
    arquivo: "comercial-precificacao.spec.ts",
    teste: "Cadastra nível de técnico vinculado a um cargo real do PCM",
    categoria: "producao",
    motivo: "espera o cargo real com a grafia de produção 'Of. de Manutenção'",
  },
  {
    arquivo: "manual-pcm.spec.ts",
    teste: "AC-5: ajuda contextual do 360 e dos cadastros chega aos roteiros sem salvar",
    categoria: "producao",
    motivo: "exige a fixture E2E_CLIENTE_360_NOME_A (cliente de produção)",
  },

  // ── desatualizados: a tela mudou ──
  {
    arquivo: "comercial-contratos.spec.ts",
    categoria: "desatualizado",
    motivo: "espera o heading 'Oportunidades'; a navegação do Comercial hoje é 'Funil'",
  },
  {
    arquivo: "comercial-levantamento.spec.ts",
    categoria: "desatualizado",
    motivo: "espera o heading 'Oportunidades'; hoje é 'Funil'",
  },
  {
    arquivo: "comercial-proposta-pdf-portal.spec.ts",
    categoria: "desatualizado",
    motivo: "espera o heading 'Oportunidades'; hoje é 'Funil'",
  },
  {
    arquivo: "comercial-proposta.spec.ts",
    categoria: "desatualizado",
    motivo: "espera o heading 'Oportunidades'; hoje é 'Funil'",
  },
  ...[
    "cria contrato, gera recebível do mês e dá baixa em contas a receber",
    "cria despesa fixa, gera previsto e vê em contas a pagar",
    "cadastra custo de funcionário e vê rentabilidade sem erro",
    "cria lançamento previsto, filtra e dá baixa",
    "anexa comprovante e corrige valor de lançamento realizado",
    "transferência entre contas move o saldo de origem pra destino",
    "cria, edita e desativa ponto da régua de cobrança",
    "emitir cobrança sem integração Mercado Pago ativa mostra erro claro",
  ].map(
    (teste): TestePendente => ({
      arquivo: "financeiro-lancamentos.spec.ts",
      teste,
      categoria: "desatualizado",
      motivo: "procura o modal por '.modal-backdrop'; o modal virou dialog (role=dialog)",
    }),
  ),
  {
    arquivo: "kits.spec.ts",
    categoria: "desatualizado",
    motivo: "campo 'Quantidade total' não existe mais no formulário de ferramenta",
  },
  {
    arquivo: "refinamento-ux.spec.ts",
    teste: "Ferramentas: histórico de unidade abre e mostra o rótulo da unidade",
    categoria: "desatualizado",
    motivo: "campo 'Quantidade total' não existe mais no formulário de ferramenta",
  },
  {
    arquivo: "backlog-gut.spec.ts",
    categoria: "desatualizado",
    motivo: "botão 'Novo item de backlog' não existe mais (Operação tem Novo Chamado/Nova OS)",
  },
  {
    arquivo: "backlog-pre-triagem.spec.ts",
    categoria: "desatualizado",
    motivo: "botão 'Novo item de backlog' não existe mais",
  },
  {
    arquivo: "arvore-ativos.spec.ts",
    categoria: "desatualizado",
    motivo: "a Visão 360 não tem mais o botão/aba 'Árvore'",
  },
  {
    arquivo: "cadastro-ativos-360.spec.ts",
    categoria: "desatualizado",
    motivo: "a Visão 360 não tem mais o botão/aba 'Ativos'",
  },
  {
    arquivo: "board-ativos.spec.ts",
    categoria: "desatualizado",
    motivo: "getByText('Torre A') agora casa 2 elementos (strict mode)",
  },
  ...[
    "cria hierarquia Área>Local, instala Item, cria Sistema e confirma breadcrumb + chip",
    "Componente em um Sistema aparece desabilitado no seletor de outro Sistema (E01-S154 AC-4)",
    "Componente só na Área e Sistema no Local preservam posição (E01-S155)",
  ].map(
    (teste): TestePendente => ({
      arquivo: "hierarquia-sistemas.spec.ts",
      teste,
      categoria: "desatualizado",
      motivo:
        "nomes de Área/Local/Componente agora casam 2 elementos (strict mode) ou não aparecem",
    }),
  ),
  {
    arquivo: "identificador-ativo.spec.ts",
    categoria: "desatualizado",
    motivo: "getByText('Componentes') casa 2 elementos (menu e aba)",
  },
  {
    arquivo: "clientes-marcacoes.spec.ts",
    categoria: "desatualizado",
    motivo: "nome da marcação editada aparece 2 vezes (strict mode)",
  },
  {
    arquivo: "protecao-custos-portal.spec.ts",
    categoria: "desatualizado",
    motivo: "há 2 botões 'Criar acesso' (página e modal); seletor ambíguo",
  },
  {
    arquivo: "kanban-colunas.spec.ts",
    categoria: "desatualizado",
    motivo:
      "filtro padrão 'Ativos' esconde a coluna Cancelado; coluna Preventiva não está entre Corretiva e Planejamento",
  },
  {
    arquivo: "nav-pcm-reorg.spec.ts",
    categoria: "desatualizado",
    motivo: "o menu do PCM ainda tem 'Preventivas'; o spec espera que não tenha",
  },
  {
    arquivo: "comercial-contas.spec.ts",
    teste: "Lista de Contas mostra contas inativas — o que a Lista de Clientes do PCM esconde",
    categoria: "dado-local",
    motivo: "não há conta inativa no banco local; criar no seed fictício ou no próprio teste",
  },
  {
    arquivo: "apontamento-horas-visualizacoes.spec.ts",
    categoria: "dado-local",
    motivo: "sem apontamentos no período ('Sem dados no período'); precisa de horas fictícias",
  },
  {
    arquivo: "refinamento-ux.spec.ts",
    teste: "OS: expandir abre modal grande, fecha por X e por Esc",
    categoria: "dado-local",
    motivo: "pressupõe uma OS já existente na lista; o banco local começa vazio",
  },
  {
    arquivo: "assessment.spec.ts",
    categoria: "ambiente",
    motivo: "importação de questionário chama Edge Function/Auvo; local devolve non-2xx genérico",
  },
  {
    arquivo: "chamados.spec.ts",
    teste: "cria Chamado, gera OS a partir dele e o histórico continua acessível",
    categoria: "a-confirmar",
    motivo: "'Confirmar' de Gerar OS fica desabilitado (falta campo novo obrigatório ou dado)",
  },
  {
    arquivo: "chamados.spec.ts",
    teste: "bloqueia 'Enviar ao backlog' sem GUT completo e libera após preencher",
    categoria: "a-confirmar",
    motivo: "'Confirmar' fica desabilitado (mesma causa do teste acima)",
  },
  {
    arquivo: "ordens-servico.spec.ts",
    teste: "cria OS, abre detalhe e edita",
    categoria: "a-confirmar",
    motivo: "botão 'Criar OS' não aparece após 'Nova OS' (formulário mudou)",
  },
  {
    arquivo: "financeiro-lancamentos.spec.ts",
    teste: "configura alíquota fixa e provisiona imposto da competência",
    categoria: "a-confirmar",
    motivo: "linha da competência do mês não aparece após Provisionar",
  },
  {
    arquivo: "financeiro-lancamentos.spec.ts",
    teste: "fecha e reabre um mês (competência antiga, nunca o mês atual)",
    categoria: "a-confirmar",
    motivo: "competência 05/2026 não aparece como 'Aberto' (lista parte de dado existente)",
  },
  {
    arquivo: "importacao-estrutura.spec.ts",
    categoria: "a-confirmar",
    motivo: "reimportar a estrutura exportada não mostra '0 criar · 0 editar · 0 excluir'",
  },
  {
    arquivo: "inspecoes.spec.ts",
    categoria: "a-confirmar",
    motivo: "card do item não tem mais o botão 'Expandir detalhes'",
  },
];

function escaparRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Arquivos inteiros fora da suíte padrão. */
export const ARQUIVOS_PENDENTES: RegExp[] = TESTES_PENDENTES.filter((p) => !p.teste).map(
  (p) => new RegExp(`${escaparRegex(p.arquivo)}$`),
);

/** Testes individuais fora da suíte padrão (casa pelo título exato, no fim do título completo). */
export const TITULOS_PENDENTES: RegExp | undefined = (() => {
  const titulos = TESTES_PENDENTES.filter((p) => p.teste).map(
    (p) => `${escaparRegex(p.arquivo)}.* ${escaparRegex(p.teste as string)}$`,
  );
  return titulos.length ? new RegExp(titulos.join("|")) : undefined;
})();

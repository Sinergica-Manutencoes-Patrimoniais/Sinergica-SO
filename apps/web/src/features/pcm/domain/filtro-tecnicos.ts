// DEF-33: opções do filtro de técnico em Chamados > Lista.
//
// As opções saem das OS carregadas, que já vêm filtradas pelo servidor. Ao trocar a categoria
// para Preventiva, o técnico selecionado podia não ter nenhuma OS no novo recorte e sumia da
// lista; um <select> controlado cujo `value` não existe entre as opções exibe a primeira
// ("Todos os técnicos"), enquanto a consulta continuava filtrando por aquele técnico. A tela
// passava a mentir sobre o filtro ativo. O selecionado permanece na lista enquanto estiver
// selecionado.

export interface TecnicoOpcaoFiltro {
  id: string;
  nome: string;
}

interface OrdemComTecnico {
  tecnicoFuncionarioId?: string | null;
  tecnicoNome?: string | null;
}

export const TECNICO_TODOS = "todos";

export function montarOpcoesTecnico(
  ordens: readonly OrdemComTecnico[],
  tecnicoSelecionado: string,
  nomesConhecidos: Map<string, string>,
): TecnicoOpcaoFiltro[] {
  const porId = new Map<string, string>();
  for (const ordem of ordens) {
    if (ordem.tecnicoFuncionarioId) {
      const nome = ordem.tecnicoNome ?? "Técnico";
      porId.set(ordem.tecnicoFuncionarioId, nome);
      nomesConhecidos.set(ordem.tecnicoFuncionarioId, nome);
    }
  }
  if (tecnicoSelecionado !== TECNICO_TODOS && !porId.has(tecnicoSelecionado)) {
    porId.set(tecnicoSelecionado, nomesConhecidos.get(tecnicoSelecionado) ?? "Técnico");
  }
  return [...porId.entries()]
    .map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

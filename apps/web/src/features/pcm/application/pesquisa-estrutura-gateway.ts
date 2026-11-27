export type TipoEstrutura =
  | "area"
  | "local"
  | "sistema"
  | "equipamento"
  | "componente"
  | "grupo_quantitativo";
export type ResultadoEstrutura = {
  chave: string;
  tipo: TipoEstrutura;
  id: string;
  nome: string;
  codigo: string | null;
  areaId: string | null;
  localId: string | null;
  sistemaId: string | null;
  parentId: string | null;
};
export type FiltroPesquisaEstrutura = {
  usuario: string;
  clienteId: string;
  busca: string;
  tipo: TipoEstrutura | "";
  contexto: Pick<ResultadoEstrutura, "tipo" | "id"> | null;
  apos: string | null;
};
export type ResumoGrupoEstrutura = {
  quantidade: number;
  local: string | null;
  sistema: string | null;
  temSistema: boolean;
};
export interface PesquisaEstruturaGateway {
  obterResumoGrupo(
    usuario: string,
    clienteId: string,
    grupoId: string,
    signal: AbortSignal,
  ): Promise<ResumoGrupoEstrutura | null>;
  pesquisar(filtro: FiltroPesquisaEstrutura, signal?: AbortSignal): Promise<ResultadoEstrutura[]>;
}

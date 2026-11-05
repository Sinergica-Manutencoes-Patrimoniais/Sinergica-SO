export interface SalvarGrupoCommand {
  requestId: string;
  expectedRevision: number;
  grupoId: string;
  localId: string;
  categoriaId: string;
  sistemaId: string | null;
  nome: string;
  quantidade: number;
  caracteristicas: Record<string, string>;
}

export interface ResultadoEstrutura {
  aggregateId: string;
  revision: number;
  state: boolean;
  created: boolean;
  linkedIds: Record<string, string>;
  warnings: string[];
  requestId: string;
}

export interface EstruturaTecnicaGateway {
  salvarGrupo(comando: SalvarGrupoCommand): Promise<ResultadoEstrutura>;
}

export interface MoverComponenteCommand {
  requestId: string;
  expectedRevision: number;
  componenteId: string;
  areaId: string | null;
  localId: string | null;
  parentId: string | null;
}
export interface MovimentarComponenteGateway {
  moverComponente(comando: MoverComponenteCommand): Promise<ResultadoEstrutura>;
}
export interface DestinoEstrutura {
  id: string;
  nome: string;
  areaId: string | null;
}
export interface ConsultaDestinosGateway {
  listarDestinos(
    clienteId: string,
    tipo: "area" | "local" | "componente",
    limite: number,
    apos: string | null,
    busca: string | null,
    signal?: AbortSignal,
  ): Promise<DestinoEstrutura[]>;
}

export interface GrupoQuantitativo {
  id: string;
  clienteId: string;
  localId: string;
  categoriaId: string;
  sistemaId: string | null;
  nome: string;
  quantidade: number;
  caracteristicas: Record<string, string>;
  revisao: number;
}

export interface ConsultaGruposGateway {
  listarGrupos(
    clienteId: string,
    inicio: number,
    limite: number,
    signal?: AbortSignal,
    sistemaId?: string,
  ): Promise<GrupoQuantitativo[]>;
}

export interface EventoHistoricoEstrutura {
  id: string;
  data: string;
  acao: string;
  atorId: string | null;
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown>;
}
export interface ConsultaHistoricoGateway {
  listarHistorico(
    tipo: "grupo" | "componente",
    id: string,
    limite: number,
    cursor: { data: string; id: string } | null,
    signal?: AbortSignal,
  ): Promise<EventoHistoricoEstrutura[]>;
}

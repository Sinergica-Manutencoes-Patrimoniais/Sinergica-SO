export type OpcaoPreventiva = {
  id: string;
  nome: string;
  auvo_id?: number | null;
  auvo_user_id?: number | null;
  auvo_equipment_id?: number | null;
};

export type PlanoPreventivo = {
  id: string;
  nome: string;
  estado: "rascunho" | "ativo" | "pausado";
  primeira_data: string;
  intervalo_unidade: "semanas" | "meses";
  intervalo_n: number;
  cliente_id: string;
  sistema_id: string | null;
  equipamento_id: string | null;
  questionario_id: string;
  tipo_tarefa_id: string;
};

export type OcorrenciaPreventiva = {
  id: string;
  plano_id: string;
  vencimento: string;
  visita_em: string | null;
  envio_estado: "prevista" | "enviando" | "falha" | "incerto" | "disponivel";
  auvo_task_id: number | null;
  tecnico_funcionario_id: string | null;
  erro_envio: string | null;
  os_status?: string | null;
};

export type AvaliacaoPreventiva = {
  id: string;
  ocorrencia_id: string;
  item_referencia: string | null;
  local_informado: string | null;
  resposta: { pergunta?: string; valor?: string };
  fotos?: unknown[];
  medicoes?: unknown[];
};

export type ResultadoPreventivas = {
  planos: PlanoPreventivo[];
  ocorrencias: OcorrenciaPreventiva[];
  avaliacoes: AvaliacaoPreventiva[];
};

export type CatalogoPreventivas = {
  clientes: OpcaoPreventiva[];
  sistemas: Array<OpcaoPreventiva & { cliente_id: string }>;
  equipamentos: Array<OpcaoPreventiva & { client_id: string }>;
  questionarios: OpcaoPreventiva[];
  tipos: OpcaoPreventiva[];
  tecnicos: OpcaoPreventiva[];
};

// @sinergica/shared — schemas Zod e tipos de domínio reutilizados por frontend e Edge Functions.
//
// Cada bounded context exporta aqui APENAS o que precisa cruzar a fronteira do app
// (ex.: o tipo de uma OS consumida pela Área do Cliente e pelo Relatórios). Regras de
// negócio internas permanecem no domínio de cada feature em apps/web/src/features/<dominio>.
//
// Placeholder inicial — preenchido feature a feature na fase de construção.

export const SHARED_PACKAGE = "@sinergica/shared";

export type OrdemServicoCategoria = "corretiva" | "preventiva" | "emergencial";
export type OrdemServicoPrioridade = "baixa" | "normal" | "media" | "alta" | "critica";

export interface OrdemServicoInput {
  client_id: string;
  titulo: string;
  descricao: string;
  categoria: OrdemServicoCategoria;
  prioridade: OrdemServicoPrioridade;
  local_descricao: string;
  origem: "ze";
  origem_ref_id: string;
  solicitante?: string;
}

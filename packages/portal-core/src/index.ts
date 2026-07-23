/** Contratos neutros compartilhados pelos dois builds. Nunca importar UI interna aqui. */
export type PortalRole = "cliente-sindico";
export type PortalSection =
  | "painel"
  | "assessment"
  | "chamados"
  | "os"
  | "documentos"
  | "cronograma"
  | "notificacoes"
  | "orcamentos"
  | "financeiro";

export interface PortalTenantClaim {
  user_role: PortalRole;
  cliente_id: string;
  user_modulos: { "area-cliente": "leitura" };
}

export const PORTAL_SECTIONS: readonly PortalSection[] = [
  "painel",
  "assessment",
  "chamados",
  "os",
  "documentos",
  "cronograma",
  "notificacoes",
  "orcamentos",
  "financeiro",
];

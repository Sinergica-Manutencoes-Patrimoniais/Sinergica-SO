// domain/historico-ativo.ts — E01-S87 AC-1/AC-2.
// `OsHistoricoItem` morava só em `application/board-ativos-gateway.ts` (E01-S78) — movido pra cá
// (a interface continua importando/reexportando de lá) porque agora tem lógica de domínio pura em
// cima dele (última manutenção, agregação do Sistema) e domínio não pode depender de application.

/** Uma OS vinculada a um ativo (via `pcm.os_equipamentos_auvo` por `auvo_equipment_id`). */
export interface OsHistoricoItem {
  osId: string;
  numero: string;
  categoria: string | null;
  status: string | null;
  /** data agendada da OS (ou `created_at` quando não há agenda), ISO. */
  data: string | null;
}

/** AC-1/AC-2: "última manutenção/preventiva" em destaque — o histórico já vem ordenado do mais
 * recente pro mais antigo (adapter), então é só o primeiro. `null` = sem histórico (AC-3). */
export function ultimaManutencao(historico: OsHistoricoItem[]): string | null {
  return historico[0]?.data ?? null;
}

/** AC-2: junta o histórico de OS vinculadas ao Sistema em si com o dos Componentes, removendo
 * duplicatas por `osId` (uma mesma OS pode aparecer em mais de uma fonte — ex.: vinculada tanto ao
 * Sistema quanto a um Componente específico) — ordenado da mais recente pra mais antiga. */
export function agregarHistoricoSistema(fontes: OsHistoricoItem[][]): OsHistoricoItem[] {
  const porId = new Map<string, OsHistoricoItem>();
  for (const historico of fontes) {
    for (const os of historico) {
      if (!porId.has(os.osId)) porId.set(os.osId, os);
    }
  }
  return [...porId.values()].sort((a, b) => (b.data ?? "").localeCompare(a.data ?? ""));
}

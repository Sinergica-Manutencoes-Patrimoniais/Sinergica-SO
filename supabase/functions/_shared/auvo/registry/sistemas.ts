import type { AuvoEntityDescriptor } from "./types.ts";

export interface SistemaRow extends Record<string, unknown> {
  id: string;
  nome: string;
  tipo?: string | null;
  descricao?: string | null;
  ativo?: boolean | null;
  codigo?: string | null;
  /** E01-S85 AC-4: nome da Área (Sistema não tem `local_id`, só `area_id` opcional) — recalculado
   * por trigger (`0131`). */
  auvo_localizacao?: string | null;
  // E01-S153: coluna adicionada (migration 0213) + backfill dos Sistemas existentes — pré-condição
  // do flip `writeEnabled:true` documentada no design.md da E01-S76. Populada em app a partir de
  // `pcm.clientes.auvo_id` (supabase-sistemas-adapter.ts), mesmo padrão de
  // `pcm.equipamentos.auvo_customer_id`.
  auvo_customer_id?: number | null;
}

export interface AuvoEquipmentSistema {
  id?: number;
  equipmentId?: number;
  name?: string;
  description?: string;
  identifier?: string;
  associatedCustomerId?: number;
  customerId?: number;
  location?: string;
  active?: boolean;
}

/** E01-S76/E01-S153 — Sistema (agrupamento transversal de Itens) empurrado ao Auvo como Equipment
 * (`/equipments`), push-only. Sem `webhookEntity` nem `cronSchedule` — PCM é dono do Sistema.
 * `writeEnabled:true` desde E01-S153, só depois de resolver as duas pré-condições do design.md:
 * (1) `auvo_customer_id` (migration 0213 + backfill) e (2) mitigação da linha-fantasma — o inbound
 * de Equipment(27) (`pcm-auvo-equipment-sync` e o dispatcher genérico de webhook) agora exclui
 * `auvo_equipment_id` já presentes em `pcm.sistemas`, pra não duplicar o Sistema como Equipamento. */
export const sistemasDescriptor: AuvoEntityDescriptor<AuvoEquipmentSistema, SistemaRow> = {
  key: "sistemas",
  auvoBasePath: "/equipments",
  pcmTable: "sistemas",
  writeEnabled: true,
  deleteStrategy: "soft-patch",
  toAuvo(row) {
    return limparVazios({
      name: row.nome,
      description: row.descricao ?? row.nome,
      associatedCustomerId: row.auvo_customer_id,
      identifier: row.codigo,
      // E01-S85 AC-4: localização do Sistema é só a Área (não tem local_id).
      location: row.auvo_localizacao,
      active: row.ativo ?? true,
    }) as AuvoEquipmentSistema;
  },
  fromAuvo(auvo) {
    const auvoId = auvo.id ?? auvo.equipmentId;
    return {
      auvo_equipment_id: auvoId,
      nome: textoOuFallback(auvo.name ?? auvo.description, `Sistema ${auvoId ?? ""}`.trim()),
      codigo: textoOuNull(auvo.identifier),
      ativo: auvo.active !== false,
    };
  },
};

function limparVazios<T extends Record<string, unknown>>(input: T): T {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => {
      if (value === undefined || value === null) return false;
      if (typeof value === "string") return value.trim().length > 0;
      return true;
    }),
  ) as T;
}

function textoOuFallback(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function textoOuNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

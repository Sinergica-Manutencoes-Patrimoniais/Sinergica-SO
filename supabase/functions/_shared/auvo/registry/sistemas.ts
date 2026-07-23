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
  // NÃO existe hoje em pcm.sistemas (ver migration 0095/design.md — schema travado pelo PO).
  // `associatedCustomerId` fica sem valor até essa lacuna ser fechada — sem efeito prático nesta
  // story: `writeEnabled:false` garante que `toAuvo` nunca é chamado pelo drain (processOutboxRow
  // curto-circuita antes, ver pcm-auvo-push/index.ts). Resolver junto do flip (pré-condição já
  // documentada no design.md: mitigação da linha-fantasma Equipment(27)).
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

/** E01-S76 — Sistema (agrupamento transversal de Itens) empurrado ao Auvo como Equipment
 * (`/equipments`), push-only, `writeEnabled:false` (ADR-0009/D2). Sem `webhookEntity` nem
 * `cronSchedule` — PCM é dono do Sistema, evita colisão com o inbound Equipment(27) do descriptor
 * `equipamentos`. NÃO ligar `writeEnabled:true` sem antes mitigar a linha-fantasma (ver design.md). */
export const sistemasDescriptor: AuvoEntityDescriptor<AuvoEquipmentSistema, SistemaRow> = {
  key: "sistemas",
  auvoBasePath: "/equipments",
  pcmTable: "sistemas",
  writeEnabled: false,
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

import type { AuvoEntityDescriptor } from "./types.ts";

export interface ServicoRow extends Record<string, unknown> {
  id: string;
  titulo: string;
  descricao?: string | null;
  preco_centavos: number;
  fiscal_service_id?: string | null;
  ativo?: boolean | null;
}

export interface AuvoService {
  id?: string;
  serviceId?: string;
  title?: string;
  description?: string;
  price?: number;
  active?: boolean;
  fiscalServiceId?: string | null;
}

export const servicosDescriptor: AuvoEntityDescriptor<AuvoService, ServicoRow> = {
  key: "servicos",
  auvoBasePath: "/services",
  pcmTable: "servicos",
  // Sem cronSchedule DE PROPÓSITO: `GET /services` (listagem paginada, usada pelo pull-sync) segue
  // 404 na API real — reconfirmado em 2026-07-14 (E01-S74). Mas `GET /services/{id}`, `POST
  // /services` e `PATCH /services/{id}` funcionam normalmente (mesmo teste, registro reversível
  // criado/editado/desativado com sucesso) — só a listagem está bloqueada, não o módulo inteiro.
  // `pcm-auvo-push` nunca chama a listagem (só POST/PATCH/DELETE por id), então o write path é
  // seguro mesmo com o pull desabilitado. Decisão de negócio sobre a listagem (confirmar com o
  // Auvo) segue em aberto — ver STATE.md.
  writeEnabled: true,
  deleteStrategy: "soft-patch",
  externalIdField: "externalCode",
  // Confirmado ao vivo (E01-S74): `POST /services` devolve `result.id` como GUID **string**, não
  // number — o extrator padrão de `pcm-auvo-push` só aceita `number` (a maioria das entidades Auvo
  // usa id numérico). Sem este override, toda criação de serviço lançaria "Auvo criou servicos sem
  // id na resposta" mesmo com a chamada tendo funcionado.
  extractCreatedAuvoId(response) {
    const id = (response as { result?: { id?: unknown } })?.result?.id;
    if (typeof id === "string" && id.trim().length > 0) return id;
    if (typeof id === "number" && Number.isFinite(id)) return id;
    return null;
  },
  toAuvo(row) {
    return limparVazios({
      title: row.titulo,
      description: row.descricao,
      price: centavosParaDecimal(row.preco_centavos),
      active: row.ativo ?? true,
      fiscalServiceId: row.fiscal_service_id ?? null,
    }) as AuvoService;
  },
  fromAuvo(auvo) {
    return {
      titulo: textoOuFallback(auvo.title ?? auvo.description, `Serviço ${auvo.id ?? auvo.serviceId ?? ""}`.trim()),
      descricao: textoOuNull(auvo.description),
      preco_centavos: decimalParaCentavos(auvo.price),
      fiscal_service_id: textoOuNull(auvo.fiscalServiceId),
      ativo: auvo.active !== false,
    };
  },
};

export function centavosParaDecimal(value: number): number {
  return Math.round(value) / 100;
}

export function decimalParaCentavos(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value * 100) : 0;
}

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

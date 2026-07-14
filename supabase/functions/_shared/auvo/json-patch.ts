// _shared/auvo/json-patch.ts — conversão para o formato de PATCH da API Auvo v2 (E01-S22/E01-S24+).
//
// Achado ao mapear os endpoints do catálogo completo (Task Types, Services, Equipments, Products,
// Tickets, Segments, Keywords, Product/Equipment Categories — todos verificados no blueprint
// público): TODO `PATCH /<recurso>/{id}` da Auvo v2 espera um array de operações
// `[{ op: "replace", path: "<campo>", value }]`, NUNCA um objeto flat parcial (isso é o que
// `POST`/`PUT` aceitam). O `path` no dialeto do Auvo NÃO tem barra inicial (diferente do RFC 6902
// puro, que exigiria `"/<campo>"`) — os próprios exemplos da documentação mostram `"path":
// "description"`, não `"path": "/description"`. Implementado exatamente como documentado.
//
// CONFIRMADO CONTRA PRODUÇÃO (E01-S74, 2026-07-14): `PATCH /services/{id}` com
// `[{op:"replace",path:"active",value:false}]` (sem barra inicial) devolveu 200 e aplicou a
// mudança de verdade — formato validado ao vivo, não só pela documentação.

export interface AuvoJsonPatchOp {
  op: "replace";
  path: string;
  value: unknown;
}

/**
 * Converte um patch flat (`{ campo: valor, ... }`) no array de operações que os endpoints PATCH
 * da Auvo v2 esperam. Usado pelo motor de sync (`pcm-auvo-push`) em toda chamada `auvoPatch` —
 * nunca envia o objeto flat de `descriptor.toAuvo()` direto para um PATCH.
 */
export function toAuvoJsonPatch(patch: Record<string, unknown>): AuvoJsonPatchOp[] {
  return Object.entries(patch).map(([path, value]) => ({ op: "replace", path, value }));
}

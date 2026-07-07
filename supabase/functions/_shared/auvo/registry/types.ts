// registry/types.ts — contrato do "entity registry" do motor de sync Auvo (E01-S22/E01-S23).
// Único lugar onde o mapeamento de campos PCM↔Auvo de cada entidade deve viver — tanto o drain
// (`pcm-auvo-push`) quanto o futuro dispatcher/poller inbound (`E01-S23`) resolvem um descriptor
// por aqui, nunca hardcodam o shape de uma entidade fora do seu próprio módulo em `registry/`.
// Ver specs/E01-S22-motor-sync-auvo-write/{design.md,domain.md} → "Descriptor".

/**
 * Operação de escrita pendente no outbox (`pcm.auvo_sync_outbox.op`), refletida aqui para os
 * descriptors decidirem qual verbo HTTP usar (`toAuvo` é chamado com o `op` do lado de fora, no
 * drain — este tipo só documenta o vocabulário compartilhado).
 */
export type AuvoSyncOp = "create" | "update" | "delete";

/**
 * Descreve como uma tabela `pcm.<pcmTable>` se sincroniza com um recurso da API Auvo v2.
 *
 * @template TAuvo forma do payload/registro do lado do Auvo (o que `toAuvo` produz e `fromAuvo`
 *   consome).
 * @template TRow forma da linha `pcm.<pcmTable>` (o que `fromAuvo` produz e `toAuvo` consome).
 */
export interface AuvoEntityDescriptor<TAuvo, TRow> {
  /** Chave estável do registry — mesmo valor gravado em `pcm.auvo_sync_outbox.entity` e usado
   * como `TG_ARGV[0]` na trigger `pcm.fn_auvo_enqueue('<key>')`. Ex.: `'produtos'`. */
  readonly key: string;

  /** Caminho base do recurso Auvo v2, sem barra final. Ex.: `'/products'`. */
  readonly auvoBasePath: string;

  /** Tabela `pcm.<pcmTable>` correspondente (sem o prefixo de schema). */
  readonly pcmTable: string;

  /** Entidade de webhook do Auvo (`POST /webhooks` → `entity`), se esta entidade suportar
   * notificação em tempo real. Ausente = só cron (`E01-S23` decide a cadência). Valores documentados
   * pela API Auvo: 1-User, 4-Task, 7-Customer, 27-Equipment, 50-Invoice, 62-Ticket. */
  readonly webhookEntity?: 1 | 4 | 7 | 27 | 50 | 62;

  /** Expressão de cron (`pg_cron`) para o poller genérico de `E01-S23`, se esta entidade for
   * sincronizada por polling em vez de (ou além de) webhook. */
  readonly cronSchedule?: string;

  /**
   * Gate de segurança: enquanto `false`, o drain (`pcm-auvo-push`) NUNCA chama a API Auvo para
   * esta entidade — processa a linha do outbox como pulada (dry-run), sem rede. Existe porque o
   * shape de campo/`paramFilter` de cada endpoint Auvo não foi verificado contra produção (ver
   * `client.ts`, nota "NÃO VERIFICADO") — todo descriptor nasce `false` e só liga depois de uma
   * verificação real (task própria em cada story de entidade, `E01-S24`+).
   */
  readonly writeEnabled: boolean;

  /**
   * Como uma exclusão no PCM (soft-delete, `deleted_at` preenchido) se traduz no Auvo:
   * - `'soft-patch'` (padrão quando ausente) — `PATCH` com `deactivatePatch` (ou `{active:false}`
   *   se `deactivatePatch` também estiver ausente). Use para entidades com um campo de
   *   ativo/inativo (Task Types, Customers, Products, Equipments, Services — a maioria).
   * - `'hard-delete'` — `DELETE` físico no Auvo. Use só quando o recurso não tem NENHUM campo de
   *   ativo/inativo (Segments, Keywords, Categorias, Customer Groups) e o risco de perder o
   *   registro sem histórico é aceitável (metadado de classificação, não entidade de negócio).
   * - `'unsupported'` — o recurso Auvo não tem `PATCH` nem `DELETE` (ex. `Teams`, só
   *   `POST`/`GET`). A exclusão fica só no PCM (soft-delete local), sem nenhuma chamada ao Auvo —
   *   a UI deve avisar que o registro pode continuar existindo lá.
   */
  readonly deleteStrategy?: "soft-patch" | "hard-delete" | "unsupported";

  /** Patch a enviar quando `deleteStrategy` é `'soft-patch'` e o campo de "desativado" do Auvo
   * NÃO se chama `active` (ex.: Users usa `unavailableForTasks: true`, não `active: false`).
   * Ausente = usa `{ active: false }` (padrão da maioria das entidades). */
  readonly deactivatePatch?: Record<string, unknown>;

  /**
   * `false` quando o recurso Auvo não tem endpoint de edição (`PATCH`) — ex. `/customergroups`
   * só tem `POST`/`DELETE`. Nesse caso o drain trata `op='update'` como sucesso no-op (não chama
   * o Auvo, marca o outbox `sent`) em vez de tentar um `PATCH` que não existe. Padrão `true`.
   */
  readonly supportsUpdate?: boolean;

  /** Nome do campo de idempotência de criação que o `POST` deste recurso espera (ADR-0001).
   * Padrão `'externalId'` (a maioria dos recursos) — alguns usam outro nome (`Services` usa
   * `externalCode`, confirmado no catálogo). `pcm-auvo-push` usa este campo, nunca hardcoda
   * `externalId`. */
  readonly externalIdField?: string;

  /** Traduz uma linha PCM para o payload que a API Auvo espera em `POST`/`PUT`/`PATCH`. */
  toAuvo(row: TRow): TAuvo;

  /**
   * Payload restrito para `PATCH` (op='update'), se o recurso Auvo documentar edição só de um
   * subconjunto de campos (ex.: `Tickets` só documenta `statusId`/`externalId` como editáveis —
   * título/descrição não têm caminho de edição). Ausente = `pcm-auvo-push` usa `toAuvo()` também
   * para o PATCH (comportamento padrão de todas as outras entidades).
   */
  toAuvoUpdate?(row: TRow): Partial<TAuvo>;

  /** Traduz um registro Auvo (webhook ou pull) para um patch parcial de `pcm.<pcmTable>`. */
  fromAuvo(auvo: TAuvo): Partial<TRow>;
}

/** Registro de descriptors, indexado pela `key` de cada um. Populado pelas stories de entidade
 * (`E01-S24`+) — vazio nesta story (E01-S22), que só entrega o mecanismo. */
export type AuvoEntityRegistry = Record<string, AuvoEntityDescriptor<unknown, unknown>>;

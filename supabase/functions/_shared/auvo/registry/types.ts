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

  /** Traduz uma linha PCM para o payload que a API Auvo espera em `POST`/`PUT`/`PATCH`. */
  toAuvo(row: TRow): TAuvo;

  /** Traduz um registro Auvo (webhook ou pull) para um patch parcial de `pcm.<pcmTable>`. */
  fromAuvo(auvo: TAuvo): Partial<TRow>;
}

/** Registro de descriptors, indexado pela `key` de cada um. Populado pelas stories de entidade
 * (`E01-S24`+) — vazio nesta story (E01-S22), que só entrega o mecanismo. */
export type AuvoEntityRegistry = Record<string, AuvoEntityDescriptor<unknown, unknown>>;

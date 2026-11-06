# ADR-0152 — Decisão pública de proposta operacional versionada

**Estado:** proposta preparatória, RPCs revogadas e interface desligada.

O Portal mostra somente propostas enviadas ou decididas vinculadas à OS, com versão e projeção pública de S184. A decisão exige usuário e vínculo atuais, identidade do item e versão, valida validade no servidor e serializa a proposta. Idêntico `request_id` retorna resultado anterior; decisão concorrente diferente é conflito. O adaptador reaproveita o comando protegido de S184 após conferir versão sob lock, preservando a semântica existente de Comercial sem criar OS ou cobrança. Motivo é obrigatório para recusa.

Antes de ativar, revisar o comando legado e seus grants: os endpoints antigos sem versão continuam disponíveis e podem contornar este protocolo. Verificar concorrência com edição/envio e revogação de Conta, snapshots públicos, controle granular por contato, idempotência e auditoria. Testar acesso cruzado, revogação e não exposição de custos em todas as respostas. Não homologar com flags ou grants abertos isoladamente.

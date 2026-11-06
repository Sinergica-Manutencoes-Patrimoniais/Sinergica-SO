# ADR-0331 — Auditoria de download de comprovante faturável

Status: proposta; gate e concessões fechados, sem testes.

Após download privado e revalidação do acesso, a Edge exige gravação de auditoria antes de entregar bytes; falha da auditoria impede resposta. RPC exclusiva do serviço reconstitui os claims do usuário a partir do token validado e revalida permissão e vínculo no banco. O evento registra ator, item, anexo e identificador de requisição, nunca caminho ou URL. A auditoria comprova autorização e tentativa de entrega, não recebimento pelo destinatário. É necessário revisar limites da credencial privilegiada, claims e concorrência de revogação, e testar antes da ativação.

# ADR-0320 — Leitura temporária mediada de fotos de ativo

Consulta e resolução privadas apresentam somente associações temporárias de Sistema/Componente cuja última decisão permaneça aceita, com autorização de leitura vigente e verificação de Cliente. Rejeição posterior bloqueia futuras leituras sem apagar histórico. Endpoint deve revalidar acesso após download e não fornecer URL pública.

O vínculo continua não canônico e exige reconciliação com o modelo oficial. Gates e execução fechados; testes de revogação, segurança de arquivo e concorrência são obrigatórios antes de ativar.

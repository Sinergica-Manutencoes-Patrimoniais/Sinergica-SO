# ADR-1162 — Sistema e questionário da OS conferidos

Status: proposta local, não aplicada nem homologada; complementa ADR-1161.

Incluir também `sistema_id` e `questionario_id` da própria OS na fotografia de conferência. Alterações invalidam a fotografia anterior e requerem nova conferência. O questionário de uma corretiva é aquele explicitamente associado à OS, sem inferir uma exigência preventiva. A fotografia não autentica o conteúdo ou vínculo Auvo e não decide entre alvos simultâneos.

Implantação deve coordenar todos os consumidores, preservar histórico e reconciliar tentativas anteriores. Validar migrações sequenciais, alterações concorrentes, gatilhos, autorização e revisão adversarial antes de ativar o produtor corretivo.

# ADR-0314 — Leitura mediada de foto vinculada ao Grupo

Preparam-se listagem e resolução privadas de vínculos de foto do levantamento em Grupo. A decisão mais recente deve permanecer aceita; uma rejeição posterior retira a foto da listagem e bloqueia a resolução, preservando associação e histórico. Autorizações atuais e gates de vínculo e fotos são verificados antes e depois do download mediado. Não há URL pública nem cópia de objeto.

Ativação requer testes de revogação concorrente, Storage, segurança de conteúdo e retenção, além de revisão adversarial. Bytes já entregues não podem ser revogados retrospectivamente.

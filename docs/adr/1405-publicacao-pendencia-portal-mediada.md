# ADR-1405 — Publicação de pendências mediada

Consulta pública de pendências e gestão interna de publicação usam entradas específicas com gates separados. O Portal confere contato ativo, Cliente e OS; a gestão exige `execucao.validar` e Cliente correspondente. O núcleo mantém revisão, conteúdo público explícito e histórico; repetição de publicação não restaura publicação já revogada.

Gates começam fechados. Antes de habilitar, validar privacidade do texto selecionado, autorização e revogação, ACL/RLS/FORCE, concorrência, repetição, paginação e revisão adversarial. Nenhuma publicação é criada automaticamente.

# ADR-0390 — Revalidação do vínculo ao conferir OS

Status: proposta; gates fechados, sem testes.

Durante a revisão da OS planejada, o PCM pode revalidar transacionalmente o vínculo explícito OS–ocorrência–Rotina. O servidor bloqueia Visita, OS e registros da cadeia, verifica última revisão não invalidada, compara a prévia vigente e o snapshot aprovado completo com a prova histórica e grava conferência auditada idempotente. A conferência é separada dos campos básicos e não comprova questionário, escopo ou equipe, nem autoriza envio. Alterações posteriores exigem nova revalidação; um registro anterior não é prova permanente. Testes de concorrência e revisão das permissões e locks são obrigatórios.

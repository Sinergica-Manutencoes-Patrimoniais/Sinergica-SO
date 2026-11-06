---
name: "docs-adr-0974-candidatos-devolucao-ciclo-md"
description: "Documento Sinérgica SO: ADR-0974 — Consulta de candidatos à devolução por ciclo"
alwaysApply: false
---

# ADR-0974 — Consulta de candidatos à devolução por ciclo

Status: preparação privada, não homologada.

Para permitir a reconciliação de devoluções, preparar consulta paginada por Cliente e composição que reúne vínculo legado, situação da parcela, ciclo inicializado, suspensão, atribuição, interrupção, OS e última reconciliação declarada. Exige capacidades atuais, trava compartilhada das fontes de autorização e gates do diagnóstico e ciclos. Exibir os estados e revisões como diagnóstico, sem afirmar que a parcela parou, está disponível para devolução ou pode ser promovida. A consulta não altera dados e não substitui a validação transacional dos comandos.

O cursor não oferece fotografia entre páginas; alterações concorrentes podem mudar os resultados. EXECUTE permanece revogado e gates fechados até validação de consistência, limites, autorização, privacidade, RLS, concorrência, cobertura dos ciclos posteriores e revisão adversarial. Não implementar retomada ou envio remoto com base nesta leitura.

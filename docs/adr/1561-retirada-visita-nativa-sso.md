# ADR-1561 — Retirada explícita de Visita nativa sem ponte

Status: proposto; exige testes de concorrência e revisão. Ao aplicar uma substituição de data já aprovada, a fila de Visita nativa pode ser retirada mesmo sem ponte legada somente se a identidade canônica, Cliente e origem contratual forem íntegros e as fontes locais SSO não tiverem OS, vínculo de execução, Chamado, Grupo ou outros efeitos. A decisão explícita do PCM e a vigência aprovada continuam obrigatórias. Sem prova local ou com incerteza concreta, a entrada permanece para conferência; Grupo e outros casos mantêm o comportamento existente.

A ausência nas fontes SSO não prova ausência em Auvo ou outras fontes externas. A operação não cria ponte, OS ou tarefa, e registra esta limitação em auditoria. Gates e guarda 1045 permanecem.

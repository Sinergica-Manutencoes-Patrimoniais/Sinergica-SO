# ADR-1247 — Consulta de código atual ou histórico de Grupo

**Status:** proposta local, não homologada. Complementa ADR-1244 a 1246.

Preparar consulta restrita a um Cliente e à capacidade atual de leitura de cadastro, por código exato normalizado, retornando UUID do Grupo e código atual, com indicação de que o código consultado é histórico. Um gate próprio nasce fechado. A consulta não altera código, cria etiqueta ou incorpora levantamento.

O gate só poderá ser aberto após integrar a unicidade e a proteção dos escritores, comandos e staging, testar autorização e revogação concorrente, colisões legadas, troca de Cliente, RLS/FORCE e revisão adversarial. A trava compartilhada de códigos reduz a corrida com escritores que usam a mesma chave, mas não prova cobertura de todos os escritores ou fontes de autorização.

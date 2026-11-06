# ADR-0677 — Materialização em lote de Visitas no legado existente

Comando atômico materializa até 25 ocorrências de Visita preparadas usando o comando canônico 0796, relação declarada vigente e Plano Preventivo legado real. Cada origem continua sujeita às verificações de Cliente, alvo, ciclo, data e feriados declarados. Retry da requisição devolve o mesmo resultado; falha em qualquer item reverte o lote.

Não cria Plano legado fictício, OS ou tarefa Auvo e não afirma integração da fila oficial. Ocorrências com alvo Grupo não são representadas pelo Plano legado; vencidos ou relações sem prova permanecem bloqueados. Gate e permissões fechados; locks, testes e homologação seguem pendentes.

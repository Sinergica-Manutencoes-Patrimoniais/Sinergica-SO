# ADR-1059 — Executor periódico da varredura local

**Status:** preparado, desligado e não homologado. Complementa ADR-1056.

O executor avança no máximo uma página por chamada, com trava não bloqueante que impede sobreposição. O cursor e a revisão são mantidos no banco; início, avanço, recibo e controle do executor pertencem à mesma transação. Após concluir, uma nova execução só começa depois do intervalo configurado e parte do início. Falha reverte o avanço e não marca sucesso.

Gate próprio desativado por padrão; não registrar cron automaticamente. O acionamento futuro é interno e deve ser configurado separadamente por DevOps após testes e revisão. Sem rede externa, retentativa Auvo ou fechamento de alerta. As limitações de fontes e lease dos ADRs anteriores permanecem. Revisar concorrência, deadlocks, monotonicidade, RLS/FORCE, privilégios, observabilidade de falhas, desempenho e recuperação antes de habilitar.

# ADR-1502 — Protocolo nas RPCs antigas de Visita

As RPCs históricas de leitura e materialização de Visita permanecem acessíveis para compatibilidade e poderiam contornar o gate da mediação. Quando o gate de continuidade da revisão estiver ativo, as três entradas históricas também passam a exigir sessão, dupla concessão e gate da ponte; escritas exigem protocolo de concorrência. O comportamento anterior permanece com a continuidade desligada. O mediador reutiliza as mesmas verificações, e a assinatura e ACL históricas são preservadas.

Esta medida não substitui inventariar integrações externas nem comprova fontes/fuso. Validar compatibilidade e concorrência nas duas ordens antes de ativar gates; aprovação e deploy permanecem bloqueados.

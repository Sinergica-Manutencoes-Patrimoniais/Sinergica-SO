# ADR-0052 — Prévia contratual sem materialização

**Status:** decisão para implementação local E01-S166. **Data:** 2026-10-27.

A prévia pura de Visitas recebe regra versionada com dia, intervalo de semanas, âncora semanal, vigência, feriados e Visitas existentes já protegidas. Calcula datas civis sem fuso implícito nem integração externa. Feriado no dia contratual suprime somente a Visita contratual não protegida e produz indicação administrativa, não ocorrência ou indicador operacional. Extras e Visitas confirmadas, reprogramadas ou com exceção aprovada permanecem identificadas e não são alteradas; referência da semana contratual impede proposta duplicada.

A prévia não persiste auditoria nem altera regras ou Visitas e não constitui materialização. Autorização, fuso IANA, geração de Ocorrências por Visita, alterações de regra e vinculação com E01-S171 continuam responsabilidades do servidor e dependências não homologadas. Obrigações por calendário são caminho separado e não podem ser suprimidas por essa prévia.

Uma prévia separada de calendário calcula ciclos a partir da âncora original em dias, semanas, meses ou anos, mantendo vencimentos em feriados e identificando-os sem reprogramação. A janela padrão vai da data de referência até 30 dias depois, inclusive. Períodos extensos demais são rejeitados em vez de truncados. É cálculo informativo: a materialização no servidor e convergência com a recorrência legada exigem provas próprias, sem substituir registros existentes.

A comparação preliminar de mudança de dia usa somente a janela futura, data de vigência explícita e Visitas protegidas recebidas. Compara propostas semanais antes/depois, não presume que sejam Visitas efetivamente existentes; conserva a supressão já ocorrida na semana e não inventa Visita anterior à vigência. Sempre sinaliza impactos operacionais pendentes. Comando de mudança dependerá de conferência transacional das Visitas/OS reais e não deve executar esta prévia do navegador como autoridade.

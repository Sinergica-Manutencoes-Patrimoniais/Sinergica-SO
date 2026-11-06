# ADR-1480 — Escolha auditada de origem por Rotina e alvo

## Contexto
Os geradores S166 exigem linha em `pcm.rotina_origem_geracao`, mas não havia comando de aplicação para registrar essa escolha. Isso impedia materialização sem escrita privilegiada direta.

## Decisão
Preparar comando autenticado, idempotente e auditado para declarar origem `plano` ou `pmoc` de uma Rotina e alvo congelados em versão aprovada, após confirmação explícita e motivo. A chave de origem existente permanece única. Mesma origem pode ser confirmada novamente; origem diferente é recusada e exige processo próprio de transição, pois pode haver ocorrência ou execução existente. O comando nunca cria ou cancela ciclos/OS nem modifica PMOC. Preparar consulta com revisão e interface no contexto da prévia. Gate desligado por padrão.

## Limites
A escolha registra responsabilidade PCM; não comprova que agendas PMOC e Plano sejam equivalentes, nem impede o gerador PMOC legado. É necessária reconciliação de fontes e prova de exclusividade antes de habilitar geração ou homologar AC-5. Revisar autorização, origem histórica, corridas, regras de transição e replay. Não acionar Auvo.

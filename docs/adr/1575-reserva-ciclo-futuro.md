# ADR 1575 — Reserva explícita de ciclo futuro

## Contexto
O PCM precisa decidir um par de obrigações antes de a ocorrência SSO existir. A relação de Planos e coincidência de datas não provam equivalência.

## Decisão
A prévia compara o ciclo individual da Rotina com o índice legado individual. O PCM confirma a fotografia das duas regras e dos efeitos conhecidos; as operações exigem READ COMMITTED. Datas distintas são permitidas nas escolhas exclusivas; a ponte usa o contrato existente, que exige datas iguais. Enquanto a ponte escolhida não existir, são recusados envio e OS legados referentes ao índice reservado. A identidade canônica SSO é registrada sem criar ocorrência, OS ou tarefa. Os escritores já existentes reconhecem a identidade quando o ciclo for preparado, e o gerador legado só limita o índice escolhido.

## Limites
A reserva cobre somente o par expressamente selecionado, sem afirmar cobertura de janela inteira. A guarda 1045 permanece. O fluxo deve ser revisto e validado, incluindo concorrência e autorização, antes de operação.

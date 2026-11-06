# ADR 1287 — Detalhe do último evento aceito de campo

## Contexto

O histórico ordenado preserva projeções de eventos externos, mas a consulta do PCM apresenta apenas estado e ordem. Dados declarados posteriormente ficam inacessíveis à triagem sem consultar o payload bruto.

## Decisão

Adicionar consulta por Cliente e OS para o último evento aceito, com gate e capacidade de validação existentes. Retornar somente título, descrição, identificador externo do técnico e horários declarados, além da ordem e estado. Não expor fotos, payload bruto ou campos arbitrários. Não alterar OS, tarefa, Chamado ou decisões do PCM. A leitura não comprova autenticidade da fonte, execução ou validação.

## Compatibilidade e retorno

Migration e interface são aditivas, com flag de interface desligada. A interface não deve habilitar esta opção antes das dependências e revisão. Para retorno, desligar a flag; não remover histórico. Validar isolamento por Cliente, revogação, divergência com a OS, dados sensíveis, relógios, concorrência e RLS/FORCE; revisão adversarial obrigatória antes de habilitar.

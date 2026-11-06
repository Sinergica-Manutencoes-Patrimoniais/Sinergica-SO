# ADR-0845 — Conferência de pergunta opcional não inspecionada

## Contexto

A conferência estrutural 0530 já valida cada pergunta e permite omissão quando há contrato de opcionalidade único e explícito. Um segundo predicado rejeita todas as respostas `nao_inspecionado`, inclusive opcionais. Com a ADR-0843, a classificação conserva essa distinção, mas a conferência ainda bloqueia o caso válido.

## Decisão

Remover apenas o predicado que rejeita qualquer resposta não inspecionada. A guarda anterior continua exigindo resposta válida para pergunta obrigatória ou com contrato ausente, inválido ou ambíguo; não converte ausência em OK. A versão histórica e as decisões são preservadas. Nenhum gate ou ACL é alterado.

## Limites

Conferência estrutural não comprova autenticidade externa de evidência nem encerra OS. Aprovação, criação de Pendência, concorrência e demais fontes exigem testes próprios e revisão antes de habilitar o fluxo.

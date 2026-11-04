# ADR-0109 — Informação e exceção de materiais

## Estado

Proposta para E01-S179, complementar às ADRs 0099 e 0105. Não autoriza implantação.

## Decisão

Disponibilidade é informação declarada por operador autorizado, não confirmação física. Registro de exceção por lista ou linha refere-se a snapshot explícito e registra tipo e descrição; reabre tratamento da lista sem alterar OS, criar OS, executar Auvo, comprar ou faturar. Eventos de informação e exceção são append-only, com ator, horário, revisão e requestId. O servidor valida OS, Cliente derivado, permissão, revisão e referências à linha, e aplica evento, revisão, estado, auditoria e resultado idempotente em uma transação.

Estado de disponibilidade usa `informada_disponivel`, `parcial` ou `indisponivel`; exceção retorna a `levantada`. A restrição inicial criada na migration ainda não aplicada precisa ser expandida para permitir os novos estados; dados existentes são preservados. Revisão da lista pode avançar sem mudança das linhas; consulta histórica de linhas escolhe snapshot mais recente até a revisão solicitada, preservando a distinção entre ausência de organização e vetor vazio.

## Gates

Não habilitar até testes de banco, concorrência/revogação, revisão adversarial, retenção de dados e autorização efetiva. Suspensão/reprogramação da mesma OS, evidências fotográficas e integração ao orçamento dependem de contratos próprios e não são inferidas pelo evento. Escrita diretamente na tabela é negada.

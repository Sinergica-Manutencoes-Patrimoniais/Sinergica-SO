# ADR-0090 — Leitura protegida das OS por Chamado

## Estado

Proposta local para E01-S167, sem liberar criação múltipla nem implantação. A migration correspondente permanece aditiva e sujeita à revisão adversarial e ao rollout coordenado.

## Contexto

O legado mantém uma referência singular em Chamado e um índice que permite só uma OS ativa por Chamado. O trigger também copia o número do Chamado para a OS. Há registros cujo vínculo não comprova mesmo Cliente, e o acesso PCM legado é amplo. Remover a restrição antes de tratar leitores, escritores e números pode causar erros ou exposição cruzada.

## Decisão

Adicionar consulta paginada somente-leitura que recebe Cliente e Chamado e usa `ordens_servico.chamado_id`. Uma referência singular legada sem vínculo inverso também é retornada quando o Cliente coincide e não há referência ambígua por outro Chamado. Vínculos inconsistentes são sinalizados por erro, sem retornar dados. A consulta verifica capacidade atual `chamado.encerrar` no Cliente e correspondência do Chamado, responde com erro uniforme para ausência ou falta de acesso, e retorna apenas OS não excluídas do mesmo Cliente. Escrita, estados, número e referência singular legados permanecem intocados.

O uso de `chamado.encerrar` é restrição técnica conservadora: não define que todo leitor deva possuir poder de encerramento. Consultas para outros perfis exigem capacidade de leitura própria e definição segura antes do uso operacional. Nenhuma concessão é criada automaticamente. Campos retornados são identificação, número, título e estado, sem custos.

## Limites

O cursor por UUID permite paginação estável de conjunto fixo, mas inserções concorrentes anteriores ao cursor exigem reinício da consulta; não representa snapshot transacional entre páginas. A consulta recusa vínculos inconsistentes em vez de corrigi-los; inventário e tratamento auditado são necessários antes de transição. O índice e o trigger legados permanecem: esta consulta não implementa criação de múltiplas OS nem prova AC-1 a AC-3. Revisar consumidores, custo do plano de consulta, RLS legada e autorização dos demais perfis antes de habilitar integração. Nenhuma sincronização Auvo é autorizada por esta decisão.

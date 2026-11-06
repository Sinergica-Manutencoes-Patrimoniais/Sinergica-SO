# ADR-0095 — Inventário agregado dos códigos legados

## Estado

Decisão para incremento local de E01-S177; não autoriza rollout, reserva, alteração ou reconciliação de códigos.

## Contexto

`pcm.equipamentos.identificador` e `pcm.sistemas.codigo` coexistem; os índices legados protegem somente o formato padronizado, ativos não excluídos e cada tabela separadamente. Legados, cadastros excluídos e colisões entre tipos continuam relevantes. Antes de impor namespace único ou cadastrar aliases é necessário conhecer ambiguidades sem renumerar nem adivinhar proprietário de código.

## Decisão

Adicionar consulta global somente agregada para superadmin ativo confirmado por registro no banco e papel da sessão. Contar por tabela linhas, códigos vazios, registros excluídos e, para Componentes, Cliente ausente. Contar grupos duplicados exatos e possíveis colisões por comparação informativa de código aparado e maiúsculo; não mudar valor original e não assumir que a normalização é identidade canônica. Códigos vazios não entram em comparação de colisões. Incluir excluídos para não presumir que códigos históricos podem ser reutilizados.

A consulta não retorna códigos, UUIDs, nomes, Cliente ou dados individuais; ausência de permissão falha fechada. Não cria reserva, alias, bloqueio, índice ou backfill, não confirma que um cadastro é rascunho e não cobre códigos de outros objetos ou fontes externas. Resultado é fotografia de uma consulta, não trava escritas concorrentes nem garante que outro instante tenha o mesmo inventário.

## Gates

Antes de qualquer uso ou rollout, medir custo em dados representativos e revisar acesso, consistência, definição de namespace e fontes de etiqueta/OS/Auvo; conciliar divergências individualmente e sem revelar informação a operador não autorizado. O inventário agregado não resolve atribuição, nem autoriza substituir ou reciclar códigos. A proteção real necessita transação, unicidade, compatibilidade com escritores legados, concorrência e auditoria próprios, além de revisão adversarial e db-tests.

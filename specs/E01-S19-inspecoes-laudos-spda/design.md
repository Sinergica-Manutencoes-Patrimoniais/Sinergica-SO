---
name: design-E01-S19-inspecoes-laudos-spda
description: Design arquitetural das tabelas e telas de Inspeções e Laudos SPDA no PCM SO.
alwaysApply: false
story: E01-S19
owner: "@architect"
status: approved
tier: arquitetural
created_at: 2026-07-04
---

# Design — Inspeções e Laudos SPDA

## Decisões

1. **Schema próprio no PCM**
   - `pcm.inspecoes`
   - `pcm.inspecao_itens`
   - `pcm.laudos_spda`
   - `pcm.laudo_spda_pontos`

2. **Sem Storage nesta entrega**
   Fotos entram como `foto_url`/referência externa, podendo ser link Auvo ou URL pública fornecida no
   momento da vistoria. Criar bucket, signed URL e políticas de Storage fica fora desta story.

3. **Sem duplicar cliente/equipamento Auvo**
   As tabelas referenciam `pcm.clientes`. Dados de equipamento continuam seguindo a decisão de
   E01-S16: se um ponto/inspeção precisar de equipamento Auvo no futuro, guardará apenas o
   identificador de relacionamento, não cache de equipamento.

4. **Cálculo NBR incremental**
   Esta story cria a fundação operacional: dados básicos, pontos, conformidade e conclusão. O motor
   completo de cálculo NBR do PCM antigo vira futura story específica.

## Modelo de Dados

### `pcm.inspecoes`

Registro mestre da vistoria/inspeção predial.

- Cliente, título, status, data, responsável técnico.
- Totais materializados: total, conformes, não conformes, atenção.
- Observações gerais.

### `pcm.inspecao_itens`

Itens levantados em campo.

- Sistema: estrutural, hidrossanitário, elétrico, SPDA, cobertura, fachada, áreas comuns,
  equipamentos, incêndio, ar-condicionado, elevadores, geral.
- Resultado: conforme, não conforme, atenção, não avaliado.
- Severidade, localização, recomendação, URL de foto.

### `pcm.laudos_spda`

Registro mestre do laudo SPDA.

- Cliente, número, status, data de vistoria, ART, responsável.
- Conclusão, nível de proteção, necessidade de SPDA e risco total simplificado.
- `dados jsonb` para campos técnicos ainda não normalizados.

### `pcm.laudo_spda_pontos`

Pontos de medição do laudo.

- Número do ponto, localização, resistência em ohms, conformidade, observações e URL de foto.

## Segurança

RLS por módulo:

- SELECT: `superadmin` ou `user_modulos.pcm in ('leitura','escrita')`
- INSERT/UPDATE/DELETE: `superadmin` ou `user_modulos.pcm = 'escrita'`
- `service_role` recebe grants para automações futuras.

## UI

As abas entram na navegação interna do PCM, com o mesmo padrão de layout do SO:

- Lista lateral/tabela de registros recentes.
- Painel de detalhe no mesmo viewport.
- Formulários compactos, com selects e campos técnicos editáveis.
- Sem modal grande para estas telas; elas são áreas de trabalho contínuo.

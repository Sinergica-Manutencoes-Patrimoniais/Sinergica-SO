# Research — E01-S172

## Decision

calcular HH interno/externo/restante e disponibilidade configurada com deduplicação e demanda incompleta; expor agenda consolidada e simulação com alertas confirmáveis, simultaneidade e baseline de vencimentos.

## Evidence and Reuse

- `apps/web/src/features/pcm/domain/agenda-tecnico.ts`
- `apps/web/src/features/pcm/pages/AgendaTecnicoPage.tsx`
- `apps/web/src/features/pcm/application/agenda-tecnico-gateway.ts`

A análise desta conversa verificou código/migrations da branch baseada em 22aca391. Referências legadas não são prova de implantação em produção. Reler os trechos tocados antes do teste que falha; não reconstruir relatórios de 14/10.

## Rationale

As definições posteriores do Fabrício prevalecem: Plano amplo/Rotina alvo único, modos por calendário/Visita, tolerâncias explícitas, alias administrativo e staging aprovado. Proteger os IDs e cadastros atuais reduz migração e preserva histórico.

## Alternatives considered

- Recriar módulo/cadastro com nova identidade: rejeitado; há base funcional reutilizável.
- Adaptar operação aprovada ao limite atual do código: rejeitado; limite deve evoluir por migration compatível.
- Antecipar Auvo, deploy ou Copiloto completo: fora de escopo; interfaces de recepção e doubles bastam para preparar esta fatia.

## Technical gates

### Revalidação local (2026-10-27)

- A agenda legada registra alocação manual por técnico/Cliente e data, não horas preventivas autorizadas, ausências, reservas ou qualificações. Sua tela cobre segunda a sábado; não utilizar essas alocações como capacidade disponível nem como prova de ausência de conflito.
- O contrato local de cobertura exige semana civil de segunda a domingo, Cliente/período coerentes e declaração explícita de disponibilidade, reservas/ausências, demandas, Visitas, vínculos e qualificações. Falha ou cobertura ausente não viram capacidade zero nem disponibilidade confirmada. Cancelamento descarta resposta tardia. Seis testes de aplicação passaram com gateways simulados; não há adapter de fontes reais, snapshot consistente, cálculo consolidado, UI ou autorização de servidor implementados.
- Antes de integração: criar fontes e contrato de consulta autorizada por Cliente, tratar dados parciais e paginação como incompletos, preservar baseline e deduplicar OS/ocorrência com vínculo comprovado. Disponibilidade externa e acompanhamento interno, deslocamento e simultaneidade exigem dados próprios. Testes isolados não substituem prova de concorrência e autorização.

Dependências E01-S171 precisam contrato estável antes da integração. APIs Auvo não comprovadas permanecem fechadas; testar depois em ambiente autorizado, com fixture até lá. P01/P02/P03 não estão abertas. Não há decisão funcional pendente nesta story; unknown de contrato real vira gate de liberação e SPEC_DEVIATION se contradizer design.

### Impedimento da consolidação de HH (2026-10-30)

- A fonte `pcm.sso_listar_fontes_demanda_visita`, em `0356_E01-S172_fontes_demanda_visita_os.sql`, é leitura preparatória fechada por gate e sem EXECUTE para authenticated. Retorna apenas vínculos de OS em Visitas, não o universo de ocorrências não vinculadas; todos os registros têm `completude = desconhecida`.
- A projeção expõe estimativa de OS, número de participantes e deslocamento, mas não identifica execução própria ou terceirizada, acompanhamento interno, unidade da estimativa, esforço já realizado ou esforço restante. O número de participantes por si só não comprova HH interno. OS em múltiplas Visitas e vínculo OS/ocorrência também exigem identidade e deduplicação de esforço restante, não soma cega de linhas ou páginas.
- A disponibilidade em `CapacidadeAgendaWorkspace` é explicitamente parcial: ausência ou sobreposição de reservas não está integralmente verificada. Ausência de páginas e fontes não significa demanda zero. Não conectar esses campos ao saldo como se fossem cobertura completa.
- Para prosseguir, E01-S171/E01-S167 precisam fornecer fonte autorizada, paginada e versionada que distinga trabalho interno, terceiros e acompanhamento, unidade/quantidade e esforço restante, com identidade canônica de OS/ocorrência e cobertura de ocorrências não vinculadas. Implementar primeiro contrato, testes positivos/negativos e concorrência com autorização atual e isolamento por Cliente; só depois calcular e expor HH conhecidos parciais, sinalizando incompletude e sem saldo definitivo. Não há necessidade de perguntar regra operacional já decidida a Fabrício.

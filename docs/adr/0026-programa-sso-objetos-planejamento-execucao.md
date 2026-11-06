# ADR-0026 — Objetos canônicos do programa SSO

**Status:** Proposta técnica especificada; adoção antes da primeira migration, sem implantação nesta entrega.
**Data:** 2026-10-26. **Fontes:** Caderno Técnico v1 e definições posteriores do Fabrício.
**Substitui:** ADR-0025 como desenho do programa; ADR-0008 nos pontos envio imediato, 1:1 e resultado somente resumido; ADR-0014 apenas quanto à unicidade numérica compartilhada entre OS do mesmo Chamado.

## Contexto e decisão

PCM governa estrutura, Plano, Rotina, Ocorrência, Pendência, Backlog, Chamado, OS e Visita. Auvo executa uma tarefa por OS. Comercial governa orçamento, Financeiro governa efetivação; contratos entre domínios usam DTOs em packages, nunca importação direta de feature.

Plano tem escopo amplo. Versão do Plano aponta versões de Rotina com alvo tipado único: Sistema, Componente individual (incluindo natureza equipamento) ou Grupo Quantitativo. Rotina versionada guarda modo por Visita/calendário, âncora, intervalo/unidade e tolerâncias antes/depois. Ocorrência conserva snapshot da versão e alvo e identidade de ciclo estável que não muda ao revisar. Revisão mapeia explicitamente ciclos futuros elegíveis para impedir duplicação entre versões.

Pendência é constatação atômica; Backlog agrupa escopos selecionados; Chamado contém necessidade integral; OS é unidade executável. Não converter registros destrutivamente. OrdemServico.chamado_id é relação canônica 1:N. Uma tabela de composição mantém quais partes do escopo cada OS atende; encerrar todas as OS não prova atendimento integral por si só.

Visita possui Cliente, Posição, janela com timezone, equipe, deslocamento, confirmação e várias OS. Relação OS/Visita tem histórico N:N e no máximo uma associação vigente por OS. Agenda existente é insumo legado, não sinônimo da nova entidade.

T−24 usa início da Visita como instante. Confirmação PCM + política cliente resolvida geram intenção, não POST antecipado. Usar outbox existente com agregado OS e revisão de programação; serialização por OS, lock transacional e compare-and-set descartam comandos obsoletos. Resultado remoto incerto bloqueia novo POST até reconciliação. HMAC, JWT, rate-limit, Zod, Vault e read-back do contrato existente permanecem obrigatórios.

Conclusão Auvo registra fim em campo. PCM valida evidências, fecha OS individualmente e encerra Chamado explicitamente somente após escopo integral. Continuação recebe somente restante; Não OK gera Pendência, nunca Chamado corretivo automático. Respostas por pergunta e evidências recebidas são preservadas com origem, acesso e retenção minimizada; ampliar material recebido somente com contrato comprovado.

## Compatibilidade e alternativas

- Rejeitados: nova árvore paralela, novo motor de sync, manter Backlog como OS ou usar Auvo como fonte da agenda.
- 0171 e 0224 exigem migração nova para cardinalidades. 0151/0209 e unique de número OS exigem compatibilidade explícita: preservar UUIDs e números antigos, criar referência pública única por OS nova (referência do Chamado + sufixo estável é representação proposta); não renumerar legado.
- Retirar constraints antigas somente depois de leitores/escritores compatíveis e backfill verificado. Fase aditiva mantém IDs, links e opção de recuar aplicação sem apagar dados novos.
- Tolerância afeta avaliação de pontualidade, não move âncora nem cria reposição de Visita.
- Aprovação/autoaprovação seguem permissão específica de gestor atribuída individualmente, conforme Fabrício; não há P01/P02/P03 abertas.

## Consequências e gates

Specs E01-S165–S186 implementam por fatias com RLS FORCE, pgTAP positivo/negativo, auditoria append-only, testes de concorrência e revisão adversarial antes de PASS. Nenhum contrato Auvo, rollout ou aceite operacional é considerado executado nesta decisão. Fabrício libera testes reais e piloto.

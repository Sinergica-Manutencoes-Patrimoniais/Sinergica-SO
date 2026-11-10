---
name: inventario-frontend-quatro-stories
description: Inventário exploratório de arquivos e rotas das stories S165, S166, S170 e S176.
alwaysApply: false
---

# Inventário inicial de frontend — quatro stories

Comparação da base Git `22aca3918224bc45175e80c6ec88b957fdb604aa` com o backup `54c95e6`. É levantamento para revisão, não seleção de release. O [inventário de hashes](inventario-frontend-quatro-stories-54c95e6.json) registra blob Git, SHA-256, diferença em relação à base, imports relativos literais e flags das quatro pastas de interface e das cinco rotas compartilhadas.

| Pasta de interface | Arquivos do snapshot | Relação inicial |
| --- | ---: | --- |
| `plano-manutencao` | 168 | S165/S166 e componentes compartilhados de outras funcionalidades |
| `calendario-contratual` | 21 | S166 e funcionalidades contratuais compartilhadas |
| `capacidades-sso` | 2 | S170 |
| `estrutura-tecnica` | 35 | S176 e fontes compartilhadas de outras stories |

Todos os 226 arquivos dessas pastas diferem da base; isso não significa que todos devam integrar o lote. O fechamento exploratório de imports literais, incluindo as rotas abaixo, alcançou 1.229 arquivos, dos quais 792 diferem da base, 74 são testes e 659 flags distintas aparecem no texto. A amplitude decorre também do carregamento de outras funcionalidades por `HomePage`; não é manifesto de release.

## Rotas e pontos compartilhados

- `apps/web/src/app/HomePage.tsx`: inclui `CapacidadesWorkspace` (S170); o mesmo diff inclui painéis de orçamento operacional e navegação de OS, que não devem entrar automaticamente no lote.
- `apps/web/src/features/pcm/pages/VisaoClientePage.tsx`: inclui os workspaces de Plano e Calendário (S165/S166); também altera painéis de backlog e outras funcionalidades sob flags próprias.
- `apps/web/src/features/pcm/pages/EstruturaClientePage.tsx`: inclui Grupos, composição do Local e Sistemas distribuídos (S176); o diff também abrange consulta de códigos, capacidade, importação, reconciliação e retornos de outras stories.
- `apps/web/src/features/pcm/pages/EquipamentosPage.tsx`: adiciona histórico de Grupo, movimentação e conferência de capacidade cadastral (S176/S170); revisar mudanças de detalhe e gestão legado separadamente.
- `apps/web/src/features/pcm/pages/SistemasPage.tsx`: altera conferência de capacidade e acesso à composição de Sistema (S170/S176); revisar o diff completo antes de selecionar trechos.

As flags listadas no JSON são referências encontradas no código, não uma recomendação de ativação. Não há segredos ou conteúdo-fonte copiado no inventário. Imports dinâmicos não literais, aliases, CSS, dependências de pacotes, exclusões e efeitos de inicialização não são cobertos; zero imports relativos não resolvidos no levantamento não prova fechamento. Para selecionar uma branch, revisar cada hunk compartilhado, testes, contratos, ACL e migrations correspondentes, além do `package.json`/lockfile e CI integrais. O inventário foi obtido por leitura; nenhuma branch foi criada ou testada.

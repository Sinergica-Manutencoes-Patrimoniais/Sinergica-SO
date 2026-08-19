# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Usuário primário: **supervisor** e **colaborador** — equipe interna da Sinérgica Manutenções que
opera o PCM no dia a dia (chamados, backlog GUT, visitas, preventivo, inspeções, OS). É onde a
maioria das telas do app vive.

Outros papéis confirmados, secundários pro trabalho de design desta app:
- `superadmin` — acesso total, configura Agente Zé, integrações, usuários.
- `cliente-síndico` — acessa via WhatsApp (Agente Zé) e via portal (Área do Cliente), só dados do
  próprio condomínio.

## Product Purpose

Sistema operacional completo da Sinérgica Manutenções Patrimoniais (Campinas/SP, manutenção
predial para condomínios residenciais/comerciais). Centraliza da captação comercial até execução
técnica em campo, faturamento e prestação de contas ao cliente. Sucesso: PCM funcionando como
system of record único da operação, substituindo processo disperso/manual.

## Positioning

PCM é o **system of record** — origin of truth para decisão (abertura, prioridade, atribuição).
Auvo (app de campo dos técnicos) é o **origin of truth para execução** (GPS, fotos, checklist,
assinatura offline) — insubstituível, não replicado no PCM. Identificação cruzada: OS no PCM ↔
`externalId`/`auvo_task_id` no Auvo. Nenhum concorrente genérico de field service replica essa
divisão decisão/execução com esse grau de integração bidirecional.

## Operating Context

Monorepo multi-domínio, 9 bounded contexts: PCM/Operação, Atendimento (Agente Zé no WhatsApp),
Comercial, Financeiro, Operação & Estoque, Marketing, Growth, Gestão (Cockpit), Área do Cliente.
apps/web é o app interno (React 19 + Vite + TanStack Router/Query); Área do Cliente também vive
aqui.

Contexto real de uso: escritório/operação da Sinérgica, jornada de trabalho comum de gestão
predial — telas de tabela/lista/formulário predominam, não conteúdo de marketing.

## Capabilities and Constraints

- Stack já estabelecida: React 19 · Vite 5 · TypeScript 5 (strict) · Tailwind CSS 4 ·
  TanStack Router/Query · `packages/ui` compartilhado.
- Data fetching: TanStack Query obrigatório em código novo (sem `useState`+`useEffect` manual)
  — ver CLAUDE.md.
- RLS FORCE em toda tabela, segurança OS-grade — ver `seguranca/os-grade.md`.
- Sistema de design em construção incremental (lote visual E00-S14..S23 em andamento: skeleton,
  tipografia, dark mode/a11y parcial) — sem DESIGN.md formal ainda.
- Dados são de clientes reais da Sinérgica — tratar com cuidado (sem exposição indevida em
  screenshots/mocks de design).

## Brand Commitments

Nome: **Sinérgica Manutenções Patrimoniais**. Logos oficiais em `apps/web/public/logos/`
(horizontal branco, horizontal positivo, símbolo laranja, favicon). Paleta de marca já extraída
dos logos e em uso em `src/index.css`: Navy (`#1C2748`) é a cor estrutural (sidebar, ativo, foco);
Laranja (`#E8731B`) é cirúrgico — só CTA/indicador ativo/prioridade crítica; papel quente
(`#F4F2EC`) como fundo, não slate genérico de dashboard. Fonte de marca: Saira (numerais, labels
caixa-alta). Esses tokens são vinculantes — ver `src/index.css` como fonte viva até existir
DESIGN.md.

## Evidence on Hand

Nenhum material de marketing, depoimento ou case pronto pra reuso em UI. Todo conteúdo real em
tela é dado operacional de clientes reais da Sinérgica (condomínios, OS, chamados) — não fabricar
depoimento, cliente fictício com nome de marca real, ou prova social. Placeholder/mock de tela deve
ser claramente genérico.

## Product Principles

- PCM decide, Auvo executa — nenhuma tela do PCM deve tentar replicar dado que só o Auvo tem
  autoridade sobre (GPS, fotos, assinatura).
- Operar > persuadir — a maioria das telas é ferramenta de trabalho interna (modo Operate); não
  aplicar padrões de landing/marketing aqui.
- Linguagem ubíqua sem sinônimo — termos seguem `docs/glossary.md` exatamente.
- Segurança e correção de dado real vêm antes de polish visual — dado de cliente real está em
  jogo.

## Accessibility & Inclusion

WCAG 2.1 AA é requisito vinculante. Já em aplicação parcial: contraste de tokens semânticos
ajustado pra passar mínimo AA 4.5:1 (ver comentário em `src/index.css`, E00-S14 AC-5). Trabalho de
dark mode/a11y do lote visual E00-S14..S23 está em andamento, não 100% completo — checar
`docs/STATE.md` pro estado mais recente antes de assumir cobertura total.

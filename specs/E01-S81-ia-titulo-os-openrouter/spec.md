---
name: spec-E01-S81-ia-titulo-os-openrouter
description: Contrato — config de IA (OpenRouter: API key no Vault + escolha do modelo) no superadmin e geração automática de título de OS a partir da descrição (botão manual + auto no fluxo Zé).
alwaysApply: true
tier: pequeno
---

# Spec — IA: config OpenRouter + geração de título de OS

> **Fonte da verdade.** Status: aprovado
> Origem: reunião Lucas × Fabrício (2026-07-16). OS no Auvo nasce sem título declarativo (só
> "corretiva/preventiva"). Queremos título tipo "troca de lâmpada, corredor 3º andar" gerado por IA
> a partir da descrição. Feature com LLM → envolver `@prompt-engineer` (ver `ia/`).

## Resumo
A config do SO (superadmin) passa a guardar a **credencial do OpenRouter (API key no Supabase Vault)
e o modelo LLM escolhido**. Com isso ligado, o form de OS ganha um botão "Gerar título" que produz um
título declarativo a partir da descrição, e o fluxo de abertura via Agente Zé/WhatsApp preenche o
título automaticamente.

## Contexto atual (AS-IS)
- `config.integracoes` + RPCs de Vault (`fn_definir_segredo_integracao`/`fn_integracao_tem_segredo`,
  `fn_obter_segredo_integracao_interno` para `service_role`) já existem — E00-S12. A key de IA reusa
  esse mesmo padrão (segredo nunca em tabela; campo write-only na UI).
- Fluxo Zé já usa OpenRouter numa Edge Function (`pcm-ze-agent`) — E01-S02.
- Form de OS: `NovaOrdemServicoModal.tsx`; domínio em `pcm/domain/ordens-servico.ts`.

## Critérios de aceite

### AC-1: Config de credencial + modelo de IA (superadmin)
- **Dado** um `superadmin` em Configurações → IA
- **Quando** informa a API key do OpenRouter e escolhe o modelo (ex.: `openai/gpt-4o-mini`)
- **Então** a key é gravada via RPC no **Vault** (nunca em tabela, campo write-only, nunca reexibida)
  e o modelo escolhido fica em `config.integracoes` (metadado não-sensível). Sem `superadmin`, a tela
  é inacessível.

### AC-2: Botão "Gerar título" no form de OS
- **Dado** o form de abertura/edição de OS com uma descrição preenchida
- **Quando** o usuário clica "Gerar título"
- **Então** uma Edge Function chama o OpenRouter (key/modelo da config) e retorna um título curto e
  declarativo, que é sugerido no campo título (o usuário pode editar antes de salvar).

### AC-3: Título automático no fluxo Zé
- **Dado** uma OS criada via Agente Zé/WhatsApp (`origem='ze'`) sem título
- **Quando** a OS é aberta
- **Então** o título declarativo é gerado automaticamente a partir da descrição/contexto, sem ação
  manual.

### AC-4: Degradação sem IA configurada
- **Dado** que a integração de IA não está configurada/ativa
- **Quando** o usuário abre o form de OS ou o Zé cria uma OS
- **Então** o botão "Gerar título" fica desabilitado (com dica do porquê) e o fluxo Zé segue sem
  título gerado — **nunca** quebra a abertura da OS nem finge sucesso (mesmo princípio do e-mail em
  E01-S05).

## Casos de borda e erros
- OpenRouter fora do ar/timeout → mensagem clara, título não preenchido, OS pode ser salva mesmo assim.
- Descrição vazia → botão desabilitado (não há de onde gerar).
- Resposta do LLM muito longa → truncar/validar no domínio antes de aplicar ao campo título.

## Fora de escopo (vinculante)
- Gerar descrição/outros campos por IA (só o título nesta story).
- Análise/priorização por IA (a IA aqui é só redação de título).
- Trocar o provedor Zé de OpenRouter (só reusa a mesma credencial/padrão).

## Rastreabilidade
- Config: `apps/web/src/features/config/pages/` (nova aba IA), `config.integracoes` + RPC Vault (E00-S12)
- Edge Function nova de geração de título (reusa `_shared` + leitura de segredo via
  `fn_obter_segredo_integracao_interno`)
- Form: `apps/web/src/features/pcm/components/NovaOrdemServicoModal.tsx`,
  `apps/web/src/features/pcm/domain/ordens-servico.ts`
- Fluxo Zé: `supabase/functions/pcm-ze-agent/index.ts`
- IA/prompt: `ia/` (prompt do gerador de título — `@prompt-engineer`)

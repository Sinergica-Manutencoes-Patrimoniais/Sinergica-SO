---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Sistema de feedback: toast + diálogo de confirmação

> **Fonte da verdade.** Status: rascunho
> Depende de **E00-S15** (`Modal`). **Maior ganho percebido por esforço de toda a análise.**

## Resumo
O sistema para de usar as caixas nativas do browser (`window.confirm`/`alert`) e passa a
confirmar, avisar e reportar erro dentro da própria interface.

## Contexto medido (2026-08-07)
| Medida | Valor |
|--------|-------|
| Arquivos com `confirm(` | **24** |
| Arquivos com `window.confirm` explícito | 8 |
| Arquivos com `alert(` | 1 |
| Sistema de toast/notificação | **inexistente** |
| Arquivos com `aria-live` | 1 |

`window.confirm` desenha uma caixa cinza do sistema operacional, com o domínio
`so-sinergica.netlify.app` escrito no topo, no meio de um produto de marca. É o sinal isolado
mais forte de "isto não foi desenhado". Também é bloqueante (trava a thread), não estiliza, não
tem estado de carregamento e não distingue ação destrutiva de ação comum.

## Critérios de aceite

### AC-1: Nenhum diálogo nativo do browser sobrevive
- **Dado** `apps/web/src/**/*.tsx` e `**/*.ts`
- **Quando** o gate estático roda
- **Então** a contagem de `window.confirm`, `confirm(`, `alert(` e `prompt(` é **0**

### AC-2: Toast para os quatro tipos de feedback
- **Dado** o `ToastProvider` montado na raiz
- **Quando** `toast.sucesso(...)`, `toast.erro(...)`, `toast.aviso(...)` ou `toast.info(...)` é
  chamado
- **Então** aparece uma faixa no canto, empilhável, com tone vindo dos tokens de E00-S14
- **E** sucesso/info somem sozinhos em 4s; **erro e aviso não somem sozinhos** (o usuário precisa
  poder ler e agir)
- **E** o container tem `role="status"` + `aria-live="polite"`, e o de erro `aria-live="assertive"`
- **E** o toast é dispensável por clique e por swipe lateral, entrando e saindo **pelo mesmo lado**
  (consistência espacial — o swipe só faz sentido se a entrada veio de onde a saída vai)

### AC-3: Confirmação destrutiva é um diálogo do produto, não do browser
- **Dado** uma ação irreversível (excluir cliente, excluir OS, apagar anexo…)
- **Quando** o usuário aciona
- **Então** abre um `ConfirmDialog` (sobre o `Modal` de E00-S15) que declara **o que exatamente
  será apagado** (nome/número do registro, não "este item"), a consequência, e tem o botão de
  confirmação com `variant="danger"`
- **E** o botão de confirmação entra em `loading` durante a operação e o diálogo **não fecha
  antes** da promise resolver
- **E** o foco inicial cai no botão **cancelar**, não no destrutivo

### AC-4: Ação reversível não pede confirmação — oferece desfazer
- **Dado** uma ação reversível (arquivar, remover tag, desvincular)
- **Quando** o usuário aciona
- **Então** a ação executa **imediatamente**, sem diálogo, e aparece um toast com ação
  "Desfazer" válida por 8s
- **E** confirmação fica reservada ao genuinamente irreversível — confirmar tudo treina o usuário
  a clicar sem ler

### AC-5: Erro de operação nunca desaparece em silêncio
- **Dado** qualquer `catch` em camada de interface
- **Quando** uma promise de ação do usuário rejeita
- **Então** o erro chega ao usuário por toast ou por faixa inline — nunca só `console.error`
- **E** existe gate estático que falha em `catch {}` vazio ou `catch` cujo corpo só tem
  `console.*` dentro de `features/**/pages/**` e `features/**/components/**`

> AC-5 é a generalização do bug real corrigido em `ConversaChat.tsx` (2026-08-07): envio de
> áudio/mídia falhava como promise rejeitada sem nenhum feedback visível.

## Matriz de decisão — qual feedback usar

| Natureza da ação | Reversível? | Feedback | AC |
|------------------|-------------|----------|-----|
| Salvar formulário | sim | toast sucesso, sem diálogo | AC-2 |
| Arquivar / remover tag / desvincular | sim | executa + toast "Desfazer" | AC-4 |
| Excluir registro | **não** | `ConfirmDialog` nomeando o registro | AC-3 |
| Enviar mensagem a cliente (WhatsApp) | **não** | executa, mas erro vira toast/faixa | AC-2, AC-5 |
| Falha de rede/permissão | — | toast erro persistente com detalhe | AC-2, AC-5 |
| Processo longo (importar OFX, gerar PDF) | — | toast de progresso que vira sucesso/erro | AC-2 |

## Casos de borda e erros
- 6 toasts disparados em sequência (import em lote) → empilha no máximo 3 visíveis + contador,
  não cobre a tela.
- `ConfirmDialog` cuja promise rejeita → diálogo **permanece aberto** mostrando o erro; fechar e
  perder o contexto obriga o usuário a refazer tudo.
- Usuário navega enquanto a ação corre → toast sobrevive à troca de tela (provider fica na raiz).
- Leitor de tela: dois toasts simultâneos não podem se atropelar em `aria-live` — fila.
- `prefers-reduced-motion` → toast aparece por cross-fade, sem deslizar (ver E00-S19).

## Fora de escopo
> Vinculante. Não implemente nada aqui.
- Central de notificações persistente / histórico de avisos (existe no portal, E09-S08 — não
  misturar).
- Notificação push ou por e-mail.
- Adotar `sonner` ou outra dependência externa sem ADR — a primitiva é interna sobre o `Modal`
  e o `ToastProvider` próprios.

## Rastreabilidade
- Depende de: **E00-S14**, **E00-S15**
- Relacionado: E09-S08 (notificações do portal — sistema distinto, não reusar)

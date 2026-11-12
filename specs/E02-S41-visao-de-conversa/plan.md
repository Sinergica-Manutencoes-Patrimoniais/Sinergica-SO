---
name: plan
description: Detalhe técnico de E02-S41 — componentes, portas, queries, estado. Puxe ao implementar.
alwaysApply: false
---

# Plan — E02-S41 · Visão de conversa nova

## Estrutura

```
apps/web/src/features/atendimento/
  interfaces/
    WorkspaceDeAtendimento.tsx     casca de 3 colunas + rotas
    FilaDeConversas.tsx            escopo, busca, contador, item com foto
    PainelDaConversa.tsx           cabeçalho + timeline + compositor + ações
    TimelineDaConversa.tsx         render por tipo de conteúdo
    CompositorDeResposta.tsx       texto, anexo, emoji, templates, rascunho
    PainelDeContextoDoCliente.tsx  dossiê, chamados, OS, tags
    AcaoDeHandoff.tsx              assumir / devolver ao Zé / transferir
    AcaoDeEncerrar.tsx             encerrar com confirmação
    estado-do-workspace.tsx        contexto: rascunho, anexo pendente, operacaoId
    contador-da-fila.ts            conta aguardando humano
    preferencia-do-contexto.ts     coluna aberta/fechada em localStorage
  application/
    atendimento-queries.ts         hooks TanStack Query + atendimentoQueryKeys
    portas.ts                      contrato do repositório
```

Componentes atuais (`ConversaChat`, `ConversaLista`, `MensagemBubble`, `RichComposer`,
`ConversaPerfil`) **não são apagados nesta story**: a tela nova os substitui na rota e eles saem num
PR de limpeza depois do PASS, para o rollback ser trivial.

## Contrato (`application/portas.ts`)

```ts
export type EscopoDaFila = 'ativas' | 'encerradas' | 'todas'

export interface ConversaNaFila {
  id: string; clienteNome: string | null; contatoNome: string | null
  canal: CanalConversa; status: StatusConversa; modo: ModoConversa
  atribuidoA: string | null; naoLidas: number
  ultimaMensagemPreview: string | null; ultimaMensagemEm: string | null
  tags: string[]; fotoHash?: string | null
}

export interface ConversaDetalhada extends ConversaNaFila {
  mensagens: MensagemItem[]
  /** Sinal calculado pela policy no servidor — nunca comparação de ID no browser. (AC-7) */
  podeResponder: boolean
  motivoSemPermissao?: string | null
  contexto?: ContextoDoContato
  versao: number            // para CAS nas ações (AC-8)
}

export interface RespostaParaEnvio {
  texto: string
  anexos: ArquivoDaMensagem[]
  /** Reusado em retry para o banco não duplicar. (AC-9) */
  operacaoId: string
  conteudosDosAnexos?: Record<string, Blob | ArrayBuffer | Uint8Array>
}

export interface RepositorioDeAtendimento {
  listarPorEscopo(escopo: EscopoDaFila, opcoes?: { offset?: number; limite?: number })
    : Promise<ConversaNaFila[]>
  abrir(id: string): Promise<ConversaDetalhada | null>
  /** Quem age é resolvido no adapter a partir da sessão. NUNCA entra por parâmetro. (AC-6) */
  assumir(id: string, versaoEsperada: number): Promise<ConversaNaFila>
  devolverAoZe(id: string, versaoEsperada: number): Promise<ConversaNaFila>
  transferir(id: string, destinoId: string, versaoEsperada: number): Promise<ConversaNaFila>
  encerrar(id: string, versaoEsperada: number): Promise<ConversaNaFila>
  enviarResposta(id: string, resposta: RespostaParaEnvio, sinal?: AbortSignal)
    : Promise<ConversaDetalhada>
}
```

> **Por que o ator não entra por parâmetro:** se viesse do browser, um atendente autenticado poderia
> atribuir a conversa a outra pessoa. A atribuição é o único registro de qual humano leu o histórico de
> WhatsApp de um cliente — um ator escolhido pelo cliente faria esse rastro nomear a pessoa errada, de
> forma indistinguível do registro verdadeiro.

## TanStack Query (AC-11)

```ts
export const atendimentoQueryKeys = {
  todas:      ['atendimento'] as const,
  fila:       (escopo: EscopoDaFila, busca: string) =>
                ['atendimento','fila',escopo,busca] as const,
  conversa:   (id: string) => ['atendimento','conversa',id] as const,
  mensagens:  (id: string) => ['atendimento','mensagens',id] as const,
  contexto:   (id: string) => ['atendimento','contexto',id] as const,
  contador:   ['atendimento','contador'] as const,
}
```

- `useFilaDeConversas(escopo, busca)` — `placeholderData: keepPreviousData`, `signal` repassado ao
  adapter para cancelar a busca antiga (AC-11, caso de borda do filtro).
- `useConversa(id)`, `useMensagens(id)` — `staleTime` do `queryClient` global (30 s).
- Mutations (`assumir`, `devolver`, `transferir`, `encerrar`, `enviarResposta`): `onSuccess` invalida
  `conversa(id)`, `mensagens(id)`, `fila(*)` e `contador`.
- `enviarResposta` com atualização otimista: insere a mensagem com `status_entrega='enviando'`;
  `onError` marca "não enviada" e guarda o `operacaoId` para o retry.

## Estado do workspace

```ts
export interface RascunhoDaConversa { texto: string; anexos: AnexoPendente[]; operacaoId: string }
// Map<conversaId, RascunhoDaConversa> num contexto React, vivo enquanto a tela existe.
```

O `operacaoId` nasce com o rascunho (`crypto.randomUUID()`) e só é descartado quando o envio confirma —
é o que torna o retry idempotente (AC-9). Rascunho **não** vai para `localStorage` (conteúdo de
conversa de cliente não fica no navegador); some ao recarregar a página, e isso é intencional.

`preferencia-do-contexto.ts` usa `localStorage` só para a coluna aberta/fechada, com `try/catch` nas
duas pontas — modo privado ou storage bloqueado degrada em silêncio (AC-10).

## Timeline — render por tipo

| Condição | Render |
|---|---|
| `tipoConteudo='texto'`, sem `conteudoRecebido` | bolha de texto |
| `conteudoRecebido='imagem'` ou `'figurinha'`, `anexoEstado='guardado'` | `<img>` do proxy, clique amplia (figurinha menor, sem moldura) |
| `conteudoRecebido='video'`, guardado | `<video controls preload="metadata">` |
| `conteudoRecebido='documento'`, guardado | cartão: ícone, nome saneado, tipo, tamanho, baixar |
| `tipoConteudo='audio'` | `<audio controls>` + transcrição abaixo, ou "Transcrição indisponível" |
| `anexoEstado` de falha | texto do aviso com ícone de atenção |
| `conteudoRecebido` de aviso | texto `[localização]` com ícone |
| `citadaRemoteId !== null` | bloco "em resposta a" acima do conteúdo |
| reação presente | emoji ancorado no canto da bolha |

Rótulo do autor: `remetenteTipo='ze'|'agente'` → "Agente Zé" · `'humano'` + `origemEnvio='celular'` →
"Pelo celular" · `'humano'` + `'celular_automatico'` → "Mensagem automática do WhatsApp" ·
`'humano'` + resto → "Você" · `'cliente'` → nome do contato.

Todos os anexos vêm do proxy `atendimento-anexo`; `URL.createObjectURL` revogada no unmount.

## Layout

- ≥1280 px: três colunas (`320px | 1fr | 360px`), contexto colapsável.
- 768–1279 px: duas colunas; contexto vira painel sobreposto pela direita.
- <768 px: pilha — fila é a tela, conversa empurra; ações secundárias no menu `⋯`.
- Tokens semânticos do E00-S14; nenhuma cor hardcoded. Animações respeitam `prefers-reduced-motion`
  (AC-13).

## Migração da rota

1. A tela nova nasce em `/atendimento` atrás do mesmo item de menu.
2. `ConversaChat` e companhia continuam no código, sem rota, até o PASS.
3. PR de limpeza remove os antigos e seus testes — story própria, não esta.

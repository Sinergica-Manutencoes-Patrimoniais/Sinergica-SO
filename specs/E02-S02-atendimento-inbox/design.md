---
name: design
description: Arquitetura — feature apps/web/src/features/atendimento/ completa (Inbox), wiring em HomePage.
alwaysApply: false
---

# Design — Inbox de Conversas

## Componentes

Feature completa em `apps/web/src/features/atendimento/`, seguindo exatamente o molde de
`features/pcm/` (`domain/equipes.ts` + `application/equipes-gateway.ts` + `application/equipes.ts`
+ `infrastructure/supabase-equipes-adapter.ts` + `pages/EquipesPage.tsx`):

```
apps/web/src/features/atendimento/
├── domain/
│   ├── deteccao-mencao-ze.ts        (já existe, mantém)
│   ├── conversas.ts                  (NOVO — tipos + filtrarConversas() pura)
│   └── mensagens.ts                  (NOVO — tipos + validarTextoMensagem() pura)
├── application/
│   ├── atendimento-gateway.ts        (NOVO — interface AtendimentoGateway)
│   ├── listar-conversas.ts / listar-mensagens.ts
│   ├── enviar-mensagem.ts / assumir-conversa.ts / devolver-ao-ze.ts
│   ├── marcar-conversa-lida.ts / acionar-ze-agora.ts
├── infrastructure/
│   └── supabase-atendimento-adapter.ts
├── components/
│   ├── ConversaLista.tsx / ConversaChat.tsx / ConversaPerfil.tsx / MensagemBubble.tsx
└── pages/
    └── AtendimentoInboxPage.tsx
```

`domain/conversas.ts`:
```ts
export type StatusConversa = "aberta" | "pendente" | "encerrada";
export type ModoConversa = "auto" | "pausado";
export interface ConversaItem {
  id: string; clientId: string | null; clienteNome: string | null; contatoNome: string | null;
  status: StatusConversa; modo: ModoConversa; atribuidoA: string | null; naoLidas: number;
  ultimaMensagemPreview: string | null; ultimaMensagemEm: string | null;
  ordemServicoId: string | null; tags: string[];
}
export function filtrarConversas(conversas: ConversaItem[], filtro: {...}): ConversaItem[] { ... }
```

`domain/mensagens.ts`:
```ts
export type DirecaoMensagem = "entrada" | "saida";
export type RemetenteTipo = "cliente" | "ze" | "humano";
export interface MensagemItem { id: string; conversaId: string; direcao: DirecaoMensagem;
  remetenteTipo: RemetenteTipo; remetenteId: string | null; conteudo: string | null;
  statusEntrega: "enviando" | "enviado" | "erro" | null; createdAt: string; }
export function validarTextoMensagem(texto: string): string {
  const limpo = texto.trim();
  if (!limpo) throw new Error("Mensagem não pode ser vazia.");
  if (limpo.length > 4000) throw new Error("Mensagem muito longa.");
  return limpo;
}
```

`application/atendimento-gateway.ts`:
```ts
export interface AtendimentoGateway {
  listarConversas(filtro?: { status?: StatusConversa }): Promise<ConversaItem[]>;
  listarMensagens(conversaId: string): Promise<MensagemItem[]>;
  enviarMensagem(input: { conversaId: string; texto: string }): Promise<MensagemItem>;
  assumirConversa(input: { conversaId: string; userId: string }): Promise<void>;
  devolverAoZe(input: { conversaId: string }): Promise<void>;
  marcarComoLida(input: { conversaId: string }): Promise<void>;
  acionarZeAgora(input: { conversaId: string }): Promise<void>;
}
```
Casos de uso só chamam `validarTextoMensagem` do domain e delegam ao gateway — mesmo formato de
`criarEquipe(gateway, input)`.

`infrastructure/supabase-atendimento-adapter.ts` — reads/updates diretos via
`supabase.schema("atendimento").from(...)`; `enviarMensagem`/`acionarZeAgora` via
`supabase.functions.invoke("atendimento-whatsapp-envio", {...})`/
`supabase.functions.invoke("pcm-ze-agent", {body:{queueKey, forcar:true}})` — mesmo precedente de
`supabase-tickets-adapter.ts` (`listarReferencia` via `functions.invoke`).

`pages/AtendimentoInboxPage.tsx` — segue o esqueleto de `EquipesPage.tsx`/`TicketsPage.tsx`:
`Estado = {fase:"carregando"}|{fase:"erro";mensagem}|{fase:"pronto";conversas,...}`, gate
`podeAcessar("atendimento","leitura"|"escrita")`. Layout de 3 colunas (`grid
grid-cols-[320px_1fr_280px] gap-4`) com os tokens já existentes (`rounded-[8px] border border-line
bg-card`, `bg-orange`/`hover:bg-orange-deep`, `.input`, ícones `lucide-react`) — sem shadcn/Radix
(não existe lib de componentes compartilhada). Página fina, delega renderização de cada coluna às
`components/`.

## Estratégia de atualização (polling)
Sem React Query (não instalado, nenhuma tela do projeto usa lib de data-fetching hoje) —
`useEffect` + `setInterval`: lista de conversas a cada 5s, mensagens da conversa aberta a cada 3s
(só enquanto uma conversa está selecionada). Pausar ambos em `document.visibilitychange`
(`document.hidden`). Envio otimista: `enviarMensagem()` devolve a linha real criada (com `id` do
banco) assim que a promise resolve — a UI insere a bolha com esse `id` real, sem precisar de
reconciliação por conteúdo (insert e envio são a mesma chamada síncrona via Edge Function).

## Toggle IA/humano
- **"Assumir"** (header do `ConversaChat`): `assumirConversa(gateway,{conversaId,userId})` →
  `atendimento-whatsapp-envio` ação `assumir` → `modo='pausado'`+`atribuido_a`.
- **"Devolver ao Zé"**: ação `devolver` → `modo='auto'`.
- **"Responder com IA agora"**: `acionarZeAgora(gateway,{conversaId})` →
  `functions.invoke("pcm-ze-agent",{body:{queueKey:\`${instanceId}:${remoteJid}\`,forcar:true}})`
  — reaproveita a function existente (com o campo `forcar` de `E02-S01`), não duplica lógica de
  LLM.

## Wiring em `HomePage.tsx`
- `type AtendimentoView = "inbox"` + `const ATENDIMENTO_NAV: NavGroup[]` (1 item "Inbox", ícone
  `MessageCircle`) — mesmo formato de `PcmView`/`PCM_NAV`.
- `useState<AtendimentoView>("inbox")`.
- Bloco de sidebar (~linha 525): branch `activeModulo === "atendimento" ? ATENDIMENTO_NAV.map(...)`.
- Bloco de conteúdo (~linha 747): branch `activeModulo === "atendimento" ?
  <AtendimentoInboxPage /> :` antes do fallback `<EmConstrucao />`.

## Riscos
- Ver `product.md` → Riscos.
- `ChatPanel.tsx` da origem tem 1335 linhas por acumular estado demais num componente só — este
  design evita isso desde o início separando `ConversaLista`/`ConversaChat`/`ConversaPerfil`/
  `MensagemBubble` e mantendo `AtendimentoInboxPage` fina.

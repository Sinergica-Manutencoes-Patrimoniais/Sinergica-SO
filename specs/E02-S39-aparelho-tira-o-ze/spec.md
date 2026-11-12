---
name: E02-S39-aparelho-tira-o-ze
description: Mensagem enviada pelo próprio número do canal (celular, WhatsApp Web) entra no histórico e tira o Zé da conversa, com pessoa responsável configurável por canal
alwaysApply: true
---

# Spec — E02-S39 · Mensagem do aparelho tira o Zé

> **Fonte da verdade.** Status: rascunho
> Tier: **arquitetural** (muda quem responde uma conversa viva; cancela resposta pendente).

## Resumo

Quando alguém responde pelo celular do canal, pelo WhatsApp Web ou por outro aparelho pareado, a
mensagem entra no histórico **e** a conversa sai do automático: passa para a pessoa configurada como
responsável do aparelho, cancelando resposta e follow-up pendentes do Zé.

## Contexto

A Sinérgica já grava a mensagem do celular (`fn_registrar_mensagem_celular`, migration `0207`) com
`origem_envio='celular'` — mas **não mexe em `modo` nem em `atribuido_a`**. Resultado: a equipe responde
pelo celular e o Zé responde de novo por cima, para o mesmo cliente, segundos depois.

Base: `docs/planejamento/port-evolution-triviatende.md`, seção (c.5).

## Critérios de aceite

### AC-0: O defeito de hoje é diagnosticado e provado corrigido
- **Dado** o relato de que mensagens enviadas pelo celular **não aparecem** no sistema, embora
  `fn_registrar_mensagem_celular` exista desde a migration `0207` e o webhook a invoque desde o commit
  `44d2cd90`
- **Quando** a investigação roda (função deployada? evento `fromMe` chega? linha é gravada?)
- **Então** a causa é identificada por **evidência**, não por suposição, e vira um teste que falha antes
  da correção e passa depois
- **E** o caminho de leitura é conferido ponta a ponta: a mensagem gravada aparece na conversa

> Esta story **não pode** assumir que a gravação funciona hoje. AC-1 descreve o destino; AC-0 prova o
> ponto de partida.

### AC-1: A mensagem do aparelho entra no histórico
- **Dado** um canal Evolution com responsável do aparelho configurado
- **Quando** alguém responde pelo celular daquele número
- **Então** a mensagem aparece na conversa como `direcao='saida'`, `remetente_tipo='humano'`,
  `origem_envio='celular'`, com o **horário real do evento** (não `now()`), rotulada "Pelo celular"

### AC-2: A conversa sai do automático
- **Dado** uma conversa em `modo='auto'` (com o Zé)
- **Quando** chega uma mensagem do aparelho
- **Então** a conversa passa a `modo='pausado'` e `atribuido_a` = a **pessoa configurada no canal**, e
  qualquer resposta ou follow-up pendente do Zé é **cancelado**

### AC-3: "Ninguém" é a chave de desligar
- **Dado** um canal **sem** responsável do aparelho configurado
- **Quando** chega uma mensagem do aparelho
- **Então** a mensagem entra no histórico e **nada mais muda**: `modo` e `atribuido_a` ficam como estavam

### AC-4: Eco da própria mensagem não conta
- **Dado** uma mensagem que o próprio sistema acabou de enviar
- **Quando** o webhook recebe o eco (`fromMe`)
- **Então** ela é reconhecida pelo `wa_message_id` gravado no envio e **não** duplica, **não** tira o Zé
- **E dado** que o id ainda não foi gravado (a entrega não voltou)
- **Então** o eco é reconhecido pelo **mesmo texto normalizado** de uma mensagem do sistema em envio nos
  **últimos 20 minutos**

### AC-5: Mensagem automática do WhatsApp Business não tira o Zé
- **Dado** uma lista de textos automáticos configurada **no canal** (até 10 textos, até 1.000
  caracteres cada, sem repetir)
- **Quando** chega uma mensagem do aparelho cujo texto normalizado casa com um deles
- **Então** ela entra no histórico rotulada "Mensagem automática do WhatsApp" e **não** muda a conversa

### AC-6: Mensagem atrasada só entra no histórico
- **Dado** uma mensagem do aparelho com mais de **15 minutos** de atraso em relação a agora
- **Então** ela entra no histórico e **não** tira o Zé

### AC-7: Mídia do aparelho vira marcador
- **Dado** uma imagem, vídeo, documento, figurinha, áudio, localização ou contato enviado pelo aparelho
- **Então** entra como **texto marcador** (`[Imagem enviada pelo aparelho] legenda`), **sem download e
  sem transcrição**
- **Motivo:** transcrever gravaria autor `cliente` e acordaria o Zé

### AC-8: A resposta do celular nunca é reenviada
- **Dado** uma mensagem do aparelho gravada
- **Então** ela **não** entra na fila de envio, em nenhuma circunstância; só mensagem originada no
  sistema é enviada ao contato

### AC-9: Grupo, broadcast, protocolo e reação do aparelho são ignorados
- **Dado** `fromMe` com `remoteJid` terminando em `@g.us` ou `@broadcast`, ou com `protocolMessage` ou
  `reactionMessage`
- **Então** é ignorado sem erro

### AC-10: Configuração por canal, só superadmin
- **Dado** a tela "Respostas pelo aparelho" do canal
- **Quando** o superadmin escolhe a pessoa responsável e os textos automáticos
- **Então** a configuração é salva com **controle de versão** (gravação concorrente com versão velha é
  recusada), e um colaborador sem papel de superadmin **não consegue** ler nem escrever essa
  configuração

### AC-11: Pessoa inválida é recusada
- **Dado** uma pessoa inativa, ou que não tem acesso ao módulo de atendimento
- **Quando** é escolhida como responsável do aparelho
- **Então** a gravação é recusada com "A pessoa escolhida não está ativa no atendimento"
- **E dado** que a pessoa configurada é desativada depois
- **Então** a tela mostra o aviso e o canal volta a se comportar como "Ninguém" (AC-3)

### AC-12: Textos automáticos validados
- **Dado** mais de 10 textos, texto acima de 1.000 caracteres, ou dois textos iguais depois de
  normalizar espaços
- **Então** a gravação é recusada com a mensagem correspondente

### AC-13: Nunca usa `pushName`
- **Dado** qualquer mensagem do aparelho
- **Então** o nome do remetente **nunca** vem de `pushName` — esse campo é o nome da própria conta, não
  de quem digitou

## Matriz de decisão

| `fromMe` | Responsável no canal | Eco conhecido | Texto automático | Atraso > 15 min | Resultado | AC |
|---|---|---|---|---|---|---|
| sim | configurado | não | não | não | histórico **+ pausa + atribui** | AC-2 |
| sim | **"Ninguém"** | não | não | não | só histórico | AC-3 |
| sim | configurado | **sim** | — | — | nada (duplicata) | AC-4 |
| sim | configurado | não | **sim** | — | só histórico, rótulo "automática" | AC-5 |
| sim | configurado | não | não | **sim** | só histórico | AC-6 |
| sim | — | — | — | — (grupo/broadcast/protocolo/reação) | ignorado | AC-9 |

## Casos de borda e erros

- **Riscos aceitos e contados nos testes:** resposta do Zé já em envio ainda chega ao contato e fica
  incerta; follow-up já reservado pode sair depois da resposta humana; texto curto digitado no celular,
  igual a uma mensagem do sistema sem id gravado, pode ser tomado por eco.
- WhatsApp Web, outro aparelho pareado e qualquer automação no mesmo número **contam como celular**.
- Conversa encerrada recebendo mensagem do aparelho: entra no histórico; reabertura segue a regra de
  hoje.
- Duas mensagens do aparelho em sequência: só a primeira muda a conversa; a segunda já encontra
  `modo='pausado'`.

## Fora de escopo

> Vinculante.
- Transcrever ou guardar mídia do aparelho.
- Enviar pelo aparelho **a partir** do sistema.
- Reação enviada pelo aparelho.
- Canais Meta.

## Rastreabilidade

- Análise: `docs/planejamento/port-evolution-triviatende.md` (c.5, e.2)
- ADR a criar: `docs/adr/1688-mensagem-do-aparelho-tira-o-ze.md`
- Depende de: `E02-S36`
- Substitui o comportamento de: migration `0207_E02-S32_origem_envio_mensagens.sql`
- Referência (somente leitura): `rosefish` ADR-0049;
  `supabase/functions/evolution-webhook/mensagem-do-aparelho.ts`;
  `apps/web/src/modules/atendimento/domain/configuracao-do-aparelho.ts`,
  `interfaces/RespostasPeloAparelho.tsx`; migrations `20261106126000`, `20261106128000`

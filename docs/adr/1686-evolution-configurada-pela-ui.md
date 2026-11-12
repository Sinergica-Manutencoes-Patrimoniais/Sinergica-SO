---
name: "adr-1686-evolution-configurada-pela-ui"
description: "Servidor e instância Evolution administrados pela UI com segredo write-only, matriz de compatibilidade e token por canal no Vault"
alwaysApply: false
---

# ADR-1686 — Servidor e instância Evolution configurados pela UI

## Estado

Aceito para implementação em E02-S35.

## Contexto

Hoje (`supabase/functions/_shared/evolution-config.ts`) a Sinérgica lê `config.integracoes.config_publico.api_url`
e usa a URL **sem validar origem** (risco de SSRF: a Edge Function chama endereço escolhido pela UI),
e tem só a API key **global** no Vault — não existe token por instância, nem matriz de compatibilidade,
nem distinção de estado entre "instância criada mas webhook falhou" / "desconectado com credencial" /
"sem credencial". `atendimento.canais_externos.status_conexao` só tem
`conectado | desconectado | erro`.

Decisão de porte: `docs/planejamento/port-evolution-triviatende.md` (análise completa) e ADR-0007/0034/0037
do repositório de referência `rosefish` (TriviAtende), adaptados ao vocabulário e ao cofre já existentes
na Sinérgica.

## Decisão

- URL do servidor Evolution é **atestada** antes de salvar: HTTPS obrigatório em produção, sem
  credencial embutida/query/fragmento, DNS resolvido a cada chamada, loopback/link-local/metadata/rede
  privada negados por padrão, redirect não pode mudar origem.
- Versão do servidor é conferida contra uma **matriz de compatibilidade** versionada
  (`instanceCreate`, `qr`, `connectionState`, `webhookHeaders`, `webhookEvents`, `sendText`,
  `deliveryStatus`). Versão fora da matriz, ou que não prova todas as capacidades, falha fechada —
  mesmo que os endpoints pareçam existir.
- A instância remota é criada **pelo produto**, com nome derivado do `canal_id` (nunca escolhido pelo
  browser), idempotente. O token retornado vai ao Vault sob **referência opaca**; a resposta crua é
  descartada.
- `atendimento.canais_externos` ganha `provedor`, `estado_conexao`, `saude`, `ultimo_sucesso_em`,
  `ultimo_erro_em` — aditivo, sem remover `status_conexao` (sincronizado por trigger durante a
  transição).
- Duas tabelas novas (`evolution_servidor`, `evolution_instancia`), RLS enable+force, só superadmin
  administra.
- Nenhum segredo (API key global, token de instância, segredo de webhook) volta ao browser, aparece em
  log ou em mensagem de erro — no máximo os 4 últimos caracteres, para reconhecer geração.
- Salvar credencial nova **nunca** marca o canal como conectado — volta a `configurado`, pendente de
  verificação real.

## Consequências

- `status_conexao` legado e `estado_conexao` novo coexistem durante a transição; a trigger de sincronia
  é a única fonte de verdade entre os dois — divergência silenciosa é o risco principal, coberto por
  teste pgTAP nas 6 transições.
- Falha entre "criar instância" e "instalar webhook" preserva a referência da instância
  (`configuracao_incompleta`, retomável) — nunca marca conectado por engano.
- Webhook por canal (segredo próprio, canal no caminho) é **ADR-1687**, story seguinte — este ADR cobre
  só a configuração do servidor/instância/token.

## Alternativas descartadas

**Manter API key só em variável de ambiente.** Impede rotação pelo produto e não sustenta múltiplas
instâncias com tokens próprios — era exatamente a limitação que a S35 resolve.

**Confiar na versão declarada pelo servidor sem matriz.** Builds e forks da Evolution podem divergir no
conjunto de capacidades reais; a matriz exige prova, não nome do produto.

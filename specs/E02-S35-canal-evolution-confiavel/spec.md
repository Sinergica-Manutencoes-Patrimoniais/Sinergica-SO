---
name: E02-S35-canal-evolution-confiavel
description: Servidor Evolution atestado, matriz de compatibilidade, instância e token por canal no Vault, estados e saúde do canal
alwaysApply: true
---

# Spec — E02-S35 · Canal Evolution confiável

> **Fonte da verdade.** Status: rascunho
> Tier: **arquitetural** (integração externa + schema com dado em produção). Exige ADR antes de
> implementar e `/revisao-adversarial` antes do PASS.

## Resumo

O superadmin passa a cadastrar o servidor Evolution pela UI com a URL atestada contra SSRF e a versão
conferida numa matriz de capacidades; o produto cria a instância do número com nome derivado do canal,
guarda o token dessa instância no Vault sob referência opaca, e o canal passa a ter estado de conexão e
saúde que refletem o uso real.

## Contexto

Hoje (`supabase/functions/_shared/evolution-config.ts`) a Sinérgica lê `config_publico.api_url` e usa a
URL **sem validar**, e tem só a API key **global** no Vault. Não existe token por instância, não existe
matriz de compatibilidade e `canais_externos.status_conexao` só tem
`conectado | desconectado | erro` — sem distinguir "instância criada mas webhook falhou" de
"desconectado com credencial" (reescanear) de "sem credencial" (configurar do zero).

Base: `docs/planejamento/port-evolution-triviatende.md`, seções (a) e (b.1/b.2).

## Critérios de aceite

### AC-1: URL do servidor atestada antes de salvar
- **Dado** o superadmin na tela do servidor Evolution
- **Quando** informa uma URL que não é HTTPS, ou tem credencial embutida, query ou fragmento, ou resolve
  para loopback / link-local / metadata (169.254.169.254) / rede privada (RFC1918, ULA fc00::/7)
- **Então** o servidor **não é salvo** e a tela mostra "Endereço recusado. Use a URL pública HTTPS do
  servidor Evolution", sem revelar o IP resolvido

### AC-2: Versão fora da matriz bloqueia a conexão
- **Dado** uma URL válida e a API key global corretas
- **Quando** o backend lê a versão do servidor e ela não está na matriz de compatibilidade, **ou** está
  mas não prova todas as capacidades obrigatórias (`instanceCreate`, `qr`, `connectionState`,
  `webhookHeaders`, `webhookEvents`, `sendText`, `deliveryStatus`)
- **Então** o servidor é salvo como `incompativel` com o motivo, a tela lista **quais capacidades
  faltam**, e nenhuma instância pode ser criada

### AC-3: Segredo nunca volta ao browser
- **Dado** um servidor salvo e uma instância criada
- **Quando** a UI busca o estado da configuração
- **Então** a resposta traz `url_base`, `estado`, `versao`, `motivo` e no máximo os **4 últimos
  caracteres** da chave; a API key global, o token da instância e o segredo do webhook **não aparecem**
  na resposta, em log, em mensagem de erro nem em evento de auditoria

### AC-4: Instância criada pelo produto, com nome derivado do canal
- **Dado** um servidor `compativel` e um canal Evolution
- **Quando** o superadmin aciona "Conectar número"
- **Então** o backend cria a instância remota com nome **derivado do `canal_id`** (nunca enviado pelo
  browser), guarda o token retornado no Vault sob referência opaca e descarta a resposta crua; repetir a
  ação com a mesma instância **não cria uma segunda**

### AC-5: Falha no meio deixa estado retomável, nunca conectado
- **Dado** a instância criada
- **Quando** a instalação do webhook falha
- **Então** a instância fica em `configuracao_incompleta`, o canal **não** fica `conectado_verificado`,
  a tela mostra "Retomar configuração", e a referência da instância é preservada para a retomada

### AC-6: Salvar credencial não equivale a conectar
- **Dado** um canal que já estava `conectado_verificado`
- **Quando** uma credencial nova é salva
- **Então** o estado volta para `configurado`, pendente de verificação real — nunca permanece conectado
  por inércia

### AC-7: Saúde reflete o uso real
- **Dado** um canal conectado
- **Quando** um envio ou um webhook tem sucesso → **Então** `saude='saudavel'` e `ultimo_sucesso_em` é
  atualizado
- **Quando** falha → **Então** `saude='degradada'` e `ultimo_erro_em` é atualizado
- **Quando** a falha é de **autenticação** → **Então** além de degradar, o canal passa a `desconectado`

### AC-8: Reescanear vs. configurar do zero
- **Dado** um canal `desconectado`
- **Quando** ele **tem** referência de credencial → **Então** a tela oferece "Reescanear QR"
- **Quando** **não tem** → **Então** a tela oferece "Configurar número"

### AC-9: Só superadmin administra Evolution
- **Dado** um colaborador com `atendimento = escrita` (não superadmin)
- **Quando** ele tenta ler ou escrever `atendimento.evolution_servidor` ou
  `atendimento.evolution_instancia`, direto pelo PostgREST
- **Então** a operação é **negada** pela RLS (teste pgTAP de caso permitido e negado)

### AC-10: Backfill não adivinha provedor
- **Dado** linhas existentes em `atendimento.canais_externos`
- **Quando** a migration roda
- **Então** linha com `tipo='evolution'` recebe `provedor='evolution-api'`, `tipo='meta_wa'` recebe
  `'meta-whatsapp'`, e qualquer linha sem prova recebe `'desconhecido'` — nenhum palpite

## Matriz de decisão — estado do canal

| Credencial | Instância remota | Webhook | Pareamento | Estado resultante | AC |
|---|---|---|---|---|---|
| ausente | — | — | — | `sem_credencial` | AC-6, AC-8 |
| presente | ausente | — | — | `configurado` | AC-6 |
| presente | criada | falhou | — | `configuracao_incompleta` | AC-5 |
| presente | criada | ok | pendente | `aguardando_pareamento` | AC-4 |
| presente | criada | ok | confirmado + número bate | `conectado_verificado` | AC-4 |
| presente | criada | ok | sessão caiu | `desconectado` (+ `saude='degradada'`) | AC-7, AC-8 |

## Casos de borda e erros

- Servidor responde `200` com corpo que não é JSON de versão → `incompativel`, motivo "versão não
  identificada".
- Redirect que muda de origem → recusado; DNS é **revalidado antes de cada chamada**, não só no cadastro.
- Timeout do servidor Evolution (>10 s no probe) → `servidor_indisponivel`, nada é salvo.
- `429` da Evolution → respeita `Retry-After`, uma repetição; depois degrada o canal.
- Duas abas criando a mesma instância → a chave idempotente local garante uma só.
- Excluir instância remota: exige confirmação específica e checagem de conversas abertas. **Desativar
  localmente é o rollback padrão**; exclusão física de canal com histórico é proibida.

## Fora de escopo

> Vinculante.
- Webhook de entrada (é `E02-S36`).
- Mídia, citação, reação, foto, mensagem do aparelho (S37–S40).
- Visão de conversa (S41).
- WhatsApp Cloud API oficial e Instagram.
- Hospedar, atualizar ou recuperar o servidor Evolution — continua fora do produto.
- Múltiplos agentes por canal.

## Rastreabilidade

- Análise: `docs/planejamento/port-evolution-triviatende.md` (a, b.1, b.2, e.1, e.2)
- ADR a criar: `docs/adr/1686-evolution-configurada-pela-ui.md`
- Referência (somente leitura): `rosefish` ADR-0034, ADR-0007, ADR-0037;
  `supabase/functions/evolution-configurar/index.ts`, `evolution-pareamento/index.ts`;
  `apps/web/src/modules/atendimento/domain/evolution.ts`, `domain/canal.ts`;
  migrations `20260916090000`, `20260923120000`, `20261107130000`

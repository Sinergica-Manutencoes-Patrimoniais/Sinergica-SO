---
name: plan
description: "Inventário da Agenda do Técnico, desenho da projeção a partir da Visita e aposentadoria do cadastro manual (E01-S202)."
alwaysApply: false
---

# Plano técnico — E01-S202

## 1. Inventário (feito antes de qualquer migration)

### A tabela de agenda

| Item | Achado |
|---|---|
| Nome real | **`pcm.agenda_tecnico`** (não existe `agenda_tecnica` nem equivalente em outro schema) |
| Criada em | `0155_E01-S104_agenda_tecnico.sql`; `0163_E01-S112` renomeou `hora` → `hora_inicio` e acrescentou `hora_fim` |
| Colunas | `id`, `funcionario_id`, `cliente_id`, `data`, `hora_inicio`, `hora_fim`, `created_at/by`, `updated_at/by`, `deleted_at` |
| RLS | `enable` + `force`; policies por `auth.jwt()->>'user_role'` / `user_modulos->>'pcm'` (padrão antigo, anterior às capacidades de E01-S170) |
| **Linhas no Supabase local** | **0 total, 0 vivas** (`select count(*) … from pcm.agenda_tecnico` após `db reset`). A tabela nunca recebeu dado de seed nem de pipeline |

### Quem escreve

**Ninguém, automaticamente.** Grep exaustivo (migrations, Edge Functions, front):

- Escrita: só `supabase-agenda-tecnico-adapter.ts` (`criar` / `editar` / `remover`), acionado pela
  própria `AgendaTecnicoPage.tsx` via `application/agenda-tecnico.ts`. Cadastro manual, ponto.
- Nenhuma migration insere. Nenhuma RPC insere. Nenhum gatilho de Visita, OS ou Auvo toca a tabela.
  `E01-S171_visitas.test.sql` chega a **provar** isso: *"equipe não altera agenda técnica legada"*.

É exatamente a causa já nomeada em `specs/E01-S192-agenda-preventivas-visiveis/plan.md`. **Não
refizemos o diagnóstico; partimos dele.**

### Quem lê

| Leitor | Caminho |
|---|---|
| `AgendaTecnicoPage.tsx` | `select` direto na tabela, via adapter (semana seg–sáb) |
| `pcm.sso_listar_agenda_tecnico_capacidade` (`1054`/`1063`) | leitura por Cliente+semana, `security invoker`, gate `pcm.capacidade_agenda_tecnico_gate`, capacidade `capacidade.gerir` |
| `pcm.sso_listar_agenda_tecnico_filtrada` (`1200`) | a mesma, com filtro por técnico, atrás de um segundo gate |
| `interfaces/capacidade-agenda/AgendaTecnicoContexto.tsx` | consome a RPC de `1054` como **contexto**, não como saldo |

### Como a Visita se relaciona com técnico, data, período e OS

Tudo já existe, desde `0282_E01-S171_visitas_fundacao.sql`:

- **`pcm.visitas`** — `cliente_id`, `inicio_em`/`fim_em` (timestamptz) + **`fuso`**, `natureza`,
  `estado`, `responsavel_id`, `revisao`. É o contêiner canônico.
- **`pcm.visita_equipes`** (`0285`) — N técnicos por Visita, com `papel`, histórico por
  `encerrado_em` (nunca deletado).
- **`pcm.visita_ordens_servico`** (`0282`) — N OS por Visita, com `sequencia` e histórico por
  `encerrado_em`.
- Capacidade de leitura das três: `config.sso_autorizar_acao('visita.confirmar', cliente_id)`.

Caminho da projeção, portanto: `visitas ⋈ visita_equipes` dá **técnico × data**; `data` e
**período** saem de `inicio_em/fim_em at time zone fuso`; `visita_ordens_servico ⋈ ordens_servico`
dá as **OS vinculadas**. Nada precisa ser inventado.

### Já existe calendário por cliente derivado de Visita? Sim — e foi imitado

`0481_E01-S183_calendario_visitas_portal.sql` (`pcm.sso_portal_calendario_visitas`) monta o
calendário do portal do síndico a partir de `pcm.visitas` + `visita_ordens_servico` +
`ordens_servico`, com gate próprio e janela paginada. **Foi esse caminho que imitamos**: mesma
junção, mesma disciplina de erro nomeado, em vez de inventar um segundo jeito de projetar Visita.
`1284_E01-S166_agenda_sem_visitas_suprimidas.sql` deu a outra regra copiada: Visita dispensada por
feriado não aparece.

## 2. Decisões desta story

### Migration `1870_E01-S202_agenda_projecao_visita.sql` (aditiva)

**`pcm.sso_listar_agenda_tecnico_projetada(p_cliente_id uuid, p_semana_inicio date, p_limite integer)`**
— só leitura, `security definer`, `search_path = ''`.

- `p_cliente_id` **nulo** devolve todos os Clientes autorizados. A agenda de um técnico cruza
  Clientes por definição ("em que cliente cada técnico estará cada dia"); exigir um Cliente
  escolhido reproduziria o vazio que a story veio corrigir.
- Uma linha por (Visita × técnico), com `os_numeros` e `quantidade_os` agregados.
- Responsável sem equipe entra com papel `Responsável` — senão Visita com dono e sem equipe sumiria.
- Estados aceitos: `planejada, confirmada, enviada, em_execucao, parcial, concluida`.
- **Zero Cliente autorizado ⇒ `sem_acesso` (42501)**, não lista vazia: a tela precisa distinguir
  "negado" de "semana sem Visita".

**Reuso deliberado, nenhum gate nem capacidade nova** (mesma disciplina de `1866`):

| Peça | Reusada | Por quê |
|---|---|---|
| Gate | `pcm.capacidade_agenda_tecnico_gate`, via `pcm.sso_exigir_agenda_tecnico_capacidade()` (`1054`/`1063`) | É literalmente o gate batizado de "agenda do técnico". A projeção é a mesma jornada vista da fonte certa; um segundo gate dobraria a superfície de ativação da mesma tela. Como brinde, a função já traz o `advisory lock` compartilhado `sso-autorizacao-confirmacao-visita` e a checagem de isolamento |
| Capacidade | `config.sso_autorizar_acao('visita.confirmar', cliente)` | É a mesma que já governa toda leitura de `pcm.visitas`/`visita_equipes`/`visita_ordens_servico`. **Não** se reusou `capacidade.gerir` (de `1054`/`1200`): aquela autoriza ler o *cadastro manual*; usá-la entregaria dado de Visita a quem não pode ler Visita |

### Aposentadoria do cadastro manual (ainda na `1870`, aditiva)

- `comment on table pcm.agenda_tecnico` declarando a obsolescência **no próprio schema**.
- Trigger `sso_agenda_tecnico_obsoleta` (`before insert or update or delete`) que levanta
  `agenda_tecnico_obsoleta` (55000) com `hint` apontando para a Visita.
- **Única escrita ainda aceita:** o soft-delete puro (`deleted_at` de nulo para não-nulo, sem tocar
  em mais nada), para retirar da tela o que foi lançado à mão **preservando a linha**.
- **Não** se dropa tabela, **não** se apaga linha, **não** se edita migration aplicada. "Pode
  migrar" não é "pode destruir"; `SELECT` segue intacto e `1054`/`1200` continuam funcionando.

Efeito colateral assumido e documentado: com a flag **desligada**, a tela continua idêntica, mas o
botão "Salvar" do cadastro manual passa a recusar — é o que a aposentadoria significa. A recusa é
traduzida para português por `mensagemDeErroDeAlocacaoManual`, nunca mostrada como erro cru.

### Front

- `domain/agenda-projecao-visita.ts` — puro: tipos, `inicioSemanaIso`, agrupamentos,
  `motivoDoErroProjecao` e as frases (uma por estado).
- `application/agenda-projecao-queries.ts` — só chaves (não importa `infrastructure/`, regra do
  dependency-cruiser).
- `infrastructure/supabase-agenda-projecao-adapter.ts` — RPC + Zod `.strict()`; erro nomeado sobe
  cru para a tela escolher a frase.
- `pages/AgendaTecnicoPage.tsx` — `useQuery` com `retry: false` (gate fechado e falta de capacidade
  são permanentes), atrás de `flagLigada("VITE_SSO_AGENDA_PROJECAO_VISITA_ENABLED")`. Com a flag
  desligada o `useQuery` fica `enabled: false` e o caminho antigo roda como sempre.
- A view **não** entra nem sai do menu: `agenda-tecnico` já existe em `navegacao-sso.ts` e em
  `rotas-legadas.ts` (`VIEWS_LEGADAS` + `ROTAS_LEGADAS`). Nada a atualizar lá.

## 3. Procedimento de abertura (antes de a jornada existir para o usuário)

1. Abrir o gate: `update pcm.capacidade_agenda_tecnico_gate set habilitado = true where id;`
   **Atenção — gate compartilhado:** abri-lo também libera
   `pcm.sso_listar_agenda_tecnico_capacidade` (`1054`) e, se o gate de `1200` estiver aberto, o
   filtro por técnico. Foi a escolha consciente de não multiplicar superfície de ativação.
2. Conceder `visita.confirmar` aos Clientes que o PCM acompanha (`config.sso_concessoes`), se ainda
   não concedida — é a mesma concessão que a tela de Visita já usa.
3. Ligar `VITE_SSO_AGENDA_PROJECAO_VISITA_ENABLED=true` no ambiente e publicar.
4. Conferir com o cenário do cliente: abrir uma semana que tenha Visita planejada e ver as
   alocações com as OS.

## 4. Procedimento de retorno

1. `VITE_SSO_AGENDA_PROJECAO_VISITA_ENABLED=false` e publicar — a tela volta ao cadastro manual na
   hora, sem tocar no banco.
2. Se for preciso fechar no banco: `update pcm.capacidade_agenda_tecnico_gate set habilitado = false
   where id;` (lembrando que isso também fecha as leituras de `1054`/`1200`).
3. A guarda `sso_agenda_tecnico_obsoleta` **não** é revertida pelo retorno: a aposentadoria do
   cadastro é decisão de produto, não de ativação. Reverter exigiria o reverso escrito no cabeçalho
   da `1870`, em migration nova.

## 5. O que ficou para a próxima fatia

- Calendário por cliente e relatório de planejamento consumindo a **mesma** projeção (o pacote
  manda; só a agenda foi convertida aqui).
- Capacidade por Visita+OS (o pacote fala em "cálculo integrado"), hoje ainda em
  `interfaces/capacidade-agenda/`, lendo a tabela antiga.
- Migrar `1054`/`1200` para derivar da Visita e, só então, considerar a retirada física de
  `pcm.agenda_tecnico` — com ADR.
- Paginação: a projeção devolve até 500 linhas por semana, sem cursor. Uma semana real não chega
  perto disso; quando chegar, segue-se o cursor `(inicio_em, id)` de `sso_listar_visitas`.

---
name: design-cadastro-ativos-v2
description: Design técnico compartilhado da iniciativa Cadastro de ativos v2 (E01-S154..S161) — modelo de dados, triggers, ordem de execução, algoritmo de sigla, identificador, regra anti-PATCH em massa no Auvo.
alwaysApply: false
---

# Technical Design Doc — Cadastro de ativos do cliente v2

> **Tier:** arquitetural · **Status:** aprovado pelo PO (Lucas, 2026-09-29)
> **Autor:** Claude (sessão Lucas) · **Data:** 2026-09-29
> Stories cobertas: E01-S154 a E01-S161. Produto: [`product.md`](./product.md).
> ADR: [ADR-0022](../../docs/adr/0022-identificador-ativo-siglas-imutavel.md).

## Contexto da funcionalidade
Estado atual, verificado no código em 2026-09-29:

| Tema | Hoje | Onde |
|---|---|---|
| Componente | tabela `pcm.equipamentos`, `tipo in ('equipamento','componente')`, `parent_item_id` (componente filho de equipamento), `local_id` opcional, `client_id` **nullable**, `categoria text` livre, `identificador text` livre | migrations `0032`, `0095` · `domain/equipamentos.ts` · `infrastructure/supabase-equipamentos-adapter.ts` |
| Sistema | `pcm.sistemas`: `cliente_id not null`, `area_id` opcional, **sem `local_id`**, `tipo text` livre, `codigo` (= identifier Auvo), `descricao` | `0095`, `0214` · `domain/sistemas.ts` |
| Sistema↔Item | `pcm.sistema_itens` N:N, único só em `(sistema_id,item_id)` | `0095` |
| Sync Auvo | `equipamentosDescriptor` e `sistemasDescriptor` (ambos `writeEnabled:true`, `/equipments`). `description = nome`. `location = auvo_localizacao` | `supabase/functions/_shared/auvo/registry/{equipamentos,sistemas}.ts` |
| Enqueue | trigger `after insert or update or delete` → `pcm.fn_auvo_enqueue(...)`. **Qualquer UPDATE enfileira PATCH**, exceto quando `current_setting('app.auvo_sync_write') = 'true'` | `0032`, `0095`, `0051` |
| Localização Auvo | `auvo_localizacao` por trigger `BEFORE ... OF local_id` (equip.) / `OF area_id` (sistemas). Propaga em rename de Área/Local | `0131`, `0132` |
| Categorias | `pcm.equipamento_categorias` (nome, `auvo_id`), sync Auvo com pull diário 6h e **write habilitado** | `0029` · registry `categorias.ts` · `CatalogoSimplesPage` |
| 360 | abas Ativos (só atribui Local), Estrutura (CRUD Área/Local), Sistemas (só compõe), Board. Ferramentas alocadas ficam no Resumo | `pages/VisaoClientePage.tsx` |
| Excel | SheetJS carregado via CDN dentro de `InspecoesPage.tsx` (`carregarSheetJs`) | `pages/InspecoesPage.tsx:2580` |

## Goals / Non-goals
Ver [`product.md`](./product.md). Resumo técnico dos non-goals: não renomear código nem tabelas;
não fazer backfill que enfileire PATCH no Auvo; não sincronizar o vínculo Sistema→Componente.

## Decisões

### D1 — "Componente" é linguagem de UI; o código mantém `equipamento`
A UI e o glossário passam a dizer **Componente**. Tabela `pcm.equipamentos`, tipo
`EquipamentoItem`, arquivos `*equipamentos*` e descriptor `equipamentos` **não mudam**.
- Por quê: renomear significa ~60 arquivos, Edge Functions, descriptor, testes Deno e pgTAP. Esse
  refactor amplo é proibido dentro de story estreita (`ANTI-PADROES.md`), e o banco já carrega o
  nome físico por causa do pipeline Auvo (ADR-0009).
- O glossário registra o mapeamento: Componente (UI) = linha de `pcm.equipamentos`.
- `tipo='componente'` e `parent_item_id` **saem da UI**, mas ficam no banco. Dado legado
  preservado. Linha nova nasce com `tipo='equipamento'` (default da coluna) e `parent_item_id=null`.

### D2 — Sistema 1:N
Índice único `pcm.sistema_itens (item_id)`. A tabela N:N continua existindo (menos mudança), mas
na prática vira 1:N. A validação de domínio dá erro legível antes do round-trip.

### D3 — Posição flexível: `cliente` obrigatório, `área` e `local` opcionais, nos dois
- `pcm.equipamentos` ganha `area_id uuid` (FK `pcm.areas`).
- `pcm.sistemas` ganha `local_id uuid` (FK `pcm.locais`).
- **Invariante de posição**, aplicada por trigger `BEFORE INSERT OR UPDATE`:
  1. Se `local_id` não é nulo, então `area_id := locais.area_id` (derivado; o valor enviado pelo
     client é ignorado).
  2. Se `area_id` não é nulo e o cliente da linha é nulo, então cliente := `areas.cliente_id`.
  3. Se `area_id` não é nulo e `areas.cliente_id <> cliente da linha`, então
     `raise exception using errcode = '23514', message = 'posicao_cliente_divergente'`.
- **Cliente obrigatório só na borda do SO** (domínio + UI). **Não** se cria `NOT NULL`/`CHECK` no
  banco: o inbound do Auvo grava equipamento sem cliente, e um CHECK quebraria o sync.
- **Sem backfill de `area_id`** nas linhas legadas. Quem precisa da Área efetiva calcula
  `area_id ?? locais[local_id].area_id` (função pura `areaEfetiva`, E01-S155).

### D4 — Categoria = catálogo `pcm.equipamento_categorias`
- Catálogo ganha `sigla`.
- `pcm.equipamentos` ganha `categoria_id` (FK). `pcm.sistemas` ganha `categoria_id` (FK) e
  `categoria text` (denormalizado, para o descriptor, que é função pura).
- Trigger mantém `categoria` (texto) = `nome` do catálogo. Assim o descriptor continua mandando
  `category` como texto, sem mudança de contrato com o Auvo.
- Inbound do Auvo (só texto): o trigger resolve `categoria_id` por nome (case-insensitive).
- `sistemas.tipo` (texto livre) sai da UI. Coluna preservada.

### D5 — Siglas e identificador (ADR-0022)
- Sigla de **exatamente 3 caracteres `[A-Z0-9]`** em `pcm.clientes`, `pcm.areas`, `pcm.locais` e
  `pcm.equipamento_categorias`. Sugestão automática com algoritmo determinístico (abaixo),
  **editável**. Única entre irmãos.
- Identificador = `CLI[-ARE][-LOC...]-CAT-NOM-NN`:
  - `CLI`: sigla do cliente;
  - `ARE`: sigla da Área (se houver);
  - `LOC...`: siglas da cadeia de Locais, da raiz até a folha;
  - `CAT`: sigla da categoria;
  - `NOM`: sigla do nome do ativo (números fora);
  - `NN`: sequencial de 2 dígitos, ou o número que já estava no fim do nome.
  - Exemplo: `GUA-TOA-A02-SHA-ELE-QDC-01`.
- Gerado **só ao criar pelo SO**. Depois é **fixo**: mudar sigla, posição ou nome **não** altera.
  Alteração manual existe, com confirmação que avisa do QR Code.
- Item criado no Auvo: o identificador vem do Auvo (inbound) e o SO nunca o sobrescreve sozinho.

### D6 — Descrição completa no Auvo
Coluna `auvo_descricao` (equipamentos e sistemas), recalculada por trigger:
`Cliente - Área - Local1 - … - LocalN - Categoria - Nome`, partes vazias omitidas, separador fixo
`" - "`. O descriptor manda `description = auvo_descricao ?? (fallback atual)`.

### D7 — Data fetching
Código novo e painéis tocados usam **TanStack Query** (regra do `CLAUDE.md`). Hooks ficam em
`features/pcm/application/ativos-cliente-queries.ts`, com chaves em `ativosClienteQueryKeys`
(padrão de `operacao-queries.ts`). Depois de gravar, **invalide a chave**.

### D8 — SheetJS compartilhado
Extrair `carregarSheetJs`/`carregarScript` de `InspecoesPage.tsx` para `apps/web/src/lib/sheetjs.ts`
(mesma URL CDN `xlsx@0.18.5`), acrescentando os tipos de escrita (`utils.aoa_to_sheet`,
`utils.book_new`, `utils.book_append_sheet`, `writeFile`). `InspecoesPage` passa a importar dali.

## Regra de ouro — nada de PATCH em massa no Auvo
`pcm.equipamentos`, `pcm.sistemas` e `pcm.equipamento_categorias` enfileiram **qualquer** UPDATE
para o Auvo (produção real). Portanto, em **toda** migration desta iniciativa:
1. **Proibido** `UPDATE` em massa nessas tabelas, exceto dentro de um bloco que suprime o enqueue:
   ```sql
   begin;
   set local app.auvo_sync_write = 'true';  -- pcm.fn_auvo_enqueue retorna sem enfileirar (0051)
   update ...;
   commit;
   ```
   Use isso só quando o dado **enviado ao Auvo não muda** (ex.: preencher `categoria_id`
   equivalente ao texto já existente).
2. Coluna nova que muda payload (`auvo_descricao`, `auvo_localizacao`) **não** tem backfill. Fica
   `null` até a linha ser tocada, e o descriptor cai no fallback atual. Mesma decisão da E01-S85.
3. **Proibido** testar em Playwright rename/move real de ativos de produção sem cliente de teste
   dedicado (ver `e2e/helpers/limpeza-e2e.ts`).

## Ordem dos triggers BEFORE (crítico)
O Postgres executa triggers `BEFORE` do mesmo evento em **ordem alfabética do nome**. Os nomes
abaixo foram escolhidos para garantir a ordem. **Não renomeie.**

| Tabela | Ordem | Trigger | Story | Faz |
|---|---|---|---|---|
| `pcm.equipamentos` | 1 | `trg_equipamentos_categoria_sync` | S156 | `categoria` ↔ `categoria_id` |
| | 2 | `trg_equipamentos_normalizar_posicao` | S155 | deriva `area_id`/cliente, valida |
| | 3 | `trg_equipamentos_recalcular_localizacao` (já existe, recriado) | S155 | `auvo_localizacao` |
| | 4 | `trg_equipamentos_texto_auvo` | S158 | `auvo_descricao` |
| `pcm.sistemas` | 1 | `trg_sistemas_categoria_sync` | S156 | idem |
| | 2 | `trg_sistemas_normalizar_posicao` | S155 | idem |
| | 3 | `trg_sistemas_recalcular_localizacao` (já existe, recriado) | S155 | idem |
| | 4 | `trg_sistemas_texto_auvo` | S158 | idem |

Os triggers `AFTER` de enqueue (`trg_*_auvo_enqueue`) continuam como estão.

## Algoritmo de sigla (fonte única, usado por S156, S157 e S161)
Função pura em `features/pcm/domain/siglas.ts`:

```ts
export function sugerirSigla(nome: string, opcoes: { manterNumero: boolean }): { sigla: string; numeroFinal: string | null }
export function sugerirSiglaUnica(nome: string, emUso: ReadonlySet<string>, opcoes: { manterNumero: boolean }): string
export function validarSigla(valor: string): string // trim+upper; /^[A-Z0-9]{3}$/ senão throw "Sigla deve ter exatamente 3 letras ou números."
```

**Passo 1, normalizar.** Remover acentos (`normalize("NFD")` + remover `\p{M}`), passar para
maiúsculas, remover `º ª °`, trocar qualquer caractere fora de `[A-Z0-9]` por espaço e quebrar em
tokens.

**Passo 2, stopwords.** Remover `DE DA DO DAS DOS E EM NA NO NAS NOS A O AS OS PARA COM POR`.
Exceção: um token de 1 letra que vem **depois** de uma palavra (ex.: "Torre **A**") não é stopword,
é **marcador**. Se sobrar nenhum token, usar os tokens originais.

**Passo 3, classificar.** `numero` = último token só de dígitos. `marcador` = token de 1 letra
depois de palavra. `palavras` = os demais.

**Passo 4, `manterNumero:false`** (nome de Componente/Sistema). Tirar `numero` e devolvê-lo em
`numeroFinal` (formatado com 2 dígitos, ou como está se tiver mais de 2). Seguir para o passo 5
sem número.

**Passo 5, regras em ordem (a primeira que casar vence):**
| # | Condição | Sigla | Exemplo |
|---|---|---|---|
| a | `manterNumero` e tem `numero` e ≥1 palavra | 1ª letra da 1ª palavra + número com 2 dígitos (se ≥3 dígitos: últimos 2) | "2º Andar" → `A02`; "Sala 01" → `S01`; "Sala 101" → `S01` |
| b | tem `marcador` e **exatamente 1** palavra | 2 primeiras letras da palavra + marcador | "Torre A" → `TOA`; "Bloco B" → `BLB` |
| c | ≥3 palavras | iniciais das 3 primeiras | "Quadro de Distribuição de Circuitos" → `QDC` |
| d | 2 palavras | 2 primeiras letras da 1ª + 1ª letra da 2ª | "Ar Condicionado" → `ARC`; "Área Comum" → `ARC`; "Casa de Máquinas" → `CAM` |
| e | 1 palavra | 3 primeiras letras; se < 3, completar com `X` | "Guainumbí" → `GUA`; "Shaft" → `SHA`; "Elétrica" → `ELE`; "Ar" → `ARX` |
| f | só número (sem palavras) | número com 3 dígitos | "12" → `012` |

**`sugerirSiglaUnica`.** Se a sigla sugerida não está em `emUso`, devolve ela. Senão, mantém os 2
primeiros caracteres e troca o 3º, na ordem `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`, até achar um livre.
Se esgotar, `throw new Error("Não foi possível sugerir sigla única — informe manualmente.")`.

**Casos de ouro** (devem virar teste literal em `siglas.test.ts`):

| Entrada | manterNumero | sigla | numeroFinal |
|---|---|---|---|
| Guainumbí | true | GUA | null |
| Torre A | true | TOA | null |
| 2º Andar | true | A02 | null |
| Shaft | true | SHA | null |
| Elétrica | true | ELE | null |
| Sala 01 | true | S01 | null |
| Casa de Máquinas | true | CAM | null |
| Transporte Vertical | true | TRV | null |
| PCI | true | PCI | null |
| Quadro de Distribuição de Circuitos 01 | false | QDC | 01 |
| Ar Condicionado 2 | false | ARC | 02 |
| Hidrante 1 | false | HID | 01 |
| Sistema de Hidrante Torre A | false | SHT | null |
| Ar | true | ARX | null |
| Sala 101 | true | S01 | null |
| 12 | true | 012 | null |

Com 2 ou mais palavras, o marcador é ignorado e a regra c ou d decide. Por isso "Sistema de
Hidrante Torre A" → palavras `SISTEMA HIDRANTE TORRE` → regra c → `SHT`.

## Identificador — composição e sequencial
Função pura `montarPrefixoIdentificador` em `features/pcm/domain/identificador-ativo.ts`:

```ts
interface EntradaPrefixo {
  siglaCliente: string;
  siglaArea: string | null;
  siglasLocais: string[];      // raiz → folha; [] se sem Local
  siglaCategoria: string;
  nomeAtivo: string;           // sigla calculada com sugerirSigla(nome, { manterNumero: false })
}
// devolve { prefixo: "GUA-TOA-A02-SHA-ELE-QDC", numeroDoNome: "01" | null }
```

Sequencial (quando `numeroDoNome` é `null`): RPC `pcm.fn_proximo_sequencial_identificador(p_prefixo text) returns text`.
- `security invoker`, `stable`, `grant execute to authenticated`.
- Primeiro valida o formato: se `p_prefixo !~ '^[A-Z0-9]{3}(-[A-Z0-9]{3})+$'`, então
  `raise exception using errcode = '22023', message = 'prefixo_invalido'`. Como o prefixo só tem
  `[A-Z0-9-]`, não precisa escapar nada na regex seguinte.
- Procura o maior sufixo numérico em `pcm.equipamentos.identificador` **e** `pcm.sistemas.codigo`
  (ambos com `deleted_at is null`) que casem com `'^' || p_prefixo || '-([0-9]{2,})$'`. Use
  `substring(col from '^' || p_prefixo || '-([0-9]{2,})$')::int`.
- Devolve `lpad((max+1)::text, 2, '0')`. Sem nenhum casamento, devolve `'01'`.

Unicidade: índice único parcial, **só para identificadores no padrão novo** (itens legados do Auvo
podem ter duplicatas e não podem quebrar a migration):
```sql
create unique index uq_equipamentos_identificador_padrao on pcm.equipamentos (identificador)
  where deleted_at is null and identificador ~ '^[A-Z0-9]{3}(-[A-Z0-9]{3})+-[0-9]{2,}$';
create unique index uq_sistemas_codigo_padrao on pcm.sistemas (codigo)
  where deleted_at is null and codigo ~ '^[A-Z0-9]{3}(-[A-Z0-9]{3})+-[0-9]{2,}$';
```
Corrida entre dois usuários: o segundo insert falha com `23505`. O caso de uso chama a RPC de novo
e tenta **uma** vez mais. Na segunda falha, mostra o erro. Colisão **entre** as duas tabelas é
evitada pela RPC (olha as duas), sem índice cruzado. Risco residual aceito.

## Cobertura dos 5 eixos

### 1. Tech stack
Nada novo. SheetJS já é usado (CDN), React 19, TanStack Query, Supabase.

### 2. Arquitetura base
Tudo dentro do bounded context **PCM** (`features/pcm/`). Domínio puro novo: `siglas.ts`,
`identificador-ativo.ts`, `posicao-ativo.ts`, `arvore-ativos.ts`, `importacao-estrutura.ts`.
Nenhum import entre features. A regra `interfaces → application → domain ← infrastructure` é
verificada por `pnpm run arch:check`.

### 3. Infra
Só migrations aditivas: colunas nullable, FK `NOT VALID` + `VALIDATE` em migration separada
(padrão `0073`/`0074`), índices, triggers e 1 RPC. Edge Functions: redeploy de quem importa o
registry depois de mexer nos descriptors (S156 e S158). A lista está nas tasks dessas stories.
Reversão: colunas novas podem ser ignoradas pelo app. Os triggers novos podem ser dropados sem perda.

### 4. Qualidade
- Unidade (Vitest): todo domínio puro, com os casos de ouro literais.
- pgTAP: um arquivo por story com migration, em `supabase/tests/` (roda no job `db-tests` da CI).
- Deno: testes dos descriptors alterados (`registry/*.test.ts`).
- E2E (Playwright): cliente de teste dedicado, com cleanup via `e2e/helpers/limpeza-e2e.ts`.
- Gate local: `pnpm run ci:local`.
- Performance: listas por cliente filtram **no servidor** (`.eq('client_id', ...)`). Proibido
  carregar todos os ~2000 equipamentos e filtrar no browser, como faz hoje o `PainelItensDoCliente`.

### 5. Observabilidade
Sem métrica nova. Erros de sync continuam em `auvo_sync_status`/`auvo_sync_error` (painel de saúde
do sync já existente). Erros de trigger usam mensagens estáveis (`posicao_cliente_divergente`), que
o adapter traduz para texto de UI.

## Mapa de dependências
| Dependência | Tipo | Descrição | Endpoints |
|---|---|---|---|
| Auvo API | REST | Equipment e categoria | `POST/PATCH /equipments` · `/equipmentcategories` |
| SheetJS | CDN script | leitura/escrita .xlsx no browser | `cdn.jsdelivr.net/npm/xlsx@0.18.5` |

## Alternativas consideradas
| Alternativa | Prós | Contras | Decisão |
|---|---|---|---|
| Renomear tabela/tipos para `componente` | linguagem 100% alinhada | refactor enorme + Edge Functions + risco no sync | **Não** (D1) |
| Identificador gerado por trigger no banco | sem corrida | algoritmo de sigla duplicado em SQL e TS; preview na UI fica difícil | **Não**. Domínio TS + RPC de sequencial |
| Backfill de `area_id`/`auvo_descricao` | dado uniforme | ~2000 PATCH reais no Auvo | **Não** (regra de ouro) |
| `NOT NULL` em `client_id` | garantia forte | quebra inbound do Auvo | **Não**. Validação na borda |
| Árvore como organograma (caixas) | igual ao desenho | ilegível com 2000 itens | v1 lista recolhível. Diagrama fica para depois |

## Riscos
| Risco | Descrição | Prob. × Impacto | Mitigação |
|---|---|---|---|
| Auvo ignora `identifier` | Auvo pode gerar o próprio | médio × alto | Task de verificação na S157 antes do merge. Se falhar, PARE e avise o Lucas |
| Duplicatas em `sistema_itens` | índice único falha na migration | médio × baixo | Task 1 da S154 consulta antes |
| Ordem de trigger errada | descrição/localização calculada antes da posição | baixo × médio | nomes fixados na tabela acima + teste pgTAP de ponta a ponta |
| Sigla colide entre irmãos | "Sala 01" e "Sala 1" → `S01` | médio × baixo | `sugerirSiglaUnica` + índice único + erro legível |
| Corrida no sequencial | 2 usuários, mesmo prefixo | baixo × baixo | índice único parcial + 1 retry |

## Roadmap da feature
| Onda | Stories | Depende de |
|---|---|---|
| 1 (paralelizável) | S154 Componente + 1:N · S155 Posição · S156 Categoria | — |
| 2 | S157 Siglas + identificador · S158 Descrição Auvo | S155, S156 |
| 3 | S159 Cadastro na 360 · S160 Árvore | S154–S157 (S159) · S154, S155 (S160) |
| 4 | S161 Importação Excel | S159 |

## Questões em aberto
- [ ] Nenhuma de produto. A verificação do `identifier` no Auvo é task técnica da S157.

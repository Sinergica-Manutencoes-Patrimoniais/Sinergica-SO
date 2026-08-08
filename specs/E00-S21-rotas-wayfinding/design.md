---
name: design
description: Technical Design Doc — 5 eixos + dependências, solução, riscos e roadmap. Puxe ao desenhar feature arquitetural.
alwaysApply: false
---

# Technical Design Doc — Rotas reais e wayfinding

> **Tier:** arquitetural · **Status:** rascunho
> **Autor:** sessão Claude (lote visual E00-S14..S23) · **Data:** 2026-08-07
> Depende de **E00-S17** (skeleton de rota). Bloqueia nada do lote 1 — pode ser aprovado em
> paralelo, implementação fica pro lote 2.

## Contexto da funcionalidade
`apps/web/src/app/App.tsx` declara 4 rotas reais: `/login`, `/`, `/ui` (galeria, E00-S15) e o
catch-all. As 56 telas do produto vivem **dentro** de `/`, selecionadas por `useState` em
`HomePage.tsx` (1312 linhas) — `activeModulo`, `pcmView`, `financeiroView`, `atendimentoView`,
`guiaView`, cada um um switch próprio sobre componentes importados diretamente no arquivo.

Consequência medida:
- Nenhuma tela tem URL — impossível compartilhar link de uma OS ou um chamado específico.
- Voltar do navegador sai do sistema (não existe histórico de navegação interno).
- F5 em qualquer tela devolve ao módulo inicial.
- `HomePage.tsx` importa as ~50 páginas de todo o produto no topo do arquivo → bundle de entrada
  de 2.4MB (chunk único, sem code splitting).
- `NavGuardProvider` (`nav-guard-context.tsx`) intercepta troca de `pcmView`/módulo via um
  verificador síncrono registrado por formulário aberto — não existe hoje um "vou navegar,
  posso?" no nível de rota porque não existe rota.

Não mexe no papel do RLS como controle primário de acesso — isso já é resolvido no banco;
esta story só expõe em URL o que já existe navegável por clique.

## Goals / Non-goals

**Goals**
- Toda tela tem uma URL estável, e a URL reabre exatamente a mesma tela após F5.
- Botão voltar/avançar do navegador funciona dentro do sistema.
- Registro selecionado (cliente, OS, chamado, conversa) é parte da URL.
- Bundle de entrada cai para menos de 60% do atual via `React.lazy` por módulo.
- `HomePage.tsx` vira layout (menu + chrome + `<Outlet/>`), abaixo de 300 linhas, sem importar
  nenhuma página de feature diretamente.
- O gate de isolamento do portal (`apps/portal/scripts/check-isolation.mjs`) continua verde.

**Non-goals**
- Renomear módulo, seção ou reorganizar o menu — o mapa de navegação atual é preservado 1:1,
  só ganha URL.
- Mudar a matriz de permissão ou o gating por papel — `podeAcessar()` continua igual.
- SSR/pré-renderização.
- Rotas do `apps/portal` (já isolado, árvore própria, fora de escopo).

## Design proposto

### Estrutura de URL
Convenção: `/<módulo>/<seção>[/<sub-seção>][/<id>]`. Módulo e seção usam os mesmos slugs que já
existem como valores de `ModuloId`/`PcmView`/`FinanceiroView`/`AtendimentoView` internamente —
não se inventa nomenclatura nova, só se expõe a que já existe.

| Área | Exemplos de rota | Origem (estado atual) |
|------|-------------------|------------------------|
| PCM | `/pcm/dashboard`, `/pcm/clientes`, `/pcm/clientes/:clienteId`, `/pcm/ordens-servico`, `/pcm/backlog`, `/pcm/agenda-tecnico`, `/pcm/relatorio-planejamento` | `PcmView` (17 valores) |
| Financeiro | `/financeiro/dashboard`, `/financeiro/contas-a-receber`, `/financeiro/lancamentos`, `/financeiro/dre` | `FinanceiroView` |
| Atendimento | `/atendimento/dashboard`, `/atendimento/inbox`, `/atendimento/inbox/:conversaId`, `/atendimento/config` | `AtendimentoView` |
| Config | `/config/usuarios`, `/config/grupos`, `/config/integracoes`, `/config/ia` | switch de `activeModulo === "config"` |
| Guia | `/guia/visao-geral`, `/guia/pcm`, … | `GuiaView` |
| Área do Cliente (admin, não-portal) | `/area-cliente` | tela única hoje |
| Raiz | `/` → redireciona pro último módulo visitado (ou dashboard do primeiro módulo permitido) | novo |

Isto **não é** a lista completa das 56 — é o padrão. A tabela completa nasce mecanicamente na
task 1 (rota por `PcmView`/`FinanceiroView`/etc. já são enums TypeScript existentes; gerar a
árvore de `<Route>` a partir deles, não reescrever à mão).

### Árvore de componentes
```
<BrowserRouter>
  <Routes>
    <Route path="/login" element={<PublicOnly><LoginPage/></PublicOnly>} />
    <Route path="/ui" element={<RequireAuth><GaleriaUiProtegida/></RequireAuth>} />
    <Route element={<RequireAuth><EntradaAutenticada/></RequireAuth>}>
      <Route path="/" element={<HomeLayout/>}>
        <Route index element={<Navigate to={rotaInicial(user)} replace/>} />
        <Route path="pcm" element={<PcmLayout/>}>
          <Route path="dashboard" element={<PcmDashboardPage/>} />
          <Route path="clientes" element={<ListaClientesPage/>} />
          <Route path="clientes/:clienteId" element={<VisaoClientePage/>} />
          … (um <Route> por PcmView, code-split)
        </Route>
        <Route path="financeiro" element={<FinanceiroLayout/>}>…</Route>
        <Route path="atendimento" element={<AtendimentoLayout/>}>…</Route>
        <Route path="config" element={<ConfigLayout/>}>…</Route>
        <Route path="guia" element={<GuiaLayout/>}>…</Route>
        <Route path="area-cliente" element={<AreaClienteAdminPage/>} />
      </Route>
    </Route>
    <Route path="*" element={<Rota404/>} />
  </Routes>
</BrowserRouter>
```
`HomeLayout` é o que resta de `HomePage.tsx`: sidebar, cabeçalho, seletor de tema, migalha —
renderiza `<Outlet/>` no lugar de decidir qual página mostrar via `useState`. Cada `*Layout`
(`PcmLayout` etc.) é a sub-navegação (abas internas do módulo), também via `<Outlet/>`.

### Code splitting
Cada página vira `React.lazy(() => import("../features/.../XPage"))`. React Router v8 já suporta
`element={<Suspense fallback={<SkeletonRota/>}><XPage/></Suspense>}` por rota, ou um único
`<Suspense>` no `HomeLayout` envolvendo o `<Outlet/>` (mais simples, um só fallback pro produto
inteiro — decisão: usar o único `<Suspense>` no layout, o fallback é o skeleton de E00-S17, não
uma tela em branco).

### Registro selecionado na URL
Páginas de detalhe (`VisaoClientePage`, inbox do Atendimento) trocam a prop de callback
(`onSelecionar(clienteId)` hoje muda `useState`) por `useNavigate()` indo pra
`/pcm/clientes/:clienteId`; a própria página lê `useParams().clienteId` em vez de receber por
prop. Isso já é a forma como a Visão 360 é montada hoje internamente — troca o transporte do id
(prop → URL), não a lógica de busca.

### Filtro em query string
Filtro que muda o que a lista mostra (status, período, cliente) vai em `useSearchParams()`.
Estado efêmero (hover, rascunho de campo, aba de um modal aberto) **não** vai pra URL — só o que
precisa sobreviver a compartilhar o link ou recarregar.

### `nav-guard` passa a interceptar rota
Hoje `confirmarSaida()` é síncrono (`window.confirm`) — E00-S16 já apontou que isso é uma
exceção legítima e ainda não migrada pro `ConfirmDialog` (que é assíncrono). Duas opções:

**A (escolhida):** usar o [`unstable_useBlocker`](react-router v8) — o React Router já expõe um
blocker de navegação nativo que pausa a transição de rota até uma decisão do usuário. Troca
`window.confirm` síncrono por um `ConfirmDialog` assíncrono: a navegação fica pendente, o diálogo
abre, e só prossegue (ou é descartada) na resposta. Resolve ao mesmo tempo o `window.confirm`
pendente de E00-S16 **e** a integração com rota real — não são dois problemas, é um só, adiado
até existir rota de verdade (por isso ficou de fora de S16, como já registrado lá).

### Permissão na rota
Cada `*Layout` já existente (`PcmLayout` etc.) checa `podeAcessar(modulo, "leitura")` antes de
renderizar o `<Outlet/>` — se negado, renderiza `<AcessoNegado modulo="..." permissao="leitura"/>`
nomeando o módulo e a permissão exigida (AC-5). Isto é uma **segunda camada**, não substitui a
RLS: se o gate de rota tiver um bug, o banco ainda barra. As duas camadas continuam existindo,
nenhuma é removida.

## Cobertura dos 5 eixos

### 1. Tech stack
Nenhuma dependência nova — `react-router` v8 já está instalado e em uso; `unstable_useBlocker`
já vem no pacote (é a API pública mais recente, mas ainda sob esse prefixo na versão instalada —
checar changelog na hora de implementar se já estabilizou).

### 2. Arquitetura base
Não cria bounded context novo. É puramente `interfaces/` (a camada de apresentação React) —
`application`/`domain`/`infrastructure` das features não mudam nada. `HomePage.tsx` deixa de ser
um componente de aplicação monolítico e vira `app/HomeLayout.tsx` (camada de shell, já é onde
mora hoje).

### 3. Infra
Rewrite SPA no Netlify — **já existe** em `netlify.toml` da raiz (`/* → /index.html 200`,
build a partir de `apps/web`), confirmado nesta sessão. Não é prerequisito novo; URL profunda já
funcionaria hoje se existisse alguma pra testar.

### 4. Qualidade
- Unidade: mapa de rotas cobre as 56 telas (teste que compara `PcmView`/`FinanceiroView`/etc.
  contra as rotas declaradas — nenhum valor do enum fica sem `<Route>`).
- Integração: guarda de permissão nega e nomeia; `nav-guard` bloqueia navegação com formulário
  sujo.
- Aceite (Playwright — quando a sessão tiver navegador disponível): F5 mantém tela; voltar não
  sai do sistema; URL de detalhe reabre o registro; filtro sobrevive à recarga; URL profunda não
  dá 404 no Netlify; bundle do portal sem `HomePage`/rota interna (gate já existente).
- Budget de performance: bundle de entrada < 60% do atual (hoje 2.4MB → meta < 1.44MB) — medir
  com `vite build` antes/depois, comando já usado nesta sessão pra todo o resto do lote.

### 5. Observabilidade
Nenhuma métrica nova necessária — é navegação client-side, sem novo endpoint. Se o produto tiver
analytics de navegação no futuro, rota real é o que os habilita (hoje é impossível saber "qual
tela" alguém está vendo via log de acesso, porque a URL é sempre `/`).

## Mapa de dependências
| Dependência | Tipo | Descrição | Métodos / endpoints |
|---|---|---|---|
| `react-router` v8 | lib já instalada | roteamento client-side, `unstable_useBlocker` | `<Routes>`, `useNavigate`, `useParams`, `useSearchParams` |
| Netlify (rewrite SPA) | infra | evita 404 em URL profunda no recarregamento | `netlify.toml` `/* /index.html 200` |
| `apps/portal/scripts/check-isolation.mjs` | gate existente | prova que o bundle do portal não ganhou rota interna | roda no `apps/portal` build |

## Alternativas consideradas
| Alternativa | Prós | Contras | Por que (não) escolhida |
|---|---|---|---|
| **A (escolhida)** — rotas aninhadas + `React.lazy` por módulo, `nav-guard` via `unstable_useBlocker` | Resolve URL, code splitting e o `window.confirm` pendente de uma vez; reusa 100% da estrutura de `PcmView`/etc. já existente | `unstable_` no nome do hook (API pode mudar em major futuro) | Menor caminho até o resultado, sem reescrever a árvore de navegação que já está certa |
| B — `React.lazy` sem mudar rota (só code splitting, sem URL) | Menor escopo, resolve o bundle de 2.4MB isoladamente | Não resolve nada do wayfinding real (F5, voltar, compartilhar link) — é a dor maior da story | Rejeitada: resolve só o sintoma técnico, não o problema do usuário |
| C — biblioteca de state machine de rota (TanStack Router, etc.) | Recursos avançados de tipagem de rota | Dependência nova, curva de aprendizado, o projeto já tem `react-router` funcionando em produção | Sem motivo pra trocar ferramenta que já funciona |

## Trade-offs e consequências
**Ganha:** wayfinding real, bundle menor, resolve o `window.confirm` síncrono pendente de
E00-S16 sem duplicar trabalho.
**Aceita:** é a story de maior superfície do lote — toca `HomePage.tsx` inteiro, todo `*View`
existente, e o `nav-guard`. Só entra em produção depois de testada manualmente em todos os
módulos (Playwright real não roda nesta sessão).

## Riscos
| Risco | Descrição | Prob. × Impacto | Mitigação |
|---|---|---|---|
| Regressão de permissão | Rota nova esquece de checar `podeAcessar` num módulo | baixa × alto | Teste que itera todos os módulos e afirma que cada `*Layout` chama `podeAcessar` |
| Vazamento pro bundle do portal | Import acidental de algo de `apps/web` dentro de rota compartilhada | baixa × alto | Gate `check-isolation.mjs` já existe e já roda no build do portal — não precisa de gate novo |
| `unstable_useBlocker` mudar de API | Story trava numa versão futura do react-router | baixa × médio | Fixar a versão usada; checar changelog antes de implementar |

## Roadmap da feature
| Fase | Entrega | Depende de |
|---|---|---|
| 1 | Árvore de rotas + `HomeLayout` + PCM migrado (maior módulo, prova o padrão) | — |
| 2 | Financeiro + Atendimento + Config + Guia + Área do Cliente | 1 |
| 3 | Parâmetro de registro na URL + filtro em query string | 1, 2 |
| 4 | `nav-guard` via `unstable_useBlocker`, migalha, 404, `React.lazy`, rewrite Netlify | 1, 2 |
| 5 | Retomar rota após re-login em sessão expirada | 4 |

## Questões em aberto
- [ ] `unstable_useBlocker` está estável o suficiente na versão instalada de `react-router`, ou
      vale esperar a promoção pra API estável antes de depender dele em produção?

> Este design fecha o `window.confirm` de `nav-guard-context.tsx`, deixado pendente
> deliberadamente em E00-S16 (ver commit daquela story) por depender de rota real.

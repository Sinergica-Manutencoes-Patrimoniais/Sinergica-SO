---
name: adr-0018-movimento-css-waapi-sem-biblioteca-de-mola
description: Movimento do produto usa CSS + Web Animations API; nenhuma biblioteca de mola entra sem medição de gesto real. Decide a dependência da E00-S19.
alwaysApply: false
---

# ADR-0018 — Movimento em CSS + Web Animations API, sem biblioteca de mola

> **ADRs são imutáveis.** Não edite este ADR; se mudar de ideia, crie um novo que o substitua.

**Status:** Aceito
**Data:** 2026-08-07
**Decisores:** Lucas (delegou a decisão), sessão Claude
**Relacionados:** E00-S19, E00-S23, ADR-0017

## Contexto

A E00-S19 pedia decisão entre CSS puro e uma biblioteca de mola (`motion`/`framer-motion`).

Medição em `apps/web/src` (2026-08-07):

| Medida | Valor |
|--------|-------|
| Arquivos com `transition-` | 12 de 139 |
| Arquivos com `animate-` | 5 |
| `prefers-reduced-motion` | 0 |
| Botões com `:active` | 0 |
| Bundle de entrada atual | **2.2MB em chunk único** |

A skill `apple-design` (WWDC *Designing Fluid Interfaces*) argumenta que molas são superiores
porque são interrompíveis e herdam velocidade. O argumento é correto — **e depende de haver
gesto.** Mola só ganha de curva fixa quando existe um dedo arrastando cuja velocidade precisa ser
herdada na soltura.

Levantamento da superfície de gesto do Sinérgica SO: **um** componente — o drawer lateral do
`HomePage` em viewport pequena. O produto é entrada e leitura de dados densos em desktop
(supervisor lançando OS, PCM filtrando backlog, financeiro conciliando extrato). Não há carrossel,
não há bottom sheet, não há swipe entre telas, não há arrastar-e-soltar.

Além disso, a matriz de frequência de E00-S19 (herdada de `emil-design-eng`) já determina que a
maior parte das interações do produto — ação de teclado, troca de aba, foco — **não deve animar**.
Uma biblioteca de mola serviria justamente as interações que decidimos não animar.

## Decisão

**1. O movimento do produto é implementado com CSS (`transition`, `@keyframes`, curvas
`cubic-bezier` próprias) e Web Animations API onde for preciso interromper.** Nenhuma biblioteca
de animação entra no `package.json` da E00-S19.

**2. Os AC-1 a AC-6 da E00-S19 são entregues assim** — curvas próprias, resposta no `pointerdown`,
caminho de entrada/saída espelhado, `transform-origin` ancorado no gatilho, nada aparecendo do
nada, e `prefers-reduced-motion` coberto por gate estático.

**3. O AC-7 (arrasto interrompível do drawer com herança de velocidade) sai da E00-S19 e vira a
story E00-S23.** Ela é a única com gesto real e é onde a decisão de biblioteca deve ser tomada —
com o componente na mão e uma medição, não antes.

**4. A E00-S23 tem orçamento explícito: se o gesto correto couber em ≤ 120 linhas de Pointer
Events + Web Animations API, fica sem dependência.** Se passar disso, a biblioteca entra
**apenas para esse componente**, carregada sob demanda, e este ADR é substituído.

## Alternativas consideradas

| Alternativa | Prós | Contras | Por que (não) escolhida |
|-------------|------|---------|-------------------------|
| **A (escolhida)** — CSS + WAAPI, gesto adiado para E00-S23 | Zero dependência para 6 dos 7 AC; destrava a S19 imediatamente; decide o gesto com evidência | O arrasto interrompível fica para depois | O custo da biblioteca é pago por 1 componente; adiar a decisão até existir o componente é mais barato que adivinhar |
| B — adotar `motion` já na S19 | Molas prontas, interrupção e herança de velocidade corretas | Bundle novo em cima de 2.2MB em chunk único; serve 1 componente; convida a animar o que a matriz de frequência manda não animar | Custo desproporcional ao ganho medido |
| C — CSS puro e abandonar o AC-7 | Mais simples de todos | O drawer móvel fica com abertura não interrompível — regressão real de qualidade no celular | Descartar o único gesto do produto por conveniência |
| D — escrever mola própria genérica | Sem dependência, controle total | Reimplementar integração de mola e herança de velocidade é exatamente o tipo de código sutilmente errado que a biblioteca existe para evitar | Só faria sentido com muitos consumidores; há um |

## Consequências

**Positivas:**
- E00-S19 entrega sem dependência nova e sem esperar decisão de bundle.
- A decisão de biblioteca passa a ser tomada com um componente real e um número, na E00-S23.
- Reforça a matriz de frequência: a ferramenta disponível (curva CSS) é a certa para o tipo de
  movimento que o produto de fato precisa.

**Negativas / trade-offs aceitos:**
- O drawer móvel continua com abertura/fechamento não interrompível até a E00-S23.
- Se a E00-S23 concluir pela biblioteca, parte do movimento entregue na S19 pode ser reescrita
  para usá-la — retrabalho aceito, limitado ao drawer.
- CSS não interpola bem valor "de onde está agora" sem leitura explícita; onde houver
  interrupção, ler o valor computado é obrigatório e precisa estar em teste (E00-S19 AC-4).

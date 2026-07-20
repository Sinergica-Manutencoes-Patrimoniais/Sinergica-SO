---
name: pedido-cliente
description: Formulário simples pra cliente/stakeholder descrever um pedido de mudança ou feature nova, em linguagem comum — vira o insumo do @pm/@analyst pra escrever product.md + spec.md.
alwaysApply: false
---

# Pedido de Feature / Mudança

> Preencha em linguagem do dia a dia, sem termo técnico — não precisa saber nada de sistema.
> Quanto mais concreto e com exemplo real, mais rápido isso vira funcionalidade de verdade.
> Não sabe responder algum campo? Deixe em branco — alguém volta a perguntar antes de começar
> a construir. Melhor um "não sei" do que um chute.

**Quem está pedindo:** ______________  **Data:** ___/___/______

## 1. O que você quer que mude ou seja criado?
Descreva em 2–4 frases, do jeito que você explicaria pra um colega numa conversa.

...

## 2. Por que isso importa? Que problema isso resolve?
O que hoje é difícil, lento, arriscado ou impossível de fazer? Se teve um caso real que
motivou o pedido, conte ele.

...

## 3. Quem vai usar isso no dia a dia?
Ex.: técnico de campo, supervisor, você mesmo, síndico/cliente...

...

## 4. Como isso é feito hoje (se já tem um jeito, mesmo que ruim)?
O que a pessoa faz hoje pra resolver isso — mesmo que seja fora do sistema (planilha,
WhatsApp, papel, "de cabeça")?

...

## 5. Me dá um exemplo real e concreto
Um caso de verdade, com nome/data/situação, é muito mais útil que uma descrição genérica.
Ex.: "a furadeira X ficou com o Fabrício no dia 10, depois passou pro Wesley no dia 15,
e ninguém sabia dizer isso quando ela quebrou."

...

## 6. Tem algo que EXPLICITAMENTE não precisa fazer parte disso agora?
Opcional. Ex.: "não precisa funcionar no celular ainda", "não mexe na tela de X".

...

## 7. Urgência / prazo
Tem data? Está travando alguma outra coisa? Ou pode entrar na fila normal?

...

## 8. Referência visual (opcional)
Print de tela, foto, desenho, ou exemplo de como outro sistema/planilha faz algo parecido.

...

---

## Uso interno (Lucas / IA — não faz parte do que o cliente preenche)
Este formulário é o insumo bruto do ciclo Triviaiox, não o `spec.md` em si:

1. `@pm`/`@analyst` lê as respostas acima e escreve `product.md` (por quê/pra quem) +
   `spec.md` (critérios de aceite Given/When/Then) em `specs/E0N-S0N-<nome>/`.
2. Campo 1+2+5 juntos geralmente dão o `Problema`/`Para quem` do `product.md`.
3. Campo 5 (exemplo concreto) é matéria-prima direta pros ACs — cada exemplo real vira
   candidato a cenário de teste.
4. Campo 6 vira `Fora de escopo` — vinculante, exatamente como o cliente descreveu.
5. **Se alguma resposta ficar vaga a ponto de não dar pra escrever um AC testável, pare e
   rode `/clarificar`** (uma pergunta por vez) antes de criar `tasks.md`. Nunca adivinhe —
   ver `CLAUDE.md` → "A spec é a fonte da verdade".
6. Depois do `spec.md` aprovado, segue o ciclo normal: `@sm` (tasks.md) → `@dev` → `@qa` →
   `@devops`. Marcar owner no `docs/epics/ROADMAP.md` antes de codar qualquer linha.

---
name: ANTI-PADROES
description: O que NÃO fazer e quando parar/perguntar. Puxe antes de criar artefato ou tomar decisão de escopo.
alwaysApply: false
---

# Anti-padrões e heurísticas de parada

O maior risco de um agente competente é **super-produzir**: criar estrutura, abstração e cerimônia
que ninguém pediu. Este documento existe para conter isso. Na dúvida entre fazer mais ou menos,
**faça menos e pergunte**.

## Stop-conditions — PARE e pergunte quando…
- A `spec.md` está ambígua, contraditória ou silenciosa sobre um caso que você precisa decidir.
- A tarefa exige uma **decisão difícil de reverter** (schema com dado em produção, troca de
  biblioteca central, nova integração externa, mudança de contrato de API público) e não há
  `design.md`/ADR aprovado.
- Você ia implementar algo que está em **"Fora de escopo"** da spec.
- A lista de passos atômicos passou de **~5 passos** ou surgiu dependência complexa inesperada
  (o tier real é maior — crie `tasks.md` formal antes de continuar).
- Você precisaria **inventar** uma API, comportamento ou regra de negócio que não está documentada
  e não conseguiu confirmar (ver "Verificação de conhecimento" no `CLAUDE.md`).
- Vai mexer em arquivo de outra feature/domínio para "aproveitar a viagem".

## O que NÃO fazer

### Cerimônia e artefatos
- ❌ **Não crie ADR** para decisão trivial ou fácil de reverter. ADR é para decisão **durável e
  custosa de desfazer**.
- ❌ **Não crie `design.md`** em tier trivial/pequeno. Ele é obrigatório só no **arquitetural**.
- ❌ **Não crie `domain.md`** se a feature não introduz domínio novo — reutilize o glossário.
- ❌ **Não promova para monorepo (OS)** "por precaução". Comece single-repo; promova só quando há
  fronteira de domínio real (ver guia de promoção).

### Arquitetura e código
- ❌ **Não crie schema/tabela** para um app de tabela única ou dado efêmero — pese o custo.
- ❌ **Não crie camadas/abstrações "para o futuro"** (repository genérico, factory, camada de
  serviço vazia) sem uma necessidade presente na spec. YAGNI.
- ❌ **Não faça `domain/` importar framework/I/O.** A dependência aponta só para dentro.
- ❌ **Não invente sinônimos** para termos do glossário. Mesmo nome em spec, código e conversa.
- ❌ **Não generalize** após o primeiro caso. Espere o segundo/terceiro uso antes de abstrair.

### Processo e qualidade
- ❌ **Não marque task como done por inspeção visual.** Done = **gate executável verde** (comando).
- ❌ **Não implemente além da spec** porque "seria útil". Útil-não-pedido = fora de escopo.
- ❌ **Não deixe `SPEC_DEVIATION` em silêncio.** Registre e resolva (ver `CLAUDE.md`).
- ❌ **Não faça `git push` / abra PR** se você não é `@devops` — delegue (ver `AGENTS.md`).
- ❌ **Não refatore amplamente** dentro de uma feature de escopo estreito. Refactor é tarefa própria.

### Segurança
- ❌ **Não coloque secret no client** nem em código versionado. Use env/Vault.
- ❌ **Não confie em input** sem validar na borda (Zod).
- ❌ **Não crie tabela sem RLS.** Em OS, sem RLS FORCE.
- ❌ **Não suba dívida de segurança em silêncio** — registre em `docs/SECURITY_DEBT.md`.

## Heurística do "menor passo que prova valor"
Antes de codar, pergunte: *qual é a menor fatia que satisfaz um `AC` e roda de verdade?* Construa
essa fatia, prove com o gate, e só então avance. Big-bang é anti-padrão.

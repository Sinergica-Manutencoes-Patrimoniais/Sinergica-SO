# Squad Trivia OS

Camada de extensão que faz os **agentes Triviaiox** seguirem o **Padrão OS** (esteira SDD), **sem
alterar o core** do Triviaiox (`.triviaiox-core/` permanece intacto — camadas L1/L2 protegidas).

## O que este squad faz
1. **Artefato canônico único:** os agentes produzem/consomem `spec/domain/design/tasks/product` +
   ADR (ver `config.yaml` → `artifact_ownership` e `base/AGENTS.md`). A *story* do Triviaiox passa
   a ser apenas a **visão de execução de `tasks.md`** — não um artefato concorrente.
2. **Roteamento de skills:** mapeia `/clarificar`, `/nova-feature`, `/validar`, `/revisar-pr`,
   `/auditar`, `/handoff` aos donos de comando (ver `config.yaml` → `skill_routing`).
3. **Preserva a autoridade** do Triviaiox: `git push`/PR/CI-CD seguem exclusivos do `@devops`.

## Como instalar
1. Tenha o Triviaiox instalado no repo (`npx triviaiox-core install`) — **não editamos o core**.
2. Copie esta pasta para `squads/trivia-os/` do projeto.
3. Aplique o trecho de `rules/core-config-snippet.yaml` ao `core-config.yaml` do projeto
   (technical preferences) para apontar os agentes ao artefato canônico.
4. As skills da esteira já vêm em `base/.claude/skills/` do scaffold.

## O que NÃO fazer
- ❌ Não editar `.triviaiox-core/core/`, `constitution.md`, agentes ou templates do framework.
- ❌ Não criar um formato de story paralelo aos artefatos SDD.
- Mudança no core do Triviaiox só com aprovação explícita do dono do projeto.

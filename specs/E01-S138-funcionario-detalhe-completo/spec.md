---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Funcionário: tela que diz tudo sobre ele

> **Fonte da verdade.** Origem: Lucas (2026-08-04, item 2). "A parte 'Funcionários' está pobre ao
> clicar. Quero ver todas as informações dele, alocação do dia e semana, quantas OS atendeu, quais
> ferramentas está com ele. Imagine que é a tela que me diz tudo sobre o funcionário."

## Contexto de código
- `pages/FuncionariosPage.tsx` + `domain/funcionarios.ts` (`FuncionarioItem`: nome, cargo, telefone,
  email, ativo, auvoUser). Hoje o clique mostra pouco.
- Dado pra consolidar: Agenda do Técnico (E01-S104/S112, alocação dia/semana), `pcm.ordens_servico`
  por `tecnico_funcionario_id` (OS atendidas) + apontamento de horas (E01-S72/S77), unidades de
  ferramenta em posse (`ferramenta_unidades`, E01-S63/S131).

## Resumo
Clicar num funcionário abre um **perfil completo**: dados cadastrais + alocação do dia e da semana +
OS atendidas (contagem/período) + ferramentas em posse. Uma tela única "tudo sobre o funcionário",
read-only por padrão (ações de edição continuam onde já são).

## Critérios de aceite

### AC-1: Dados cadastrais completos
- **Dado** um funcionário na lista
- **Quando** o operador clica
- **Então** vê nome, cargo, telefone, e-mail, status (ativo), vínculo Auvo — tudo que existe do cadastro.

### AC-2: Alocação do dia e da semana
- **Dado** o perfil aberto
- **Então** mostra onde ele está alocado **hoje** e a **semana** (Agenda do Técnico: cliente/local/
  horário por dia).

### AC-3: OS atendidas
- **Dado** o perfil
- **Então** mostra **quantas OS ele atendeu** (período selecionável ou padrão), com atalho pra ver a
  lista; opcionalmente horas apontadas.

### AC-4: Ferramentas com ele
- **Dado** o perfil
- **Então** lista as **ferramentas atualmente em posse** dele (unidades atribuídas), com atalho pro
  histórico (E01-S137).

### AC-5: Estados vazios
- **Dado** um funcionário sem alocação/OS/ferramenta no recorte
- **Então** cada seção mostra estado vazio claro ("Sem alocação esta semana", "Nenhuma ferramenta em
  posse"), sem seção quebrada.

## Casos de borda e erros
- Funcionário inativo: perfil abre, sinaliza "inativo".
- Sem vínculo Auvo: mostra o que há, sem quebrar (OS/agenda podem depender do vínculo — degrada com clareza).
- Período de OS: default (ex.: mês atual), com opção de mudar.

## Fora de escopo
- Editar o cadastro do funcionário aqui (edição continua no fluxo atual/Auvo).
- Métricas de produtividade/ranking (é perfil informativo, não avaliação).

## Rastreabilidade
- Código: `pages/FuncionariosPage.tsx` (perfil/detalhe), `domain/funcionarios.ts`, `application/*`,
  adapters (funcionários, agenda, `hub-os`/OS por técnico, `ferramenta_unidades`, apontamento).
- Reusa: E01-S104/S112 (agenda), E01-S72/S77 (horas), E01-S63/S131/S137 (ferramentas), OS por técnico.
- ADRs relacionados: —

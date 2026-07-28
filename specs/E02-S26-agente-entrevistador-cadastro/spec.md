---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Agente entrevistador de cadastro de cliente/estrutura

> **Fonte da verdade.** Status: rascunho
> Origem: reunião Fabrício × Lucas (2026-07-27). Item 17. Ver `product.md` e `design.md`.

## Resumo
Um agente conversacional entrevista o colaborador (ou o Fabrício) sobre um prédio, usando um roteiro
de perguntas **configurável**, e monta uma proposta de cadastro (contato, CNPJ, estrutura de locais
em árvore). A proposta é apresentada para **confirmação do entrevistado**; só após o "confirma" os
cadastros são efetivados. O cadastro manual continua disponível.

## Critérios de aceite

### AC-1: Roteiro de perguntas configurável
- **Dado** um admin configurando a entrevista
- **Quando** define perguntas (texto/número/escolha), ordem e valores-padrão
- **Então** o roteiro é persistido e é o usado pelo agente na próxima entrevista.

### AC-2: Condução da entrevista
- **Dado** um roteiro ativo e um cliente-alvo
- **Quando** o colaborador inicia a entrevista
- **Então** o agente conduz as perguntas (uma por vez), aceita respostas livres e as normaliza em
  campos estruturados; **e** a sessão é retomável se interrompida.

### AC-3: Proposta de cadastro
- **Dado** as respostas coletadas
- **Quando** a entrevista termina
- **Então** o agente gera uma proposta contendo contato, CNPJ e a estrutura de locais em árvore
  (até ~3 níveis), aplicando os padrões configurados quando aplicável.

### AC-4: Confirmação obrigatória antes de gravar
- **Dado** uma proposta gerada
- **Quando** apresentada ao entrevistado
- **Então** **nada é gravado** até ele confirmar; **e** ele pode ajustar manualmente a proposta antes
  de confirmar. Se negar/ajustar, o agente revisa sem gravar.

### AC-5: Gravação nos cadastros existentes
- **Dado** a confirmação do entrevistado
- **Quando** grava
- **Então** cliente (contato/CNPJ) e estrutura de locais são persistidos nos cadastros existentes do
  PCM, de forma transacional (tudo ou nada), e a operação é auditada (`audit.*`).

### AC-6: Cadastro manual preservado
- **Dado** o cadastro do cliente/estrutura
- **Quando** o operador opta por editar na mão
- **Então** o fluxo manual continua funcionando independentemente do agente.

## Casos de borda e erros
- Entrevistado nega a confirmação → nada gravado; proposta descartada ou salva como rascunho.
- Resposta com tentativa de injeção de instrução → sanitizada; não altera o comportamento do agente.
- Falha na gravação transacional → rollback total; nada parcial; erro sinalizado.
- CNPJ inválido → validação, permite corrigir na tela de confirmação.

## Fora de escopo
- Portal/acesso externo do cliente (Área do Cliente descartada — item 14).
- Cadastro de equipamentos fora da gestão da Sinérgica.
- Substituir o cadastro manual.

## Rastreabilidade
- Product: `./product.md` · Design: `./design.md`
- Código: `features/atendimento/` (motor) escrevendo em cadastros PCM (cliente + localização, ADR-0009).
- Feature de IA/LLM → trilha `ia/` (prompt versionado + eval + injection) com `@prompt-engineer`.
- ADRs: **ADR-0016** (fronteira Atendimento→cadastro via entrevista); relaciona ADR-0009.

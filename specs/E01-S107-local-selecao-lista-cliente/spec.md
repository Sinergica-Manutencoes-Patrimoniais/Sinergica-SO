---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Local do Chamado/OS: seleção da lista do cliente + "Outro"

> **Fonte da verdade.** Status: rascunho
> Origem: feedback do Lucas testando E01-S101/E01-S99 localmente (2026-07-29). Itens 1 e 4.

## Resumo
O campo Local — hoje texto livre no Chamado (E01-S101) e na OS (`NovaOrdemServicoModal`) — passa a
ser um seletor com os Locais já cadastrados na Estrutura do cliente (E01-S76,
`listarLocaisDoCliente`), mais uma opção **"Outro"** que libera texto livre. Nos dois lugares,
mesmo padrão de UI.

## Contexto de código
- `HierarquiaGateway.listarLocaisDoCliente(clienteId): Promise<Local[]>` já existe
  (`application/hierarquia-gateway.ts`) — não precisa de gateway novo, só consumir.
- Chamado: `local` é `text` livre (migration `0153`, E01-S101). OS: `local_descricao` é `text` livre
  (já existia antes desta reunião). Nenhuma migration nova — o valor final gravado continua sendo
  texto (nome do Local escolhido, ou o texto livre de "Outro").

## Critérios de aceite

### AC-1: Seletor de Local no Chamado
- **Dado** um cliente com Locais cadastrados na Estrutura
- **Quando** o operador abre o formulário de novo Chamado (após escolher o cliente)
- **Então** o campo Local vira um `<select>` com os Locais daquele cliente + opção "Outro".

### AC-2: "Outro" libera texto livre
- **Dado** o seletor de Local
- **Quando** o operador escolhe "Outro"
- **Então** aparece um campo de texto livre; o valor gravado é o texto digitado (não o literal "Outro").

### AC-3: Cliente sem Locais cadastrados
- **Dado** um cliente sem nenhum Local na Estrutura
- **Quando** o formulário carrega
- **Então** o seletor mostra só "Outro" (pré-selecionado), sem quebrar — texto livre funciona igual
  a antes desta story.

### AC-4: Mesmo comportamento na OS
- **Dado** o formulário de Nova/Editar Ordem de Serviço
- **Quando** o cliente já está selecionado
- **Então** o campo "Localização" segue o mesmo padrão (seletor + Outro) do Chamado.

### AC-5: Troca de cliente reseta o seletor
- **Dado** um Local já selecionado
- **Quando** o operador troca o cliente do formulário
- **Então** a lista de Locais recarrega pro novo cliente e a seleção anterior é limpa (evita gravar
  Local de outro cliente por engano).

## Casos de borda e erros
- Cliente ainda não selecionado → seletor de Local desabilitado/oculto até escolher cliente.
- Local cadastrado depois apagado/inativado → segue aparecendo se já estava selecionado nesta
  edição (não força re-seleção no meio do preenchimento).

## Fora de escopo
- Cadastrar Local novo a partir do modal de Chamado/OS (cadastro de Local continua só pela aba
  Estrutura, E01-S76).
- Mudar o schema de `local`/`local_descricao` (continuam texto livre no banco).

## Rastreabilidade
- Código: `ChamadosPage.tsx` (`NovoChamadoModal`), `NovaOrdemServicoModal.tsx`,
  `application/hierarquia-gateway.ts` (`listarLocaisDoCliente`, já existe).
- Depende de/estende: E01-S101 (campo Local no Chamado), E01-S76 (Estrutura/Locais).
- ADRs relacionados: —

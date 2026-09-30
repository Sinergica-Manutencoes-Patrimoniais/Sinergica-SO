---
name: E01-S159-cadastro-ativos-visao-360
description: Visão 360 do cliente vira o lugar do cadastro completo — Componentes (CRUD), Sistemas (CRUD + composição), Estrutura (já existente) e aba Ferramentas (alocar/devolver), com TanStack Query.
alwaysApply: true
---

# Spec — E01-S159 Cadastro completo de ativos na Visão 360

> **Status:** aprovado · **Tier:** pequeno
> Design: [`../E01-S155-posicao-flexivel-ativos/design.md`](../E01-S155-posicao-flexivel-ativos/design.md) (D7)
> **Depende de:** E01-S154, E01-S155, E01-S156, E01-S157 (os modais já trazem posição, categoria e
> identificador).

## Resumo
Dentro da Visão 360 do cliente dá para cadastrar tudo: Estrutura (já existe), **Sistemas**
(criar/editar/desativar + compor), **Componentes** (criar/editar/desativar) e **Ferramentas**
(alocar/devolver ferramentas da Sinérgica). Os modais são os mesmos das telas globais, com o
cliente fixo.

## Contexto para quem implementa
- Aba atual "Ativos" = `PainelItensDoCliente` (só atribui Local; carrega **todos** os
  equipamentos e filtra no browser) + `PainelEquipamentos` (cache Auvo, só leitura).
- Aba "Sistemas" = `PainelSistemasCliente` (só "Compor itens").
- Ferramentas alocadas = `PainelFerramentasCliente` + `AlocarFerramentaModal`, definidos **dentro**
  de `VisaoClientePage.tsx` (~L871/L983) e renderizados no **Resumo** (~L533).
- `SistemaModal` está **dentro** de `pages/SistemasPage.tsx` (~L285).
- Ferramenta é patrimônio da **Sinérgica** alocado ao cliente. **Não** é ativo do cliente e não
  vira Componente.

## Critérios de aceite

### AC-1: Aba "Componentes" com CRUD
- **Dado** a Visão 360 de um cliente e um usuário com `pcm:escrita`
- **Então** a aba "Ativos" passa a se chamar **"Componentes"** (mesmo `id` interno `"ativos"`)
- **E** lista os Componentes **deste cliente** (filtro no servidor, `.eq('client_id', clienteId)`
  e `deleted_at is null`), ordenados por nome, com colunas: Identificador, Nome, Categoria,
  Posição (`Área > Local…`, ou "—"), Sistema (nome ou "—")
- **E** tem busca por nome/identificador (client-side sobre a lista carregada) e botão
  **"Novo componente"**
- **E** "Novo componente" abre o `EquipamentoModal` com o cliente **fixo** (prop
  `clienteFixoId`: esconde o select de cliente)
- **E** cada linha tem "Editar" (mesmo modal, modo edição) e "Desativar" (mesmo fluxo de
  `EquipamentosPage`: consulta `possuiOsAberta` e mostra o `ConfirmDialog` com o aviso de OS)
- **E** depois de criar, editar ou desativar, a lista atualiza por **invalidação** da query
  (sem `carregar()` manual).
- **E** sem `pcm:escrita`: lista e busca visíveis, sem botões.

### AC-2: Equipamentos do Auvo recolhidos
- **Dado** a aba Componentes
- **Então** o antigo `PainelEquipamentos` fica abaixo, **recolhido** por padrão, com o título
  "Equipamentos no Auvo (somente leitura)" (título da S154).

### AC-3: Aba "Sistemas" com CRUD
- **Dado** a aba Sistemas
- **Então** tem **"Novo sistema"** (abre `SistemaModal` com cliente fixo), e cada Sistema tem
  "Editar", "Desativar" (confirmação simples: "Desativar o Sistema «X»? Os Componentes continuam
  cadastrados, só deixam de pertencer a ele.") e o "Compor itens" que já existe
- **E** cada linha mostra Identificador (`codigo`), Categoria, Posição e quantidade de Componentes
- **E** `SistemaModal` é **extraído** para `components/SistemaModal.tsx` e reusado por
  `SistemasPage` e pela 360 (sem mudar o comportamento da tela global).

### AC-4: Desativar Sistema libera os Componentes
- **Quando** um Sistema é desativado
- **Então** os vínculos dele em `pcm.sistema_itens` são removidos (pelo caso de uso
  `desativarSistema`, antes do soft-delete), para os Componentes poderem entrar em outro Sistema
  (regra 1:N da S154).

### AC-5: Aba "Ferramentas"
- **Dado** a Visão 360
- **Então** existe a aba **"Ferramentas"** (ícone `Package`), logo depois de "Sistemas", com o
  painel de ferramentas alocadas (listar, alocar, devolver), com o mesmo comportamento de hoje
- **E** o painel **sai** do Resumo
- **E** `PainelFerramentasCliente` e `AlocarFerramentaModal` são extraídos para
  `components/PainelFerramentasCliente.tsx` e migrados para TanStack Query.

### AC-6: Ordem das abas
- **Então** a ordem fica: Resumo, Timeline, OS, Inspeções, Assessment, **Estrutura**,
  **Componentes**, **Sistemas**, **Ferramentas**, Board, Financeiro, Comercial, Comunicação. As
  abas de cadastro ficam juntas, na ordem em que se cadastra.

## Casos de borda e erros
- Cliente sem nenhuma Área: o `SeletorPosicao` só oferece "Sem Área", e o componente pode ser
  criado pendurado no cliente.
- Falha ao carregar uma aba: mensagem de erro **só naquela aba** (padrão isolado-de-falha da 360),
  com botão "Tentar de novo" (`refetch`).
- Componente editado fora da 360 (outra aba do navegador): o `staleTime` padrão (30s) + refetch ao
  focar resolvem. Não precisa de realtime.

## Fora de escopo
- Cadastrar a ferramenta em si (fica na tela Ferramentas).
- Importação Excel (E01-S161). Árvore (E01-S160).
- Desativar pelo drawer do Board.
- Remover as telas globais Componentes/Sistemas (continuam existindo).

## Rastreabilidade
- Código: `features/pcm/pages/VisaoClientePage.tsx`,
  `features/pcm/components/{PainelItensDoCliente,PainelSistemasCliente,PainelEquipamentos,SistemaModal,PainelFerramentasCliente,EquipamentoModal}.tsx`,
  `features/pcm/pages/SistemasPage.tsx`,
  `features/pcm/application/{ativos-cliente-queries,sistemas,equipamentos-gateway}.ts`,
  `features/pcm/infrastructure/supabase-equipamentos-adapter.ts`.

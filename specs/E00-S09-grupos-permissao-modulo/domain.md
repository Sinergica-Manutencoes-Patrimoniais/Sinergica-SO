---
name: domain
description: Modelo DDD de Grupos e permissões por módulo. Puxe ao modelar agregados e linguagem.
alwaysApply: false
---

# Domain Model (DDD) — Grupos e Permissões por Módulo

> Responde: qual a **linguagem** e o **modelo** do negócio. Bounded context `config` (já
> existente — governança: usuários, feature flags, e agora grupos/permissões). Subdomínio
> **supporting**: necessário para o sistema operar em escala, não é vantagem competitiva.

## Bounded Context
**Config** (`config`) — schema já existente (`config.usuarios`, `config.feature_flags`). Esta
feature adiciona `config.grupos`, `config.grupo_modulos`, `config.usuario_modulos` ao mesmo
contexto — é gestão de acesso, não um contexto novo.

## Linguagem ubíqua
> Promovidos ao `docs/glossary.md` global no mesmo PR desta story.

| Termo | Definição | NÃO confundir com |
|-------|-----------|-------------------|
| **Módulo** | Uma das 9 áreas de negócio do sistema (`pcm`, `atendimento`, `comercial`, `financeiro`, `operacao`, `marketing`, `growth`, `gestao`, `area-cliente`) — mesmos IDs já usados na sidebar (`ModuloId`). `inicio` não é módulo permissionável. | Bounded context (módulo é a unidade de permissão na UI; bounded context é a unidade de arquitetura no backend — nem todo módulo tem schema próprio, ex. `gestao`) |
| **Grupo** | Conjunto nomeado e reutilizável de permissões por módulo (`leitura`/`escrita`/nenhum, por módulo), criado por `superadmin`/`supervisor`. Atribuído a 0, 1 ou N usuários. | Papel (`superadmin`/`supervisor`/`colaborador`/`cliente-sindico` — dimensão fixa e separada, não substituída por grupo) |
| **Permissão individual** | Configuração de acesso por módulo feita diretamente num usuário, sem grupo — modo alternativo e mutuamente exclusivo ao grupo. | Permissão de grupo (herdada; individual é direta) |
| **Nível de acesso** | `leitura` (só SELECT) ou `escrita` (SELECT+INSERT+UPDATE) por módulo. Ausência de registro = nenhum acesso. | Papel (nível é por módulo; papel é uma dimensão global do usuário) |

## Agregados, entidades e value objects
- **Agregado `Grupo`** (raiz: `Grupo`, tabela `config.grupos`)
  - Entidades: `PermissaoModulo` (uma linha de `config.grupo_modulos` — módulo + nível)
  - Value objects: `Modulo` (um dos 9 IDs fixos), `NivelAcesso` (`leitura` | `escrita`)
  - **Invariantes**: um módulo aparece no máximo 1x por grupo (PK composta `grupo_id, modulo`);
    grupo inativo (`ativo = false`) não concede nenhuma permissão a seus membros (tratado na
    resolução, não apaga fisicamente as linhas).
  - Fronteira de consistência: grupo + suas permissões de módulo mudam juntos numa transação
    (criar/editar grupo grava `grupos` + `grupo_modulos` atomicamente).
- **Agregado `Usuario`** (raiz: `config.usuarios`, já existente — estendido, não recriado)
  - Novo campo: `grupo_id` (nullable, FK para `config.grupos`).
  - Nova relação: `PermissaoModulo` individual (`config.usuario_modulos`), só quando
    `grupo_id is null`.
  - **Novo invariante**: um usuário tem OU `grupo_id` setado OU linhas em `usuario_modulos`,
    nunca os dois — garantido por trigger (a regra cruza duas tabelas, não expressável em
    CHECK single-table).

## Eventos de domínio
| Evento (passado) | Disparado quando | Quem reage |
|-------------------|-------------------|------------|
| `GrupoCriado` / `GrupoAtualizado` | `superadmin`/`supervisor` grava `config.grupos`+`grupo_modulos` | Nenhum handler automático nesta fundação — efeito só aparece no próximo login/refresh dos membros (claim JWT) |
| `PermissaoUsuarioDefinida` | `config.definir_permissao_usuario` troca o modo (grupo↔individual) de um usuário | Idem — reflete no próximo token |
| `UsuarioCriado` | Edge Function `config-gerenciar-usuario` cria o Auth user + `config.usuarios` + permissão inicial | Usuário passa a poder logar imediatamente (papel/permissão já presentes desde o primeiro token) |

## Relações com outros contextos
- Nenhuma relação nova de context-map — `config` já é transversal (consultado por toda RLS de
  domínio via o claim JWT, mecanismo do `ADR-0003`, agora estendido pelo `ADR-0004`). Não há
  Customer/Supplier ou ACL novos; é extensão de um bounded context já existente.

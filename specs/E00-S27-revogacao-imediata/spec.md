# Feature Specification: Revogação imediata de acesso

**Story:** E00-S27 · **Owner:** _(marcar antes de codar)_ · **Created:** 2026-11-17
**Feature Branch (planejada):** `feat/E00-S27-revogacao-imediata`
**Status:** Especificada — implementação não iniciada. **Tier arquitetural (segurança).**

**Input:** Pacote Consolidado SSO v1.0 (13/11/2026), **BL 006** e seção 10.
Confronto em `docs/Apontamentos/Pacote-Consolidado-2026-11-13-confronto.md`.

## Contexto — o problema que esta story resolve

Hoje a permissão é **carimbada dentro do JWT** pelo hook de
`0008_E00-S09_resolver_hook_permissoes.sql`. Isso é bom para desempenho e ruim para revogação: o
token já emitido continua carregando o poder revogado até expirar.

A busca por `jwt_version`, `versao_sessao`, `revogar_sessao` e `sessao_revog` em
`supabase/migrations`, `supabase/functions` e `apps/web/src` não retorna **nenhuma** ocorrência.
Reconfirmado por caminho diferente: `supabase/functions/config-gerenciar-usuario/index.ts` só **lê**
`ativo` para autorizar quem chama; não invalida nada do usuário alterado.

Consequência prática: desativar um usuário, tirar um grupo ou retirar uma capacidade **não tem
efeito imediato**. É exposição de segurança aberta em produção, não dívida estética.

O pacote é direto: "desativação, revogação e mudança crítica de perfil passam a valer sem atraso
operacional relevante", e o acesso deve ser negado "em telas, API, Módulo de Campo e MCP".

## User Scenarios & Testing

### US1 — Desativar vale agora (Priority: P1)

**Why this priority:** É o caso que a operação usa quando alguém sai da empresa.

**Independent Test:** Com uma sessão aberta e válida, desativar o usuário em outra janela e tentar
qualquer ação sensível sem refazer login.

**Acceptance Scenarios:**

- **AC-1:** Dado um usuário com sessão ativa e token **ainda não expirado**, quando for desativado, então a **próxima ação** dele é negada — em tela, em RPC e em Edge Function.
- **AC-2:** Dado o mesmo usuário com duas sessões em dispositivos diferentes, quando for desativado, então **as duas** perdem acesso, não só a que disparou a mudança.
- **AC-3:** Dado o evento de desativação, quando ocorrer, então fica em `audit.*` com ator, alvo, motivo e momento.

### US2 — Mudança crítica de perfil também revoga (Priority: P1)

**Why this priority:** Rebaixar alguém sem efeito imediato é equivalente a não rebaixar.

**Acceptance Scenarios:**

- **AC-4:** Dado um usuário que perde uma capacidade sensível (aprovar, cancelar, exportar, ver valores internos), quando a mudança for gravada, então a sessão existente **deixa de exercer essa capacidade** sem novo login.
- **AC-5:** Dado o cache de permissão de qualquer camada (cliente, Edge Function, API), quando houver revogação, então o cache é invalidado ou deixa de ser confiável para decisão — nunca serve decisão vencida.
- **AC-6:** Dado um usuário restaurado depois de revogado, quando reativado, então recupera acesso de forma controlada e **auditada**, sem precisar de intervenção manual no banco.

### US3 — Vale em toda borda, não só na tela (Priority: P1)

**Why this priority:** O pacote nomeia telas, API, Campo e MCP; proteger só a tela é proteção falsa.

**Acceptance Scenarios:**

- **AC-7:** Dado um token revogado, quando usado contra uma Edge Function, então é recusado pela mesma verificação que recusa na tela — uma implementação, não duas.
- **AC-8:** Dada a verificação de revogação, quando um caminho novo de borda for criado, então a ausência da verificação é detectada por guarda no CI (mesmo padrão de `E00-S11`).

### Edge Cases

- Revogação durante uma operação longa já em andamento: definir se aborta ou conclui, e registrar a decisão.
- Relógio/propagação: "sem atraso operacional relevante" precisa de número acordado (sugestão: próxima ação, nunca mais que a janela do cache).
- Usuário `service_role` interno: não pode ser revogável por engano a ponto de derrubar a integração.
- Portal do cliente (`0142_E09-S01_portal_fundacao_acesso.sql`) tem caminho próprio de acesso e precisa obedecer a mesma revogação.

## Requirements

### Functional Requirements

- **FR-001:** Introduzir versão/geração de sessão por usuário, incrementada em desativação e em mudança crítica de perfil, conforme AC-1, AC-2, AC-4.
- **FR-002:** Verificar a versão vigente no servidor a cada ação sensível, independentemente do conteúdo carimbado no JWT, conforme AC-7.
- **FR-003:** Invalidar caches de permissão em todas as camadas, conforme AC-5.
- **FR-004:** Auditar revogação e restauração em `audit.*` append-only, conforme AC-3, AC-6.
- **FR-005:** Guarda no CI contra borda nova sem verificação, conforme AC-8.

### Key Entities

**Versão de sessão** por usuário (contador monotônico) e **evento de revogação** append-only.
Migration **aditiva**; nenhuma migration aplicada é editada.

## Success Criteria

- **SC-001:** pgTAP prova negado com token válido após revogação, e permitido antes dela.
- **SC-002:** Dois dispositivos perdem acesso no mesmo evento.
- **SC-003:** Nenhuma borda sensível sem verificação (gate de CI verde, não pulado).
- **SC-004:** A dívida correspondente sai de `docs/SECURITY_DEBT.md`, se registrada lá.

## Assumptions & Dependencies

- Depende de `E00-S26` para saber **quais** mudanças são "críticas".
- Toca autenticação em produção: exige ADR e `/revisao-adversarial` antes do PASS.
- Precisa de janela de homologação — mudança de sessão afeta todo usuário logado.

## Fora de escopo

- Trocar o modelo de autenticação ou sair do hook de JWT.
- Logout forçado em tempo real por push (a regra aprovada é "próxima ação", não websocket).
- Gestão de dispositivos confiáveis.

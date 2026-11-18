---
name: "docs-adr-1691-revogacao-imediata-generaliza-s184-md"
description: "Documento Sinérgica SO: ADR-1691 — E00-S27 generaliza o padrão de releitura ao vivo do E01-S184 (0234)"
alwaysApply: false
---

# ADR-1691 — E00-S27 generaliza o padrão de releitura ao vivo de `0234` (E01-S184)

**Status:** decidida (18/11/2026).

## Contexto

Achado do Fabrício: permissão é carimbada no JWT no login; revogar usuário/capacidade não tem
efeito até o token expirar. Busca por `jwt_version`/`versao_sessao` confirma: não existe
mecanismo de versão de sessão no repo.

**Restrição real do Postgres/Supabase (não é escolha de implementação):** uma vez emitido, um
access token JWT é válido e assinado até sua própria expiração — o Postgres não tem como
"invalidar" um JWT já decodificado que chega numa request. A ÚNICA forma de uma policy RLS ou RPC
recusar uma ação com um JWT "velho mas ainda válido" é NÃO confiar no que foi carimbado nele e
reler o estado atual de uma tabela a cada chamada.

**Achado que muda o escopo:** essa releitura já existe em DOIS lugares, nunca formalizados como
"o padrão de revogação":
1. `config.sso_autorizar_acao` (E01-S170) — releitura ao vivo de `config.usuarios`/
   `sso_concessoes` a cada chamada, para qualquer RPC que a use. `u.ativo` e a concessão
   específica já são verificados frescos, não a partir do JWT.
2. `config.s184_acesso_interno_atual` (`0234`, E01-S184) — a mesma ideia, como policy RLS
   `RESTRICTIVE`, aplicada hoje em 5 tabelas de custo (`comercial.propostas` e afins). Provado em
   produção por `E01-S184_protecao_custos_portal_us3.test.sql` ("permissão revogada invalida
   nova leitura com token antigo").

## Decisão

1. **Não criar versão de sessão nem reescrever o hook de JWT.** A arquitetura de releitura ao
   vivo já resolve "próxima ação é negada" (AC-1) sem precisar de um contador por sessão — e
   evita o problema de nunca conseguir invalidar um JWT já assinado de qualquer forma.
2. **Generalizar `0234` numa função nomeada e reusável:** `config.sso_acesso_atual(p_modulo,
   p_nivel)` — mesma lógica, parametrizada, pra não precisar duplicar a função toda vez que uma
   tabela nova precisar da garantia.
3. **Revogar/reativar usuário vira comando auditado** (`sso_revogar_usuario`/
   `sso_reativar_usuario`), nunca `UPDATE` cru — fecha AC-3/AC-6, que hoje não existem
   (`config-gerenciar-usuario` só lê `ativo`, nunca grava com auditoria).
4. **Retrofit de TODAS as RLS policies existentes que confiam só em `auth.jwt()` fica fora de
   escopo** — é um universo desconhecido sem inventário prévio, e reescrever policy em produção
   sem revisão individual é o tipo de mudança que esta própria story pede cautela antes de fazer
   (ver "Fora de escopo" do `spec.md`: não trocar o modelo de autenticação). Em vez disso,
   `scripts/check-revogacao-coberta.mjs` (FR-005/AC-8) vira um gate de CI que impede policy NOVA
   (migration ≥ 1855) de repetir o problema, sem reescrever o passado.
5. **AC-5 (cache) não aplica** — não existe camada de cache de permissão neste repo (sem Redis
   nem store client-side de permissão); a releitura ao vivo É a ausência de cache, por desenho.

## Consequências

- Nenhuma tabela nova de sessão; `sso_revogacoes_usuario` é só o log de auditoria do comando.
- `config.sso_acesso_atual` fica disponível pra quem for fechar o retrofit de outras tabelas
  sensíveis no futuro — não é mais preciso copiar o corpo de `0234` de novo.
- Dívida que fica registrada, não escondida: quantas RLS policies hoje confiam só em
  `auth.jwt()` sem releitura ao vivo é desconhecido — nenhum inventário completo foi feito nesta
  story (seria o equivalente a uma auditoria de segurança própria). `check-revogacao-coberta.mjs`
  só cobre o que vier depois de 18/11/2026.
- **Achado de `/revisao-adversarial` corrigido antes do PASS:** `sso_revogar_usuario` sem guarda
  deixava um superadmin se autorrevogar e travar — `sso_reativar_usuario` também exige
  `ativo=true` pra ser chamado, ou seja, não haveria caminho de volta por RPC. Bloqueado
  explicitamente (`nao_pode_revogar_a_si_mesmo`).

## Referências

- `0234_E01-S184_sessoes_internas_atuais.sql` — precedente original.
- `0239`-`0242_E01-S170_capacidades_sso.sql` — `sso_autorizar_acao`.
- `docs/SECURITY_DEBT.md` SEC-004 (o achado já estava registrado) e SEC-007 (mitigação parcial
  provada em produção).

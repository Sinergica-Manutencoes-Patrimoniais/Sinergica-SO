---
name: alcance-no-front-2026-11-17
description: Medição do alcance real das regras de negócio pelo front — por que regra implementada não vira ação disponível na tela.
alwaysApply: false
---

# Alcance no front — medição de 2026-11-17

Pergunta do Lucas: *"regra de negócio foi feita mas não está disponível no front; por exemplo, um
Chamado ter mais de uma OS eu não consigo fazer via front"*.

Está certo, e o caso escolhido é o melhor exemplo possível — porque a regra dele foi **fechada em
produção** na PR #78 (migration `1842`) e mesmo assim **não existe botão**.

Este arquivo mede a causa. Não é opinião: cada número abaixo sai de um comando.

---

## 1. O caso concreto — Chamado com mais de uma OS

A jornada tem **quatro camadas**, e três estão fechadas:

| Camada | Estado | Evidência |
|---|---|---|
| Regra de domínio | **Pronta** | `sso_criar_os_chamado` (`0324:44`), mediação `sso_criar_os_chamado_autorizado` (`1037`), corte 1:N aplicado (`1842`) |
| UI | **Existe e está fiada** | `CriarOsChamado` renderizado em `ChamadoPainel.tsx:244`, adapter em `supabase-chamados-os-comando-adapter.ts:25` |
| Flag de build | **Nunca declarada** | `ChamadoPainel.tsx:244` lê `import.meta.env.VITE_SSO_CRIAR_OS_CHAMADO_ENABLED`; essa flag **não existe** em `.env.example`, `.env.local` nem `netlify.toml` |
| Gate de banco | **Fechado** | `pcm.sso_criacao_os_mediada_gate` = `false` (`1037:6`) e `pcm.chamado_os_gate` = `false` (`0324:40`) |

E o comportamento quando a flag falta é o pior possível:

```tsx
// apps/web/src/features/pcm/interfaces/chamados-os/CriarOsChamado.tsx:19
if (props.habilitado !== "true" || props.chamado !== props.chamadoEsperado) return null;
```

`import.meta.env.VITE_SSO_CRIAR_OS_CHAMADO_ENABLED` é `undefined`, `undefined !== "true"`, e o
componente **retorna `null`**. Sem botão, sem aviso, sem erro, sem rastro no console. Da cadeira do
operador, a funcionalidade **não existe** — e não há como distinguir "não foi feito" de "foi feito e
está desligado". Era exatamente o que você sentiu.

## 2. A escala do problema

| Medida | Número | Comando |
|---|---|---|
| Flags `VITE_SSO_*` usadas no código | **737** | `grep -rhoE "VITE_SSO_[A-Z0-9_]+" apps/web/src \| sort -u \| wc -l` |
| Arquivos do front que leem alguma flag | **434** | varredura de `apps/web/src` |
| Flags declaradas em `.env.example` + `netlify.toml` + `.env.local` | **43** | `grep -cE "^VITE_SSO_" .env.example` |
| **Flags usadas e nunca declaradas em lugar nenhum** | **694** | diferença dos dois conjuntos |
| Pontos do front que fazem `return null` silencioso atrás de flag | **227** | varredura por contexto |
| Tabelas `*_gate` no banco | **599** | `grep -rhoE "create table [a-z_]+\.[a-z0-9_]*_gate"` |
| Gates com `habilitado ... default false` | **583** | `grep -rl "habilitado boolean not null default false"` |
| **Migrations que abrem algum gate** | **1** | `grep -rlE "habilitado *= *true"` |

Leitura direta: **694 funcionalidades do front estão desligadas por uma variável que ninguém nunca
escreveu**, e **583 regras de banco recusam por um gate que uma única migration em 1853 já abriu**.

## 3. O que **não** é o gargalo

Vale registrar para ninguém gastar sprint no lugar errado. Fiz o cruzamento inverso — RPC com
`grant execute` a `authenticated` × referência no código do front:

- **1140** RPCs com grant a `authenticated`;
- **66** sem nenhuma referência no front, e a maioria delas é versão superada (`..._v2` a `..._v5`),
  helper interno de política (`s184_pode_ver_custos`) ou caminho legado.

Ou seja: **a fiação UI → adapter → RPC existe**. `E01-S189` (sete escritores sem grant) continua
válida, mas é a ponta pequena. O gargalo é **flag + gate**, não fiação e não grant.

## 4. Por que isto não está coberto pelas stories que já existem

- `E01-S188` (ativação governada) **diagnostica** gates/flags/grants e declara jornadas — e diz
  explicitamente que **não abre nenhum gate**. Necessária, mas por si só não acende nada.
- `E01-S189` cobre grants de sete escritores.
- `E01-S191` (piloto Guainumbi) prova a jornada **ponta a ponta automatizada**, inclusive duas OS no
  mesmo Chamado (AC-4) — mas prova a **regra**, não que o **operador** alcança a ação na tela.

Falta a peça do meio, que é a da sua observação: **a ativação tem que ser visível e honesta no
front**. Isso vira `E00-S28`.

## 5. Três correções, em ordem

1. **Parar o sangramento (gate de CI).** Flag `VITE_SSO_*` usada no código e não declarada em nenhum
   arquivo de ambiente **quebra o build**. Hoje o custo de esquecer é zero e o sintoma é invisível;
   com o gate, o custo é imediato e o sintoma é uma linha de CI. Mesmo espírito de `E00-S11`.
2. **Recurso desligado se anuncia.** Trocar os 227 `return null` por um estado explícito:
   *"Disponível, não ativado — falta a ativação X"*, visível para quem administra e discreto para o
   operador. Some em silêncio é o que torna impossível distinguir ausência de desligamento.
3. **Acender a primeira jornada de verdade.** Chamado 1:N é a candidata natural: regra fechada
   (`1842`), UI pronta, prova automatizada já especificada em `E01-S191`. Faltam **duas linhas de
   ativação** — a flag no Netlify e os dois gates no banco — e o rollback declarado.

A ordem importa: acender sem (1) e (2) acende no escuro de novo na próxima story.

## 6. Ação imediata possível, sem story nova

Para **Chamado com várias OS** especificamente, a ativação é pequena e reversível:

- declarar `VITE_SSO_CRIAR_OS_CHAMADO_ENABLED=true` no Netlify e em `.env.example`, e **republicar**
  (flag de build não vale sem republicar — é o AC-6 de `E01-S188`);
- abrir `pcm.chamado_os_gate` e `pcm.sso_criacao_os_mediada_gate` por migration aditiva, com o
  procedimento de retorno escrito antes.

**Isto é decisão de produção, não de código** — precisa do seu aceite e de janela. Está registrado
aqui para ser decidido, não executado de surpresa.

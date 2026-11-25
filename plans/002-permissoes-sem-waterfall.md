# 002 — Permissões no TanStack Query e fim do waterfall serial

- **Status**: DONE
- **Commit**: cc104969
- **Severity**: HIGH
- **Category**: Performance
- **Estimated scope**: 2 arquivos (`permissoes-context.tsx`, uma query nova), ~80 linhas

## Problem

`PermissoesProvider` busca permissão com `useState` + `useEffect` — exatamente o padrão que o
`CLAUDE.md` recusa em código novo ("`useEffect` buscando dado de servidor em código novo é
recusado no review"):

```tsx
// apps/web/src/app/permissoes-context.tsx:25-32 — atual
  const [permissoes, setPermissoes] = useState<PermissaoModulo[]>([]);
  const [origem, setOrigem] = useState<{ id: string; papel: string } | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    ...
    resolverMinhasPermissoes(supabaseConfigAdapter)
```

Como não passa pelo `queryClient`, não tem cache, nem `staleTime`, nem dedupe, nem
revalidação em background. E 55 arquivos consomem `usePermissoes`.

O custo real é o **waterfall**: as telas derivam um gate do `carregando` e penduram o `enabled`
das queries nele.

```tsx
// apps/web/src/features/pcm/pages/OrdensServicoPage.tsx:200 — atual
  const consultasAtivas = !permissoesCarregando && temLeitura;
```

Esse `consultasAtivas` alimenta o `enabled` de 7 queries (linhas 215, 220, 222, 248, 267, 435).
Nenhuma requisição de dado começa antes de a permissão voltar. Duas viagens em série, sempre.

## Target

Permissão vira uma `useQuery` normal, com chave estável e `staleTime` alto (permissão muda
raramente, e E00-S27 já trata revogação imediata por outro caminho). O provider continua
existindo e expondo a mesma interface (`carregando`, `podeAcessar`) — **nenhum consumidor muda**.

```tsx
// apps/web/src/app/permissoes-context.tsx — target (trecho)
const consulta = useQuery({
  queryKey: ["config", "minhas-permissoes", usuarioId, papel],
  queryFn: () => resolverMinhasPermissoes(supabaseConfigAdapter),
  enabled: status === "autenticado" && Boolean(usuarioId) && Boolean(papel),
  staleTime: 5 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
  retry: 1,
});
```

A falha continua tratada como "sem permissão nenhuma" (mais restritivo, nunca mais permissivo) —
é a decisão já documentada no comentário de `permissoes-context.tsx:46-48` e deve ser preservada.

## Repo conventions to follow

- `queryClient` único em `apps/web/src/app/query-client.ts` (`staleTime` padrão 30s).
- Chaves ficam em objetos `<dominio>QueryKeys` — exemplar:
  `apps/web/src/features/pcm/application/operacao-queries.ts`.
- Exemplar de `useQuery` com `enabled` e `staleTime` maior:
  `apps/web/src/features/pcm/pages/MonitorExcecoesAuvoPage.tsx:42-48`.

## Steps

1. Criar `apps/web/src/features/config/application/permissoes-queries.ts` com
   `permissoesQueryKeys.minhas(usuarioId, papel)` e um hook `useMinhasPermissoes(usuarioId, papel, habilitado)`
   encapsulando a `useQuery` do Target.
2. Em `permissoes-context.tsx`, trocar os três `useState` e o `useEffect` pelo hook novo.
   `carregando` passa a ser `consulta.isPending`; `permissoes` passa a ser `consulta.data ?? []`.
   Em erro, `consulta.data` é `undefined` e o `?? []` já entrega o comportamento restritivo —
   manter o comentário que explica isso.
3. A checagem `corresponde` (que hoje compara `origem` com o usuário atual) deixa de precisar do
   state `origem`: a chave da query já inclui `usuarioId` e `papel`, então o dado nunca é de outra
   identidade. Remover `origem` e simplificar `corresponde` para
   `status === "autenticado" && !!user`.
4. Em `OrdensServicoPage.tsx:200`, manter `temLeitura` no `enabled` (é regra de negócio) mas
   **remover `!permissoesCarregando`** do gate: com cache, o segundo acesso resolve síncrono, e
   `temLeitura` já é `false` enquanto não há permissão — o `enabled` continua correto sem
   serializar.

## Boundaries

- NÃO mudar a interface pública de `usePermissoes` (`carregando`, `podeAcessar`) — 55 arquivos
  dependem dela.
- NÃO tornar a falha mais permissiva. Erro = sem permissão.
- NÃO mexer em `auth-context.tsx`.
- NÃO alterar as regras de `podeAcessarModulo` (domínio puro).
- Se `resolverMinhasPermissoes` tiver outra assinatura, PARE e relate.

## Verification

- **Mecânica**:
  - `pnpm --filter @sinergica/web typecheck` limpo.
  - `pnpm -w test` verde — em especial qualquer teste que monte `PermissoesProvider`.
  - `pnpm -w lint` limpo.
- **Feel check**: logar, entrar no PCM, voltar pra Home e entrar de novo. Na segunda entrada a
  tela não pode mostrar skeleton de permissão nenhum — o dado vem do cache. Confirmar também que
  um usuário sem módulo continua vendo "Acesso restrito".

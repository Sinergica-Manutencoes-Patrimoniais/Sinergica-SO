# Verificação local dos gates de CI

Executada com Node 22 e sem iniciar Supabase compartilhado. `eval:spec`, Mermaid e `pnpm --filter @sinergica/web typecheck` passaram. O lote de 18 fixtures SQL e 70 testes web está registrado separadamente em `manual_E01-S165_S166_lote_isolado_1767.md`.

Bloqueios observados no estado completo do workspace:

- `audit:esteira`: 1.597 problemas, em sua maioria documentos sem frontmatter; também apontou link quebrado.
- `lint:migrations`: convenções passaram em 1.743 migrations, mas Squawk reportou 474 alertas em 42 arquivos.
- `arch:check`: quatro violações de dependência nas áreas de exportação e importação XLSX.
- `check:edge-functions`: testes do verificador passaram, mas há invocações de funções existentes sem declaração em `supabase/config.toml`.
- Biome focado em quatro arquivos de Plano de Manutenção reportou 16 diagnósticos de formatação/acessibilidade; nenhuma correção automática foi aplicada.

O comando `ci:local` executa vários processos em paralelo e não inclui `db-tests`. A CI do GitHub roda `supabase start` e pgTAP em runner próprio. A execução local integral desde zero não foi feita: o workspace tinha 9,1 GiB livres e não foi considerado seguro iniciar infraestrutura compartilhada sem isolamento equivalente. Nenhum deploy ou Auvo foi acionado.

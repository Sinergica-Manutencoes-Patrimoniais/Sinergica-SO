# ADR-0917 — Imports explícitos no parser XLSX compartilhado

Data: 2026-10-30 · Status: preparação, não publicada.

O worker da função e o frontend reutilizam o mesmo parser, sem duplicar regras. Para permitir resolução pelo Deno padrão, imports relativos do grafo compartilhado passam a usar extensão `.ts`; o frontend sem emissão habilita `allowImportingTsExtensions`. A função declara o pacote zip fixado em seu `deno.json`. Não há mudança de domínio, formato ou política de dados.

O check Deno local não prova que o Supabase empacota o worker e arquivos externos à pasta da função. Testar Edge Runtime real, isolamento e import map no bundle antes de qualquer publicação; manter gates e homologação fechados. Reversão exige remover a entrada Edge ou restabelecer a resolução anterior juntamente com o frontend, sem alterar dados.

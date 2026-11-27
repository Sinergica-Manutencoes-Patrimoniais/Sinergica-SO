-- inventario.sql — E01-S205. SOMENTE LEITURA (só SELECT). Rode ANTES de arquivar, depois da migration 1911.
-- Mostra o que pcm.arquivar_dados_teste_e2e() arquivaria e o que depende disso.

-- 1) O que seria arquivado, por tabela
select tabela, count(*) as linhas from pcm.e2e_selecionar_arquivaveis() group by 1 order by 1;

-- 2) Lista linha a linha (para o dono aprovar)
select tabela, id, nome, motivo from pcm.e2e_selecionar_arquivaveis() order by tabela, nome;

-- 3) Allowlist vigente (massa ativa do caderno)
select a.tabela, a.row_id, c.nome, a.motivo
from pcm.e2e_allowlist a left join pcm.clientes c on a.tabela = 'clientes' and c.id = a.row_id;

-- 4) Dependências: para cada FK que aponta para uma tabela da Fase 1, quantas linhas de
--    OUTRAS tabelas (chamados, OS, inspeções, comercial...) referenciam as linhas selecionadas.
--    chamados e ordens_servico da lista são arquivados junto (decisão do dono); as demais tabelas
--    (inspeções, comercial, financeiro...) NÃO são tocadas e ficam sem o pai visível nos seletores.
with sel as (select tabela, id from pcm.e2e_selecionar_arquivaveis()),
fks as (
  select c.conrelid::regclass::text as tabela_filha, a.attname as coluna,
         c.confrelid::regclass::text as tabela_pai
  from pg_constraint c
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
  join pg_attribute p on p.attrelid = c.confrelid and p.attnum = c.confkey[1] and p.attname = 'id'
  where c.contype = 'f' and array_length(c.conkey, 1) = 1
    and c.confrelid::regclass::text in
      ('pcm.clientes','pcm.areas','pcm.locais','pcm.sistemas','pcm.equipamentos','pcm.ferramentas')
    and c.conrelid::regclass::text not like 'atendimento.%'  -- regra do projeto: não consultar Atendimento
    and c.conrelid::regclass::text not in
      ('pcm.areas','pcm.locais','pcm.sistemas','pcm.equipamentos','pcm.ferramentas','pcm.e2e_arquivamento')
)
select f.tabela_pai, f.tabela_filha, f.coluna,
       (xpath('/row/n/text()', query_to_xml(format(
         'select count(*) as n from %s where %I in (select id from pcm.e2e_selecionar_arquivaveis() where tabela = %L)',
         f.tabela_filha, f.coluna, split_part(f.tabela_pai, '.', 2)), false, true, '')))[1]::text::int as linhas_dependentes
from fks f
order by 1, 2;

-- E01-S97: item de inspeção importado do XLS Auvo pode ter várias fotos (Ocorrência separa por
-- `;`), mas só a primeira era gravada em `foto_url` (text único). `foto_urls` guarda a lista
-- completa para a galeria na tela — continua como URL externa, nunca sobe pro Storage (mesma
-- decisão de `0091_E01-S73` sobre mídia vinda de import).
alter table pcm.inspecao_itens add column if not exists foto_urls jsonb not null default '[]'::jsonb;

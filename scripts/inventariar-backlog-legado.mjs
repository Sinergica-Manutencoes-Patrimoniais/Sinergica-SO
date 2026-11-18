#!/usr/bin/env node
// E01-S193 task 3 — relatório ANTES da classificação do Backlog legado (AC-7).
//
// Conta `pcm.ordens_servico` em `status='backlog'` por cliente, separando quem tem
// `auvo_task_id`/`auvo_sync_status` preenchido (não pode ser reclassificado sem reconciliação —
// mesmo padrão de E01-S171 e `1832_efeito_remoto_exige_reconciliacao`) de quem não tem.
//
// Só leitura. Não decide nada, não aplica migration, não chama Auvo. O relatório é insumo pra
// revisão humana (task 12) antes de qualquer classificação.
//
// Uso: node scripts/inventariar-backlog-legado.mjs
// Conexão: SUPABASE_DB_URL (produção/staging, injetado por CI/secrets) ou, na ausência,
// a URL padrão do `supabase start` local.
import { execFileSync } from "node:child_process";

const DB_URL =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";

const CONSULTA = `
select
  os.client_id as cliente_id,
  c.nome as cliente_nome,
  count(*) filter (where os.auvo_task_id is null and os.auvo_sync_status is null) as sem_auvo,
  count(*) filter (where os.auvo_task_id is not null or os.auvo_sync_status is not null) as com_auvo,
  count(*) as total
from pcm.ordens_servico os
join pcm.clientes c on c.id = os.client_id
where os.status = 'backlog' and os.deleted_at is null
group by os.client_id, c.nome
order by total desc, c.nome;
`;

function consultar(sql) {
  return execFileSync("psql", [DB_URL, "--csv", "--tuples-only", "--no-align", "-c", sql], {
    encoding: "utf8",
  });
}

function parseCsv(saida) {
  const linhas = saida.trim().length > 0 ? saida.trim().split("\n") : [];
  return linhas.map((linha) => {
    const [clienteId, clienteNome, semAuvo, comAuvo, total] = linha.split(",");
    return {
      clienteId,
      clienteNome,
      semAuvo: Number(semAuvo),
      comAuvo: Number(comAuvo),
      total: Number(total),
    };
  });
}

function main() {
  let linhas;
  try {
    linhas = parseCsv(consultar(CONSULTA));
  } catch (erro) {
    process.stderr.write(
      `inventariar-backlog-legado: falha ao consultar ${DB_URL.replace(/:[^:@]*@/, ":***@")} — ${erro.message}\n`,
    );
    process.exit(1);
  }

  const totalGeral = linhas.reduce((soma, l) => soma + l.total, 0);
  const totalSemAuvo = linhas.reduce((soma, l) => soma + l.semAuvo, 0);
  const totalComAuvo = linhas.reduce((soma, l) => soma + l.comAuvo, 0);

  process.stdout.write(
    JSON.stringify(
      {
        aviso:
          "Só leitura. 'comAuvo' não pode ser reclassificado sem reconciliação (E01-S171/1832). Revisão humana obrigatória antes da task 12.",
        geradoEm: new Date().toISOString(),
        totalGeral,
        totalSemAuvo,
        totalComAuvo,
        porCliente: linhas,
      },
      null,
      2,
    ) + "\n",
  );
}

main();

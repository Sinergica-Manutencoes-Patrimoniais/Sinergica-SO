// Somente base descartável 55422, com 0958 e fixtures E01-S181_assessment_cliente já commitadas.
// As quatro disputas deixam as fixtures sintéticas alteradas; não executa limpeza automática.
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const a = '18130000-0000-0000-0000-00000000000a';
const b = '18130000-0000-0000-0000-00000000000b';
const ins = '18130000-0000-0000-0000-000000000021';
const op = '18130000-0000-0000-0000-000000000011';
const prop = '18130000-0000-0000-0000-000000000031';
function run(sql) {
  return new Promise((resolve) => {
    const p = spawn('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-p', '55422', '-U', 'postgres', '-d', 'postgres', '-c', sql]);
    let output = '';
    p.stdout.on('data', x => output += x); p.stderr.on('data', x => output += x);
    p.on('close', code => resolve({ code, output }));
    p.on('error', e => resolve({ code: -1, output: String(e) }));
  });
}
async function main() {
  for (const [table, key, col, id] of [['pcm.inspecoes','id','client_id',ins], ['comercial.oportunidades','id','cliente_id',op]]) {
    for (const linkFirst of [true, false]) {
      let r = await run(`set app.auvo_sync_write='true'; update comercial.propostas set assessment_id=null where id='${prop}'; update pcm.inspecoes set client_id='${a}' where id='${ins}'; update comercial.oportunidades set cliente_id='${a}' where id='${op}';`);
      assert.equal(r.code, 0, r.output);
      const link = `update comercial.propostas set assessment_id='${ins}' where id='${prop}'`;
      const move = `update ${table} set ${col}='${b}' where ${key}='${id}'`;
      const first = run(`begin; set local app.auvo_sync_write='true'; ${linkFirst ? link : move}; select pg_sleep(2); commit;`);
      await new Promise(resolve => setTimeout(resolve, 400));
      const started = Date.now();
      const second = run(`begin; set local app.auvo_sync_write='true'; set local lock_timeout='5s'; ${linkFirst ? move : link}; commit;`).then(r => ({ ...r, elapsed: Date.now() - started }));
      const [r1,r2] = await Promise.all([first,second]);
      assert.equal(r1.code, 0, r1.output);
      assert.notEqual(r2.code, 0, r2.output);
      assert.match(r2.output, /vinculo_assessment_invalido/);
      assert.ok(r2.elapsed >= 1000, 'disputa não demonstrou espera pela primeira transação');
      r = await run(`select case when p.assessment_id is null or i.client_id=o.cliente_id then 'ok' else 'inconsistente' end from comercial.propostas p join comercial.oportunidades o on o.id=p.oportunidade_id left join pcm.inspecoes i on i.id=p.assessment_id where p.id='${prop}'`);
      assert.equal(r.code, 0, r.output); assert.match(r.output, /\bok\b/);
      process.stdout.write(`ok ${table} ${linkFirst ? 'vínculo primeiro' : 'mudança primeiro'}\n`);
    }
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });

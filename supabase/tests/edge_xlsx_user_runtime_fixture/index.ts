// Proxy exclusivamente local: cria runtime de usuário com limites explícitos.
// Nenhuma credencial ou variável de ambiente é propagada.
Deno.serve(async (req) => {
  try {
    const worker = await EdgeRuntime.userWorkers.create({
      servicePath: "/work/supabase/tests/edge_xlsx_runtime_fixture",
      memoryLimitMb: 128,
      workerTimeoutMs: 15000,
      cpuTimeSoftLimitMs: 1000,
      cpuTimeHardLimitMs: 2000,
      noModuleCache: false,
      envVars: [],
      forceCreate: true,
    });
    return await worker.fetch(req);
  } catch {
    return Response.json({ erro: "runtime_indisponivel" }, { status: 503 });
  }
});

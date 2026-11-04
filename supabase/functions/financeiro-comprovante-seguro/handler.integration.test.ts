import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { criarHandler } from "./handler.ts";

const lancamentoId = "18420000-0000-4000-8000-000000000012";
const caminho = "s184-integracao/nota.pdf";

// Somente banco local. Cada consulta cria fixtures dentro de transação descartada;
// Auth e conteúdo Storage são doubles, portanto não prova a pilha HTTP completa.
async function consultarBanco(ativo: boolean): Promise<string | null> {
  const sql = `
    begin;
    insert into auth.users(id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
      values ('18420000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'integracao-comprovante@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
    insert into config.usuarios(user_id, papel, nome, ativo) values ('18420000-0000-4000-8000-000000000001', 'colaborador', 'Teste integrado', true);
    ${ativo ? "insert into config.usuario_modulos(user_id, modulo, nivel) values ('18420000-0000-4000-8000-000000000001', 'financeiro', 'leitura');" : ""}
    insert into financeiro.categorias(id, nome, tipo) values ('18420000-0000-4000-8000-000000000011', 'Categoria integrada', 'entrada');
    insert into financeiro.lancamentos(id, tipo, status, valor_centavos, data_competencia, data_vencimento, categoria_id, comprovante_path)
      values ('${lancamentoId}', 'entrada', 'previsto', 100, '2026-10-01', '2026-10-01', '18420000-0000-4000-8000-000000000011', '${caminho}');
    insert into storage.objects(bucket_id, name) values ('financeiro-comprovantes', '${caminho}');
    set local role authenticated;
    set local request.jwt.claims = '{"sub":"18420000-0000-4000-8000-000000000001","role":"authenticated","user_role":"colaborador","user_modulos":{"financeiro":"leitura"}}';
    select financeiro.sso_comprovante_autorizado('${lancamentoId}');
    rollback;
  `;
  const resultado = await new Deno.Command("rtk", { args: ["proxy", "docker", "exec", "-i", "supabase_db_Sinergica-SO", "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "supabase_admin", "-d", "postgres", "-c", sql], stdout: "piped", stderr: "piped" }).output();
  if (!resultado.success) {
    const erro = new TextDecoder().decode(resultado.stderr);
    if (erro.includes("comprovante_nao_encontrado_ou_sem_acesso")) return null;
    throw new Error("Falha inesperada no banco local de teste.");
  }
  return new TextDecoder().decode(resultado.stdout).trim();
}

Deno.test({ name: "rota usa autorização real do banco e entrega conteúdo sintético", ignore: Deno.env.get("SSO_TESTE_BANCO_LOCAL") !== "1", fn: async () => {
  const handler = criarHandler({ cors: () => ({}), autenticar: async () => "usuario-sintetico", limitar: async () => true,
    resolver: async () => await consultarBanco(true), baixar: async (path) => { assertEquals(path, caminho); return new Blob(["nota sintética"]); } });
  const response = await handler(new Request("http://localhost/", { method: "POST", body: JSON.stringify({ lancamentoId }) }));
  assertEquals(response.status, 200);
  assertEquals(await response.text(), "nota sintética");
} });

Deno.test({ name: "rota não entrega conteúdo quando a segunda consulta ao banco encontra permissão ausente", ignore: Deno.env.get("SSO_TESTE_BANCO_LOCAL") !== "1", fn: async () => {
  let chamadas = 0;
  const handler = criarHandler({ cors: () => ({}), autenticar: async () => "usuario-sintetico", limitar: async () => true,
    resolver: async () => await consultarBanco(++chamadas === 1), baixar: async () => new Blob(["nota sintética"]) });
  const response = await handler(new Request("http://localhost/", { method: "POST", body: JSON.stringify({ lancamentoId }) }));
  assertEquals(response.status, 404);
  assertEquals((await response.text()).includes("nota sintética"), false);
} });

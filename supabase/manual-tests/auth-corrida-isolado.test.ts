import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { serializarAutenticacao } from "../../apps/web/src/features/auth/infrastructure/serializar-autenticacao.ts";

// Nunca executar fora da pilha descartável explicitamente identificada.
for (const modo of ["sdk", "fila", "condicional"] as const) Deno.test({
  name: modo === "sdk" ? "caracterização: SDK isolado apaga nova sessão após saída anterior" : modo === "fila" ? "fila do SSO preserva nova sessão após saída anterior" : "perfil antigo não encerra sessão nova",
  ignore: Deno.env.get("SSO_TESTE_PILHA_ISOLADA") !== "1",
  fn: async () => {
    const dir = Deno.env.get("SSO_PILHA_DIR");
    if (dir !== "/Users/lucasazevedo/sso-comprovantes-AmwvLX") {
      throw new Error("Diretório isolado não autorizado.");
    }
    const status = await new Deno.Command("rtk", {
      args: ["proxy", "supabase", "status", "--workdir", dir, "-o", "json"],
      stdout: "piped",
      stderr: "piped",
    }).output();
    if (!status.success) throw new Error("Pilha isolada indisponível.");
    const texto = new TextDecoder().decode(status.stdout);
    const config = JSON.parse(
      texto.slice(texto.indexOf("{"), texto.lastIndexOf("}") + 1),
    ) as { API_URL: string; ANON_KEY: string; SERVICE_ROLE_KEY: string };
    if (config.API_URL !== "http://127.0.0.1:56321") {
      throw new Error("API não pertence à pilha isolada.");
    }
    const headers = {
      apikey: config.SERVICE_ROLE_KEY,
      Authorization: `Bearer ${config.SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    };
    const ids: string[] = [];
    const senha = `${crypto.randomUUID()}aA1!`;
    const emails = [0, 1].map(() =>
      `sso-auth-corrida-${crypto.randomUUID()}@example.test`
    );
    try {
      for (const email of emails) {
        const resposta = await fetch(`${config.API_URL}/auth/v1/admin/users`, {
          method: "POST",
          headers,
          body: JSON.stringify({ email, password: senha, email_confirm: true }),
        });
        if (!resposta.ok) {
          throw new Error(`Criação sintética falhou: ${resposta.status}`);
        }
        const usuario = await resposta.json() as { id: string };
        if (!/^[0-9a-f-]{36}$/.test(usuario.id)) {
          throw new Error("ID sintético inválido");
        }
        ids.push(usuario.id);
      }
      let iniciarLogout!: () => void;
      let liberarLogout!: () => void;
      const aguardando = new Promise<void>((resolve) => {
        iniciarLogout = resolve;
      });
      const liberado = new Promise<void>((resolve) => {
        liberarLogout = resolve;
      });
      const sdk = createClient(config.API_URL, config.ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
          fetch: async (input, init) => {
            if (String(input).includes("/auth/v1/logout")) {
              iniciarLogout();
              await liberado;
            }
            return fetch(input, init);
          },
        },
      });
      const fila = serializarAutenticacao(sdk.auth);
      const auth = modo === "sdk" ? sdk.auth : fila;
      const primeiro = await auth.signInWithPassword({
        email: emails[0],
        password: senha,
      });
      assertEquals(primeiro.error, null);
      if (modo === "condicional") {
        assertEquals((await auth.signInWithPassword({ email: emails[1], password: senha })).error, null);
        await fila.signOut(ids[0]);
      } else {
        const saida = auth.signOut();
        await aguardando;
        const entrada = auth.signInWithPassword({ email: emails[1], password: senha });
        if (modo === "sdk") assertEquals((await entrada).error, null);
        liberarLogout();
        await saida;
        assertEquals((await entrada).error, null);
      }
      const atual = await sdk.auth.getSession();
      assertEquals(atual.data.session?.user.id, modo === "sdk" ? undefined : ids[1]);
    } finally {
      for (const id of ids) {
        const resposta = await fetch(
          `${config.API_URL}/auth/v1/admin/users/${id}`,
          { method: "DELETE", headers },
        );
        if (!resposta.ok) {
          throw new Error(
            `Remoção de usuário sintético falhou: ${resposta.status}`,
          );
        }
      }
    }
  },
});

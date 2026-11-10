import { beforeEach, describe, expect, it, vi } from "vitest";

const rede = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("../../../lib/supabase-client", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  return {
    supabase: createClient("https://sso-test.invalid", "chave-teste", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: rede.fetch },
    }),
  };
});

import { supabase } from "../../../lib/supabase-client";
import { confirmarAcessoVersaoPdf } from "./supabase-proposta-adapter";

const a = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const b = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const proposta = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const versao = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const token = (id: string) =>
  `${Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.fake`;
const json = (dados: unknown, status = 200) =>
  new Response(JSON.stringify(dados), { status, headers: { "Content-Type": "application/json" } });
const usuario = (id: string) => ({
  id,
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
  created_at: "2025-01-01T00:00:00Z",
});

async function iniciar(id: string) {
  rede.fetch.mockImplementation(async () => json(usuario(id)));
  const { error } = await supabase.auth.setSession({
    access_token: token(id),
    refresh_token: `refresh-${id}`,
  });
  if (error) throw error;
  rede.fetch.mockReset();
}

beforeEach(() => {
  rede.fetch.mockReset();
});

describe("PDF: revalidação com SDK Supabase e transporte simulado", () => {
  it("autoriza A com identidade e versão conferidas no servidor", async () => {
    await iniciar(a);
    rede.fetch.mockImplementation(async (url) =>
      String(url).includes("/auth/v1/user") ? json(usuario(a)) : json({ id: versao }),
    );
    expect(await confirmarAcessoVersaoPdf(a, proposta, versao)).toBe(true);
    expect(rede.fetch).toHaveBeenCalledTimes(3);
    const chamada = rede.fetch.mock.calls[1];
    if (!chamada) throw new Error("Consulta de versão não realizada.");
    const [url, init] = chamada;
    expect(String(url)).toContain(`proposta_id=eq.${proposta}`);
    expect(String(url)).toContain(`id=eq.${versao}`);
    expect(new Headers(init.headers).get("accept-profile")).toBe("comercial");
  });

  it("nega B tentando usar o documento de A", async () => {
    await iniciar(b);
    rede.fetch.mockImplementation(async () => json(usuario(b)));
    expect(await confirmarAcessoVersaoPdf(a, proposta, versao)).toBe(false);
    expect(rede.fetch).toHaveBeenCalledTimes(1);
  });

  it("nega ausência de linha pela RLS", async () => {
    await iniciar(a);
    rede.fetch.mockImplementation(async (url) =>
      String(url).includes("/auth/v1/user") ? json(usuario(a)) : json([]),
    );
    expect(await confirmarAcessoVersaoPdf(a, proposta, versao)).toBe(false);
  });

  it("nega erro na consulta da versão", async () => {
    await iniciar(a);
    rede.fetch.mockImplementation(async (url) =>
      String(url).includes("/auth/v1/user")
        ? json(usuario(a))
        : json({ code: "42501", message: "negado" }, 403),
    );
    expect(await confirmarAcessoVersaoPdf(a, proposta, versao)).toBe(false);
  });

  it("nega resposta inconsistente com identificador de outra versão", async () => {
    await iniciar(a);
    rede.fetch.mockImplementation(async (url) =>
      String(url).includes("/auth/v1/user") ? json(usuario(a)) : json({ id: "outra-versao" }),
    );
    expect(await confirmarAcessoVersaoPdf(a, proposta, versao)).toBe(false);
  });

  it("nega indisponibilidade HTTP durante checagem de identidade", async () => {
    await iniciar(a);
    rede.fetch.mockResolvedValue(json({ message: "indisponível" }, 503));
    expect(await confirmarAcessoVersaoPdf(a, proposta, versao)).toBe(false);
  });

  it("nega rejeição de rede durante checagem de identidade", async () => {
    await iniciar(a);
    rede.fetch.mockRejectedValue(new Error("rede indisponível"));
    expect(await confirmarAcessoVersaoPdf(a, proposta, versao)).toBe(false);
  });

  it("nega troca de A para B enquanto a consulta está em andamento", async () => {
    await iniciar(a);
    rede.fetch.mockImplementation(async (url, init) => {
      if (String(url).includes("/auth/v1/user")) {
        const bearer = new Headers(init?.headers).get("authorization");
        const payload = JSON.parse(
          Buffer.from(bearer?.split(".")[1] ?? "", "base64url").toString(),
        );
        return json(usuario(payload.sub));
      }
      const { error } = await supabase.auth.setSession({
        access_token: token(b),
        refresh_token: `refresh-${b}`,
      });
      if (error) throw error;
      return json({ id: versao });
    });
    expect(await confirmarAcessoVersaoPdf(a, proposta, versao)).toBe(false);
  });
});

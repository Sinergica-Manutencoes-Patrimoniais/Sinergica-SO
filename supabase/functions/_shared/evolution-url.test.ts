import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  ipv4PrivadoOuLoopback,
  ipv6PrivadoOuLoopback,
  nomeRemotoDaInstancia,
  validarUrlDoServidor,
} from "./evolution-url.ts";

function fake(enderecos: string[]) {
  return { resolverDns: async () => enderecos };
}

Deno.test("ipv4PrivadoOuLoopback — reconhece as faixas privadas", () => {
  assertEquals(ipv4PrivadoOuLoopback("127.0.0.1"), true);
  assertEquals(ipv4PrivadoOuLoopback("10.0.0.5"), true);
  assertEquals(ipv4PrivadoOuLoopback("172.16.0.1"), true);
  assertEquals(ipv4PrivadoOuLoopback("172.31.255.255"), true);
  assertEquals(ipv4PrivadoOuLoopback("192.168.1.1"), true);
  assertEquals(ipv4PrivadoOuLoopback("169.254.169.254"), true); // metadata
  assertEquals(ipv4PrivadoOuLoopback("8.8.8.8"), false);
  assertEquals(ipv4PrivadoOuLoopback("200.147.1.1"), false);
});

Deno.test("ipv6PrivadoOuLoopback — reconhece loopback, ULA e link-local", () => {
  assertEquals(ipv6PrivadoOuLoopback("::1"), true);
  assertEquals(ipv6PrivadoOuLoopback("fc00::1"), true);
  assertEquals(ipv6PrivadoOuLoopback("fd12:3456::1"), true);
  assertEquals(ipv6PrivadoOuLoopback("fe80::1"), true);
  assertEquals(ipv6PrivadoOuLoopback("2001:4860:4860::8888"), false);
});

Deno.test("validarUrlDoServidor — recusa HTTP em produção", async () => {
  const r = await validarUrlDoServidor("http://evolution.exemplo.com.br", fake(["200.1.1.1"]));
  assertEquals(r.ok, false);
  assertEquals(r.motivo, "https_obrigatorio");
});

Deno.test("validarUrlDoServidor — recusa credencial embutida", async () => {
  const r = await validarUrlDoServidor(
    "https://user:pass@evolution.exemplo.com.br",
    fake(["200.1.1.1"]),
  );
  assertEquals(r.ok, false);
  assertEquals(r.motivo, "credencial_na_url");
});

Deno.test("validarUrlDoServidor — recusa query string", async () => {
  const r = await validarUrlDoServidor(
    "https://evolution.exemplo.com.br/?token=abc",
    fake(["200.1.1.1"]),
  );
  assertEquals(r.ok, false);
  assertEquals(r.motivo, "query_ou_fragmento_na_url");
});

Deno.test("validarUrlDoServidor — recusa fragmento", async () => {
  const r = await validarUrlDoServidor(
    "https://evolution.exemplo.com.br/#frag",
    fake(["200.1.1.1"]),
  );
  assertEquals(r.ok, false);
  assertEquals(r.motivo, "query_ou_fragmento_na_url");
});

Deno.test("validarUrlDoServidor — recusa quando DNS resolve para endereço privado", async () => {
  const r = await validarUrlDoServidor(
    "https://interno.exemplo.com.br",
    fake(["10.0.0.5"]),
  );
  assertEquals(r.ok, false);
  assertEquals(r.motivo, "endereco_privado_ou_loopback");
});

Deno.test("validarUrlDoServidor — recusa metadata (169.254.169.254)", async () => {
  const r = await validarUrlDoServidor(
    "https://parece-publico.exemplo.com.br",
    fake(["169.254.169.254"]),
  );
  assertEquals(r.ok, false);
  assertEquals(r.motivo, "endereco_privado_ou_loopback");
});

Deno.test("validarUrlDoServidor — recusa quando DNS não resolve (falha fechada)", async () => {
  const r = await validarUrlDoServidor("https://naoexiste.exemplo.com.br", fake([]));
  assertEquals(r.ok, false);
  assertEquals(r.motivo, "dns_nao_resolvido");
});

Deno.test("validarUrlDoServidor — recusa quando a resolução de DNS lança", async () => {
  const r = await validarUrlDoServidor("https://evolution.exemplo.com.br", {
    resolverDns: async () => {
      throw new Error("timeout");
    },
  });
  assertEquals(r.ok, false);
  assertEquals(r.motivo, "dns_nao_resolvido");
});

Deno.test("validarUrlDoServidor — aceita HTTPS público, sem credencial/query/fragmento", async () => {
  const r = await validarUrlDoServidor("https://evolution.exemplo.com.br", fake(["200.1.1.1"]));
  assertEquals(r.ok, true);
  assertEquals(r.origem, "https://evolution.exemplo.com.br");
});

Deno.test("validarUrlDoServidor — URL malformada não lança, recusa", async () => {
  const r = await validarUrlDoServidor("não-é-uma-url", fake(["200.1.1.1"]));
  assertEquals(r.ok, false);
  assertEquals(r.motivo, "url_invalida");
});

Deno.test("nomeRemotoDaInstancia — derivado do canal, estável", () => {
  assertEquals(nomeRemotoDaInstancia("abc-123"), "sinergica-abc-123");
  assertEquals(nomeRemotoDaInstancia("abc-123"), nomeRemotoDaInstancia("abc-123"));
});

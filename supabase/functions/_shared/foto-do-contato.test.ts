import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { atualizarFotoDoContato, mimeDaAssinatura, urlDoWhatsapp } from "./foto-do-contato.ts";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);
const TEXTO = new TextEncoder().encode("isso não é uma imagem, é um script");

Deno.test("mimeDaAssinatura — reconhece JPEG/PNG/WebP pela assinatura, não pelo nome", () => {
  assertEquals(mimeDaAssinatura(JPEG), "image/jpeg");
  assertEquals(mimeDaAssinatura(PNG), "image/png");
  assertEquals(mimeDaAssinatura(WEBP), "image/webp");
});

Deno.test("mimeDaAssinatura — recusa arquivo que não é imagem, mesmo que pequeno", () => {
  assertEquals(mimeDaAssinatura(TEXTO), null);
  assertEquals(mimeDaAssinatura(new Uint8Array(0)), null);
});

Deno.test("urlDoWhatsapp — aceita host do WhatsApp em HTTPS", () => {
  assertEquals(urlDoWhatsapp("https://pps.whatsapp.net/v/abc.jpg"), true);
  assertEquals(urlDoWhatsapp("https://mmg.whatsapp.net/foo"), true);
});

Deno.test("urlDoWhatsapp — recusa host fora do WhatsApp, HTTP, credencial embutida", () => {
  assertEquals(urlDoWhatsapp("https://evil.example.com/whatsapp.net"), false);
  assertEquals(urlDoWhatsapp("http://pps.whatsapp.net/v/abc.jpg"), false);
  assertEquals(urlDoWhatsapp("https://user:pass@pps.whatsapp.net/v/abc.jpg"), false);
  assertEquals(urlDoWhatsapp("não é uma url"), false);
});

function depsFake(opts: {
  podeConsultar?: boolean;
  fetchEvolution: typeof fetch;
}) {
  const chamadas: Array<{ conversaId: string; estado: string; mime: string | null; hash: string | null }> = [];
  const salvos: Array<{ caminho: string; mime: string }> = [];
  return {
    deps: {
      fetchEvolution: opts.fetchEvolution,
      reservarConsulta: async () => opts.podeConsultar ?? true,
      registrarResultado: async (
        conversaId: string,
        estado: "guardada" | "sem_foto" | "falhou",
        mime: string | null,
        hash: string | null,
      ) => {
        chamadas.push({ conversaId, estado, mime, hash });
      },
      salvarArquivo: async (caminho: string, _bytes: Uint8Array, mime: string) => {
        salvos.push({ caminho, mime });
      },
    },
    chamadas,
    salvos,
  };
}

function entradaFake() {
  return {
    canalId: "canal-1",
    conversaId: "conversa-1",
    remoteJid: "5511999999999@s.whatsapp.net",
    nomeRemoto: "sinergica-canal-1",
    tokenInstancia: "token",
    urlBaseEvolution: "https://evolution.exemplo.com.br",
  };
}

Deno.test("atualizarFotoDoContato — dentro da janela de 7 dias, não consulta", async () => {
  const { deps, chamadas } = depsFake({
    podeConsultar: false,
    fetchEvolution: async () => {
      throw new Error("não deveria chamar a Evolution");
    },
  });
  await atualizarFotoDoContato(entradaFake(), deps);
  assertEquals(chamadas.length, 0);
});

Deno.test("atualizarFotoDoContato — sem URL na resposta vira sem_foto", async () => {
  const { deps, chamadas } = depsFake({
    fetchEvolution: async () => new Response(JSON.stringify({}), { status: 200 }),
  });
  await atualizarFotoDoContato(entradaFake(), deps);
  assertEquals(chamadas[0]?.estado, "sem_foto");
});

Deno.test("atualizarFotoDoContato — URL fora do WhatsApp vira sem_foto (nunca baixa)", async () => {
  const { deps, chamadas } = depsFake({
    fetchEvolution: async () =>
      new Response(JSON.stringify({ profilePictureUrl: "https://evil.example.com/x.jpg" }), {
        status: 200,
      }),
  });
  await atualizarFotoDoContato(entradaFake(), deps);
  assertEquals(chamadas[0]?.estado, "sem_foto");
});

Deno.test("atualizarFotoDoContato — caminho feliz: baixa, confere assinatura, salva, hash", async () => {
  let chamadaN = 0;
  const { deps, chamadas, salvos } = depsFake({
    fetchEvolution: async () => {
      chamadaN += 1;
      if (chamadaN === 1) {
        return new Response(
          JSON.stringify({ profilePictureUrl: "https://pps.whatsapp.net/v/abc.jpg" }),
          { status: 200 },
        );
      }
      return new Response(JPEG, { status: 200 });
    },
  });
  await atualizarFotoDoContato(entradaFake(), deps);
  assertEquals(chamadas[0]?.estado, "guardada");
  assertEquals(chamadas[0]?.mime, "image/jpeg");
  assertEquals(typeof chamadas[0]?.hash, "string");
  assertEquals(chamadas[0]?.hash?.length, 64);
  assertEquals(salvos[0]?.caminho, "conversa-1.jpg");
});

Deno.test("atualizarFotoDoContato — arquivo baixado não é imagem de verdade vira falhou", async () => {
  let chamadaN = 0;
  const { deps, chamadas, salvos } = depsFake({
    fetchEvolution: async () => {
      chamadaN += 1;
      if (chamadaN === 1) {
        return new Response(
          JSON.stringify({ profilePictureUrl: "https://pps.whatsapp.net/v/abc.jpg" }),
          { status: 200 },
        );
      }
      return new Response(TEXTO, { status: 200 });
    },
  });
  await atualizarFotoDoContato(entradaFake(), deps);
  assertEquals(chamadas[0]?.estado, "falhou");
  assertEquals(salvos.length, 0);
});

Deno.test("atualizarFotoDoContato — qualquer exceção é engolida, vira falhou, nunca lança", async () => {
  const { deps, chamadas } = depsFake({
    fetchEvolution: async () => {
      throw new Error("rede caiu");
    },
  });
  await atualizarFotoDoContato(entradaFake(), deps); // não deve lançar
  assertEquals(chamadas[0]?.estado, "falhou");
});

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  avisoDaMensagem,
  extensaoPerigosa,
  limiteDe,
  midiaDaMensagem,
  mimeAceito,
  nomeParaChave,
  normalizarMime,
  sanearNome,
  textoDeAviso,
  textoDeMidiaNaoGuardada,
  textoParaAgente,
} from "./evolution-midia.ts";

Deno.test("normalizarMime — remove parâmetros e valida formato", () => {
  assertEquals(normalizarMime("image/jpeg; charset=binary"), "image/jpeg");
  assertEquals(normalizarMime("não é mime"), null);
  assertEquals(normalizarMime(42), null);
});

Deno.test("mimeAceito — por conteúdo", () => {
  assertEquals(mimeAceito("imagem", "image/jpeg"), true);
  assertEquals(mimeAceito("imagem", "application/pdf"), false);
  assertEquals(mimeAceito("documento", "application/pdf"), true);
  assertEquals(mimeAceito("video", "video/mp4"), true);
  assertEquals(mimeAceito("imagem", null), false);
});

Deno.test("limiteDe — imagem/figurinha 10MB, vídeo 16MB, documento 25MB", () => {
  assertEquals(limiteDe("imagem"), 10 * 1024 * 1024);
  assertEquals(limiteDe("figurinha"), 10 * 1024 * 1024);
  assertEquals(limiteDe("video"), 16 * 1024 * 1024);
  assertEquals(limiteDe("documento"), 25 * 1024 * 1024);
});

Deno.test("extensaoPerigosa — recusa executáveis, scripts, compactados, html/svg", () => {
  for (const nome of ["virus.exe", "script.js", "pacote.zip", "pagina.html", "imagem.svg", "x.PDF.exe"]) {
    assertEquals(extensaoPerigosa(nome), true, nome);
  }
  assertEquals(extensaoPerigosa("laudo.pdf"), false);
  assertEquals(extensaoPerigosa("foto.jpg"), false);
});

Deno.test("sanearNome — remove caminho, controle, limita tamanho, mantém extensão", () => {
  assertEquals(sanearNome("../../etc/passwd", "application/pdf", "REMOTE1"), "passwd.pdf");
  assertEquals(sanearNome(null, "image/jpeg", "REMOTE1"), "REMOTE1.jpg");
  assertEquals(sanearNome("relatorio.pdf", null, "REMOTE1"), "relatorio.pdf");
  const longo = sanearNome(`${"a".repeat(300)}.pdf`, null, "REMOTE1");
  assertEquals(longo.length <= 120, true);
});

Deno.test("nomeParaChave — ASCII seguro, sem acento", () => {
  assertEquals(nomeParaChave("relatório ação.pdf"), "relatorio_acao.pdf");
  assertEquals(nomeParaChave(""), "arquivo");
  assertEquals(nomeParaChave("####"), "arquivo");
});

Deno.test("midiaDaMensagem — imagem com legenda", () => {
  const r = midiaDaMensagem({ imageMessage: { mimetype: "image/jpeg", caption: "foto" } }, "R1");
  assertEquals(r?.conteudo, "imagem");
  assertEquals(r?.legenda, "foto");
  assertEquals(r?.mimeType, "image/jpeg");
});

Deno.test("midiaDaMensagem — figurinha NUNCA tem legenda", () => {
  const r = midiaDaMensagem({ stickerMessage: { mimetype: "image/webp", caption: "ignorado" } }, "R1");
  assertEquals(r?.conteudo, "figurinha");
  assertEquals(r?.legenda, null);
});

Deno.test("midiaDaMensagem — documento com nome e tamanho", () => {
  const r = midiaDaMensagem(
    { documentMessage: { mimetype: "application/pdf", fileName: "laudo.pdf", fileLength: 12345 } },
    "R1",
  );
  assertEquals(r?.conteudo, "documento");
  assertEquals(r?.nome, "laudo.pdf");
  assertEquals(r?.tamanhoDeclarado, 12345);
});

Deno.test("midiaDaMensagem — desembrulha ephemeralMessage/viewOnceMessage", () => {
  const r = midiaDaMensagem(
    { ephemeralMessage: { message: { viewOnceMessage: { message: { imageMessage: { caption: "x" } } } } } },
    "R1",
  );
  assertEquals(r?.conteudo, "imagem");
});

Deno.test("midiaDaMensagem — null para mensagem sem mídia", () => {
  assertEquals(midiaDaMensagem({ conversation: "oi" }, "R1"), null);
});

Deno.test("avisoDaMensagem — localização, contato, enquete, outro", () => {
  assertEquals(avisoDaMensagem({ locationMessage: {} }), "localizacao");
  assertEquals(avisoDaMensagem({ contactMessage: {} }), "contato");
  assertEquals(avisoDaMensagem({ pollCreationMessageV2: {} }), "enquete");
  assertEquals(avisoDaMensagem({ eventMessage: {} }), "outro");
  assertEquals(avisoDaMensagem({ conversation: "oi" }), null);
});

Deno.test("textoParaAgente — figurinha, com legenda, sem legenda", () => {
  assertEquals(textoParaAgente({ conteudo: "figurinha", mimeType: "", nome: "x.webp", tamanhoDeclarado: null, legenda: null }), "[figurinha]");
  assertEquals(
    textoParaAgente({ conteudo: "imagem", mimeType: "image/jpeg", nome: "x.jpg", tamanhoDeclarado: null, legenda: "paguei a avaliação" }),
    "[imagem] legenda: paguei a avaliação",
  );
  assertEquals(
    textoParaAgente({ conteudo: "imagem", mimeType: "image/jpeg", nome: "x.jpg", tamanhoDeclarado: null, legenda: null }),
    null,
  );
});

Deno.test("textoDeMidiaNaoGuardada — motivo e legenda", () => {
  assertEquals(
    textoDeMidiaNaoGuardada(
      { conteudo: "imagem", mimeType: "", nome: "x", tamanhoDeclarado: null, legenda: null },
      "acima_do_limite",
    ),
    "[imagem acima do limite]",
  );
  assertEquals(
    textoDeMidiaNaoGuardada(
      { conteudo: "documento", mimeType: "", nome: "x", tamanhoDeclarado: null, legenda: "segue" },
      "tipo_nao_aceito",
    ),
    "[documento de tipo não aceito] legenda: segue",
  );
});

Deno.test("textoDeAviso — rótulos fixos", () => {
  assertEquals(textoDeAviso("localizacao"), "[localização]");
  assertEquals(textoDeAviso("outro"), "[mensagem de tipo não suportado]");
});

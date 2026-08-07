// Helper compartilhado de PDF de relatório — cabeçalho com marca (faixa navy + logo + filete
// laranja) e rodapé (empresa + página/total + data), com paginação automática. Extraído de 3
// cópias quase idênticas em RelatorioClientePage/RelatorioDiarioPage/RelatorioPlanejamentoPage
// (E01-S139). Cores replicam `apps/web/src/index.css` (--color-navy/--color-orange/--color-ink).
import { PDFDocument, type PDFImage, type PDFPage, StandardFonts, rgb } from "pdf-lib";

const PAGINA_LARGURA = 595.28; // A4 em pontos
const PAGINA_ALTURA = 841.89;
const MARGEM_X = 42;
const ALTURA_CABECALHO = 64;
const ALTURA_RODAPE = 56;
const LARGURA_MAX_LINHA = 88;

const NAVY = rgb(0x1c / 255, 0x27 / 255, 0x48 / 255);
const ORANGE = rgb(0xe8 / 255, 0x73 / 255, 0x1b / 255);
const INK = rgb(0.1, 0.12, 0.16);
const INK_3 = rgb(0.55, 0.56, 0.61);
const BRANCO = rgb(1, 1, 1);
const SUBTITULO_CLARO = rgb(0.82, 0.85, 0.92);
const LINHA_RODAPE = rgb(0.88, 0.88, 0.88);

const LOGO_URL = "/logos/logo-horizontal-branco.png";

export interface RelatorioPdfOptions {
  titulo: string;
  subtitulo?: string;
}

export interface RelatorioPdfBuilder {
  escreverParagrafo(texto: string): void;
  escreverTexto(texto: string): void;
  finalizar(): Promise<Uint8Array>;
}

async function carregarLogo(pdf: PDFDocument): Promise<PDFImage | null> {
  try {
    const resposta = await fetch(LOGO_URL);
    if (!resposta.ok) return null;
    return await pdf.embedPng(await resposta.arrayBuffer());
  } catch {
    return null;
  }
}

export async function criarRelatorioPdf(
  options: RelatorioPdfOptions,
): Promise<RelatorioPdfBuilder> {
  const pdf = await PDFDocument.create();
  const fonte = await pdf.embedFont(StandardFonts.Helvetica);
  const fonteNegrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await carregarLogo(pdf);
  const logoAltura = 18;
  const logoLargura = logo ? (logo.width / logo.height) * logoAltura : 0;
  const textoInicioX = MARGEM_X + (logo ? logoLargura + 18 : 0);

  function desenharCabecalho(pagina: PDFPage): void {
    pagina.drawRectangle({
      x: 0,
      y: PAGINA_ALTURA - ALTURA_CABECALHO,
      width: PAGINA_LARGURA,
      height: ALTURA_CABECALHO,
      color: NAVY,
    });
    pagina.drawRectangle({
      x: 0,
      y: PAGINA_ALTURA - ALTURA_CABECALHO - 3,
      width: PAGINA_LARGURA,
      height: 3,
      color: ORANGE,
    });
    if (logo) {
      pagina.drawImage(logo, {
        x: MARGEM_X,
        y: PAGINA_ALTURA - ALTURA_CABECALHO / 2 - logoAltura / 2,
        width: logoLargura,
        height: logoAltura,
      });
    }
    pagina.drawText(options.titulo, {
      x: textoInicioX,
      y: PAGINA_ALTURA - 28,
      size: 13,
      font: fonteNegrito,
      color: BRANCO,
    });
    if (options.subtitulo) {
      pagina.drawText(options.subtitulo, {
        x: textoInicioX,
        y: PAGINA_ALTURA - 44,
        size: 9,
        font: fonte,
        color: SUBTITULO_CLARO,
      });
    }
  }

  function novaPagina(): PDFPage {
    const pagina = pdf.addPage([PAGINA_LARGURA, PAGINA_ALTURA]);
    desenharCabecalho(pagina);
    return pagina;
  }

  let pagina = novaPagina();
  let y = PAGINA_ALTURA - ALTURA_CABECALHO - 28;

  function escreverParagrafo(texto: string): void {
    const partes = texto.match(new RegExp(`.{1,${LARGURA_MAX_LINHA}}(?:\\s|$)`, "g")) ?? [texto];
    for (const parte of partes) {
      if (y < ALTURA_RODAPE) {
        pagina = novaPagina();
        y = PAGINA_ALTURA - ALTURA_CABECALHO - 28;
      }
      pagina.drawText(parte.trim(), { x: MARGEM_X, y, size: 10, font: fonte, color: INK });
      y -= 16;
    }
  }

  function escreverTexto(texto: string): void {
    for (const linha of texto.split("\n")) escreverParagrafo(linha);
  }

  async function finalizar(): Promise<Uint8Array> {
    const paginas = pdf.getPages();
    const total = paginas.length;
    const geradoEm = new Date().toLocaleDateString("pt-BR");
    for (const [indice, p] of paginas.entries()) {
      p.drawLine({
        start: { x: MARGEM_X, y: 40 },
        end: { x: PAGINA_LARGURA - MARGEM_X, y: 40 },
        thickness: 0.5,
        color: LINHA_RODAPE,
      });
      p.drawText("Sinérgica Manutenções", {
        x: MARGEM_X,
        y: 26,
        size: 8,
        font: fonte,
        color: INK_3,
      });
      const rotulo = `Página ${indice + 1} de ${total} · gerado em ${geradoEm}`;
      const larguraRotulo = fonte.widthOfTextAtSize(rotulo, 8);
      p.drawText(rotulo, {
        x: PAGINA_LARGURA - MARGEM_X - larguraRotulo,
        y: 26,
        size: 8,
        font: fonte,
        color: INK_3,
      });
    }
    return pdf.save();
  }

  return { escreverParagrafo, escreverTexto, finalizar };
}

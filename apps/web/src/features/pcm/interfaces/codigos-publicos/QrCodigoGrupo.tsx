import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "../../../../lib/supabase-client";

type Props = { userId: string; clienteId: string; ativoId: string; tipo: "grupo_quantitativo" | "sistema" | "componente"; codigo: string };

export function QrCodigoGrupo(props: Props) {
  if (props.tipo === "grupo_quantitativo" ? import.meta.env.VITE_SSO_QR_CODIGO_GRUPO_ENABLED !== "true" : import.meta.env.VITE_SSO_QR_CODIGO_ATIVO_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.tipo, props.ativoId, props.codigo])} {...props} />;
}

function Conteudo({ userId, clienteId, ativoId, tipo, codigo }: Props) {
  const trava = useRef(false);
  const geracao = useRef(0);
  useEffect(() => () => { geracao.current++; }, []);
  const [imagem, setImagem] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  async function conferir() {
    const antes = await supabase.auth.getUser();
    if (antes.error || antes.data.user?.id !== userId) throw new Error("Sessão alterada.");
    const { data, error } = await supabase.schema("pcm").rpc("sso_localizar_codigo_com_grupo", { p_cliente_id: clienteId, p_codigo: codigo });
    if (error || !data || data.situacao !== "encontrado" || data.tipo !== tipo || data.ativoId !== ativoId) throw new Error("Código indisponível ou ambíguo.");
    if (tipo === "grupo_quantitativo") {
      if (data.codigoAtual !== codigo || data.codigoHistorico !== false) throw new Error("Código atual divergente.");
    } else if (import.meta.env.VITE_SSO_CODIGO_ATUAL_MEDIADO_ENABLED === "true") {
      const atual = await supabase.schema("pcm").rpc("sso_consultar_codigo_atual_mediado", { p_ator_id: userId, p_cliente_id: clienteId, p_tipo: tipo, p_ativo_id: ativoId });
      if (atual.error || atual.data?.tipo !== tipo || atual.data?.ativoId !== ativoId || atual.data?.codigo !== codigo) throw new Error("Código atual divergente.");
    } else {
      const q = tipo === "sistema"
        ? supabase.schema("pcm").from("sistemas").select("codigo").eq("cliente_id", clienteId).eq("id", ativoId).is("deleted_at", null).maybeSingle()
        : supabase.schema("pcm").from("equipamentos").select("identificador").eq("client_id", clienteId).eq("id", ativoId).is("deleted_at", null).maybeSingle();
      const atual = await q;
      const valor = atual.data && ("codigo" in atual.data ? atual.data.codigo : "identificador" in atual.data ? atual.data.identificador : null);
      if (atual.error || valor !== codigo) throw new Error("Código atual divergente.");
    }
    const depois = await supabase.auth.getUser();
    if (depois.error || depois.data.user?.id !== userId) throw new Error("Sessão alterada.");
  }
  async function gerar() {
    if (trava.current) return;
    const atual = geracao.current;
    trava.current = true; setOcupado(true); setImagem(null); setAviso("");
    try {
      await conferir();
      // O QR contém somente o código público; não incorpora URL, token ou dados do Cliente.
      const png = await QRCode.toDataURL(codigo, { errorCorrectionLevel: "M", margin: 4, width: 512, type: "image/png" });
      await conferir();
      if (geracao.current !== atual) return;
      setImagem(png);
    } catch { if (geracao.current === atual) setAviso("Não foi possível gerar o QR com o código atual. Confira acesso e tente novamente."); }
    finally { trava.current = false; if (geracao.current === atual) setOcupado(false); }
  }
  async function baixar() {
    if (trava.current || !imagem) return;
    const atual = geracao.current;
    trava.current = true; setOcupado(true); setAviso("");
    try {
      await conferir();
      if (geracao.current !== atual) return;
      const link = document.createElement("a"); link.href = imagem; link.download = `codigo-${ativoId}.png`; link.click();
    } catch { if (geracao.current === atual) { setImagem(null); setAviso("Código ou acesso não puderam ser confirmados; gere o QR novamente."); } }
    finally { trava.current = false; if (geracao.current === atual) setOcupado(false); }
  }
  async function baixarEtiqueta() {
    if (trava.current || !imagem) return;
    const atual = geracao.current;
    trava.current = true; setOcupado(true); setAviso("");
    let url: string | null = null;
    try {
      await conferir();
      const { PDFDocument, StandardFonts } = await import("pdf-lib");
      const pdf = await PDFDocument.create();
      const pagina = pdf.addPage([595.28, 841.89]);
      const fonte = await pdf.embedFont(StandardFonts.Helvetica);
      const qr = await pdf.embedPng(imagem);
      pagina.drawText("Etiqueta de identificacao", { x: 42, y: 790, size: 14, font: fonte });
      pagina.drawImage(qr, { x: 42, y: 570, width: 200, height: 200 });
      // A fonte padrão não suporta todo Unicode; não substituir ou truncar código.
      const textoImprimivel = /^[\x20-\x7e]+$/.test(codigo);
      if (textoImprimivel) {
        let linha = ""; let y = 548;
        for (const caractere of codigo) {
          const proxima = linha + caractere;
          if (linha && fonte.widthOfTextAtSize(proxima, 9) > 500) { pagina.drawText(linha, { x: 42, y, size: 9, font: fonte }); linha = caractere; y -= 13; }
          else linha = proxima;
        }
        if (linha) pagina.drawText(linha, { x: 42, y, size: 9, font: fonte });
      } else pagina.drawText("Codigo completo no QR; confira o texto no sistema.", { x: 42, y: 548, size: 9, font: fonte });
      const bytes = await pdf.save();
      await conferir();
      if (geracao.current !== atual) return;
      url = URL.createObjectURL(new Blob([new Uint8Array(bytes).buffer], { type: "application/pdf" }));
      const link = document.createElement("a"); link.href = url; link.download = `etiqueta-${ativoId}.pdf`; link.click();
      if (!textoImprimivel) setAviso("O código contém caracteres não impressos no texto do PDF; o QR contém o código completo. Confira a leitura antes de aplicar.");
    } catch { if (geracao.current === atual) setAviso("Não foi possível gerar a etiqueta. Confira código e acesso."); }
    finally { if (url) setTimeout(() => URL.revokeObjectURL(url!), 1000); trava.current = false; if (geracao.current === atual) setOcupado(false); }
  }
  return <section aria-label="QR Code do cadastro"><h4>QR Code do cadastro</h4>
    <p>Contém somente o código público {codigo}. Gerar ou baixar não registra aplicação de etiqueta.</p>
    <button type="button" disabled={ocupado} onClick={() => void gerar()}>Gerar QR Code</button>
    {imagem && <><img src={imagem} width={192} height={192} alt={`QR Code do código ${codigo}`} /><button type="button" disabled={ocupado} onClick={() => void baixar()}>Baixar QR Code PNG</button><button type="button" disabled={ocupado} onClick={() => void baixarEtiqueta()}>Baixar etiqueta PDF</button></>}
    {ocupado && <output>Conferindo código…</output>}{aviso && <p role="alert">{aviso}</p>}
  </section>;
}

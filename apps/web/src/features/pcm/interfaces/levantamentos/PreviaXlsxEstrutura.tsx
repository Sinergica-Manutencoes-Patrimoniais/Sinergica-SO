import { useEffect, useRef, useState } from "react";
import { conferirEstruturaXlsxIsolada } from "../../infrastructure/estrutura-xlsx-isolada";
import { gerarModeloEstruturaXlsx } from "../../infrastructure/modelo-estrutura-xlsx";
import { COLUNAS_ESTRUTURA } from "../../application/importacao-estrutura-csv";

type Resultado = Awaited<ReturnType<typeof conferirEstruturaXlsxIsolada>>;
type AcaoExperimental = (entrada: { bytes: Uint8Array; aba: string; origem: string }) => Promise<string>;

/** Prévia local; recepção só aparece quando o chamador a habilita explicitamente. */
export function PreviaXlsxEstrutura({ enviarExperimental, reconciliarExperimental, enviarLocalDeclarado, clienteId, permitirRecepcao = false }: { enviarExperimental?: AcaoExperimental; reconciliarExperimental?: AcaoExperimental; enviarLocalDeclarado?: AcaoExperimental; clienteId?: string; permitirRecepcao?: boolean } = {}) {
  const controle = useRef<AbortController | null>(null);
  const arquivo = useRef<Uint8Array | null>(null);
  const sequencia = useRef(0);
  const [abas, setAbas] = useState<string[]>([]);
  const [aba, setAba] = useState("");
  const [hash, setHash] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [pagina, setPagina] = useState(0);
  const [somentePendencias, setSomentePendencias] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [origem, setOrigem] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  const [aviso, setAviso] = useState("");
  const trava = useRef(false);
  useEffect(() => () => { sequencia.current++; controle.current?.abort(); arquivo.current = null; }, []);

  async function baixarModelo() {
    if (ocupado || trava.current) return;
    const atual = sequencia.current;
    trava.current = true; setOcupado(true); setErro("");
    try {
      const modelo = await gerarModeloEstruturaXlsx();
      if (atual !== sequencia.current) return;
      const url = URL.createObjectURL(modelo);
      try {
        const link = document.createElement("a"); link.href = url; link.download = "modelo-levantamento-estrutura.xlsx"; link.click();
      } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch { if (atual === sequencia.current) setErro("Não foi possível gerar o modelo XLSX."); }
    finally { trava.current = false; if (atual === sequencia.current) setOcupado(false); }
  }

  async function abrir(file: File | undefined) {
    const atual = ++sequencia.current;
    controle.current?.abort();
    const abortador = new AbortController();
    controle.current = abortador;
    arquivo.current = null;
    setAbas([]); setAba(""); setHash(""); setResultado(null); setPagina(0); setSomentePendencias(false); setErro(""); setConfirmado(false); setAviso("");
    if (!file) { setOcupado(false); return; }
    setOcupado(true);
    try {
      if (!/\.xlsx$/i.test(file.name) || file.size < 1 || file.size > 5_242_880) throw new Error("Arquivo inválido.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (abortador.signal.aborted || atual !== sequencia.current) return;
      const resposta = await conferirEstruturaXlsxIsolada(bytes, null, abortador.signal);
      if (abortador.signal.aborted || atual !== sequencia.current) return;
      arquivo.current = bytes;
      setAbas(resposta.abas);
      setHash(resposta.sha256);
    } catch {
      if (!abortador.signal.aborted && atual === sequencia.current) setErro("Não foi possível ler a planilha. Confira o arquivo e tente novamente.");
    } finally { if (atual === sequencia.current) setOcupado(false); }
  }
  async function conferir() {
    const bytes = arquivo.current;
    if (!bytes || !abas.includes(aba) || ocupado) return;
    const atual = ++sequencia.current;
    controle.current?.abort();
    const abortador = new AbortController();
    controle.current = abortador;
    setOcupado(true); setResultado(null); setPagina(0); setErro("");
    try {
      const resposta = await conferirEstruturaXlsxIsolada(bytes, aba, abortador.signal);
      if (abortador.signal.aborted || atual !== sequencia.current) return;
      if (resposta.sha256 !== hash) throw new Error("Arquivo divergente.");
      setResultado(resposta);
    } catch {
      if (!abortador.signal.aborted && atual === sequencia.current) setErro("Não foi possível conferir a aba. Verifique o modelo e tente novamente.");
    } finally { if (atual === sequencia.current) setOcupado(false); }
  }
  async function executar(acao: AcaoExperimental) {
    const bytes = arquivo.current;
    const fonte = origem.trim();
    if (trava.current || ocupado || !bytes || !resultado?.diagnosticos || resultado.aba !== aba || resultado.sha256 !== hash || !fonte || !confirmado) return;
    const atual = sequencia.current;
    trava.current = true; setOcupado(true); setErro(""); setAviso("");
    try {
      const mensagem = await acao({ bytes: new Uint8Array(bytes), aba, origem: fonte });
      if (atual === sequencia.current) setAviso(mensagem);
    } catch (e) {
      if (atual === sequencia.current) setErro(e instanceof Error ? e.message : "Resultado não confirmado. Confira a tentativa antes de repetir.");
    } finally { trava.current = false; if (atual === sequencia.current) setOcupado(false); }
  }
  const diagnosticos = resultado?.diagnosticos ?? [];
  const pendencias = diagnosticos.filter((item) => item.erros.length > 0 || item.alertas.length > 0);
  const comErro = diagnosticos.filter((item) => item.erros.length > 0).length;
  const somenteAlertas = diagnosticos.filter((item) => item.erros.length === 0 && item.alertas.length > 0).length;
  const semPendenciasLocais = diagnosticos.length - comErro - somenteAlertas;
  const exibidos = somentePendencias ? pendencias : diagnosticos;
  const paginaAtual = Math.min(pagina, Math.max(0, Math.ceil(exibidos.length / 50) - 1));
  return <section aria-label="Prévia experimental de planilha XLSX">
    <h3>Conferir planilha XLSX</h3>
    <p>{permitirRecepcao && enviarExperimental ? "A prévia é local; o envio separado exige confirmação. A conferência pelo PCM continua necessária." : "Prévia local: nenhum arquivo, lote ou cadastro será enviado. A conferência pelo PCM ainda é necessária."}</p>
    <p>O modelo está vazio e prepara até 1.000 linhas como texto, exceto quantidade. Confira os códigos e zeros ao editar ou colar dados. Tipos aceitos: area, local, sublocal, sistema, equipamento, componente e grupo_quantitativo.</p>
    <button type="button" disabled={ocupado} onClick={() => void baixarModelo()}>Baixar modelo XLSX</button>
    <label>Arquivo XLSX <input type="file" accept=".xlsx" disabled={ocupado} onChange={(evento) => void abrir(evento.target.files?.[0])} /></label>
    {abas.length > 0 && <><label>Aba <select value={aba} disabled={ocupado} onChange={(evento) => { setAba(evento.target.value); setResultado(null); setPagina(0); setConfirmado(false); }}>
      <option value="">Selecione</option>{abas.map((nome) => <option key={nome} value={nome}>{nome}</option>)}
    </select></label><button type="button" disabled={ocupado || !aba} onClick={() => void conferir()}>Conferir aba</button></>}
    {ocupado && <output>Processando planilha…</output>}
    {erro && <p role="alert">{erro}</p>}
    {resultado?.diagnosticos && <><p>{resultado.diagnosticos.length} registro(s) na aba {resultado.aba}. A prévia não valida códigos ou vínculos no cadastro oficial.</p>
      <p>Conferência estrutural local: {comErro} com erro, {somenteAlertas} somente com alertas e {semPendenciasLocais} sem pendências locais. Isso não identifica registros novos, alterados ou rejeitados no cadastro oficial.</p>
      <label><input type="checkbox" checked={somentePendencias} onChange={(evento) => { setSomentePendencias(evento.target.checked); setPagina(0); }} /> Mostrar somente erros e alertas ({pendencias.length})</label>
      <p>{exibidos.length} registro(s) nesta seleção · página {paginaAtual + 1} de {Math.max(1, Math.ceil(exibidos.length / 50))}.</p>
      {exibidos.length === 0 ? <p>Nenhum registro nesta seleção.</p> : <ol>{exibidos.slice(paginaAtual * 50, (paginaAtual + 1) * 50).map((item) => <li key={item.numero}>Registro {item.numero} · {item.chave || "chave ausente"} · {item.tipo || "tipo ausente"} · {item.erros.length ? item.erros.join(" ") : "estrutura apta à conferência"}{item.alertas.length ? ` · ${item.alertas.join(" ")}` : ""}
        <details><summary>Conferir valores do registro {item.numero}</summary>
          <p>Valores lidos da planilha; vínculos e códigos não foram validados no cadastro oficial.</p>
          <dl>{item.celulas.map((valor, indice) => <div key={indice}><dt>{COLUNAS_ESTRUTURA[indice] ?? `Coluna extra ${indice + 1}`}</dt><dd style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{valor || "—"}</dd></div>)}</dl>
        </details>
      </li>)}</ol>}
      {exibidos.length > 50 && <nav aria-label="Páginas da conferência XLSX">
        <button type="button" disabled={paginaAtual === 0} onClick={() => setPagina(paginaAtual - 1)}>Página anterior</button>{" "}
        <button type="button" disabled={(paginaAtual + 1) * 50 >= exibidos.length} onClick={() => setPagina(paginaAtual + 1)}>Próxima página</button>
      </nav>}
    </>}
    {permitirRecepcao && resultado?.diagnosticos && (enviarExperimental || reconciliarExperimental || enviarLocalDeclarado) && <section aria-label="Recepção de estrutura para conferência">
      <p>A recepção exige conferência e aprovação do PCM; não altera diretamente o cadastro oficial.</p>
      {clienteId && <p>Cliente em contexto: {clienteId}</p>}
      <label>Identificação da origem <input disabled={ocupado} maxLength={200} value={origem} onChange={(evento) => { setOrigem(evento.target.value); setConfirmado(false); }} /></label>
      <label><input type="checkbox" disabled={ocupado} checked={confirmado} onChange={(evento) => setConfirmado(evento.target.checked)} /> Conferi arquivo, aba, origem e Cliente.</label>
      {enviarExperimental && <button type="button" disabled={ocupado || !origem.trim() || !confirmado} onClick={() => void executar(enviarExperimental)}>Receber para conferência</button>}
      {reconciliarExperimental && <button type="button" disabled={ocupado || !origem.trim() || !confirmado} onClick={() => void executar(reconciliarExperimental)}>Reconciliar tentativa</button>}
      {enviarLocalDeclarado && <><p>Alternativa declarada: o navegador extrai os dados da planilha. O servidor recebe as linhas, mas não verifica o arquivo original nem sua origem. Lote permanece pendente de revisão.</p><button type="button" disabled={ocupado || !origem.trim() || !confirmado || comErro > 0} onClick={() => void executar(enviarLocalDeclarado)}>Receber dados extraídos localmente</button></>}
    </section>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}

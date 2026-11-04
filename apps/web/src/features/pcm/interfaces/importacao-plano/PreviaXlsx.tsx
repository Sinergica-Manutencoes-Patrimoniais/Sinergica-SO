import { useEffect, useRef, useState } from "react";
import { prepararXlsxCronograma } from "../../application/preparar-xlsx-cronograma";
import { gerarModeloCronogramaXlsx } from "../../infrastructure/modelo-cronograma-xlsx";
import { AvisosXlsx } from "./AvisosXlsx";
import { ProgramacaoLinha } from "./ProgramacaoLinha";

type Resultado = Awaited<ReturnType<typeof prepararXlsxCronograma>>;

/** Envio opcional e controlado pela composição; não aprova nem incorpora. */
export function PreviaXlsx({ fonteId, clienteId, enviarExperimental, reconciliarExperimental, usarMatrizDeclarada, aoAlterarBloqueio }: { fonteId: string; clienteId: string; enviarExperimental?: (bytes: Uint8Array) => Promise<void>; reconciliarExperimental?: (bytes: Uint8Array) => Promise<void>; usarMatrizDeclarada?: (matriz: (string | number | boolean | null)[][]) => void; aoAlterarBloqueio?: (bloqueado: boolean) => void }) {
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [pagina, setPagina] = useState(0);
  const [cienteOmissoes, setCienteOmissoes] = useState(false);
  const [estado, setEstado] = useState<"vazio" | "lendo" | "erro" | "pronto">("vazio");
  const leitura = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const sequencia = useRef(0);
  const original = useRef<Uint8Array | null>(null);
  const ocupado = useRef(false);
  const [envio, setEnvio] = useState<"ocioso" | "enviando" | "reconciliando" | "incerto" | "guardado">("ocioso");
  const [reconciliada, setReconciliada] = useState(false);
  const bloqueado = envio === "enviando" || envio === "reconciliando";
  const [gerandoModelo, setGerandoModelo] = useState(false);
  const [erroModelo, setErroModelo] = useState(false);
  const tentativaIncerta = envio === "incerto";
  useEffect(() => {
    aoAlterarBloqueio?.(bloqueado || tentativaIncerta);
    return () => aoAlterarBloqueio?.(false);
  }, [aoAlterarBloqueio, bloqueado, tentativaIncerta]);
  useEffect(() => {
    original.current = null; setEnvio("ocioso"); setReconciliada(false); setResultado(null); setPagina(0); setCienteOmissoes(false); setEstado("vazio"); setGerandoModelo(false); setErroModelo(false);
    if (input.current) input.current.value = "";
    return () => { sequencia.current++; leitura.current?.abort(); };
  }, [clienteId, fonteId]);
  const descartar = () => {
    if (ocupado.current || tentativaIncerta) return;
    sequencia.current++; leitura.current?.abort(); leitura.current = null;
    original.current = null; setEnvio("ocioso"); setReconciliada(false); setResultado(null); setPagina(0); setCienteOmissoes(false); setEstado("vazio");
    if (input.current) input.current.value = "";
  };
  async function baixarModelo() {
    if (ocupado.current || gerandoModelo) return;
    ocupado.current = true; setGerandoModelo(true); setErroModelo(false);
    const atual = sequencia.current;
    try {
      const modelo = await gerarModeloCronogramaXlsx();
      if (atual !== sequencia.current) return;
      const url = URL.createObjectURL(modelo);
      try { const link = document.createElement("a"); link.href = url; link.download = "modelo-cronograma-plano.xlsx"; link.click(); }
      finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch { if (atual === sequencia.current) setErroModelo(true); }
    finally { ocupado.current = false; if (atual === sequencia.current) setGerandoModelo(false); }
  }
  return <section aria-label="Prévia XLSX local">
    <p>{enviarExperimental ? "Prévia local de cronograma. O arquivo só será enviado ao confirmar a ação de envio." : "Prévia local de cronograma. Nenhum arquivo ou dado é enviado nesta etapa."}</p>
    <p>O modelo não define o calendário contratual: preencha a data de S01 na linha 4 e acrescente apenas as semanas aplicáveis.</p>
    <button type="button" disabled={gerandoModelo || bloqueado || tentativaIncerta} onClick={() => void baixarModelo()}>Baixar modelo XLSX de cronograma</button>
    {erroModelo && <p role="alert">Não foi possível gerar o modelo. Tente novamente.</p>}
    <label>Arquivo XLSX do cronograma
      <input ref={input} type="file" accept=".xlsx" disabled={bloqueado || tentativaIncerta} onChange={async (evento) => {
        const arquivo = evento.currentTarget.files?.[0];
        leitura.current?.abort(); const atual = ++sequencia.current;
        original.current = null; setEnvio("ocioso"); setReconciliada(false); setResultado(null); setPagina(0); setCienteOmissoes(false);
        if (!arquivo) { setEstado("vazio"); return; }
        if (!arquivo.name.toLowerCase().endsWith(".xlsx") || arquivo.size === 0 || arquivo.size > 5_242_880) { setEstado("erro"); return; }
        const controle = new AbortController(); leitura.current = controle; setEstado("lendo");
        try {
          const bytes = new Uint8Array(await arquivo.arrayBuffer());
          controle.signal.throwIfAborted();
          const resposta = await prepararXlsxCronograma(bytes, fonteId, clienteId, controle.signal);
          if (atual === sequencia.current && !controle.signal.aborted) { original.current = bytes; setResultado(resposta); setEstado("pronto"); }
        } catch {
          if (atual === sequencia.current && !controle.signal.aborted) setEstado("erro");
        }
      }} />
    </label>
    {estado === "lendo" && <p role="status">Lendo arquivo…</p>}
    {estado === "erro" && <p role="alert">Arquivo inválido ou não pôde ser lido. Nenhum dado foi enviado.</p>}
    {resultado && resultado.previa.estado === "pendente" && <AvisosXlsx estado="pendente" itens={resultado.previa.pendencias} />}
    {resultado && resultado.previa.estado === "conferivel" && <>
      <p>{resultado.previa.linhas.length} linhas prontas para conferência local; ainda não foram importadas.</p>
      <p>Alvos e recorrências não foram mapeados nesta prévia. Uma marcação X indica programação, não execução.</p>
      <AvisosXlsx estado="conferivel" itens={resultado.previa.avisos} />
      {usarMatrizDeclarada && resultado.matriz && <>
        <p>Alternativa manual: copie os valores lidos para a matriz de conferência. O servidor não recebe nem autentica o XLSX; confira a matriz antes de guardá-la.</p>
        {resultado.previa.avisos.length > 0 && <label><input type="checkbox" checked={cienteOmissoes} onChange={(evento) => setCienteOmissoes(evento.target.checked)} /> Estou ciente de que fórmulas e erros auxiliares serão omitidos da matriz; os valores calculados não serão importados.</label>}
        <button type="button" disabled={bloqueado || tentativaIncerta || (resultado.previa.avisos.length > 0 && !cienteOmissoes)} onClick={() => usarMatrizDeclarada(structuredClone(resultado.matriz!))}>Usar valores na matriz manual</button>
      </>}
      <section aria-label="Linhas da prévia XLSX">
        <h4>Linhas do cronograma</h4>
        <p>Página {pagina + 1} de {Math.max(1, Math.ceil(resultado.previa.linhas.length / 50))}.</p>
        <ul>{resultado.previa.linhas.slice(pagina * 50, (pagina + 1) * 50).map(({ original, conferencia }) => <li key={original.numeroLinha}>
          Linha {original.numeroLinha} · disciplina {String(original.disciplina ?? "")} · código {String(original.codigoOriginal ?? "")} · periodicidade {String(original.periodicidadeOriginal ?? "")}
          {" "}· tempo {conferencia.tempo?.estado === "tempo_a_validar" ? "a validar" : conferencia.tempo?.estado === "informado" ? `${conferencia.tempo.horas} h` : "inválido"}
          {" "}· pendências {conferencia.erros.join(", ") || "nenhuma sinalizada"}
          <ProgramacaoLinha semanas={conferencia.semanas} />
        </li>)}</ul>
        {resultado.previa.linhas.length > 50 && <nav aria-label="Páginas da prévia XLSX">
          <button type="button" disabled={pagina === 0} onClick={() => setPagina((atual) => atual - 1)}>Página anterior</button>{" "}
          <button type="button" disabled={(pagina + 1) * 50 >= resultado.previa.linhas.length} onClick={() => setPagina((atual) => atual + 1)}>Próxima página</button>
        </nav>}
      </section>
      {enviarExperimental && original.current && envio !== "guardado" && <button type="button" disabled={bloqueado} onClick={async () => {
        if (ocupado.current || !original.current) return;
        ocupado.current = true; const atual = sequencia.current; const bytes = new Uint8Array(original.current);
        setEnvio("enviando"); setReconciliada(false);
        try { await enviarExperimental(bytes); if (atual === sequencia.current) setEnvio("guardado"); }
        catch { if (atual === sequencia.current) setEnvio("incerto"); }
        finally { ocupado.current = false; }
      }}>{envio === "incerto" ? "Repetir envio" : envio === "enviando" ? "Enviando…" : "Enviar para conferência"}</button>}
      {envio === "incerto" && <p role="alert">Resultado não confirmado. O arquivo selecionado permanece preservado nesta tela; repita a mesma tentativa ou procure suporte antes de trocar a seleção.</p>}
      {envio === "incerto" && reconciliarExperimental && original.current && <button type="button" onClick={async () => {
        if (ocupado.current || !original.current) return;
        ocupado.current = true; const atual = sequencia.current; const bytes = new Uint8Array(original.current);
        setEnvio("reconciliando"); setReconciliada(false);
        try { await reconciliarExperimental(bytes); if (atual === sequencia.current) { setEnvio("incerto"); setReconciliada(true); } }
        catch { if (atual === sequencia.current) setEnvio("incerto"); }
        finally { ocupado.current = false; }
      }}>Reconciliar tentativa</button>}
      {reconciliada && <p role="status">Tentativa reconciliada; confira e repita o envio.</p>}
      {envio === "guardado" && <p role="status">Arquivo guardado em staging, ainda não aprovado nem incorporado.</p>}
    </>}
    {estado !== "vazio" && <button type="button" disabled={bloqueado || tentativaIncerta} onClick={descartar}>Descartar seleção</button>}
  </section>;
}

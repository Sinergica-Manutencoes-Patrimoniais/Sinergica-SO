import { useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import { PrepararParcelas } from "./PrepararParcelas";
import {
  type PrepararOrcamento,
  supabaseOrcamentoOperacionalAdapter,
  validarPrepararOrcamento,
} from "../../infrastructure/supabase-orcamento-operacional-adapter";

type Props = {
  usuario: string;
  cliente: string;
  propostaId: string;
  propostaRevisao: number;
  listaId: string;
  listaRevisao: number;
  permitirEdicao: boolean;
  aoSalvar: () => void;
};
/** A RPC permanece sem EXECUTE para papéis de aplicação até a revisão. */
export function PrepararOrcamentoOperacional(props: Props) {
  const [modoRecuperacao,setModoRecuperacao]=useState<"manual" | "parcelas" | null>(null);
  const [,atualizar]=useState(0);
  let manualPendente: boolean, parcelasPendentes: boolean;
  try {
    manualPendente=sessionStorage.getItem(`sso-composicao-orcamento:${JSON.stringify([props.usuario,props.cliente,props.propostaId])}`)!==null;
    parcelasPendentes=sessionStorage.getItem(`sso-composicao-parcelas:${JSON.stringify([props.usuario,props.cliente,props.propostaId])}`)!==null;
  } catch {
    return <p role="alert">Não foi possível conferir operações pendentes. Procure suporte antes de criar outra composição.</p>;
  }
  const aoSalvar=()=>{setModoRecuperacao(null);atualizar((v)=>v+1);props.aoSalvar();};
  if(manualPendente && parcelasPendentes && !modoRecuperacao) return <section aria-label="Recuperação de composições">
    <p role="alert">Existem tentativas pendentes nos dois modos de composição. Confira e reconcilie uma por vez; não crie outra até resolver ambas.</p>
    <button type="button" onClick={()=>setModoRecuperacao("manual")}>Conferir tentativa manual</button>
    <button type="button" onClick={()=>setModoRecuperacao("parcelas")}>Conferir tentativa por parcelas</button>
  </section>;
  if(parcelasPendentes && (!manualPendente || modoRecuperacao==="parcelas")) return <PrepararParcelas {...props} aoSalvar={aoSalvar} />;
  if(manualPendente && (!parcelasPendentes || modoRecuperacao==="manual")) return <Conteudo key={JSON.stringify([props.usuario,props.cliente,props.propostaId,props.listaId])} {...props} aoSalvar={aoSalvar} />;
  if (import.meta.env.VITE_SSO_ORCAMENTO_PARCELAS_ENABLED === "true") return <PrepararParcelas {...props} aoSalvar={aoSalvar} />;
  return (
    <Conteudo
      key={JSON.stringify([
        props.usuario,
        props.cliente,
        props.propostaId,
        props.propostaRevisao,
        props.listaId,
        props.listaRevisao,
      ])}
      {...props}
      aoSalvar={aoSalvar}
    />
  );
}
function Conteudo({ usuario, cliente, propostaId, propostaRevisao, listaId, listaRevisao, permitirEdicao, aoSalvar }: Props) {
  const chave = `sso-composicao-orcamento:${JSON.stringify([usuario, cliente, propostaId])}`;
  const [descricao, setDescricao] = useState("");
  const [custo, setCusto] = useState("");
  const [adicional, setAdicional] = useState("0");
  const [fator, setFator] = useState("1.5");
  const [preco, setPreco] = useState("");
  const [pendente, setPendente] = useState<PrepararOrcamento | "invalido" | null>(() => {
    try {
      const salvo = sessionStorage.getItem(chave);
      if (!salvo) return null;
      const pedido = validarPrepararOrcamento(JSON.parse(salvo));
      return pedido.propostaId === propostaId && pedido.listaId === listaId ? pedido : "invalido";
    } catch { return "invalido"; }
  });
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const enviando = useRef(false);
  // Mesma fórmula positiva em centavos do servidor; prévia não substitui validação/piso da RPC.
  function calcularSugestao(): string | null {
    if (!/^\d{1,13}$/.test(custo) || !/^\d{1,13}$/.test(adicional) || !/^\d{1,3}(?:\.\d{1,4})?$/.test(fator)) return null;
    const [inteiro = "0", frac = ""] = fator.split(".");
    const multiplicador = BigInt(inteiro) * 10000n + BigInt(frac.padEnd(4, "0"));
    if (multiplicador < 10000n || multiplicador > 1000000n) return null;
    const aquisicao = BigInt(custo), operacional = BigInt(adicional);
    if (aquisicao > 1000000000000n || operacional > 1000000000000n) return null;
    const sugerido = (aquisicao * multiplicador + 5000n) / 10000n + operacional;
    return sugerido <= 1000000000000n ? sugerido.toString() : null;
  }
  const sugestao = calcularSugestao();
  const formatoReal = (centavos: string) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(centavos) / 100);
  async function enviar(comando: PrepararOrcamento) {
    if (enviando.current) return;
    try {
      if (sessionStorage.getItem(chave) !== JSON.stringify(comando)) throw new Error("Tentativa divergente.");
    } catch { setErro("Tentativa local alterada ou indisponível. Procure suporte antes de repetir."); return; }
    enviando.current = true;
    setOcupado(true);
    setErro("");
    try {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== usuario || sessionStorage.getItem(chave) !== JSON.stringify(comando))
        throw new Error("Sessão ou tentativa alterada.");
      await supabaseOrcamentoOperacionalAdapter.preparar(comando);
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== usuario) throw new Error("Sessão alterada.");
      if (sessionStorage.getItem(chave) !== JSON.stringify(comando)) throw new Error("Tentativa local divergente.");
      sessionStorage.removeItem(chave);
      setPendente(null);
      aoSalvar();
    } catch {
      setErro(
        "Não foi possível confirmar. Tente novamente com os mesmos dados; não feche esta tela até conferir a operação.",
      );
    } finally {
      enviando.current = false;
      setOcupado(false);
    }
  }
  function iniciar() {
    if (!permitirEdicao || pendente || enviando.current) return;
    try {
      if (![custo, adicional, fator, preco].every((v) => v.trim() !== ""))
        throw new Error("Campos obrigatórios.");
      const comando = validarPrepararOrcamento({
        requestId: crypto.randomUUID(),
        propostaId,
        expectedRevision: propostaRevisao,
        listaId,
        listaRevision: listaRevisao,
        descricao,
        custoAquisicaoCentavos: Number(custo),
        custosOperacionaisCentavos: Number(adicional),
        fator: Number(fator),
        precoCentavos: Number(preco),
      });
      if (sessionStorage.getItem(chave)) throw new Error("Tentativa anterior pendente.");
      sessionStorage.setItem(chave, JSON.stringify(comando));
      setPendente(comando);
      void enviar(comando);
    } catch {
      setErro("Confira descrição, fator, valores em centavos e armazenamento da tentativa.");
    }
  }
  if (!permitirEdicao && !pendente) return null;
  return (
    <section aria-label="Preparar orçamento operacional">
      <p>Composição interna. Esta etapa não envia proposta, cria OS nem gera cobrança.</p>
      {erro && <p role="alert">{erro}</p>}
      {pendente === "invalido" ? (
        <p role="alert">Tentativa local ilegível ou divergente; procure suporte antes de criar outra.</p>
      ) : pendente ? (
        <div><p>Resultado anterior não confirmado. Repita a mesma tentativa; não crie outra composição. O servidor revalida sua autorização e somente retorna a operação anterior se ela foi registrada.</p>
        <button type="button" disabled={ocupado} onClick={() => void enviar(pendente)}>
          Tentar salvar novamente
        </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            iniciar();
          }}
        >
          <label>
            Descrição do fornecimento
            <textarea
              required
              maxLength={4000}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </label>
          <label>
            Custo de aquisição em centavos
            <input
              type="number"
              min="0"
              step="1"
              required
              value={custo}
              onChange={(e) => setCusto(e.target.value)}
            />
          </label>
          <label>
            Custos operacionais em centavos
            <input
              type="number"
              min="0"
              step="1"
              required
              value={adicional}
              onChange={(e) => setAdicional(e.target.value)}
            />
          </label>
          <label>
            Fator de preço
            <input
              type="number"
              min="1"
              max="100"
              step="0.0001"
              required
              value={fator}
              onChange={(e) => setFator(e.target.value)}
            />
          </label>
          <label>
            Preço de venda em centavos
            <input
              type="number"
              min="0"
              step="1"
              required
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
            />
          </label>
          {sugestao !== null ? <p>Preço sugerido: {formatoReal(sugestao)} ({sugestao} centavos). A validação de piso e autorização é feita no servidor.</p> : <p>Informe custos inteiros em centavos e fator entre 1 e 100; a sugestão não pode ultrapassar 1 trilhão de centavos.</p>}
          <button type="button" disabled={sugestao === null || ocupado} onClick={() => { if (sugestao !== null) setPreco(sugestao); }}>Usar preço sugerido</button>
          {/^\d{1,13}$/.test(preco) && BigInt(preco) <= 1000000000000n && <p>Preço de venda informado: {formatoReal(preco)}.</p>}
          <button type="submit" disabled={ocupado}>
            Salvar composição
          </button>
        </form>
      )}
    </section>
  );
}

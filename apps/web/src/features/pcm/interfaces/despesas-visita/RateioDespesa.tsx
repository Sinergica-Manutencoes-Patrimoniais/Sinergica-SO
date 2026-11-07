import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { dividirRateioIgual } from "../../domain/despesas-visita";
import { consultarOsParaRateio, consultarRateio, ratearDespesa, validarRateioDespesa,
  type RatearDespesa as Pedido, type DespesaVisitaListada } from "../../infrastructure/supabase-despesas-visita-adapter";

type Props = { userId: string; clienteId: string; visitaId: string; despesa: DespesaVisitaListada };
export function RateioDespesa(props: Props) {
  if (import.meta.env.VITE_SSO_RATEIO_DESPESAS_VISITA_ENABLED !== "true" || props.despesa.status !== "ativa") return null;
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.visitaId, props.despesa.id])} {...props} />;
}
function Conteudo({ userId, clienteId, visitaId, despesa }: Props) {
  const chave = `sso-rateio-despesa:${userId}:${clienteId}:${visitaId}:${despesa.id}`;
  const cliente = useQueryClient();
  const enviando = useRef(false);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [remover, setRemover] = useState(false);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [confirmarCarga, setConfirmarCarga] = useState(false);
  const [baseEdicao, setBaseEdicao] = useState(() => ({ revisao: despesa.revisao, total: despesa.realizadoCentavos ?? despesa.previstoCentavos }));
  const [mensagem, setMensagem] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try { const salvo = sessionStorage.getItem(chave); if (!salvo) return null;
      const pedido = validarRateioDespesa(JSON.parse(salvo));
      return pedido.despesaId === despesa.id && pedido.visitaId === visitaId ? pedido : "invalido";
    } catch { return "invalido"; }
  });
  const os = useInfiniteQuery({ queryKey: ["despesas-visita", userId, clienteId, visitaId, "rateio-os"],
    initialPageParam: null as { sequencia: number; id: string } | null,
    queryFn: ({ pageParam, signal }) => consultarOsParaRateio(clienteId, visitaId, pageParam, signal),
    getNextPageParam: (pagina) => pagina.length === 100 ? { sequencia: pagina[pagina.length - 1]!.sequencia, id: pagina[pagina.length - 1]!.id } : undefined, gcTime: 0 });
  const atual = useQuery({ queryKey: ["despesas-visita", userId, clienteId, visitaId, despesa.id, "rateio"],
    queryFn: () => consultarRateio(despesa.id), gcTime: 0 });
  const enviar = useMutation({ mutationFn: async (pedido: Pedido) => {
      if (sessionStorage.getItem(chave) !== JSON.stringify(pedido)) throw new Error("Tentativa divergente.");
      return ratearDespesa(pedido);
    },
    onSuccess: async (_resultado, pedido) => {
      await cliente.invalidateQueries({ queryKey: ["despesas-visita", userId, clienteId, visitaId] });
      try { if (sessionStorage.getItem(chave) !== JSON.stringify(pedido)) { setMensagem("Rateio salvo, mas tentativa local divergiu. Contate suporte."); return; } sessionStorage.removeItem(chave); } catch { setMensagem("Rateio salvo, mas tentativa local não pôde ser removida. Contate suporte."); return; }
      setPendente(null); setValores({}); setSelecionadas([]); setMensagem("Rateio registrado.");
    }, onError: () => setMensagem("Resultado não confirmado. Repita a mesma tentativa e consulte suporte antes de sair."), onSettled: () => { enviando.current = false; },
  });
  function registrar(pedido: Pedido) {
    if (enviando.current) return;
    try { const existente = sessionStorage.getItem(chave); const novo = JSON.stringify(pedido);
      if (existente !== null && existente !== novo) { setMensagem("Há outra tentativa pendente; procure suporte antes de enviar novo rateio."); return; }
      if (existente === null && pendente) { setMensagem("Tentativa pendente indisponível; procure suporte antes de repetir."); return; }
      if (existente === null) sessionStorage.setItem(chave, novo); } catch { setMensagem("Não foi possível guardar a tentativa; rateio não enviado."); return; }
    enviando.current = true; setPendente(pedido); setMensagem(""); enviar.mutate(pedido);
  }
  const total = despesa.realizadoCentavos ?? despesa.previstoCentavos;
  const baseAlterada = baseEdicao.revisao !== despesa.revisao || baseEdicao.total !== total;
  const entradas = Object.values(valores).map((v) => v.trim()).filter(Boolean);
  const valoresValidos = entradas.every((v) => /^\d{1,16}$/.test(v) && BigInt(v) <= BigInt(Number.MAX_SAFE_INTEGER));
  const somaPrevia = valoresValidos ? entradas.reduce((soma, valor) => soma + BigInt(valor), 0n) : null;
  const ordens = os.data?.pages.flat() ?? [];
  const listaCompleta = !!os.data && !os.hasNextPage && !os.isFetching && !os.isError;
  return <section aria-label={`Rateio da despesa ${despesa.id}`}>
    <h5>Rateio por OS</h5>
    <p>Total a ratear ({despesa.realizadoCentavos === null ? "previsto" : "realizado"}): {total} centavos. Deixe todos vazios para remover rateio.</p>
    {baseAlterada && <p role="alert">A despesa mudou desde o início da edição. Valores digitados foram preservados; confira a nova revisão e o total antes de continuar. <button type="button" disabled={!!pendente || os.isFetching || atual.isFetching || os.isError || atual.isError} onClick={() => setBaseEdicao({ revisao: despesa.revisao, total })}>Conferi a nova base</button></p>}
    {entradas.length > 0 && somaPrevia !== null && <p>Soma informada: {somaPrevia.toString()} centavos; {somaPrevia === BigInt(total) ? "soma igual à base" : "soma diferente da base"}. A conferência não substitui validação no servidor.</p>}
    {entradas.length > 0 && somaPrevia === null && <p role="alert">Há valor inválido ou acima do limite permitido.</p>}
    {(os.isError || atual.isError) && <p role="alert">Não foi possível consultar as OS e o rateio atual.</p>}
    {os.hasNextPage && <p>Carregue todas as OS antes de registrar o rateio. O servidor permite até 100 parcelas por despesa.</p>}
    {os.hasNextPage && <button type="button" disabled={os.isFetching} onClick={() => void os.fetchNextPage()}>Carregar mais OS</button>}
    {!atual.isFetching && !atual.isError && atual.data?.some((p) => !p.vinculo_vigente) && <p role="alert">Rateio atual contém OS não vigente; requer revisão operacional.</p>}
    {!atual.isFetching && !atual.isError && atual.data && atual.data.length > 0 && <p>Rateio registrado: {atual.data.map((p) => `${p.os_id}: ${p.valor_centavos} centavos`).join("; ")}</p>}
    {listaCompleta && !atual.isFetching && !atual.isError && atual.data && atual.data.length > 0 && <div>
      <p>Carregar o rateio atual preenche a edição; não altera a despesa até novo registro.</p>
      {atual.data.some((p) => !p.vinculo_vigente || !ordens.some((item) => item.id === p.vinculo_id)) ?
        <p role="alert">O rateio atual contém vínculo não vigente ou não encontrado na lista. Revise a situação antes de carregá-lo.</p> : <>
          {confirmarCarga && <p role="alert">Os valores digitados serão substituídos. Confirme para continuar.</p>}
          <button type="button" disabled={!!pendente || enviar.isPending || baseAlterada} onClick={() => {
            if (Object.values(valores).some((valor) => valor.trim()) && !confirmarCarga) { setConfirmarCarga(true); return; }
            setValores(Object.fromEntries(atual.data!.map((parcela) => [parcela.vinculo_id, String(parcela.valor_centavos)])));
            setSelecionadas(atual.data!.map((parcela) => parcela.vinculo_id)); setRemover(false); setConfirmarCarga(false);
            setMensagem("Rateio atual carregado para edição. Confira e registre para aplicar alterações.");
          }}>{confirmarCarga ? "Confirmar substituição dos valores" : "Carregar rateio atual"}</button>
          {confirmarCarga && <button type="button" onClick={() => setConfirmarCarga(false)}>Cancelar substituição</button>}
        </>}
    </div>}
    <form onSubmit={(e) => {
      e.preventDefault(); if (baseAlterada || pendente || enviar.isPending || enviando.current || !listaCompleta || !atual.data || atual.isFetching || atual.isError) return;
      try {
        const parcelas = ordens.flatMap((item) => {
          const v = (valores[item.id] ?? "").trim();
          if (!v) return [];
          if (!/^\d+$/.test(v)) throw new Error("Valor inválido");
          return [{ vinculoId: item.id, valorCentavos: Number(v) }];
        });
        const soma = parcelas.reduce((acc, p) => acc + p.valorCentavos, 0);
        if (!Number.isSafeInteger(soma) || (parcelas.length > 0 && soma !== total) ||
          (parcelas.length === 0 && !remover)) throw new Error("Soma inválida");
        registrar(validarRateioDespesa({ requestId: crypto.randomUUID(), despesaId: despesa.id,
          visitaId, expectedRevision: despesa.revisao, parcelas }));
      } catch { setMensagem("Informe parcelas em centavos cuja soma corresponda ao total da despesa."); }
    }}>
      <fieldset disabled={baseAlterada || !!pendente || enviar.isPending || !listaCompleta || atual.isPending || atual.isFetching || atual.isError}>
        {listaCompleta && ordens.length > 0 && <fieldset>
          <legend>Dividir igualmente entre OS selecionadas</legend>
          <p>O restante em centavos é distribuído pela ordem dos identificadores. A divisão substitui os valores digitados e não salva o rateio.</p>
          {ordens.map((item) => <label key={item.id}>
            <input type="checkbox" checked={selecionadas.includes(item.id)} onChange={(e) => setSelecionadas((atuais) => e.target.checked ? [...atuais, item.id] : atuais.filter((id) => id !== item.id))} />
            Selecionar {item.numero} — {item.titulo}
          </label>)}
          <button type="button" disabled={selecionadas.length === 0} onClick={() => {
            try {
              const parcelas = dividirRateioIgual(total, selecionadas);
              setValores(Object.fromEntries(parcelas.map((p) => [p.osId, String(p.valorCentavos)])));
              setRemover(false);
              setMensagem("Valores calculados. Confira antes de registrar.");
            } catch {
              setMensagem("Não foi possível calcular a divisão. Confira a seleção e o total.");
            }
          }}>Calcular divisão igual</button>
        </fieldset>}
        {listaCompleta && ordens.map((item) => <label key={item.id}>{item.numero} — {item.titulo} <input inputMode="numeric"
          value={valores[item.id] ?? ""} onChange={(e) => { setConfirmarCarga(false); setValores((anteriores) => ({ ...anteriores, [item.id]: e.target.value })); }} /></label>)}
        <label><input type="checkbox" checked={remover} onChange={(e) => setRemover(e.target.checked)} /> Confirmo remover o rateio quando todas as parcelas estiverem vazias</label>
        <button type="submit">Registrar rateio</button>
      </fieldset>
    </form>
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Contate suporte.</p>}
    {pendente && pendente !== "invalido" && <button type="button" disabled={enviar.isPending} onClick={() => registrar(pendente)}>Repetir tentativa</button>}
    {mensagem && <p role="status">{mensagem}</p>}
  </section>;
}

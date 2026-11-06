import { registrarDespesaVisitaSchema, type RegistrarDespesaVisita } from "@sinergica/shared";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import { criarDespesaVisita } from "../../application/despesas-visita";
import { supabaseCapacidadesSsoAdapter } from "../../infrastructure/supabase-capacidades-sso-adapter";
import {
  listarCategoriasDespesa,
  listarDespesasVisita,
  supabaseDespesasVisitaAdapter,
} from "../../infrastructure/supabase-despesas-visita-adapter";
import { EditarPrevisao } from "./EditarPrevisao";
import { DeclararRepasse } from "./DeclararRepasse";
import { BaixarComprovante } from "./BaixarComprovante";
import { RateioDespesa } from "./RateioDespesa";
import { CorrigirRealizada } from "./CorrigirRealizada";
import { CorrigirValorComprovante } from "./CorrigirValorComprovante";
import { HistoricoComprovantes } from "./HistoricoComprovantes";
import { ResumoDespesas } from "./ResumoDespesas";
import { RelatorioClienteDespesas } from "./RelatorioClienteDespesas";
import { AtribuirTecnico } from "./AtribuirTecnico";
import { RealizarDespesa } from "./RealizarDespesa";
import { ConferenciaDespesa } from "./ConferenciaDespesa";
import { HistoricoRateio } from "./HistoricoRateio";
import { RecuperarAtribuicoesTecnico } from "./RecuperarAtribuicoesTecnico";
import { RecuperarCorrecoesMediadas } from "./RecuperarCorrecoesMediadas";

/** Não ativar a flag antes da migration e dos gates de autorização/RLS. */
export function DespesasVisitaWorkspace({
  userId,
  clienteId,
  visitaId,
  habilitado,
}: { userId: string; clienteId: string; visitaId: string; habilitado: boolean }) {
  const raiz = ["despesas-visita", userId, clienteId, visitaId] as const;
  async function conferirSessao(signal?: AbortSignal) {
    const { data, error } = await supabase.auth.getUser();
    if (error || data.user?.id !== userId || signal?.aborted) throw new Error("Sessão alterada.");
  }
  const permissao = useQuery({
    queryKey: [...raiz, "permissao"],
    queryFn: async ({ signal }) => {
      await conferirSessao(signal);
      const resultado = await supabaseCapacidadesSsoAdapter.autorizarAcao("despesa_visita.gerir", clienteId);
      await conferirSessao(signal);
      return resultado;
    },
    enabled: habilitado,
    gcTime: 0,
    refetchOnWindowFocus: true,
  });
  const permitido =
    habilitado && permissao.data === true && !permissao.isFetching && !permissao.isError;
  const despesas = useInfiniteQuery({
    queryKey: [...raiz, "lista"],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      await conferirSessao(signal);
      const pagina = await listarDespesasVisita(clienteId, visitaId, pageParam, signal);
      await conferirSessao(signal);
      return pagina;
    },
    getNextPageParam: (pagina) =>
      pagina.length === 20 ? pagina[pagina.length - 1]?.id : undefined,
    enabled: permitido,
    gcTime: 0,
  });
  if (!habilitado) return null;
  if (permissao.isFetching || permissao.isPending)
    return <output>Verificando acesso às despesas…</output>;
  if (permissao.isError)
    return (
      <p role="alert">
        Não foi possível verificar acesso às despesas.{" "}
        <button type="button" onClick={() => void permissao.refetch()}>
          Tentar novamente
        </button>
      </p>
    );
  if (!permitido) return <p>Você não tem permissão para consultar despesas desta Visita.</p>;
  const moeda = (valor: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor / 100);
  return (
    <section aria-label="Despesas da Visita">
      <h4>Despesas da Visita</h4>
      {import.meta.env.VITE_SSO_RECIBO_TECNICO_DESPESA_ENABLED === "true" && <RecuperarAtribuicoesTecnico userId={userId} clienteId={clienteId} visitaId={visitaId} />}
      {import.meta.env.VITE_SSO_RECIBO_CORRECAO_MEDIADA_ENABLED === "true" && <RecuperarCorrecoesMediadas userId={userId} clienteId={clienteId} visitaId={visitaId}
        despesasVisiveis={!despesas.isFetching && !despesas.isError ? despesas.data?.pages.flat().map(item => item.id) ?? [] : []} />}
      <ResumoDespesas userId={userId} clienteId={clienteId} visitaId={visitaId} />
      <RelatorioClienteDespesas userId={userId} clienteId={clienteId} />
      <NovaDespesa
        key={JSON.stringify([userId, clienteId, visitaId])}
        userId={userId}
        clienteId={clienteId}
        visitaId={visitaId}
      />
      {(despesas.isPending || despesas.isFetching) && <output>Carregando despesas…</output>}
      {despesas.isError && (
        <p role="alert">
          Não foi possível carregar despesas.{" "}
          <button type="button" onClick={() => void despesas.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {despesas.data && (
        <div hidden={despesas.isFetching || despesas.isError}>
          {despesas.data?.pages.flat().length === 0 && <p>Nenhuma despesa registrada.</p>}
          <ul>
            {despesas.data?.pages.flat().map((item) => (
              <li key={item.id}>
                {item.data} — {item.descricao} — previsto {moeda(item.previstoCentavos)} — realizado{" "}
                {item.realizadoCentavos === null ? "não informado" : moeda(item.realizadoCentavos)}
                {item.status === "cancelada" ? " — cancelada" : ""}
                <EditarPrevisao
                  userId={userId}
                  clienteId={clienteId}
                  visitaId={visitaId}
                  despesa={item}
                />
                <RealizarDespesa userId={userId} clienteId={clienteId} visitaId={visitaId} despesa={item} />
                {item.realizadoCentavos !== null && <BaixarComprovante key={`${userId}:${clienteId}:${visitaId}:${item.id}`} userId={userId} clienteId={clienteId} visitaId={visitaId} despesaId={item.id} />}
                {item.realizadoCentavos !== null && <HistoricoComprovantes userId={userId} clienteId={clienteId} visitaId={visitaId} despesaId={item.id} />}
                <DeclararRepasse userId={userId} clienteId={clienteId} visitaId={visitaId} despesa={item} />
                <RateioDespesa userId={userId} clienteId={clienteId} visitaId={visitaId} despesa={item} />
                <ConferenciaDespesa userId={userId} clienteId={clienteId} visitaId={visitaId} despesaId={item.id} revisao={item.revisao} />
                <HistoricoRateio userId={userId} clienteId={clienteId} visitaId={visitaId} despesaId={item.id} revisao={item.revisao} />
                <CorrigirRealizada userId={userId} clienteId={clienteId} visitaId={visitaId} despesa={item} />
                <CorrigirValorComprovante userId={userId} clienteId={clienteId} visitaId={visitaId} despesa={item} />
                <AtribuirTecnico userId={userId} clienteId={clienteId} visitaId={visitaId} despesa={item} />
              </li>
            ))}
          </ul>
          {despesas.hasNextPage && (
            <button type="button" onClick={() => void despesas.fetchNextPage()}>
              Mais despesas
            </button>
          )}
        </div>
      )}
      <p>
        Recursos de despesas dependem de habilitação segura e validação antes do uso.
      </p>
    </section>
  );
}

function NovaDespesa({
  userId,
  clienteId,
  visitaId,
}: { userId: string; clienteId: string; visitaId: string }) {
  const chave = `sso-despesa-visita:${userId}:${clienteId}:${visitaId}`;
  const queryClient = useQueryClient();
  const enviando = useRef(false);
  const [categoria, setCategoria] = useState("");
  const [data, setData] = useState("");
  const [descricao, setDescricao] = useState("");
  const [centavos, setCentavos] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [pendente, setPendente] = useState<RegistrarDespesaVisita | "invalido" | null>(() => {
    try {
      const salvo = sessionStorage.getItem(chave);
      if (!salvo) return null;
      const pedido = registrarDespesaVisitaSchema.parse(JSON.parse(salvo));
      return pedido.visitaId === visitaId &&
        pedido.expectedRevision === undefined &&
        pedido.comprovantes.length === 0
        ? pedido
        : "invalido";
    } catch {
      return "invalido";
    }
  });
  const categorias = useInfiniteQuery({
    queryKey: ["despesas-visita", userId, clienteId, "categorias"],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const pagina = await listarCategoriasDespesa(pageParam, signal);
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      return pagina;
    },
    getNextPageParam: (pagina) => pagina.length === 100 ? pagina.at(-1)?.id : undefined,
    gcTime: 0,
  });
  const enviar = useMutation({
    mutationFn: async (pedido: RegistrarDespesaVisita) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || sessionStorage.getItem(chave) !== JSON.stringify(pedido)) throw new Error("Sessão ou tentativa alterada.");
      const resultado = await criarDespesaVisita(supabaseDespesasVisitaAdapter, pedido);
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId) throw new Error("Sessão alterada.");
      return resultado;
    },
    onSuccess: async (_resultado, pedido) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["despesas-visita", userId, clienteId, visitaId] }),
        queryClient.invalidateQueries({ queryKey: ["relatorio-despesas-cliente", userId, clienteId] }),
      ]);
      try {
        const atual = await supabase.auth.getUser();
        if (atual.error || atual.data.user?.id !== userId) throw new Error("Sessão alterada.");
        if (sessionStorage.getItem(chave) !== JSON.stringify(pedido)) {
          setMensagem("Registro salvo, mas a tentativa local divergiu. Contate suporte.");
          return;
        }
        sessionStorage.removeItem(chave);
      } catch {
        setMensagem(
          "Registro salvo, mas não foi possível limpar a tentativa local. Contate suporte.",
        );
        return;
      }
      setPendente(null);
      setDescricao("");
      setCentavos("");
      setMensagem("Despesa prevista registrada.");
    },
    onError: () =>
      setMensagem(
        "Resultado não confirmado. Repita a mesma tentativa; não crie outra despesa para este fato.",
      ),
    onSettled: () => { enviando.current = false; },
  });
  const enviarPedido = (pedido: RegistrarDespesaVisita) => {
    if (enviando.current) return;
    try {
      const anterior = sessionStorage.getItem(chave);
      const novo = JSON.stringify(pedido);
      if (anterior !== null && anterior !== novo) {
        setMensagem("Há outra tentativa pendente; procure suporte antes de registrar nova despesa.");
        return;
      }
      if (anterior === null && pendente) throw new Error("Tentativa ausente.");
      sessionStorage.setItem(chave, novo);
    } catch {
      setMensagem("Não foi possível guardar a tentativa com segurança; registro não enviado.");
      return;
    }
    enviando.current = true;
    setPendente(pedido);
    setMensagem("");
    enviar.mutate(pedido);
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (pendente || enviando.current || enviar.isPending || categorias.isFetching || categorias.isError || !categorias.data?.pages.flat().some((item) => item.id === categoria)) return;
        const parsed = registrarDespesaVisitaSchema.safeParse({
          requestId: crypto.randomUUID(),
          despesaId: crypto.randomUUID(),
          visitaId,
          categoriaId: categoria,
          data,
          descricao,
          previstoCentavos: /^\d+$/.test(centavos) ? Number(centavos) : NaN,
          realizadoCentavos: null,
          comprovantes: [],
        });
        if (!parsed.success) {
          setMensagem("Confira categoria, data, descrição e valor em centavos.");
          return;
        }
        enviarPedido(parsed.data);
      }}
    >
      <h5>Registrar previsão</h5>
      {categorias.isError && (
        <p role="alert">
          Categorias indisponíveis.{" "}
          <button type="button" onClick={() => void (categorias.isFetchNextPageError ? categorias.fetchNextPage() : categorias.refetch())}>
            Tentar novamente
          </button>
        </p>
      )}
      {categorias.hasNextPage && !categorias.isError && (
        <button type="button" disabled={categorias.isFetching} onClick={() => void categorias.fetchNextPage()}>
          Mais categorias
        </button>
      )}
      <fieldset
        disabled={!!pendente || enviar.isPending || categorias.isFetching || categorias.isError}
      >
        <label>
          Categoria{" "}
          <select required value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="">Selecione</option>
            {categorias.data?.pages.flat().map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
              </option>
            ))}
          </select>
        </label>
        <label>
          Data <input type="date" required value={data} onChange={(e) => setData(e.target.value)} />
        </label>
        <label>
          Descrição{" "}
          <input
            required
            maxLength={10000}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
        </label>
        <label>
          Valor previsto em centavos{" "}
          <input
            inputMode="numeric"
            required
            value={centavos}
            onChange={(e) => setCentavos(e.target.value)}
          />
        </label>
        <button type="submit">Registrar previsão</button>
      </fieldset>
      {pendente === "invalido" && (
        <p role="alert">
          Tentativa local ilegível. Contate suporte antes de registrar outra despesa.
        </p>
      )}
      {pendente && pendente !== "invalido" && (
        <div>
          <p>
            Tentativa pendente: {pendente.descricao}, {pendente.previstoCentavos} centavos. Dados
            são guardados nesta sessão para evitar duplicidade.
          </p>
          <button type="button" disabled={enviar.isPending} onClick={() => enviarPedido(pendente)}>
            Repetir tentativa
          </button>
        </div>
      )}
      {mensagem && <p role="status">{mensagem}</p>}
    </form>
  );
}

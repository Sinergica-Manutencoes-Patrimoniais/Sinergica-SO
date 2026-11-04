import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import { supabaseCapacidadesSsoAdapter } from "../../infrastructure/supabase-capacidades-sso-adapter";
import { EditorPersistido } from "./EditorPersistido";
import { PublicarPortal } from "./PublicarPortal";
import { VisibilidadePortal } from "./VisibilidadePortal";
import { ExcecoesOs } from "./ExcecoesOs";
import type { RascunhoEditorMateriais } from "./EditorMateriais";
import {
  DisponibilidadeMateriais,
  type RascunhoInformacaoMaterial,
} from "./DisponibilidadeMateriais";
import {
  type CriarListaMateriais,
  supabaseListasMateriaisAdapter,
  validarCriarListaMateriais,
} from "../../infrastructure/supabase-listas-materiais-adapter";

type Props = { usuario: string; cliente: string; ordemServico: string };
/** Integração condicionada a rollout e validação da migration, sem efeito sobre OS/Auvo. */
export function WorkspaceListasMateriais(props: Props) {
  return (
    <Conteudo key={JSON.stringify([props.usuario, props.cliente, props.ordemServico])} {...props} />
  );
}
function Conteudo({ usuario, cliente, ordemServico }: Props) {
  const chave = `sso-lista-materiais:${usuario}:${cliente}:${ordemServico}`;
  const [recuperacao] = useState(() => {
    try {
      const valor = sessionStorage.getItem(chave);
      const comando = valor ? validarCriarListaMateriais(JSON.parse(valor)) : null;
      if (comando && comando.ordemServicoId !== ordemServico) throw new Error("OS divergente");
      return { comando, falhou: false };
    } catch {
      return { comando: null, falhou: true };
    }
  });
  const [pendente, setPendente] = useState(recuperacao.comando);
  const [texto, setTexto] = useState("");
  const [responsavel, setResponsavel] = useState<"cliente" | "sinergica">("cliente");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [listaAberta, setListaAberta] = useState<string | null>(null);
  const [excecoesAbertas, setExcecoesAbertas] = useState(false);
  const rascunhos = useRef(new Map<string, RascunhoEditorMateriais>());
  const rascunhosInformacao = useRef(new Map<string, RascunhoInformacaoMaterial>());
  const emEnvio = useRef(false);
  const queryClient = useQueryClient();
  const raiz = ["listas-materiais", usuario, cliente, ordemServico] as const;
  const conferirSessao = async (signal?: AbortSignal) => {
    const atual = await supabase.auth.getUser();
    if (atual.error || atual.data.user?.id !== usuario || signal?.aborted) throw new Error("Sessão alterada.");
  };
  const permissao = useQuery({
    queryKey: [...raiz, "permissao"],
    queryFn: async ({ signal }) => { await conferirSessao(signal); const autorizada = await supabaseCapacidadesSsoAdapter.autorizarAcao("material.gerir", cliente); await conferirSessao(signal); return autorizada; },
    gcTime: 0,
    refetchOnWindowFocus: true,
  });
  const permitido = permissao.data === true && !permissao.isFetching && !permissao.isError;
  const listas = useInfiniteQuery({
    queryKey: [...raiz, "listas"],
    enabled: permitido,
    gcTime: 0,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      await conferirSessao(signal);
      const pagina = await supabaseListasMateriaisAdapter.listar(cliente, ordemServico, 20, pageParam, signal);
      await conferirSessao(signal);
      return pagina;
    },
    getNextPageParam: (pagina) => (pagina.length === 20 ? pagina.at(-1)?.id : undefined),
  });
  async function enviar(comando: CriarListaMateriais) {
    if (emEnvio.current || !permitido) return;
    try {
      if (sessionStorage.getItem(chave) !== JSON.stringify(comando)) throw new Error("Operação guardada divergente.");
    } catch {
      setErro("Operação pendente indisponível ou alterada. Consulte suporte.");
      return;
    }
    emEnvio.current = true;
    setOcupado(true);
    setErro("");
    try {
      await conferirSessao();
      if (sessionStorage.getItem(chave) !== JSON.stringify(comando) || comando.ordemServicoId !== ordemServico) throw new Error("Operação alterada.");
      await supabaseListasMateriaisAdapter.criar(comando);
      await conferirSessao();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [...raiz, "listas"] }),
        queryClient.invalidateQueries({ queryKey: ["listas-materiais-central", usuario, cliente] }),
      ]);
      await conferirSessao();
      if (sessionStorage.getItem(chave) !== JSON.stringify(comando))
        throw new Error("Operação guardada divergente.");
      sessionStorage.removeItem(chave);
      setPendente(null);
      setTexto("");
    } catch {
      setErro("Não foi possível confirmar o salvamento. Tente novamente com os mesmos dados.");
    } finally {
      emEnvio.current = false;
      setOcupado(false);
    }
  }
  function iniciar() {
    if (emEnvio.current || pendente || recuperacao.falhou || !permitido) return;
    try {
      const comando = validarCriarListaMateriais({
        requestId: crypto.randomUUID(),
        expectedRevision: 0,
        listaId: crypto.randomUUID(),
        ordemServicoId: ordemServico,
        responsavel,
        textoOriginal: texto,
      });
      if (sessionStorage.getItem(chave) !== null) throw new Error("Operação pendente.");
      sessionStorage.setItem(chave, JSON.stringify(comando));
      setPendente(comando);
      void enviar(comando);
    } catch {
      setErro(
        "Confira o texto e o armazenamento antes de salvar; não sobrescreva uma operação pendente.",
      );
    }
  }
  if (permissao.isFetching || permissao.isPending)
    return <output>Verificando acesso aos materiais...</output>;
  if (permissao.isError)
    return (
      <p role="alert">
        Não foi possível verificar acesso.{" "}
        <button type="button" onClick={() => void permissao.refetch()}>
          Tentar novamente
        </button>
      </p>
    );
  if (!permitido) return <p>Sem permissão para gerir materiais deste Cliente.</p>;
  const recebidos = listas.data?.pages.flat() ?? [];
  const ids = new Set(recebidos.map((lista) => lista.id.toLowerCase()));
  const paginasDivergentes = ids.size !== recebidos.length;
  const itens = listas.isFetching || listas.isError || paginasDivergentes ? [] : recebidos;
  return (
    <section aria-label="Listas de materiais da OS">
      <h3>Listas de materiais da OS</h3>
      <p>O texto original é preservado. Criar lista não altera a OS nem envia tarefa ao Auvo.</p>
      {import.meta.env.VITE_SSO_EXCECOES_MATERIAIS_OS_ENABLED === "true" && (
        <>
          <button type="button" aria-expanded={excecoesAbertas} onClick={() => setExcecoesAbertas((abertas) => !abertas)}>
            {excecoesAbertas ? "Ocultar exceções da OS" : "Consultar exceções da OS"}
          </button>
          {excecoesAbertas && <ExcecoesOs usuario={usuario} cliente={cliente} os={ordemServico} />}
        </>
      )}
      {recuperacao.falhou && (
        <p role="alert">
          Operação guardada inválida. Consulte o suporte antes de criar outra lista.
        </p>
      )}
      {erro && <p role="alert">{erro}</p>}
      {pendente && (
        <button type="button" disabled={ocupado} onClick={() => void enviar(pendente)}>
          Tentar salvar novamente
        </button>
      )}
      {!pendente && !recuperacao.falhou && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            iniciar();
          }}
        >
          <label>
            Responsável pelo material{" "}
            <select
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value as "cliente" | "sinergica")}
            >
              <option value="cliente">Cliente</option>
              <option value="sinergica">Sinérgica</option>
            </select>
          </label>
          <label>
            Texto original{" "}
            <textarea required value={texto} onChange={(e) => setTexto(e.target.value)} />
          </label>
          <button type="submit" disabled={ocupado}>
            Registrar lista
          </button>
        </form>
      )}
      {listas.isFetching && <output>Consultando listas...</output>}
      {listas.isError && (
        <p role="alert">
          Não foi possível carregar listas.{" "}
          <button type="button" onClick={() => void listas.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {!listas.isFetching && !listas.isError && paginasDivergentes && (
        <p role="alert">A lista mudou durante a consulta. <button type="button" onClick={() => void listas.refetch()}>Atualizar listas</button></p>
      )}
      {!listas.isFetching && !listas.isError && !paginasDivergentes && itens.length === 0 && (
        <p>Nenhuma lista cadastrada nesta OS.</p>
      )}
      <ul>
        {itens.map((lista) => (
          <li key={lista.id}>
            <p>
              Responsável: {lista.responsavel === "cliente" ? "Cliente" : "Sinérgica"} · Estado:{" "}
              {lista.estado} · Revisão: {lista.revisao}
            </p>
            <pre>{lista.texto_original}</pre>
            {[...rascunhosInformacao.current.entries()]
              .filter(
                ([chave]) =>
                  chave.startsWith(`${lista.id}:`) && chave !== `${lista.id}:${lista.revisao}`,
              )
              .map(([chave, rascunho]) => (
                <details key={chave}>
                  <summary>Informação não salva de revisão anterior</summary>
                  <p>
                    Confira e recadastre na revisão atual: {rascunho.tipo} · {rascunho.situacao} ·{" "}
                    {rascunho.motivo} · {rascunho.descricao} · linha{" "}
                    {rascunho.linha || "lista inteira"}
                  </p>
                </details>
              ))}
            {[...rascunhos.current.entries()]
              .filter(
                ([chave]) =>
                  chave.startsWith(`${lista.id}:`) && chave !== `${lista.id}:${lista.revisao}`,
              )
              .map(([chave, rascunho]) => (
                <details key={chave}>
                  <summary>Rascunho de revisão anterior: confira antes de editar novamente</summary>
                  <p>
                    A lista mudou; copie os dados necessários e revise a versão atual. O rascunho
                    não foi salvo.
                  </p>
                  <ul>
                    {rascunho.edicao.linhas.map((linha, indice) => (
                      <li key={indice}>
                        {linha.descricao} · {linha.quantidade ?? "quantidade não informada"} ·{" "}
                        {linha.unidade ?? "unidade não informada"}
                      </li>
                    ))}
                  </ul>
                  {rascunho.divisao && (
                    <p>
                      Divisão incompleta: {rascunho.divisao.primeira} · {rascunho.divisao.segunda}
                    </p>
                  )}
                  {rascunho.descricaoReunida && (
                    <p>Junção incompleta: {rascunho.descricaoReunida}</p>
                  )}
                  {rascunho.adicao && (
                    <p>Adição incompleta: {rascunho.adicao.descricao || "descrição não informada"}</p>
                  )}
                </details>
              ))}
            <button
              type="button"
              onClick={() => setListaAberta(listaAberta === lista.id ? null : lista.id)}
            >
              {listaAberta === lista.id ? "Fechar organização" : "Organizar linhas"}
            </button>
            {listaAberta === lista.id && (
              <>
                <EditorPersistido
                  usuario={usuario}
                  cliente={cliente}
                  ordemServico={ordemServico}
                  listaId={lista.id}
                  revisao={lista.revisao}
                  textoOriginal={lista.texto_original}
                  rascunho={rascunhos.current.get(`${lista.id}:${lista.revisao}`)}
                  onRascunho={(edicao) =>
                    rascunhos.current.set(`${lista.id}:${lista.revisao}`, edicao)
                  }
                  onSalvo={() => rascunhos.current.delete(`${lista.id}:${lista.revisao}`)}
                />
                <DisponibilidadeMateriais
                  usuario={usuario}
                  cliente={cliente}
                  ordemServico={ordemServico}
                  listaId={lista.id}
                  revisao={lista.revisao}
                  rascunho={rascunhosInformacao.current.get(`${lista.id}:${lista.revisao}`)}
                  onRascunho={(rascunho) =>
                    rascunhosInformacao.current.set(`${lista.id}:${lista.revisao}`, rascunho)
                  }
                  onSalvo={() => rascunhosInformacao.current.delete(`${lista.id}:${lista.revisao}`)}
                />
                <PublicarPortal usuario={usuario} cliente={cliente} ordemServico={ordemServico} listaId={lista.id} revisao={lista.revisao} />
                <VisibilidadePortal usuario={usuario} cliente={cliente} listaId={lista.id} />
              </>
            )}
          </li>
        ))}
      </ul>
      {!listas.isFetching && !listas.isError && !paginasDivergentes && listas.hasNextPage && (
        <button type="button" onClick={() => void listas.fetchNextPage()}>
          Carregar mais listas
        </button>
      )}
    </section>
  );
}

import { AvisoCarregando } from "@sinergica/ui";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { flagLigada } from "../../../../config/flags-sso";
import { supabase } from "../../../../lib/supabase-client";
import { supabaseCapacidadesSsoAdapter } from "../../infrastructure/supabase-capacidades-sso-adapter";
import {
  type CriarListaMateriais,
  supabaseListasMateriaisAdapter,
  validarCriarListaMateriais,
} from "../../infrastructure/supabase-listas-materiais-adapter";
import {
  DisponibilidadeMateriais,
  type RascunhoInformacaoMaterial,
} from "./DisponibilidadeMateriais";
import type { RascunhoEditorMateriais } from "./EditorMateriais";
import { EditorPersistido } from "./EditorPersistido";
import { ExcecoesOs } from "./ExcecoesOs";
import { HistoricoVersoes } from "./HistoricoVersoes";
import { PublicarPortal } from "./PublicarPortal";
import { rotuloEstadoListaMaterial } from "./ResumoListaMaterial";
import { VisibilidadePortal } from "./VisibilidadePortal";

export type RascunhoNovaLista = {
  texto: string;
  responsavel: "cliente" | "sinergica";
};

const RASCUNHO_NOVA_LISTA_INICIAL: RascunhoNovaLista = {
  texto: "",
  responsavel: "cliente",
};

type EstadoEnvio =
  | { fase: "enviando" | "incerto"; comando: CriarListaMateriais }
  | { fase: "confirmado"; limpezaFalhou: boolean };

const enviosEmCurso = new Set<string>();
const eventosEnvio = new EventTarget();

function publicarEnvio(chave: string, estado: EstadoEnvio) {
  eventosEnvio.dispatchEvent(new CustomEvent(chave, { detail: estado }));
}

type Props = {
  usuario: string;
  cliente: string;
  ordemServico: string;
  rascunho?: RascunhoNovaLista;
  onAlterarRascunho?: (rascunho: RascunhoNovaLista) => void;
};
/** Integração condicionada a rollout e validação da migration, sem efeito sobre OS/Auvo. */
export function WorkspaceListasMateriais(props: Props) {
  return (
    <Conteudo key={JSON.stringify([props.usuario, props.cliente, props.ordemServico])} {...props} />
  );
}
function Conteudo({ usuario, cliente, ordemServico, rascunho, onAlterarRascunho }: Props) {
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
  const [rascunhoLocal, setRascunhoLocal] = useState(RASCUNHO_NOVA_LISTA_INICIAL);
  const { texto, responsavel } = rascunho ?? rascunhoLocal;
  const alterarRascunho = onAlterarRascunho ?? setRascunhoLocal;
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(() => enviosEmCurso.has(chave));
  const [limpezaFalhou, setLimpezaFalhou] = useState(false);
  const [listaAberta, setListaAberta] = useState<string | null>(null);
  const [excecoesAbertas, setExcecoesAbertas] = useState(false);
  const rascunhos = useRef(new Map<string, RascunhoEditorMateriais>());
  const rascunhosInformacao = useRef(new Map<string, RascunhoInformacaoMaterial>());
  useEffect(() => {
    function receber(evento: Event) {
      const estado = (evento as CustomEvent<EstadoEnvio>).detail;
      setOcupado(estado.fase === "enviando");
      if (estado.fase === "confirmado") {
        setPendente(null);
        if (!onAlterarRascunho) setRascunhoLocal({ texto: "", responsavel });
        setLimpezaFalhou(estado.limpezaFalhou);
        setErro(
          estado.limpezaFalhou
            ? "Lista salva. Não foi possível limpar a tentativa local. Consulte o suporte."
            : "",
        );
      } else {
        setPendente(estado.comando);
        setErro(
          estado.fase === "incerto"
            ? "Não foi possível confirmar o salvamento. Tente novamente com os mesmos dados."
            : "",
        );
      }
    }
    eventosEnvio.addEventListener(chave, receber);
    if (!enviosEmCurso.has(chave)) {
      setOcupado(false);
      try {
        if (sessionStorage.getItem(chave) === null) setPendente(null);
      } catch {
        setErro("Não foi possível consultar a tentativa local.");
      }
    }
    return () => eventosEnvio.removeEventListener(chave, receber);
  }, [chave, onAlterarRascunho, responsavel]);
  const queryClient = useQueryClient();
  const raiz = ["listas-materiais", usuario, cliente, ordemServico] as const;
  const conferirSessao = async (signal?: AbortSignal) => {
    const atual = await supabase.auth.getUser();
    if (atual.error || atual.data.user?.id !== usuario || signal?.aborted)
      throw new Error("Sessão alterada.");
  };
  const permissao = useQuery({
    queryKey: [...raiz, "permissao"],
    queryFn: async ({ signal }) => {
      await conferirSessao(signal);
      const autorizada = await supabaseCapacidadesSsoAdapter.autorizarAcao(
        "material.gerir",
        cliente,
      );
      await conferirSessao(signal);
      return autorizada;
    },
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
      const pagina = await supabaseListasMateriaisAdapter.listar(
        cliente,
        ordemServico,
        20,
        pageParam,
        signal,
      );
      await conferirSessao(signal);
      return pagina;
    },
    getNextPageParam: (pagina) => (pagina.length === 20 ? pagina.at(-1)?.id : undefined),
  });
  async function enviar(comando: CriarListaMateriais) {
    if (enviosEmCurso.has(chave) || !permitido) return;
    try {
      if (sessionStorage.getItem(chave) !== JSON.stringify(comando))
        throw new Error("Operação guardada divergente.");
    } catch {
      setErro("Operação pendente indisponível ou alterada. Consulte suporte.");
      return;
    }
    enviosEmCurso.add(chave);
    publicarEnvio(chave, { fase: "enviando", comando });
    try {
      await conferirSessao();
      if (
        sessionStorage.getItem(chave) !== JSON.stringify(comando) ||
        comando.ordemServicoId !== ordemServico
      )
        throw new Error("Operação alterada.");
      await supabaseListasMateriaisAdapter.criar(comando);
    } catch {
      enviosEmCurso.delete(chave);
      publicarEnvio(chave, { fase: "incerto", comando });
      return;
    }
    let limpezaFalhou = false;
    try {
      if (sessionStorage.getItem(chave) !== JSON.stringify(comando))
        throw new Error("Operação guardada divergente.");
      sessionStorage.removeItem(chave);
    } catch {
      limpezaFalhou = true;
    }
    enviosEmCurso.delete(chave);
    publicarEnvio(chave, { fase: "confirmado", limpezaFalhou });
    onAlterarRascunho?.({ texto: "", responsavel });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [...raiz, "listas"] }),
      queryClient.invalidateQueries({ queryKey: ["listas-materiais-central", usuario, cliente] }),
    ]);
  }
  function iniciar() {
    if (enviosEmCurso.has(chave) || pendente || recuperacao.falhou || limpezaFalhou || !permitido)
      return;
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
    return <AvisoCarregando>Verificando acesso aos materiais…</AvisoCarregando>;
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
      {flagLigada("VITE_SSO_EXCECOES_MATERIAIS_OS_ENABLED") && (
        <>
          <button
            type="button"
            aria-expanded={excecoesAbertas}
            onClick={() => setExcecoesAbertas((abertas) => !abertas)}
          >
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
      {pendente && !ocupado && !erro && (
        <p role="alert">Há um salvamento pendente nesta sessão. Confira e repita a tentativa.</p>
      )}
      {ocupado && <output>Salvando lista…</output>}
      {pendente && !ocupado && (
        <button type="button" onClick={() => void enviar(pendente)}>
          Tentar salvar novamente
        </button>
      )}
      {!pendente && !recuperacao.falhou && !limpezaFalhou && (
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
              onChange={(e) =>
                alterarRascunho({
                  texto,
                  responsavel: e.target.value as RascunhoNovaLista["responsavel"],
                })
              }
            >
              <option value="cliente">Cliente</option>
              <option value="sinergica">Sinérgica</option>
            </select>
          </label>
          <label>
            Texto original{" "}
            <textarea
              required
              value={texto}
              onChange={(e) => alterarRascunho({ texto: e.target.value, responsavel })}
            />
          </label>
          <button type="submit" disabled={ocupado}>
            Registrar lista
          </button>
        </form>
      )}
      {listas.isFetching && <output>Consultando listas…</output>}
      {listas.isError && (
        <p role="alert">
          Não foi possível carregar listas.{" "}
          <button type="button" onClick={() => void listas.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {!listas.isFetching && !listas.isError && paginasDivergentes && (
        <p role="alert">
          A lista mudou durante a consulta.{" "}
          <button type="button" onClick={() => void listas.refetch()}>
            Atualizar listas
          </button>
        </p>
      )}
      {!listas.isFetching && !listas.isError && !paginasDivergentes && itens.length === 0 && (
        <p>Nenhuma lista cadastrada nesta OS.</p>
      )}
      <ul>
        {itens.map((lista) => (
          <li key={lista.id}>
            <p>
              Responsável: {lista.responsavel === "cliente" ? "Cliente" : "Sinérgica"} · Estado:{" "}
              {rotuloEstadoListaMaterial(lista.estado)} · Revisão: {lista.revisao}
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
                      <li key={`${linha.descricao}-${linha.unidade ?? indice}`}>
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
                    <p>
                      Adição incompleta: {rascunho.adicao.descricao || "descrição não informada"}
                    </p>
                  )}
                </details>
              ))}
            {lista.estado === "concluida" && (
              <p>
                Lista concluída. O histórico está disponível para consulta e a lista não pode ser
                alterada.
              </p>
            )}
            <button
              type="button"
              onClick={() => setListaAberta(listaAberta === lista.id ? null : lista.id)}
            >
              {lista.estado === "concluida"
                ? listaAberta === lista.id
                  ? "Fechar histórico"
                  : "Consultar histórico"
                : listaAberta === lista.id
                  ? "Fechar organização"
                  : "Organizar linhas"}
            </button>
            {listaAberta === lista.id && (
              <>
                {lista.estado === "concluida" ? (
                  <HistoricoVersoes
                    usuario={usuario}
                    cliente={cliente}
                    ordemServico={ordemServico}
                    listaId={lista.id}
                    revisao={lista.revisao}
                  />
                ) : (
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
                )}
                <DisponibilidadeMateriais
                  usuario={usuario}
                  cliente={cliente}
                  ordemServico={ordemServico}
                  listaId={lista.id}
                  revisao={lista.revisao}
                  somenteLeitura={lista.estado === "concluida"}
                  rascunho={rascunhosInformacao.current.get(`${lista.id}:${lista.revisao}`)}
                  onRascunho={(rascunho) =>
                    rascunhosInformacao.current.set(`${lista.id}:${lista.revisao}`, rascunho)
                  }
                  onSalvo={() => rascunhosInformacao.current.delete(`${lista.id}:${lista.revisao}`)}
                />
                {lista.estado !== "concluida" && (
                  <>
                    <PublicarPortal
                      usuario={usuario}
                      cliente={cliente}
                      ordemServico={ordemServico}
                      listaId={lista.id}
                      revisao={lista.revisao}
                    />
                    <VisibilidadePortal usuario={usuario} cliente={cliente} listaId={lista.id} />
                  </>
                )}
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

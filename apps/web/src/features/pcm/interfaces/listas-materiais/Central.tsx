import { AvisoCarregando, Button, RecursoNaoAtivado } from "@sinergica/ui";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { flagLigada } from "../../../../config/flags-sso";
import { TEXTO_FALHA_ATIVACAO, mensagemFalhaAtivacao } from "../../../../lib/mensagem-ativacao";
import { supabase } from "../../../../lib/supabase-client";
import { OrcamentosDaOs } from "../../../comercial/interfaces/orcamento-operacional/OrcamentosDaOs";
import { supabaseCapacidadesSsoAdapter } from "../../infrastructure/supabase-capacidades-sso-adapter";
import { supabaseListasMateriaisAdapter } from "../../infrastructure/supabase-listas-materiais-adapter";
import { ExcecoesOs } from "./ExcecoesOs";
import { ResumoListaMaterial } from "./ResumoListaMaterial";
import { type RascunhoNovaLista, WorkspaceListasMateriais } from "./Workspace";
import { buscaOsCentralMateriaisOptions } from "./busca-os-central-materiais-queries";

type Props = {
  usuario: string;
  cliente: string;
  onAbrirOs?: (osId: string) => void;
  onRascunhoAlterado?: (temRascunho: boolean) => void;
};
type PesquisaOs = { texto: string; termo: string };
type ControlePesquisa = ReturnType<typeof useState<PesquisaOs>>;
type PropsComPesquisa = Props & { pesquisa: ControlePesquisa };
type Responsavel = "cliente" | "sinergica" | "todos";
type EstadoLista =
  | "todos"
  | "levantada"
  | "informada_disponivel"
  | "parcial"
  | "indisponivel"
  | "aguardando_aquisicao"
  | "dispensada"
  | "concluida";
function erroTemporario(error: unknown): boolean {
  if (error instanceof TypeError && /^(Failed to fetch|NetworkError)/i.test(error.message))
    return true;
  if (typeof error !== "object" || error === null || !("status" in error)) return false;
  const status = error.status;
  return typeof status === "number" && [500, 502, 503, 504].includes(status);
}
async function consultarPermissaoMaterial(usuario: string, cliente: string) {
  const antes = await supabase.auth.getUser();
  if (antes.error || antes.data.user?.id !== usuario) throw new Error("Sessão alterada.");
  const permitido = await supabaseCapacidadesSsoAdapter.autorizarAcao("material.gerir", cliente);
  const depois = await supabase.auth.getUser();
  if (depois.error || depois.data.user?.id !== usuario) throw new Error("Sessão alterada.");
  return permitido;
}

export function CentralMateriais(props: Props) {
  if (!flagLigada("VITE_SSO_CENTRAL_MATERIAIS_ENABLED")) {
    return (
      <RecursoNaoAtivado
        recurso="Central materiais"
        podeAdministrar={false}
        faltando={["VITE_SSO_CENTRAL_MATERIAIS_ENABLED"]}
      />
    );
  }
  return <CentralComPesquisa key={JSON.stringify([props.usuario, props.cliente])} {...props} />;
}

/** Entrada na operação global, sempre limitada ao Cliente selecionado. */
export function CentralMateriaisGlobal(props: Props) {
  if (!flagLigada("VITE_SSO_CENTRAL_MATERIAIS_ENABLED")) {
    return (
      <RecursoNaoAtivado
        recurso="Central materiais"
        podeAdministrar={false}
        faltando={["VITE_SSO_CENTRAL_MATERIAIS_ENABLED"]}
      />
    );
  }
  return (
    <CentralComPesquisa key={JSON.stringify([props.usuario, props.cliente])} {...props} global />
  );
}

function CentralComPesquisa({ global, ...props }: Props & { global?: boolean }) {
  // Apenas o texto e o termo sobrevivem à remontagem por revalidação de acesso.
  const pesquisa = useState<PesquisaOs>({ texto: "", termo: "" });
  return global ? (
    <CentralGlobalConteudo {...props} pesquisa={pesquisa} />
  ) : (
    <Conteudo {...props} pesquisa={pesquisa} />
  );
}

function CentralGlobalConteudo(props: PropsComPesquisa) {
  const [aberta, setAberta] = useState(false);
  const permissao = useQuery({
    queryKey: ["listas-materiais-central", props.usuario, props.cliente, "permissao"],
    queryFn: () => consultarPermissaoMaterial(props.usuario, props.cliente),
    gcTime: 0,
    refetchOnWindowFocus: true,
  });
  if (permissao.isPending || permissao.fetchStatus !== "idle")
    return <AvisoCarregando>Verificando acesso aos materiais…</AvisoCarregando>;
  if (permissao.isError)
    return (
      <p
        role="alert"
        className="flex flex-wrap items-center gap-2 rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-body text-danger"
      >
        Não foi possível verificar acesso.{" "}
        <Button size="sm" onClick={() => void permissao.refetch()}>
          Tentar novamente
        </Button>
      </p>
    );
  if (permissao.data !== true) return <p>Sem permissão para consultar materiais deste Cliente.</p>;
  return (
    <section aria-label="Materiais do Cliente selecionado">
      <button type="button" onClick={() => setAberta(!aberta)}>
        {aberta ? "Fechar Central de materiais" : "Abrir Central de materiais"}
      </button>
      {aberta && <Conteudo {...props} permissaoMonitorada />}
    </section>
  );
}

function Conteudo({
  usuario,
  cliente,
  onAbrirOs,
  onRascunhoAlterado,
  pesquisa,
  permissaoMonitorada = false,
}: PropsComPesquisa & { permissaoMonitorada?: boolean }) {
  const [osDigitada, setOsDigitada] = useState("");
  const [os, setOs] = useState<string | null>(null);
  const [responsavel, setResponsavel] = useState<Responsavel>("todos");
  const [estado, setEstado] = useState<EstadoLista>("todos");
  const [aberta, setAberta] = useState<string | null>(null);
  const [orcamentoOs, setOrcamentoOs] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  // O formulário pode sair da tela enquanto listas e permissões são revalidadas.
  const [rascunhos, setRascunhos] = useState(() => new Map<string, RascunhoNovaLista>());
  const temRascunho = [...rascunhos.values()].some(({ texto }) => texto.length > 0);
  useEffect(() => onRascunhoAlterado?.(temRascunho), [onRascunhoAlterado, temRascunho]);
  const filtroServidor = flagLigada("VITE_SSO_CENTRAL_MATERIAIS_SITUACAO_ENABLED");
  const permissao = useQuery({
    queryKey: ["listas-materiais-central", usuario, cliente, "permissao"],
    queryFn: () => consultarPermissaoMaterial(usuario, cliente),
    enabled: !permissaoMonitorada,
    gcTime: 0,
    refetchOnWindowFocus: true,
  });
  // Na entrada global o componente pai mantém a mesma consulta ativa e só
  // monta esta área enquanto a autorização atual está confirmada.
  const permitido =
    permissaoMonitorada ||
    (permissao.data === true && permissao.fetchStatus === "idle" && !permissao.isError);
  const buscaHabilitada = flagLigada("VITE_SSO_BUSCA_OS_MATERIAIS_ENABLED");
  const [{ termo }] = pesquisa;
  const consultaOs = useInfiniteQuery({
    ...buscaOsCentralMateriaisOptions(usuario, cliente, termo),
    enabled: permitido && buscaHabilitada,
  });
  const numerosOs = new Map(
    (consultaOs.isSuccess ? consultaOs.data.pages.flat() : []).map((item) => [
      item.id,
      item.numero,
    ]),
  );
  const listas = useInfiniteQuery({
    queryKey: [
      "listas-materiais-central",
      usuario,
      cliente,
      os,
      responsavel,
      filtroServidor,
      filtroServidor ? estado : null,
    ],
    enabled: permitido,
    gcTime: 0,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== usuario || signal.aborted)
        throw new Error("Sessão alterada.");
      const pagina = await (filtroServidor
        ? supabaseListasMateriaisAdapter.consultarCentralPorSituacao(
            cliente,
            os,
            responsavel === "todos" ? null : responsavel,
            estado === "todos" ? null : estado,
            20,
            pageParam,
            signal,
          )
        : supabaseListasMateriaisAdapter.consultarCentral(
            cliente,
            os,
            responsavel === "todos" ? null : responsavel,
            20,
            pageParam,
            signal,
          ));
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== usuario || signal.aborted)
        throw new Error("Sessão alterada.");
      return pagina;
    },
    getNextPageParam: (pagina) => (pagina.length === 20 ? pagina.at(-1)?.id : undefined),
  });
  if (!permissaoMonitorada && (permissao.isPending || permissao.fetchStatus !== "idle"))
    return <AvisoCarregando>Verificando acesso aos materiais…</AvisoCarregando>;
  if (!permissaoMonitorada && permissao.isError)
    return (
      <p role="alert">
        Não foi possível verificar acesso.{" "}
        <button type="button" onClick={() => void permissao.refetch()}>
          Tentar novamente
        </button>
      </p>
    );
  if (!permitido) return null;
  const carregadas = listas.data?.pages.flat() ?? [];
  const visiveis =
    estado === "todos" ? carregadas : carregadas.filter((lista) => lista.estado === estado);
  // 403/42501 não melhora repetindo: o aviso explica em vez de oferecer o botão.
  const negacaoListas = mensagemFalhaAtivacao(listas.error);
  return (
    <section
      aria-label="Central de materiais"
      className="flex flex-col gap-4 rounded-lg border border-line bg-card p-4 shadow-raised"
    >
      <h2 className="text-heading font-semibold text-ink">Central de materiais</h2>
      {buscaHabilitada && (
        <SelecionarOs
          consulta={consultaOs}
          pesquisa={pesquisa}
          onSelecionar={(id) => {
            setOs(id);
            setAberta(null);
            setOrcamentoOs(null);
            setErro("");
          }}
        />
      )}
      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          const valor = buscaHabilitada ? (os ?? "") : osDigitada.trim();
          if (valor && !z.string().guid().safeParse(valor).success) {
            setErro("Informe o identificador UUID da OS ou deixe vazio.");
            return;
          }
          setErro("");
          if ((valor || null) === os) void listas.refetch();
          else setOs(valor || null);
          setAberta(null);
          setOrcamentoOs(null);
        }}
        className="grid grid-cols-1 items-end gap-3 rounded-md border border-line-soft bg-paper/60 p-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {buscaHabilitada ? (
          os && (
            <Button
              size="sm"
              onClick={() => {
                setOs(null);
                setAberta(null);
                setOrcamentoOs(null);
              }}
            >
              Limpar filtro de OS
            </Button>
          )
        ) : (
          <label className="block">
            <span className="mb-1 block text-micro font-semibold text-ink-3">
              Identificador da OS
            </span>
            <input
              className="input w-full"
              value={osDigitada}
              onChange={(evento) => setOsDigitada(evento.target.value)}
            />
          </label>
        )}
        <label className="block">
          <span className="mb-1 block text-micro font-semibold text-ink-3">Responsável</span>
          <select
            className="input w-full"
            value={responsavel}
            onChange={(evento) => {
              setResponsavel(evento.target.value as Responsavel);
              setAberta(null);
              setOrcamentoOs(null);
            }}
          >
            <option value="todos">Todos</option>
            <option value="cliente">Cliente</option>
            <option value="sinergica">Sinérgica</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-micro font-semibold text-ink-3">
            {filtroServidor ? "Situação" : "Situação nas páginas carregadas"}
          </span>
          <select
            className="input w-full"
            value={estado}
            onChange={(evento) => {
              setEstado(evento.target.value as EstadoLista);
              setAberta(null);
              setOrcamentoOs(null);
            }}
          >
            <option value="todos">Todas</option>
            <option value="levantada">Levantada</option>
            <option value="informada_disponivel">Disponibilidade informada</option>
            <option value="parcial">Parcial</option>
            <option value="indisponivel">Indisponível</option>
            <option value="aguardando_aquisicao">Aguardando aquisição</option>
            <option value="dispensada">Dispensada</option>
            <option value="concluida">Concluída</option>
          </select>
        </label>
        <Button type="submit" variant="primary">
          Filtrar OS
        </Button>
      </form>
      {erro && (
        <p
          role="alert"
          className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-body text-danger"
        >
          {erro}
        </p>
      )}
      {os && <ExcecoesOs usuario={usuario} cliente={cliente} os={os} />}
      {listas.isFetching && <output className="text-body text-ink-3">Consultando listas…</output>}
      {listas.isError && (
        <p
          role="alert"
          className="flex flex-wrap items-center gap-2 rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-body text-danger"
        >
          {negacaoListas ? (
            TEXTO_FALHA_ATIVACAO[negacaoListas]
          ) : (
            <>
              Não foi possível consultar listas.{" "}
              <Button
                size="sm"
                onClick={() =>
                  void (listas.isFetchNextPageError ? listas.fetchNextPage() : listas.refetch())
                }
              >
                Tentar novamente
              </Button>
            </>
          )}
        </p>
      )}
      {!listas.isFetching && !listas.isError && listas.data?.pages.flat().length === 0 && (
        <p className="rounded-md border border-line bg-paper/60 px-3 py-6 text-center text-body text-ink-3">
          Nenhuma lista para estes filtros.
        </p>
      )}
      {listas.data &&
        !listas.isFetching &&
        (!listas.isError || (listas.isFetchNextPageError && erroTemporario(listas.error))) && (
          <>
            <p className="text-caption text-ink-3">
              {visiveis.length} lista(s) nas páginas carregadas
              {listas.hasNextPage ? "; carregue mais para ampliar a busca" : ""}.
            </p>
            {carregadas.length > 0 && visiveis.length === 0 && (
              <p className="rounded-md border border-line bg-paper/60 px-3 py-6 text-center text-body text-ink-3">
                Nenhuma lista carregada corresponde à situação selecionada.
              </p>
            )}
            <ul className="flex flex-col gap-3">
              {visiveis.map((lista) => (
                <li
                  key={lista.id}
                  className="flex flex-col gap-2 rounded-lg border border-line bg-paper/40 p-3"
                >
                  <p className="text-caption font-semibold text-ink-2">
                    <ResumoListaMaterial
                      estado={lista.estado}
                      responsavel={lista.responsavel}
                      revisao={lista.revisao}
                      numeroOs={numerosOs.get(lista.ordem_servico_id)}
                    />
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        if (!buscaHabilitada) setOsDigitada(lista.ordem_servico_id);
                        setOs(lista.ordem_servico_id);
                        setAberta(null);
                        setOrcamentoOs(null);
                        setErro("");
                      }}
                    >
                      {flagLigada("VITE_SSO_EXCECOES_MATERIAIS_OS_ENABLED")
                        ? "Filtrar esta OS e consultar exceções"
                        : "Filtrar esta OS"}
                    </Button>
                    {onAbrirOs && (
                      <Button size="sm" onClick={() => onAbrirOs(lista.ordem_servico_id)}>
                        Abrir contexto da OS
                      </Button>
                    )}
                  </div>
                  <pre className="overflow-x-auto whitespace-pre-wrap rounded-md border border-line-soft bg-paper px-3 py-2 text-body-sm text-ink-2">
                    {lista.texto_original}
                  </pre>
                  {flagLigada("VITE_SSO_LISTAS_MATERIAIS_ENABLED") && (
                    <Button
                      size="sm"
                      className="self-start"
                      onClick={() => {
                        if (aberta === lista.id) {
                          setAberta(null);
                          void listas.refetch();
                        } else setAberta(lista.id);
                      }}
                    >
                      {aberta === lista.id ? "Fechar materiais da OS" : "Abrir materiais da OS"}
                    </Button>
                  )}
                  {aberta === lista.id && (
                    <WorkspaceListasMateriais
                      usuario={usuario}
                      cliente={cliente}
                      ordemServico={lista.ordem_servico_id}
                      rascunho={rascunhos.get(lista.ordem_servico_id)}
                      onAlterarRascunho={(rascunho) =>
                        setRascunhos((atuais) =>
                          new Map(atuais).set(lista.ordem_servico_id, rascunho),
                        )
                      }
                    />
                  )}
                  {lista.responsavel === "sinergica" &&
                    flagLigada("VITE_SSO_ORCAMENTO_OPERACIONAL_ENABLED") && (
                      <>
                        <Button
                          size="sm"
                          className="self-start"
                          onClick={() => setOrcamentoOs(orcamentoOs === lista.id ? null : lista.id)}
                        >
                          {orcamentoOs === lista.id
                            ? "Fechar orçamentos da OS"
                            : "Consultar orçamentos da OS"}
                        </Button>
                        {orcamentoOs === lista.id && (
                          <>
                            <p className="rounded-md border border-line-soft bg-paper/60 px-3 py-2 text-caption text-ink-3">
                              O orçamento é da OS; confira a lista de materiais e sua revisão na
                              criação. Não gera despesa de Visita ou cobrança automaticamente.
                            </p>
                            <OrcamentosDaOs
                              key={lista.id}
                              usuario={usuario}
                              cliente={cliente}
                              ordemServico={lista.ordem_servico_id}
                              listaInicialId={lista.id}
                            />
                          </>
                        )}
                      </>
                    )}
                </li>
              ))}
            </ul>
          </>
        )}
      {!listas.isFetching && !listas.isError && listas.hasNextPage && (
        <Button size="sm" className="self-start" onClick={() => void listas.fetchNextPage()}>
          Carregar mais listas
        </Button>
      )}
    </section>
  );
}

function SelecionarOs({
  consulta,
  pesquisa,
  onSelecionar,
}: {
  consulta: ReturnType<
    typeof useInfiniteQuery<
      Awaited<ReturnType<typeof supabaseListasMateriaisAdapter.buscarOsCentral>>
    >
  >;
  pesquisa: ControlePesquisa;
  onSelecionar: (id: string) => void;
}) {
  const [{ texto, termo }, setPesquisa] = pesquisa;
  return (
    <section
      aria-label="Selecionar OS com materiais"
      className="flex flex-col gap-3 rounded-md border border-line-soft bg-paper/60 p-3"
    >
      <div>
        <h3 className="text-body font-semibold text-ink">Selecionar OS</h3>
        <p className="mt-0.5 text-caption text-ink-3">
          Busca apenas OS deste Cliente que já possuem lista de materiais.
        </p>
      </div>
      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          const valor = texto.trim();
          if (valor === termo) void consulta.refetch();
          else setPesquisa((atual) => ({ ...atual, termo: valor }));
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <label className="block flex-1">
          <span className="mb-1 block text-micro font-semibold text-ink-3">Número da OS</span>
          <input
            className="input w-full"
            maxLength={80}
            value={texto}
            onChange={(evento) => {
              const texto = evento.target.value;
              setPesquisa((atual) => ({ ...atual, texto }));
            }}
          />
        </label>
        <Button type="submit" size="sm">
          Buscar OS
        </Button>
      </form>
      {consulta.isPaused && <output>Busca de OS pausada. Aguardando conexão.</output>}
      {consulta.isFetching && <output className="text-body text-ink-3">Buscando OS…</output>}
      {consulta.isError && (
        <p
          role="alert"
          className="flex flex-wrap items-center gap-2 rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-body text-danger"
        >
          Não foi possível buscar OS.{" "}
          <Button size="sm" onClick={() => void consulta.refetch()}>
            Tentar novamente
          </Button>
        </p>
      )}
      {!consulta.isPaused &&
        !consulta.isFetching &&
        !consulta.isError &&
        consulta.data?.pages.flat().length === 0 && (
          <p className="text-body text-ink-3">Nenhuma OS com lista encontrada.</p>
        )}
      {!consulta.isPaused && !consulta.isFetching && !consulta.isError && (
        <ul className="flex flex-col gap-1.5">
          {consulta.data?.pages.flat().map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line-soft bg-card px-3 py-2 text-body-sm text-ink-2"
            >
              <span>
                {item.numero} · {item.titulo}
              </span>
              <Button size="sm" onClick={() => onSelecionar(item.id)}>
                Selecionar {item.numero}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {!consulta.isPaused && !consulta.isFetching && !consulta.isError && consulta.hasNextPage && (
        <Button size="sm" className="self-start" onClick={() => void consulta.fetchNextPage()}>
          Mais OS
        </Button>
      )}
    </section>
  );
}

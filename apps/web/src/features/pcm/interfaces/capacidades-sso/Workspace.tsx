import { Button, Card } from "@sinergica/ui";
import { useMemo, useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import { concessaoSchema, perfilSchema, vinculoSchema } from "../../application/capacidades-sso";
import type { PaginaCapacidade } from "../../application/capacidades-sso-gateway";
import { useConfiguracaoCapacidades } from "../../application/capacidades-sso-queries";
import { criarRegistroRequisicoes } from "../../application/requisicoes-capacidades";
import { ACOES_INDIVIDUAIS, ACOES_SSO, type AcaoSso } from "../../domain/capacidades-sso";
import { supabaseCapacidadesSsoAdapter } from "../../infrastructure/supabase-capacidades-sso-adapter";

const LABELS: Record<AcaoSso, string> = {
  "cadastro.ler": "Consultar estrutura técnica",
  "cadastro.gerir": "Gerir estrutura técnica",
  "plano.gerir": "Gerir Plano de Manutenção",
  "visita.confirmar": "Confirmar visita",
  "visita.cancelar": "Cancelar visita",
  "execucao.validar": "Validar execução",
  "chamado.encerrar": "Encerrar chamado",
  "chamado.os.criar": "Criar OS do Chamado",
  "chamado.escopo.gerir": "Gerir escopo do Chamado",
  "chamado.continuacao.sugerir": "Sugerir continuidade do Chamado",
  "capacidade.gerir": "Gerir capacidade",
  "despesa_visita.gerir": "Gerir despesas da Visita",
  "cadastro.aprovar": "Aprovar cadastro",
  "codigo.substituir": "Corrigir código público",
  "material.gerir": "Gerir materiais",
  "custo.ler": "Consultar custos",
  "orcamento.emitir": "Emitir orçamento",
  "faturavel.efetivar": "Efetivar faturável",
  "integracao.reconciliar": "Reconciliar integração",
  "orcamento.operacional.ler": "Consultar propostas operacionais",
  "orcamento.dispensar": "Dispensar orçamento",
  "orcamento.excecao_preco": "Autorizar exceção de preço",
  "anexo_os.publicar": "Publicar anexo de OS",
  "backlog.promover": "Promover backlog",
};

type ConsultaPaginada<T> = {
  data?: { pages: T[][] };
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
  refetch: () => Promise<unknown>;
};
function SecaoDados<T>({
  titulo,
  query,
  children,
}: { titulo: string; query: ConsultaPaginada<T>; children: (itens: T[]) => React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{titulo}</h2>
      {(query.isPending || query.isFetching) && <output>Carregando…</output>}
      {query.isError && (
        <div role="alert">
          Não foi possível carregar {titulo.toLowerCase()}.{" "}
          <Button onClick={() => void query.refetch()}>Tentar novamente</Button>
        </div>
      )}
      {!query.isPending &&
        !query.isFetching &&
        !query.isError &&
        children(query.data?.pages.flat() ?? [])}
      {(query.hasNextPage || query.isFetchingNextPage || (query.data?.pages.length ?? 0) > 1) && (
        <Button
          aria-disabled={query.isFetching || query.isError || !query.hasNextPage}
          onClick={() => {
            if (!query.isFetching && !query.isError && query.hasNextPage)
              void query.fetchNextPage();
          }}
        >
          {!query.hasNextPage && !query.isFetching
            ? "Todas as páginas carregadas"
            : "Carregar mais"}
        </Button>
      )}
    </section>
  );
}

export function CapacidadesWorkspace({ userId }: { userId: string }) {
  return <CapacidadesWorkspaceInterno key={userId} userId={userId} />;
}

function CapacidadesWorkspaceInterno({ userId }: { userId: string }) {
  const gateway = useMemo(() => {
    const conferir = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || data.user?.id !== userId) throw new Error("Sessão alterada.");
    };
    const segura =
      <T,>(listar: (pagina: PaginaCapacidade) => Promise<T[]>) =>
      async (pagina: PaginaCapacidade) => {
        await conferir();
        const resultado = await listar(pagina);
        await conferir();
        return resultado;
      };
    return {
      ...supabaseCapacidadesSsoAdapter,
      listarPerfis: segura(supabaseCapacidadesSsoAdapter.listarPerfis),
      listarVinculos: segura(supabaseCapacidadesSsoAdapter.listarVinculos),
      listarConcessoes: segura(supabaseCapacidadesSsoAdapter.listarConcessoes),
      listarUsuarios: segura(supabaseCapacidadesSsoAdapter.listarUsuarios),
      listarClientes: segura(supabaseCapacidadesSsoAdapter.listarClientes),
    };
  }, [userId]);
  const api = useConfiguracaoCapacidades(gateway, userId);
  const registro = useMemo(
    () =>
      criarRegistroRequisicoes(
        undefined,
        {
          getItem: (key) => window.sessionStorage.getItem(key),
          setItem: (key, value) => window.sessionStorage.setItem(key, value),
          removeItem: (key) => window.sessionStorage.removeItem(key),
        },
        userId,
      ),
    [userId],
  );
  const [, atualizarPendente] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [consultandoRecibo, setConsultandoRecibo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const emEnvio = useRef(false);
  const [perfilNovo, setPerfilNovo] = useState("");
  const [nomesEditados, setNomesEditados] = useState<Record<string, string>>({});
  const [perfilNovoId, setPerfilNovoId] = useState(() => crypto.randomUUID());
  const [usuarioId, setUsuarioId] = useState("");
  const [perfilId, setPerfilId] = useState("");
  const [destino, setDestino] = useState<"usuario" | "perfil">("usuario");
  const [acao, setAcao] = useState<AcaoSso>("plano.gerir");
  const [escopo, setEscopo] = useState("");
  const [confirmarGlobal, setConfirmarGlobal] = useState(false);
  const usuarios =
    api.usuarios.isError || api.usuarios.isFetching ? [] : (api.usuarios.data?.pages.flat() ?? []);
  const perfis =
    api.perfis.isError || api.perfis.isFetching ? [] : (api.perfis.data?.pages.flat() ?? []);
  const clientes =
    api.clientes.isError || api.clientes.isFetching ? [] : (api.clientes.data?.pages.flat() ?? []);
  const usuarioConfirmado =
    !api.usuarios.isFetching &&
    !api.usuarios.isError &&
    usuarios.some((u) => u.userId === usuarioId && u.ativo && u.papel !== "cliente-sindico");
  const perfilConfirmado =
    !api.perfis.isFetching &&
    !api.perfis.isError &&
    perfis.some((p) => p.id === perfilId && p.ativo);
  const escopoConfirmado =
    escopo === "*"
      ? confirmarGlobal
      : !api.clientes.isFetching && !api.clientes.isError && clientes.some((c) => c.id === escopo);
  const ocupado = api.perfil.isPending || api.vinculo.isPending || api.concessao.isPending;
  async function conferirSessao() {
    const { data, error } = await supabase.auth.getUser();
    if (error || data.user?.id !== userId) throw new Error("Sessão alterada.");
  }
  let pendente: ReturnType<typeof registro.pendente> = null;
  let armazenamentoIndisponivel = false;
  try {
    pendente = registro.pendente();
  } catch {
    armazenamentoIndisponivel = true;
  }

  function validar(chave: string, payload: object, requestId: string) {
    const dados = { ...payload, requestId };
    if (chave === "novo-perfil" || chave.startsWith("perfil-"))
      return { tipo: "perfil" as const, dados: perfilSchema.parse(dados) };
    if (chave === "novo-vinculo" || chave.startsWith("vinculo-"))
      return { tipo: "vinculo" as const, dados: vinculoSchema.parse(dados) };
    if (chave === "nova-concessao" || chave.startsWith("concessao-"))
      return { tipo: "concessao" as const, dados: concessaoSchema.parse(dados) };
    throw new Error("Tipo de operação desconhecido.");
  }

  async function executar(
    chave: string,
    payload: object,
    enviar: (requestId: string) => Promise<unknown>,
  ) {
    if (emEnvio.current) return false;
    emEnvio.current = true;
    try {
      return await executarInterno(chave, payload, enviar);
    } finally {
      emEnvio.current = false;
    }
  }

  async function executarInterno(
    chave: string,
    payload: object,
    enviar: (requestId: string) => Promise<unknown>,
  ) {
    setErro(null);
    setMensagem(null);
    try {
      validar(chave, payload, "00000000-0000-4000-8000-000000000000");
    } catch {
      setErro("Confira os dados da alteração antes de enviar.");
      return false;
    }
    let requestId: string;
    try {
      requestId = registro.obter(chave, payload);
      atualizarPendente((n) => n + 1);
    } catch {
      setErro(
        "Existe alteração pendente ou armazenamento indisponível. Resolva a pendência antes de enviar outros dados.",
      );
      return false;
    }
    try {
      await conferirSessao();
      await enviar(requestId);
      await conferirSessao();
      if (!registro.concluir(chave, requestId, payload)) {
        setErro(
          "Alteração confirmada, mas a tentativa local mudou. Procure suporte antes de continuar.",
        );
        atualizarPendente((n) => n + 1);
        return false;
      }
      atualizarPendente((n) => n + 1);
      setMensagem("Alteração registrada.");
      return true;
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "55P03"
      ) {
        atualizarPendente((n) => n + 1);
        setErro(
          "Outra alteração de permissões está em andamento. A tentativa foi preservada; confira o estado e repita a mesma operação quando a alteração concorrente terminar.",
        );
        return false;
      }
      // Uma recusa em uma repetição não comprova que tentativa anterior não
      // tenha sido confirmada. Preserve o mesmo pedido até reconciliação.
      atualizarPendente((n) => n + 1);
      setErro(
        "Resultado não confirmado. A tentativa foi preservada; confira o estado e procure suporte em caso de conflito.",
      );
      return false;
    }
  }

  async function recuperar() {
    if (!pendente) return;
    try {
      const comando = validar(pendente.chave, pendente.payload, pendente.id);
      await executar(pendente.chave, pendente.payload, () => {
        switch (comando.tipo) {
          case "perfil":
            return api.perfil.mutateAsync(comando.dados);
          case "vinculo":
            return api.vinculo.mutateAsync(comando.dados);
          case "concessao":
            return api.concessao.mutateAsync(comando.dados);
        }
      });
    } catch {
      setErro("Pedido pendente inválido. Procure suporte; os dados não foram apagados.");
    }
  }

  async function consultarRecibo() {
    if (!pendente || emEnvio.current) return;
    emEnvio.current = true;
    setConsultandoRecibo(true);
    setErro(null);
    setMensagem(null);
    try {
      const comando = validar(pendente.chave, pendente.payload, pendente.id);
      const { requestId, ...dados } = comando.dados;
      const payload: Record<string, unknown> = { ...dados };
      if (comando.tipo === "perfil") payload.tipo = "perfil";
      if (comando.tipo === "vinculo") payload.tipo = "vinculoPerfil";
      for (const campo of ["usuarioId", "perfilId", "clienteId"]) {
        if (typeof payload[campo] === "string") payload[campo] = payload[campo].toLowerCase();
      }
      await conferirSessao();
      const { data, error } = await supabase
        .schema("config")
        .rpc("sso_consultar_recibo_capacidades", { p_request_id: requestId, p_payload: payload });
      if (error || !data || data.requestId !== requestId || data.confirmado !== true)
        throw new Error("Recibo indisponível.");
      await conferirSessao();
      if (!registro.concluir(pendente.chave, requestId, pendente.payload))
        throw new Error("Tentativa alterada.");
      atualizarPendente((n) => n + 1);
      setMensagem("Alteração confirmada. Consulte a configuração atual antes de continuar.");
      void Promise.all([api.perfis.refetch(), api.vinculos.refetch(), api.concessoes.refetch()]);
    } catch {
      setErro(
        "Recibo indisponível ou não confirmado. A tentativa foi preservada; isso não prova que a alteração falhou.",
      );
    } finally {
      emEnvio.current = false;
      setConsultandoRecibo(false);
    }
  }

  async function criarPerfil() {
    const dados = {
      expectedRevision: 0,
      perfilId: perfilNovoId,
      nome: perfilNovo,
      ativo: true,
      motivo,
    };
    if (
      await executar("novo-perfil", dados, (requestId) =>
        api.perfil.mutateAsync({ ...dados, requestId }),
      )
    ) {
      setPerfilNovo("");
      setPerfilNovoId(crypto.randomUUID());
    }
  }
  async function vincular() {
    if (!usuarioConfirmado || !perfilConfirmado) return;
    const dados = { expectedRevision: 0, usuarioId, perfilId, ativo: true, motivo };
    await executar("novo-vinculo", dados, (requestId) =>
      api.vinculo.mutateAsync({ ...dados, requestId }),
    );
  }
  async function conceder() {
    if (!escopoConfirmado || (destino === "usuario" ? !usuarioConfirmado : !perfilConfirmado)) {
      setErro("Escolha e confirme o escopo da concessão.");
      return;
    }
    const dados = {
      expectedRevision: 0,
      usuarioId: destino === "usuario" ? usuarioId : null,
      perfilId: destino === "perfil" ? perfilId : null,
      acao,
      clienteId: escopo === "*" ? null : escopo,
      ativa: true,
      motivo,
    };
    await executar("nova-concessao", dados, (requestId) =>
      api.concessao.mutateAsync({ ...dados, requestId }),
    );
  }

  return (
    <div className="space-y-5 p-4">
      <h1 className="text-xl font-semibold">Capacidades e perfis</h1>
      <p>
        Defina ações e escopo para cada usuário ou perfil. Gerir Plano exige concessão individual.
      </p>
      {erro && <p role="alert">{erro}</p>}
      {mensagem && <output>{mensagem}</output>}
      {armazenamentoIndisponivel && (
        <p role="alert">
          Pedido pendente inválido ou armazenamento indisponível. Procure suporte; nenhuma alteração
          será enviada.
        </p>
      )}
      {pendente && (
        <Card className="space-y-2 p-4">
          <p>
            Há alteração de capacidade pendente nesta sessão. Repita o pedido antes de registrar
            outra alteração.
          </p>
          <Button disabled={ocupado} onClick={() => void recuperar()}>
            Repetir alteração pendente
          </Button>
          {import.meta.env.VITE_SSO_RECIBO_CAPACIDADES_ENABLED === "true" && (
            <Button disabled={ocupado || consultandoRecibo} onClick={() => void consultarRecibo()}>
              Consultar confirmação
            </Button>
          )}
        </Card>
      )}
      <Card className="space-y-3 p-4">
        <label htmlFor="sso-motivo" className="block font-semibold">
          Motivo da alteração
        </label>
        <input
          id="sso-motivo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          className="w-full rounded border border-line bg-card p-2"
          maxLength={1000}
        />
        <p className="text-caption">O motivo é obrigatório e fica registrado na auditoria.</p>
      </Card>
      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Criar perfil</h2>
        <label htmlFor="sso-perfil-novo">Nome do perfil</label>
        <input
          id="sso-perfil-novo"
          value={perfilNovo}
          onChange={(e) => setPerfilNovo(e.target.value)}
          className="w-full rounded border border-line bg-card p-2"
          maxLength={120}
        />
        <Button
          disabled={ocupado || !motivo.trim() || !perfilNovo.trim()}
          onClick={() => void criarPerfil()}
        >
          Criar perfil
        </Button>
      </Card>
      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Usuário, perfil e escopo</h2>
        <label htmlFor="sso-usuario" className="block">
          Usuário
        </label>
        <select
          id="sso-usuario"
          value={usuarioId}
          onChange={(e) => setUsuarioId(e.target.value)}
          className="w-full rounded border border-line bg-card p-2"
        >
          <option value="">Selecione um usuário</option>
          {usuarios
            .filter((u) => u.ativo && u.papel !== "cliente-sindico")
            .map((u) => (
              <option key={u.userId} value={u.userId}>
                {u.nome}
              </option>
            ))}
        </select>
        {api.usuarios.hasNextPage && (
          <Button onClick={() => void api.usuarios.fetchNextPage()}>Mais usuários</Button>
        )}
        <label htmlFor="sso-perfil" className="block">
          Perfil
        </label>
        <select
          id="sso-perfil"
          value={perfilId}
          onChange={(e) => setPerfilId(e.target.value)}
          className="w-full rounded border border-line bg-card p-2"
        >
          <option value="">Selecione um perfil</option>
          {perfis
            .filter((p) => p.ativo)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
        </select>
        <Button
          disabled={ocupado || !motivo.trim() || !usuarioConfirmado || !perfilConfirmado}
          onClick={() => void vincular()}
        >
          Atribuir perfil ao usuário
        </Button>
        <label htmlFor="sso-destino" className="block">
          Conceder ação para
        </label>
        <select
          id="sso-destino"
          value={destino}
          onChange={(e) => setDestino(e.target.value === "perfil" ? "perfil" : "usuario")}
          className="w-full rounded border border-line bg-card p-2"
        >
          <option value="usuario">Usuário selecionado</option>
          <option value="perfil">Perfil selecionado</option>
        </select>
        <label htmlFor="sso-acao" className="block">
          Ação
        </label>
        <select
          id="sso-acao"
          value={acao}
          onChange={(e) => setAcao(e.target.value as AcaoSso)}
          className="w-full rounded border border-line bg-card p-2"
        >
          {ACOES_SSO.map((a) => (
            <option key={a} value={a}>
              {LABELS[a]}
            </option>
          ))}
        </select>
        <label htmlFor="sso-escopo" className="block">
          Escopo
        </label>
        <select
          id="sso-escopo"
          value={escopo}
          onChange={(e) => {
            setEscopo(e.target.value);
            setConfirmarGlobal(false);
          }}
          className="w-full rounded border border-line bg-card p-2"
        >
          <option value="">Selecione o escopo</option>
          <option value="*">Todos os Clientes</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
        {escopo === "*" && (
          <label className="block">
            <input
              type="checkbox"
              checked={confirmarGlobal}
              onChange={(e) => setConfirmarGlobal(e.target.checked)}
            />{" "}
            Confirmo que a ação valerá para todos os Clientes.
          </label>
        )}
        {api.clientes.hasNextPage && (
          <Button onClick={() => void api.clientes.fetchNextPage()}>Mais Clientes</Button>
        )}
        <Button
          disabled={
            ocupado ||
            !motivo.trim() ||
            !escopoConfirmado ||
            (destino === "usuario" ? !usuarioConfirmado : !perfilConfirmado) ||
            (ACOES_INDIVIDUAIS.includes(acao) && destino === "perfil")
          }
          onClick={() => void conceder()}
        >
          Conceder ação
        </Button>
      </Card>
      <SecaoDados titulo="Perfis" query={api.perfis}>
        {(items) =>
          items.length ? (
            items.map((p) => (
              <Card key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <span>
                  {p.nome} · {p.ativo ? "ativo" : "inativo"}
                </span>
                <input
                  aria-label={`Nome do perfil ${p.nome}`}
                  value={nomesEditados[p.id] ?? p.nome}
                  onChange={(e) =>
                    setNomesEditados((atual) => ({ ...atual, [p.id]: e.target.value }))
                  }
                  className="rounded border border-line bg-card p-2"
                  maxLength={120}
                />
                <Button
                  disabled={
                    ocupado ||
                    api.perfis.isFetching ||
                    !motivo.trim() ||
                    !(nomesEditados[p.id] ?? "").trim() ||
                    nomesEditados[p.id]?.trim() === p.nome
                  }
                  onClick={() => {
                    const dados = {
                      expectedRevision: p.revisao,
                      perfilId: p.id,
                      nome: nomesEditados[p.id] ?? p.nome,
                      ativo: p.ativo,
                      motivo,
                    };
                    void executar(`perfil-${p.id}`, dados, (requestId) =>
                      api.perfil.mutateAsync({ ...dados, requestId }),
                    ).then((sucesso) => {
                      if (sucesso)
                        setNomesEditados((atual) => {
                          const proximo = { ...atual };
                          delete proximo[p.id];
                          return proximo;
                        });
                    });
                  }}
                >
                  Salvar nome
                </Button>
                <Button
                  disabled={ocupado || api.perfis.isFetching || !motivo.trim()}
                  onClick={() => {
                    const dados = {
                      expectedRevision: p.revisao,
                      perfilId: p.id,
                      nome: p.nome,
                      ativo: !p.ativo,
                      motivo,
                    };
                    void executar(`perfil-${p.id}`, dados, (requestId) =>
                      api.perfil.mutateAsync({ ...dados, requestId }),
                    );
                  }}
                >
                  {p.ativo ? "Desativar" : "Reativar"}
                </Button>
              </Card>
            ))
          ) : (
            <p>Nenhum perfil cadastrado.</p>
          )
        }
      </SecaoDados>
      <SecaoDados titulo="Vínculos" query={api.vinculos}>
        {(items) =>
          items.length ? (
            items.map((v) => (
              <Card key={v.id} className="flex items-center justify-between p-3">
                <span>
                  {usuarios.find((u) => u.userId === v.usuarioId)?.nome ?? "Usuário fora da página"}{" "}
                  · {perfis.find((p) => p.id === v.perfilId)?.nome ?? "Perfil fora da página"} ·{" "}
                  {v.ativo ? "ativo" : "inativo"}
                </span>
                <Button
                  disabled={ocupado || api.vinculos.isFetching || !motivo.trim()}
                  onClick={() => {
                    const dados = {
                      expectedRevision: v.revisao,
                      usuarioId: v.usuarioId,
                      perfilId: v.perfilId,
                      ativo: !v.ativo,
                      motivo,
                    };
                    void executar(`vinculo-${v.id}`, dados, (requestId) =>
                      api.vinculo.mutateAsync({ ...dados, requestId }),
                    );
                  }}
                >
                  {v.ativo ? "Revogar" : "Reativar"}
                </Button>
              </Card>
            ))
          ) : (
            <p>Nenhum vínculo cadastrado.</p>
          )
        }
      </SecaoDados>
      <SecaoDados titulo="Concessões" query={api.concessoes}>
        {(items) =>
          items.length ? (
            items.map((c) => (
              <Card key={c.id} className="flex items-center justify-between p-3">
                <span>
                  {LABELS[c.acao]} ·{" "}
                  {c.usuarioId
                    ? (usuarios.find((u) => u.userId === c.usuarioId)?.nome ??
                      "Usuário fora da página")
                    : (perfis.find((p) => p.id === c.perfilId)?.nome ??
                      "Perfil fora da página")}{" "}
                  ·{" "}
                  {c.clienteId
                    ? (clientes.find((x) => x.id === c.clienteId)?.nome ?? "Cliente fora da página")
                    : "Todos os Clientes"}{" "}
                  · {c.ativa ? "ativa" : "inativa"}
                </span>
                <Button
                  disabled={ocupado || api.concessoes.isFetching || !motivo.trim()}
                  onClick={() => {
                    const dados = {
                      expectedRevision: c.revisao,
                      usuarioId: c.usuarioId,
                      perfilId: c.perfilId,
                      acao: c.acao,
                      clienteId: c.clienteId,
                      ativa: !c.ativa,
                      motivo,
                    };
                    void executar(`concessao-${c.id}`, dados, (requestId) =>
                      api.concessao.mutateAsync({ ...dados, requestId }),
                    );
                  }}
                >
                  {c.ativa ? "Revogar" : "Reativar"}
                </Button>
              </Card>
            ))
          ) : (
            <p>Nenhuma concessão cadastrada.</p>
          )
        }
      </SecaoDados>
    </div>
  );
}

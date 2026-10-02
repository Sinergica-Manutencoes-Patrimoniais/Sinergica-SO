import { Button, Modal, Skeleton } from "@sinergica/ui";
import { Calendar, Pause, Play, Plus, RefreshCw, Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import { erroDetalhado } from "../../../lib/http/edge-function-error";
import { supabase } from "../../../lib/supabase-client";
import { calcularStatusOcorrenciaPreventiva } from "../domain/preventivas";

type Opcao = { id: string; nome: string; auvo_id?: number | null; auvo_user_id?: number | null };
type Plano = {
  id: string;
  nome: string;
  estado: "rascunho" | "ativo" | "pausado";
  primeira_data: string;
  intervalo_unidade: "semanas" | "meses";
  intervalo_n: number;
  cliente_id: string;
  sistema_id: string | null;
  equipamento_id: string | null;
  questionario_id: string;
  tipo_tarefa_id: string;
};
type Ocorrencia = {
  id: string;
  plano_id: string;
  vencimento: string;
  visita_em: string | null;
  envio_estado: "prevista" | "enviando" | "falha" | "incerto" | "disponivel";
  auvo_task_id: number | null;
  tecnico_funcionario_id: string | null;
  erro_envio: string | null;
};
type Avaliacao = {
  id: string;
  ocorrencia_id: string;
  item_referencia: string | null;
  local_informado: string | null;
  resposta: { pergunta?: string; valor?: string };
};
type FormPlano = {
  nome: string;
  clienteId: string;
  alvoTipo: "sistema" | "equipamento";
  alvoId: string;
  questionarioId: string;
  tipoTarefaId: string;
  primeiraData: string;
  intervaloN: number;
  unidade: "semanas" | "meses";
};

const vazio: FormPlano = {
  nome: "",
  clienteId: "",
  alvoTipo: "equipamento",
  alvoId: "",
  questionarioId: "",
  tipoTarefaId: "",
  primeiraData: new Date().toISOString().slice(0, 10),
  intervaloN: 1,
  unidade: "meses",
};

function dataHoraLocal(valor: string | null): string {
  if (!valor) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(valor),
  );
}
function rotuloEstado(ocorrencia: Ocorrencia): string {
  if (ocorrencia.envio_estado === "falha") return "Falha ao enviar";
  if (ocorrencia.envio_estado === "incerto") return "Reconciliação necessária";
  if (ocorrencia.envio_estado === "enviando") return "Enviando ao Auvo";
  if (ocorrencia.envio_estado === "disponivel") return "Disponível no Auvo";
  return ocorrencia.visita_em ? "Visita agendada" : "Vencimento previsto";
}

export function PreventivasPage() {
  const { user } = useAuth();
  const { carregando: permissaoCarregando, podeAcessar } = usePermissoes();
  const leitura = podeAcessar("pcm", "leitura");
  const escrita = podeAcessar("pcm", "escrita");
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [clientes, setClientes] = useState<Opcao[]>([]);
  const [sistemas, setSistemas] = useState<Array<Opcao & { cliente_id: string }>>([]);
  const [equipamentos, setEquipamentos] = useState<Array<Opcao & { client_id: string }>>([]);
  const [questionarios, setQuestionarios] = useState<Opcao[]>([]);
  const [tipos, setTipos] = useState<Opcao[]>([]);
  const [tecnicos, setTecnicos] = useState<Opcao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [novo, setNovo] = useState(false);
  const [form, setForm] = useState<FormPlano>(vazio);
  const [selecionada, setSelecionada] = useState<Ocorrencia | null>(null);
  const [tecnicoId, setTecnicoId] = useState("");
  const [visita, setVisita] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [p, o, a, c, s, e, q, t, f] = await Promise.all([
        supabase.schema("pcm").from("planos_preventivos").select("*").order("primeira_data"),
        supabase.schema("pcm").from("ocorrencias_preventivas").select("*").order("vencimento"),
        supabase
          .schema("pcm")
          .from("avaliacoes_preventivas")
          .select("*")
          .order("recebido_em", { ascending: false })
          .limit(30),
        supabase
          .schema("pcm")
          .from("clientes")
          .select("id,nome")
          .is("deleted_at", null)
          .order("nome"),
        supabase
          .schema("pcm")
          .from("sistemas")
          .select("id,nome,cliente_id")
          .is("deleted_at", null)
          .eq("ativo", true)
          .order("nome"),
        supabase
          .schema("pcm")
          .from("equipamentos")
          .select("id,nome,client_id")
          .is("deleted_at", null)
          .eq("ativo", true)
          .order("nome"),
        supabase
          .schema("pcm")
          .from("questionarios")
          .select("id,nome")
          .eq("ativo", true)
          .order("nome"),
        supabase
          .schema("pcm")
          .from("tipos_tarefa")
          .select("id,nome")
          .is("deleted_at", null)
          .eq("ativo", true)
          .order("nome"),
        supabase
          .schema("pcm")
          .from("funcionarios")
          .select("id,nome,auvo_user_id")
          .is("deleted_at", null)
          .eq("ativo", true)
          .order("nome"),
      ]);
      const falha = [p, o, a, c, s, e, q, t, f].find((resultado) => resultado.error)?.error;
      if (falha) throw falha;
      setPlanos((p.data ?? []) as Plano[]);
      setOcorrencias((o.data ?? []) as Ocorrencia[]);
      setAvaliacoes((a.data ?? []) as Avaliacao[]);
      setClientes((c.data ?? []) as Opcao[]);
      setSistemas((s.data ?? []) as Array<Opcao & { cliente_id: string }>);
      setEquipamentos((e.data ?? []) as Array<Opcao & { client_id: string }>);
      setQuestionarios((q.data ?? []) as Opcao[]);
      setTipos((t.data ?? []) as Opcao[]);
      setTecnicos((f.data ?? []) as Opcao[]);
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : "Não foi possível carregar preventivas.");
    } finally {
      setCarregando(false);
    }
  }, []);
  useEffect(() => {
    if (!permissaoCarregando && leitura) void carregar();
  }, [permissaoCarregando, leitura, carregar]);

  const alvos = useMemo(
    () =>
      form.alvoTipo === "sistema"
        ? sistemas.filter((item) => item.cliente_id === form.clienteId)
        : equipamentos.filter((item) => item.client_id === form.clienteId),
    [form.alvoTipo, form.clienteId, sistemas, equipamentos],
  );
  const planoPorId = useMemo(() => new Map(planos.map((plano) => [plano.id, plano])), [planos]);

  async function criarPlano() {
    if (
      !user ||
      !form.nome ||
      !form.clienteId ||
      !form.alvoId ||
      !form.questionarioId ||
      !form.tipoTarefaId
    ) {
      setErro("Preencha cliente, alvo, questionário Auvo e tipo de tarefa.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const { data, error } = await supabase
        .schema("pcm")
        .from("planos_preventivos")
        .insert({
          nome: form.nome,
          cliente_id: form.clienteId,
          questionario_id: form.questionarioId,
          tipo_tarefa_id: form.tipoTarefaId,
          primeira_data: form.primeiraData,
          intervalo_unidade: form.unidade,
          intervalo_n: form.intervaloN,
          estado: "ativo",
          created_by: user.id,
          ...(form.alvoTipo === "sistema"
            ? { sistema_id: form.alvoId }
            : { equipamento_id: form.alvoId }),
        })
        .select("id")
        .single();
      if (error) throw error;
      const ate = new Date();
      ate.setFullYear(ate.getFullYear() + 1);
      const { error: materializarErro } = await supabase
        .schema("pcm")
        .rpc("materializar_ocorrencias_preventivas", {
          p_plano_id: data.id,
          p_ate: ate.toISOString().slice(0, 10),
        });
      if (materializarErro) throw materializarErro;
      setNovo(false);
      setForm(vazio);
      await carregar();
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : "Não foi possível criar o plano.");
    } finally {
      setSalvando(false);
    }
  }

  async function alternarPlano(plano: Plano) {
    setSalvando(true);
    setErro(null);
    try {
      const { error } = await supabase
        .schema("pcm")
        .from("planos_preventivos")
        .update({
          estado: plano.estado === "pausado" ? "ativo" : "pausado",
          updated_by: user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", plano.id);
      if (error) throw error;
      await carregar();
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : "Não foi possível atualizar o plano.");
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarVisita() {
    if (!selecionada || !tecnicoId || !visita) {
      setErro("Informe técnico e data da visita.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const { data, error } = await supabase.functions.invoke("pcm-preventivas-confirmar", {
        body: {
          ocorrenciaId: selecionada.id,
          tecnicoFuncionarioId: tecnicoId,
          visitaEm: new Date(visita).toISOString(),
        },
      });
      if (error) throw await erroDetalhado(error);
      if (!(data as { ok?: boolean }).ok)
        throw new Error("Auvo não confirmou a abertura da tarefa.");
      setSelecionada(null);
      await carregar();
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : "Não foi possível confirmar a visita.");
    } finally {
      setSalvando(false);
    }
  }

  async function enviarAoBacklog(avaliacao: Avaliacao) {
    const descricao =
      `${avaliacao.resposta?.pergunta ?? avaliacao.item_referencia ?? "Avaliação preventiva"}: ${avaliacao.resposta?.valor ?? ""}`.trim();
    if (!window.confirm("Enviar este achado ao backlog para tratativa?")) return;
    setSalvando(true);
    setErro(null);
    try {
      const { data, error } = await supabase.functions.invoke("pcm-preventivas-enviar-backlog", {
        body: { avaliacaoId: avaliacao.id, descricao },
      });
      if (error) throw await erroDetalhado(error);
      if (!(data as { ok?: boolean }).ok) throw new Error("O achado não foi enviado ao backlog.");
    } catch (causa) {
      setErro(
        causa instanceof Error ? causa.message : "Não foi possível enviar o achado ao backlog.",
      );
    } finally {
      setSalvando(false);
    }
  }

  if (permissaoCarregando || carregando)
    return (
      <div className="p-8">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="mt-4 h-64 w-full" />
      </div>
    );
  if (!leitura)
    return <div className="p-12 text-center text-ink-3">Você não tem acesso às preventivas.</div>;

  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-heading font-semibold text-ink">Preventivas</h1>
          <p className="text-body text-ink-3">PCM planeja; o técnico executa e responde no Auvo.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => void carregar()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
          {escrita && (
            <Button onClick={() => setNovo(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo plano
            </Button>
          )}
        </div>
      </div>
      {erro && (
        <p role="alert" className="rounded-md bg-red-soft p-3 text-body text-red">
          {erro}
        </p>
      )}
      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="font-semibold text-ink">Calendário de vencimentos</h2>
        <div className="mt-3 grid gap-2">
          {ocorrencias.length === 0 ? (
            <p className="text-body text-ink-3">Nenhuma ocorrência planejada.</p>
          ) : (
            ocorrencias.map((ocorrencia) => {
              const plano = planoPorId.get(ocorrencia.plano_id);
              const estado = calcularStatusOcorrenciaPreventiva(
                {
                  vencimento: ocorrencia.vencimento,
                  ordemServico: ocorrencia.auvo_task_id
                    ? {
                        status: "planejamento",
                        auvoDisponivel: ocorrencia.envio_estado === "disponivel",
                      }
                    : null,
                },
                new Date().toISOString().slice(0, 10),
              );
              return (
                <div
                  key={ocorrencia.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line px-3 py-2"
                >
                  <div>
                    <p className="font-medium text-ink">{plano?.nome ?? "Plano removido"}</p>
                    <p className="text-sm text-ink-3">
                      Vence{" "}
                      {new Intl.DateTimeFormat("pt-BR").format(
                        new Date(`${ocorrencia.vencimento}T00:00:00`),
                      )}{" "}
                      · {rotuloEstado(ocorrencia)} ·{" "}
                      {estado === "atrasada" ? "Atrasada" : dataHoraLocal(ocorrencia.visita_em)}
                    </p>
                    {ocorrencia.erro_envio && (
                      <p className="text-sm text-red">{ocorrencia.erro_envio}</p>
                    )}
                  </div>
                  {escrita && ocorrencia.envio_estado !== "disponivel" && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSelecionada(ocorrencia);
                        setTecnicoId(ocorrencia.tecnico_funcionario_id ?? "");
                        setVisita(ocorrencia.visita_em ? ocorrencia.visita_em.slice(0, 16) : "");
                      }}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Confirmar visita
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>
      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="font-semibold text-ink">Planos ativos</h2>
        <div className="mt-3 grid gap-2">
          {planos.map((plano) => (
            <div
              key={plano.id}
              className="flex items-center justify-between rounded-md border border-line px-3 py-2"
            >
              <div>
                <p className="font-medium text-ink">{plano.nome}</p>
                <p className="text-sm text-ink-3">
                  A cada {plano.intervalo_n} {plano.intervalo_unidade} · início{" "}
                  {new Intl.DateTimeFormat("pt-BR").format(
                    new Date(`${plano.primeira_data}T00:00:00`),
                  )}{" "}
                  · {plano.estado}
                </p>
              </div>
              {escrita && (
                <Button
                  variant="secondary"
                  disabled={salvando}
                  onClick={() => void alternarPlano(plano)}
                >
                  {plano.estado === "pausado" ? (
                    <Play className="mr-2 h-4 w-4" />
                  ) : (
                    <Pause className="mr-2 h-4 w-4" />
                  )}
                  {plano.estado === "pausado" ? "Retomar" : "Pausar"}
                </Button>
              )}
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="font-semibold text-ink">Avaliações recebidas do Auvo</h2>
        <p className="mt-1 text-sm text-ink-3">
          O local informado pelo técnico é preservado como texto. Nada entra no backlog sem sua
          decisão.
        </p>
        <div className="mt-3 grid gap-2">
          {avaliacoes.length === 0 ? (
            <p className="text-body text-ink-3">Nenhuma resposta preventiva recebida.</p>
          ) : (
            avaliacoes.map((avaliacao) => (
              <div
                key={avaliacao.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line px-3 py-2"
              >
                <div>
                  <p className="font-medium text-ink">
                    {avaliacao.resposta?.pergunta ?? avaliacao.item_referencia ?? "Avaliação"}
                  </p>
                  <p className="text-sm text-ink-3">
                    {avaliacao.resposta?.valor ?? "Sem resposta"}
                    {avaliacao.local_informado ? ` · Local: ${avaliacao.local_informado}` : ""}
                  </p>
                </div>
                {escrita && (
                  <Button
                    variant="secondary"
                    disabled={salvando}
                    onClick={() => void enviarAoBacklog(avaliacao)}
                  >
                    Enviar ao backlog
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </section>
      <Modal
        open={novo}
        onOpenChange={(aberto) => setNovo(aberto)}
        titulo="Novo plano preventivo"
        descricao="O questionário será respondido pelo técnico no Auvo."
      >
        <div className="grid gap-3">
          <Campo label="Nome">
            <input
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              className="input"
            />
          </Campo>
          <Campo label="Cliente">
            <Select
              value={form.clienteId}
              onChange={(clienteId) => setForm({ ...form, clienteId, alvoId: "" })}
              opcoes={clientes}
            />
          </Campo>
          <Campo label="Alvo">
            <select
              className="input"
              value={form.alvoTipo}
              onChange={(e) =>
                setForm({ ...form, alvoTipo: e.target.value as FormPlano["alvoTipo"], alvoId: "" })
              }
            >
              <option value="equipamento">Equipamento / componente</option>
              <option value="sistema">Sistema</option>
            </select>
            <Select
              value={form.alvoId}
              onChange={(alvoId) => setForm({ ...form, alvoId })}
              opcoes={alvos}
              placeholder="Selecione o alvo"
            />
          </Campo>
          <Campo label="Questionário do Auvo">
            <Select
              value={form.questionarioId}
              onChange={(questionarioId) => setForm({ ...form, questionarioId })}
              opcoes={questionarios}
            />
          </Campo>
          <Campo label="Tipo de tarefa do Auvo">
            <Select
              value={form.tipoTarefaId}
              onChange={(tipoTarefaId) => setForm({ ...form, tipoTarefaId })}
              opcoes={tipos}
            />
          </Campo>
          <div className="grid grid-cols-3 gap-2">
            <Campo label="Primeiro vencimento">
              <input
                className="input"
                type="date"
                value={form.primeiraData}
                onChange={(e) => setForm({ ...form, primeiraData: e.target.value })}
              />
            </Campo>
            <Campo label="A cada">
              <input
                className="input"
                min="1"
                type="number"
                value={form.intervaloN}
                onChange={(e) => setForm({ ...form, intervaloN: Number(e.target.value) })}
              />
            </Campo>
            <Campo label="Unidade">
              <select
                className="input"
                value={form.unidade}
                onChange={(e) =>
                  setForm({ ...form, unidade: e.target.value as FormPlano["unidade"] })
                }
              >
                <option value="semanas">semanas</option>
                <option value="meses">meses</option>
              </select>
            </Campo>
          </div>
          <Button disabled={salvando} onClick={() => void criarPlano()}>
            <Calendar className="mr-2 h-4 w-4" />
            Criar plano
          </Button>
        </div>
      </Modal>
      <Modal
        open={selecionada !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setSelecionada(null);
        }}
        titulo="Confirmar visita e abrir OS no Auvo"
        descricao="A OS só ficará disponível depois de Auvo confirmar técnico, data, alvo e questionário."
      >
        <div className="grid gap-3">
          <Campo label="Técnico">
            <Select value={tecnicoId} onChange={setTecnicoId} opcoes={tecnicos} />
          </Campo>
          <Campo label="Data e hora da visita">
            <input
              className="input"
              type="datetime-local"
              value={visita}
              onChange={(e) => setVisita(e.target.value)}
            />
          </Campo>
          <Button disabled={salvando} onClick={() => void confirmarVisita()}>
            <Send className="mr-2 h-4 w-4" />
            Confirmar e enviar ao Auvo
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 text-sm font-medium text-ink">
      <span>{label}</span>
      {children}
    </div>
  );
}
function Select({
  value,
  onChange,
  opcoes,
  placeholder = "Selecione",
}: { value: string; onChange: (valor: string) => void; opcoes: Opcao[]; placeholder?: string }) {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {opcoes.map((opcao) => (
        <option key={opcao.id} value={opcao.id}>
          {opcao.nome}
        </option>
      ))}
    </select>
  );
}

import { Button, ConfirmDialog, Modal, Skeleton } from "@sinergica/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Pause, Play, Plus, RefreshCw, Send } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { erroDetalhado } from "../../../lib/http/edge-function-error";
import { supabase } from "../../../lib/supabase-client";
import type {
  AvaliacaoPreventiva,
  OcorrenciaPreventiva,
  OpcaoPreventiva,
  PlanoPreventivo,
} from "../application/preventivas-gateway";
import { calcularStatusOcorrenciaPreventiva } from "../domain/preventivas";
import {
  listarCatalogoPreventivas,
  listarPreventivas,
} from "../infrastructure/supabase-preventivas-adapter";
import { PreventivasCalendarioView } from "./PreventivasCalendarioView";

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

type FormValidacaoContrato = {
  clienteId: string;
  alvoTipo: "sistema" | "equipamento";
  alvoId: string;
  tecnicoId: string;
  questionarioId: string;
  tipoTarefaId: string;
  visita: string;
};

const criarFormVazio = (clienteId = ""): FormPlano => ({
  nome: "",
  clienteId,
  alvoTipo: "equipamento",
  alvoId: "",
  questionarioId: "",
  tipoTarefaId: "",
  primeiraData: new Date().toISOString().slice(0, 10),
  intervaloN: 1,
  unidade: "meses",
});

const criarFormValidacao = (clienteId = ""): FormValidacaoContrato => {
  const visita = new Date(Date.now() + 86_400_000);
  visita.setHours(10, 0, 0, 0);
  return {
    clienteId,
    alvoTipo: "equipamento",
    alvoId: "",
    tecnicoId: "",
    questionarioId: "",
    tipoTarefaId: "",
    visita: visita.toISOString().slice(0, 16),
  };
};

function dataHoraLocal(valor: string | null): string {
  if (!valor) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(valor),
  );
}

function rotuloEstado(ocorrencia: OcorrenciaPreventiva): string {
  if (ocorrencia.envio_estado === "falha") return "Falha ao enviar";
  if (ocorrencia.envio_estado === "incerto") return "Reconciliação necessária";
  if (ocorrencia.envio_estado === "enviando") return "Enviando ao Auvo";
  if (ocorrencia.envio_estado === "disponivel") return "Disponível no Auvo";
  return ocorrencia.visita_em ? "Visita agendada" : "Vencimento previsto";
}

function rotuloResultado(ocorrencia: OcorrenciaPreventiva): string {
  if (ocorrencia.resultado_estado === "nao_ok") return "Não OK";
  if (ocorrencia.resultado_estado === "ok") return "OK";
  return "Pendente";
}

function classeResultado(ocorrencia: OcorrenciaPreventiva): string {
  if (ocorrencia.resultado_estado === "nao_ok") return "bg-red-soft text-red";
  if (ocorrencia.resultado_estado === "ok") return "bg-green-soft text-green";
  return "bg-line-soft text-ink-2";
}

export function PreventivasWorkspace({
  clienteId,
  clienteNome,
  temEscrita,
  podeValidarContratoAuvo = false,
  userId,
  compacto = false,
}: {
  clienteId?: string;
  clienteNome?: string;
  temEscrita: boolean;
  podeValidarContratoAuvo?: boolean;
  userId: string;
  compacto?: boolean;
}) {
  const queryClient = useQueryClient();
  const [novo, setNovo] = useState(false);
  const [validandoContrato, setValidandoContrato] = useState(false);
  const [form, setForm] = useState<FormPlano>(() => criarFormVazio(clienteId));
  const [formValidacao, setFormValidacao] = useState<FormValidacaoContrato>(() =>
    criarFormValidacao(clienteId),
  );
  const [selecionada, setSelecionada] = useState<OcorrenciaPreventiva | null>(null);
  const [tecnicoId, setTecnicoId] = useState("");
  const [visita, setVisita] = useState("");
  const [avaliacaoParaBacklog, setAvaliacaoParaBacklog] = useState<AvaliacaoPreventiva | null>(
    null,
  );
  const [ocorrenciaEmFoco, setOcorrenciaEmFoco] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const chave = ["pcm", "preventivas", clienteId ?? "todos"] as const;
  const preventivas = useQuery({
    queryKey: chave,
    queryFn: () => listarPreventivas({ clienteId }),
  });
  const catalogo = useQuery({
    queryKey: ["pcm", "preventivas", "catalogo", clienteId ?? "todos"],
    queryFn: () => listarCatalogoPreventivas({ clienteId }),
    enabled: novo || selecionada !== null || validandoContrato,
  });

  useEffect(() => {
    setNovo(false);
    setValidandoContrato(false);
    setSelecionada(null);
    setAvaliacaoParaBacklog(null);
    setOcorrenciaEmFoco(null);
    setTecnicoId("");
    setVisita("");
    setErroAcao(null);
    setForm(criarFormVazio(clienteId));
    setFormValidacao(criarFormValidacao(clienteId));
  }, [clienteId]);

  const dados = preventivas.data;
  const planoPorId = useMemo(
    () => new Map((dados?.planos ?? []).map((plano) => [plano.id, plano])),
    [dados?.planos],
  );
  const clienteEfetivoId = clienteId ?? form.clienteId;
  const alvos = useMemo(() => {
    if (!catalogo.data) return [];
    return form.alvoTipo === "sistema"
      ? catalogo.data.sistemas.filter((item) => item.cliente_id === clienteEfetivoId)
      : catalogo.data.equipamentos.filter((item) => item.client_id === clienteEfetivoId);
  }, [catalogo.data, clienteEfetivoId, form.alvoTipo]);
  const alvosValidacao = useMemo(() => {
    if (!catalogo.data) return [];
    return formValidacao.alvoTipo === "sistema"
      ? catalogo.data.sistemas.filter((item) => item.cliente_id === formValidacao.clienteId)
      : catalogo.data.equipamentos.filter((item) => item.client_id === formValidacao.clienteId);
  }, [catalogo.data, formValidacao.alvoTipo, formValidacao.clienteId]);

  async function atualizar() {
    await queryClient.invalidateQueries({ queryKey: ["pcm", "preventivas"] });
  }

  async function criarPlano() {
    if (
      !form.nome ||
      !clienteEfetivoId ||
      !form.alvoId ||
      !form.questionarioId ||
      !form.tipoTarefaId
    ) {
      setErroAcao("Preencha cliente, alvo, questionário Auvo e tipo de tarefa.");
      return;
    }
    setSalvando(true);
    setErroAcao(null);
    try {
      const { data, error } = await supabase
        .schema("pcm")
        .from("planos_preventivos")
        .insert({
          nome: form.nome,
          cliente_id: clienteEfetivoId,
          sistema_id: form.alvoTipo === "sistema" ? form.alvoId : null,
          equipamento_id: form.alvoTipo === "equipamento" ? form.alvoId : null,
          questionario_id: form.questionarioId,
          tipo_tarefa_id: form.tipoTarefaId,
          primeira_data: form.primeiraData,
          intervalo_unidade: form.unidade,
          intervalo_n: form.intervaloN,
          estado: "ativo",
          created_by: userId,
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
      setForm(criarFormVazio(clienteId));
      await atualizar();
    } catch (causa) {
      setErroAcao(causa instanceof Error ? causa.message : "Não foi possível criar o plano.");
    } finally {
      setSalvando(false);
    }
  }

  async function alternarPlano(plano: PlanoPreventivo) {
    setSalvando(true);
    setErroAcao(null);
    try {
      const { error } = await supabase
        .schema("pcm")
        .from("planos_preventivos")
        .update({
          estado: plano.estado === "pausado" ? "ativo" : "pausado",
          updated_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", plano.id);
      if (error) throw error;
      await atualizar();
    } catch (causa) {
      setErroAcao(causa instanceof Error ? causa.message : "Não foi possível atualizar o plano.");
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarVisita() {
    if (!selecionada || !tecnicoId || !visita) {
      setErroAcao("Informe técnico e data da visita.");
      return;
    }
    setSalvando(true);
    setErroAcao(null);
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
      await atualizar();
    } catch (causa) {
      setErroAcao(causa instanceof Error ? causa.message : "Não foi possível confirmar a visita.");
    } finally {
      setSalvando(false);
    }
  }

  async function enviarAoBacklog(avaliacao: AvaliacaoPreventiva) {
    const descricao =
      `${avaliacao.resposta?.pergunta ?? avaliacao.item_referencia ?? "Avaliação preventiva"}: ${avaliacao.resposta?.valor ?? ""}`.trim();
    setSalvando(true);
    setErroAcao(null);
    try {
      const { data, error } = await supabase.functions.invoke("pcm-preventivas-enviar-backlog", {
        body: { avaliacaoId: avaliacao.id, descricao },
      });
      if (error) throw await erroDetalhado(error);
      if (!(data as { ok?: boolean }).ok) throw new Error("O achado não foi enviado ao backlog.");
      await atualizar();
    } catch (causa) {
      const mensagem =
        causa instanceof Error ? causa.message : "Não foi possível enviar o achado ao backlog.";
      setErroAcao(mensagem);
      throw new Error(mensagem);
    } finally {
      setSalvando(false);
    }
  }

  async function validarContratoAuvo() {
    const alvo = alvosValidacao.find((item) => item.id === formValidacao.alvoId);
    if (
      !formValidacao.clienteId ||
      !formValidacao.tecnicoId ||
      !formValidacao.questionarioId ||
      !formValidacao.tipoTarefaId ||
      !alvo?.auvo_equipment_id ||
      !formValidacao.visita
    ) {
      setErroAcao("Informe cliente, alvo vinculado ao Auvo, técnico, questionário, tipo e data.");
      return;
    }
    setSalvando(true);
    setErroAcao(null);
    try {
      const { data, error } = await supabase.functions.invoke("pcm-preventivas-validar-auvo", {
        body: {
          clienteId: formValidacao.clienteId,
          tecnicoFuncionarioId: formValidacao.tecnicoId,
          questionarioId: formValidacao.questionarioId,
          tipoTarefaId: formValidacao.tipoTarefaId,
          equipamentoAuvoId: alvo.auvo_equipment_id,
          alvoTipo: formValidacao.alvoTipo,
          visitaEm: new Date(formValidacao.visita).toISOString(),
        },
      });
      if (error) throw await erroDetalhado(error);
      if (!(data as { ok?: boolean }).ok) throw new Error("Auvo não confirmou a task de teste.");
      setValidandoContrato(false);
      setFormValidacao(criarFormValidacao(clienteId));
      await atualizar();
    } catch (causa) {
      setErroAcao(
        causa instanceof Error ? causa.message : "Não foi possível validar o contrato Auvo.",
      );
    } finally {
      setSalvando(false);
    }
  }

  if (preventivas.isLoading)
    return (
      <div className={compacto ? "py-4" : "p-8"}>
        <Skeleton className="h-8 w-72" />
        <Skeleton className="mt-4 h-64 w-full" />
      </div>
    );
  if (preventivas.isError)
    return (
      <div className="p-6 text-center">
        <p role="alert">Não foi possível carregar preventivas.</p>
        <Button variant="secondary" onClick={() => void preventivas.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );

  const planos = dados?.planos ?? [];
  const ocorrencias = dados?.ocorrencias ?? [];
  const avaliacoes = dados?.avaliacoes ?? [];
  const hoje = new Date().toISOString().slice(0, 10);
  const avaliacoesPorOcorrencia = new Map<string, AvaliacaoPreventiva[]>();
  for (const avaliacao of avaliacoes) {
    avaliacoesPorOcorrencia.set(avaliacao.ocorrencia_id, [
      ...(avaliacoesPorOcorrencia.get(avaliacao.ocorrencia_id) ?? []),
      avaliacao,
    ]);
  }
  const estadoDaOcorrencia = (ocorrencia: OcorrenciaPreventiva) =>
    calcularStatusOcorrenciaPreventiva(
      {
        vencimento: ocorrencia.vencimento,
        ordemServico: ocorrencia.auvo_task_id
          ? {
              status: ocorrencia.os_status ?? "planejamento",
              auvoDisponivel: ocorrencia.envio_estado === "disponivel",
            }
          : null,
      },
      hoje,
    );
  const historico = ocorrencias
    .filter((ocorrencia) => ocorrencia.auvo_task_id !== null)
    .sort((a, b) =>
      (b.os_concluida_em ?? b.visita_em ?? b.vencimento).localeCompare(
        a.os_concluida_em ?? a.visita_em ?? a.vencimento,
      ),
    );
  const ocorrenciaSelecionada = ocorrenciaEmFoco
    ? (ocorrencias.find((ocorrencia) => ocorrencia.id === ocorrenciaEmFoco) ?? null)
    : null;
  return (
    <div className={`flex flex-col gap-5 ${compacto ? "py-4" : "p-6"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-heading font-semibold text-ink">Preventivas</h1>
          <p className="text-body text-ink-3">PCM planeja; o técnico executa e responde no Auvo.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => void atualizar()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
          {podeValidarContratoAuvo && (
            <Button variant="secondary" onClick={() => setValidandoContrato(true)}>
              Validar contrato Auvo
            </Button>
          )}
          {temEscrita && (
            <Button onClick={() => setNovo(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo plano
            </Button>
          )}
        </div>
      </div>
      {(erroAcao || catalogo.isError) && (
        <p role="alert" className="rounded-md bg-red-soft p-3 text-body text-red">
          {erroAcao ?? "Não foi possível carregar o formulário."}
        </p>
      )}
      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="font-semibold text-ink">Calendário de vencimentos</h2>
        <p className="mt-1 text-sm text-ink-3">
          A visita usa a data agendada; sem agendamento, aparece no vencimento previsto.
        </p>
        <div className="mt-3">
          {ocorrencias.length === 0 ? (
            <p className="text-body text-ink-3">Nenhuma ocorrência planejada.</p>
          ) : (
            <PreventivasCalendarioView
              ocorrencias={ocorrencias.map((ocorrencia) => ({
                id: ocorrencia.id,
                nomePlano: planoPorId.get(ocorrencia.plano_id)?.nome ?? "Plano removido",
                vencimento: ocorrencia.vencimento,
                visitaEm: ocorrencia.visita_em,
                estado: estadoDaOcorrencia(ocorrencia),
              }))}
              onSelecionar={(ocorrenciaId) => {
                setOcorrenciaEmFoco(ocorrenciaId);
                requestAnimationFrame(() =>
                  document
                    .getElementById("detalhe-preventiva")
                    ?.scrollIntoView?.({ behavior: "smooth", block: "center" }),
                );
              }}
            />
          )}
        </div>
      </section>
      {ocorrenciaSelecionada && (
        <section id="detalhe-preventiva" className="rounded-lg border border-line bg-surface p-4">
          <h2 className="font-semibold text-ink">Detalhe da preventiva</h2>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium text-ink">
                {planoPorId.get(ocorrenciaSelecionada.plano_id)?.nome ?? "Plano removido"}
              </p>
              <p className="text-sm text-ink-3">
                Alvo: {planoPorId.get(ocorrenciaSelecionada.plano_id)?.alvo_nome ?? "não informado"}{" "}
                · Vence em{" "}
                {new Intl.DateTimeFormat("pt-BR").format(
                  new Date(`${ocorrenciaSelecionada.vencimento}T00:00:00`),
                )}
              </p>
              <p className="text-sm text-ink-3">
                Visita: {dataHoraLocal(ocorrenciaSelecionada.visita_em)} · Técnico:{" "}
                {ocorrenciaSelecionada.tecnico_nome ?? "não informado"} ·{" "}
                {ocorrenciaSelecionada.os_numero
                  ? `OS ${ocorrenciaSelecionada.os_numero}`
                  : "OS ainda não criada"}
              </p>
              {ocorrenciaSelecionada.erro_envio && (
                <p className="text-sm text-red">{ocorrenciaSelecionada.erro_envio}</p>
              )}
            </div>
            <span
              className={`rounded-full px-2 py-1 text-caption font-semibold ${classeResultado(ocorrenciaSelecionada)}`}
            >
              Resultado: {rotuloResultado(ocorrenciaSelecionada)}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {ocorrenciaSelecionada.auvo_task_url && (
              <a
                href={ocorrenciaSelecionada.auvo_task_url}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-line px-3 py-1.5 text-caption font-semibold text-ink hover:bg-line-soft"
              >
                Abrir formulário no Auvo
              </a>
            )}
            {temEscrita && ocorrenciaSelecionada.envio_estado !== "disponivel" && (
              <Button
                variant="secondary"
                onClick={() => {
                  setSelecionada(ocorrenciaSelecionada);
                  setTecnicoId(ocorrenciaSelecionada.tecnico_funcionario_id ?? "");
                  setVisita(
                    ocorrenciaSelecionada.visita_em
                      ? ocorrenciaSelecionada.visita_em.slice(0, 16)
                      : "",
                  );
                }}
              >
                <Send className="mr-2 h-4 w-4" />
                Confirmar visita
              </Button>
            )}
          </div>
        </section>
      )}
      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="font-semibold text-ink">Histórico de execuções</h2>
        <p className="mt-1 text-sm text-ink-3">
          O PCM mostra o resultado resumido. Formulário, fotos e medições completos ficam na tarefa
          do Auvo.
        </p>
        <div className="mt-3 grid gap-2">
          {historico.length === 0 ? (
            <p className="text-body text-ink-3">Nenhuma preventiva enviada ao Auvo ainda.</p>
          ) : (
            historico.map((ocorrencia) => {
              const avaliacoesDaOcorrencia = avaliacoesPorOcorrencia.get(ocorrencia.id) ?? [];
              return (
                <article
                  id={`preventiva-${ocorrencia.id}`}
                  key={ocorrencia.id}
                  className={`rounded-md border px-3 py-3 ${ocorrenciaEmFoco === ocorrencia.id ? "border-orange ring-1 ring-orange" : "border-line"}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink">
                        {planoPorId.get(ocorrencia.plano_id)?.nome ?? "Plano removido"}
                      </p>
                      <p className="text-sm text-ink-3">
                        {ocorrencia.os_numero
                          ? `OS ${ocorrencia.os_numero}`
                          : `Tarefa Auvo #${ocorrencia.auvo_task_id}`}{" "}
                        · Técnico: {ocorrencia.tecnico_nome ?? "não informado"} ·{" "}
                        {ocorrencia.os_concluida_em
                          ? `Executada em ${dataHoraLocal(ocorrencia.os_concluida_em)}`
                          : rotuloEstado(ocorrencia)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-caption font-semibold ${classeResultado(ocorrencia)}`}
                    >
                      Resultado: {rotuloResultado(ocorrencia)}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {ocorrencia.auvo_task_url ? (
                      <a
                        href={ocorrencia.auvo_task_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md border border-line px-3 py-1.5 text-caption font-semibold text-ink hover:bg-line-soft"
                      >
                        Abrir formulário no Auvo
                      </a>
                    ) : null}
                    <Button variant="secondary" onClick={() => setOcorrenciaEmFoco(ocorrencia.id)}>
                      Ver detalhe
                    </Button>
                    {temEscrita &&
                      avaliacoesDaOcorrencia.map((avaliacao) => (
                        <Button
                          key={avaliacao.id}
                          variant="secondary"
                          disabled={salvando}
                          onClick={() => setAvaliacaoParaBacklog(avaliacao)}
                        >
                          Enviar achado ao backlog
                        </Button>
                      ))}
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="font-semibold text-ink">Planos ativos</h2>
        <div className="mt-3 grid gap-2">
          {planos.length === 0 ? (
            <p className="text-body text-ink-3">Nenhum plano preventivo.</p>
          ) : (
            planos.map((plano) => (
              <div
                key={plano.id}
                className="flex items-center justify-between rounded-md border border-line px-3 py-2"
              >
                <div>
                  <p className="font-medium text-ink">{plano.nome}</p>
                  <p className="text-sm text-ink-3">
                    A cada {plano.intervalo_n} {plano.intervalo_unidade} · {plano.estado}
                  </p>
                </div>
                {temEscrita && (
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
            ))
          )}
        </div>
      </section>
      <Modal
        open={novo}
        onOpenChange={setNovo}
        titulo="Novo plano preventivo"
        descricao="O questionário será respondido pelo técnico no Auvo."
      >
        <div className="grid gap-3">
          <Campo label="Nome" id="preventiva-nome">
            <input
              id="preventiva-nome"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              className="input"
            />
          </Campo>
          {clienteId ? (
            <p className="text-sm text-ink-3">Cliente: {clienteNome ?? clienteId}</p>
          ) : (
            <Campo label="Cliente" id="preventiva-cliente">
              <Select
                id="preventiva-cliente"
                value={form.clienteId}
                onChange={(clienteIdSelecionado) =>
                  setForm({ ...form, clienteId: clienteIdSelecionado, alvoId: "" })
                }
                opcoes={catalogo.data?.clientes ?? []}
              />
            </Campo>
          )}
          <Campo label="Tipo de alvo" id="preventiva-alvo-tipo">
            <select
              id="preventiva-alvo-tipo"
              className="input"
              value={form.alvoTipo}
              onChange={(e) =>
                setForm({ ...form, alvoTipo: e.target.value as FormPlano["alvoTipo"], alvoId: "" })
              }
            >
              <option value="equipamento">Equipamento / componente</option>
              <option value="sistema">Sistema</option>
            </select>
          </Campo>
          <Campo label="Alvo" id="preventiva-alvo">
            <Select
              id="preventiva-alvo"
              value={form.alvoId}
              onChange={(alvoId) => setForm({ ...form, alvoId })}
              opcoes={alvos}
              placeholder="Selecione o alvo"
            />
          </Campo>
          <Campo label="Questionário do Auvo" id="preventiva-questionario">
            <Select
              id="preventiva-questionario"
              value={form.questionarioId}
              onChange={(questionarioId) => setForm({ ...form, questionarioId })}
              opcoes={catalogo.data?.questionarios ?? []}
            />
          </Campo>
          <Campo label="Tipo de tarefa do Auvo" id="preventiva-tipo">
            <Select
              id="preventiva-tipo"
              value={form.tipoTarefaId}
              onChange={(tipoTarefaId) => setForm({ ...form, tipoTarefaId })}
              opcoes={catalogo.data?.tipos ?? []}
            />
          </Campo>
          <div className="grid grid-cols-3 gap-2">
            <Campo label="Primeiro vencimento" id="preventiva-data">
              <input
                id="preventiva-data"
                className="input"
                type="date"
                value={form.primeiraData}
                onChange={(e) => setForm({ ...form, primeiraData: e.target.value })}
              />
            </Campo>
            <Campo label="A cada" id="preventiva-intervalo">
              <input
                id="preventiva-intervalo"
                className="input"
                min="1"
                type="number"
                value={form.intervaloN}
                onChange={(e) => setForm({ ...form, intervaloN: Number(e.target.value) })}
              />
            </Campo>
            <Campo label="Unidade" id="preventiva-unidade">
              <select
                id="preventiva-unidade"
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
          <Button disabled={salvando || catalogo.isLoading} onClick={() => void criarPlano()}>
            <Calendar className="mr-2 h-4 w-4" />
            Criar plano
          </Button>
        </div>
      </Modal>
      <Modal
        open={validandoContrato}
        onOpenChange={setValidandoContrato}
        titulo="Validação do contrato Auvo"
        descricao="Cria uma task futura de teste. Execute uma vez para Sistema e outra para Equipamento."
      >
        <div className="grid gap-3">
          <Campo label="Cliente" id="validacao-cliente">
            <Select
              id="validacao-cliente"
              value={formValidacao.clienteId}
              onChange={(clienteIdSelecionado) =>
                setFormValidacao({ ...formValidacao, clienteId: clienteIdSelecionado, alvoId: "" })
              }
              opcoes={catalogo.data?.clientes ?? []}
            />
          </Campo>
          <Campo label="Tipo de alvo" id="validacao-alvo-tipo">
            <select
              id="validacao-alvo-tipo"
              className="input"
              value={formValidacao.alvoTipo}
              onChange={(e) =>
                setFormValidacao({
                  ...formValidacao,
                  alvoTipo: e.target.value as FormValidacaoContrato["alvoTipo"],
                  alvoId: "",
                })
              }
            >
              <option value="equipamento">Equipamento / componente</option>
              <option value="sistema">Sistema</option>
            </select>
          </Campo>
          <Campo label="Alvo vinculado ao Auvo" id="validacao-alvo">
            <Select
              id="validacao-alvo"
              value={formValidacao.alvoId}
              onChange={(alvoId) => setFormValidacao({ ...formValidacao, alvoId })}
              opcoes={alvosValidacao}
              placeholder="Selecione o alvo"
            />
          </Campo>
          <Campo label="Técnico" id="validacao-tecnico">
            <Select
              id="validacao-tecnico"
              value={formValidacao.tecnicoId}
              onChange={(tecnicoId) => setFormValidacao({ ...formValidacao, tecnicoId })}
              opcoes={catalogo.data?.tecnicos ?? []}
            />
          </Campo>
          <Campo label="Questionário do Auvo" id="validacao-questionario">
            <Select
              id="validacao-questionario"
              value={formValidacao.questionarioId}
              onChange={(questionarioId) => setFormValidacao({ ...formValidacao, questionarioId })}
              opcoes={catalogo.data?.questionarios ?? []}
            />
          </Campo>
          <Campo label="Tipo de tarefa do Auvo" id="validacao-tipo">
            <Select
              id="validacao-tipo"
              value={formValidacao.tipoTarefaId}
              onChange={(tipoTarefaId) => setFormValidacao({ ...formValidacao, tipoTarefaId })}
              opcoes={catalogo.data?.tipos ?? []}
            />
          </Campo>
          <Campo label="Data e hora futura" id="validacao-visita">
            <input
              id="validacao-visita"
              className="input"
              type="datetime-local"
              value={formValidacao.visita}
              onChange={(e) => setFormValidacao({ ...formValidacao, visita: e.target.value })}
            />
          </Campo>
          <Button
            disabled={salvando || catalogo.isLoading}
            onClick={() => void validarContratoAuvo()}
          >
            Validar e criar task de teste
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
          <Campo label="Técnico" id="preventiva-tecnico">
            <Select
              id="preventiva-tecnico"
              value={tecnicoId}
              onChange={setTecnicoId}
              opcoes={catalogo.data?.tecnicos ?? []}
            />
          </Campo>
          <Campo label="Data e hora da visita" id="preventiva-visita">
            <input
              id="preventiva-visita"
              className="input"
              type="datetime-local"
              value={visita}
              onChange={(e) => setVisita(e.target.value)}
            />
          </Campo>
          <Button disabled={salvando || catalogo.isLoading} onClick={() => void confirmarVisita()}>
            <Send className="mr-2 h-4 w-4" />
            Confirmar e enviar ao Auvo
          </Button>
        </div>
      </Modal>
      <ConfirmDialog
        open={avaliacaoParaBacklog !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setAvaliacaoParaBacklog(null);
        }}
        titulo="Enviar achado ao backlog"
        descricao="Uma OS corretiva será criada para tratativa deste achado."
        rotuloConfirmar="Enviar ao backlog"
        onConfirmar={async () => {
          if (!avaliacaoParaBacklog) return;
          await enviarAoBacklog(avaliacaoParaBacklog);
        }}
      />
    </div>
  );
}

function Campo({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 text-sm font-medium text-ink">
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

function Select({
  id,
  value,
  onChange,
  opcoes,
  placeholder = "Selecione",
}: {
  id: string;
  value: string;
  onChange: (valor: string) => void;
  opcoes: OpcaoPreventiva[];
  placeholder?: string;
}) {
  return (
    <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {opcoes.map((opcao) => (
        <option key={opcao.id} value={opcao.id}>
          {opcao.nome}
        </option>
      ))}
    </select>
  );
}

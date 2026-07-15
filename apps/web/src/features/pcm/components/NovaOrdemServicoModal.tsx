import { X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { abrirOrdemServico, carregarDadosAberturaOs } from "../application/abrir-ordem-servico";
import { editarOrdemServico } from "../application/editar-ordem-servico";
import type { DadosAberturaOs } from "../application/ordem-servico-gateway";
import {
  CATEGORIAS_OS,
  type CategoriaOs,
  ORIGENS_OS,
  type OrigemOs,
  prioridadeParaOs,
  sugerirPrioridadePorGut,
} from "../domain/abertura-os";
import type { OrdemServicoOperacional } from "../domain/ordens-servico";
import { type PrioridadeBacklog, calcularScoreGut } from "../domain/priorizacao-backlog";
import { supabaseOrdemServicoAdapter } from "../infrastructure/supabase-ordem-servico-adapter";

const GUT_OPCOES = [1, 2, 3, 4, 5];
const PRIORIDADES: Array<{ value: PrioridadeBacklog; label: string }> = [
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
  { value: "critica", label: "Crítica" },
];

interface FormState {
  clientId: string;
  solicitante: string;
  titulo: string;
  descricao: string;
  categoria: CategoriaOs;
  prioridade: PrioridadeBacklog;
  tipoTarefaId: string;
  origem: OrigemOs;
  tecnicoId: string;
  localDescricao: string;
  dataPrevista: string;
  gravidade: number;
  urgencia: number;
  tendencia: number;
}

const hoje = new Date().toISOString().slice(0, 10);

const FORM_INICIAL: FormState = {
  clientId: "",
  solicitante: "",
  titulo: "",
  descricao: "",
  categoria: "corretiva",
  prioridade: "media",
  tipoTarefaId: "",
  origem: "solicitacao_cliente",
  tecnicoId: "",
  localDescricao: "",
  dataPrevista: hoje,
  gravidade: 3,
  urgencia: 3,
  tendencia: 3,
};

/** Converte a prioridade livre de uma OS já existente pro conjunto fechado do formulário
 * (GUT-based: baixa/media/alta/critica) — `"normal"` é um valor legado que a criação nunca produz
 * (ver `prioridadeParaOs`), tratado como "media" ao editar. */
function prioridadeParaForm(prioridade: string): PrioridadeBacklog {
  return prioridade === "baixa" ||
    prioridade === "media" ||
    prioridade === "alta" ||
    prioridade === "critica"
    ? prioridade
    : "media";
}

export function NovaOrdemServicoModal({
  aberto,
  ordem,
  onFechar,
  onCriada,
  onEditada,
}: {
  aberto: boolean;
  /** E01-S69: presente = modo edição (pré-preenche e salva via `editarOrdemServico`); ausente =
   * modo criação (comportamento original, inalterado). */
  ordem?: OrdemServicoOperacional;
  onFechar: () => void;
  onCriada?: (numero: string) => void;
  onEditada?: () => void;
}) {
  const { user } = useAuth();
  const [dados, setDados] = useState<DadosAberturaOs>({
    clientes: [],
    tecnicos: [],
    tiposTarefa: [],
  });
  const [form, setForm] = useState<FormState>(FORM_INICIAL);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [prioridadeManual, setPrioridadeManual] = useState(false);
  const editando = Boolean(ordem);

  const score = useMemo(
    () => calcularScoreGut(form.gravidade, form.urgencia, form.tendencia),
    [form.gravidade, form.urgencia, form.tendencia],
  );
  const prioridadeSugerida = useMemo(
    () => sugerirPrioridadePorGut(form.gravidade, form.urgencia, form.tendencia),
    [form.gravidade, form.urgencia, form.tendencia],
  );

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const resultado = await carregarDadosAberturaOs(supabaseOrdemServicoAdapter);
      setDados(resultado);
      setForm((f) => ({
        ...f,
        clientId: f.clientId || resultado.clientes[0]?.id || "",
        tipoTarefaId: f.tipoTarefaId || resultado.tiposTarefa[0]?.id || "",
      }));
    } catch {
      setErro("Não foi possível carregar clientes, técnicos e tipos de tarefa.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (aberto) carregar();
  }, [aberto, carregar]);

  // E01-S69: pré-preenche o formulário a partir da OS quando abre em modo edição — e trava a
  // sugestão automática de prioridade (efeito abaixo) pra não sobrescrever o valor real da OS.
  useEffect(() => {
    if (!aberto || !ordem) return;
    setForm({
      ...FORM_INICIAL,
      titulo: ordem.titulo,
      descricao: ordem.descricao ?? "",
      categoria: ordem.categoria as CategoriaOs,
      prioridade: prioridadeParaForm(ordem.prioridade),
      tecnicoId: ordem.tecnicoFuncionarioId ?? "",
      dataPrevista: ordem.dataAgendada?.slice(0, 10) ?? "",
      gravidade: ordem.gravidade ?? 3,
      urgencia: ordem.urgencia ?? 3,
      tendencia: ordem.tendencia ?? 3,
    });
    setPrioridadeManual(true);
  }, [aberto, ordem]);

  useEffect(() => {
    if (!prioridadeManual) setForm((f) => ({ ...f, prioridade: prioridadeSugerida }));
  }, [prioridadeManual, prioridadeSugerida]);

  if (!aberto) return null;
  const semClientes = !editando && dados.clientes.length === 0;
  const semTiposTarefa = !editando && dados.tiposTarefa.length === 0;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!user?.id) {
      setErro(`Sessão inválida. Entre novamente para ${editando ? "editar" : "criar"} a OS.`);
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      if (editando && ordem) {
        await editarOrdemServico(supabaseOrdemServicoAdapter, {
          id: ordem.id,
          titulo: form.titulo,
          descricao: form.descricao || null,
          categoria: form.categoria,
          prioridade: prioridadeParaOs(form.prioridade),
          gravidade: form.gravidade,
          urgencia: form.urgencia,
          tendencia: form.tendencia,
          tecnicoId: form.tecnicoId || null,
          dataPrevista: form.dataPrevista || null,
          updatedBy: user.id,
        });
        onEditada?.();
        onFechar();
      } else {
        const criada = await abrirOrdemServico(supabaseOrdemServicoAdapter, {
          clientId: form.clientId,
          titulo: form.titulo,
          descricao: form.descricao || null,
          categoria: form.categoria,
          prioridade: prioridadeParaOs(form.prioridade),
          gravidade: form.gravidade,
          urgencia: form.urgencia,
          tendencia: form.tendencia,
          localDescricao: form.localDescricao || null,
          solicitante: form.solicitante || null,
          origem: form.origem,
          tecnicoId: form.tecnicoId || null,
          tipoTarefaId: form.tipoTarefaId,
          dataPrevista: form.dataPrevista || null,
          createdBy: user.id,
        });
        onCriada?.(criada.numero);
        onFechar();
        setForm(FORM_INICIAL);
        setPrioridadeManual(false);
      }
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : `Não foi possível ${editando ? "editar" : "criar"} a OS.`,
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <form
        onSubmit={submit}
        className="w-full max-w-4xl max-h-[92vh] overflow-hidden bg-card rounded-[10px] border border-line shadow-xl flex flex-col"
      >
        <div className="px-5 py-4 border-b border-line-soft flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-ink">
              {editando ? `Editar OS ${ordem?.numero ?? ""}` : "Nova Ordem de Serviço"}
            </h2>
            <p className="text-xs text-ink-3 mt-0.5">
              {editando
                ? "Alteração de campos da OS"
                : "Abertura manual no PCM · status solicitação"}
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="w-8 h-8 rounded-[6px] border border-line flex items-center justify-center text-ink-3 hover:text-ink hover:bg-line-soft"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-5">
          {erro && (
            <div className="rounded-[6px] border border-[#F0C9C4] bg-[#FFF3F1] px-3 py-2 text-sm text-[#A72E24]">
              {erro}
            </div>
          )}
          {!carregando && semClientes && (
            <div className="rounded-[6px] border border-[#F0D4B0] bg-orange-soft px-3 py-2 text-sm text-[#7A3F00]">
              Nenhum cliente disponível no PCM. Conclua o import Auvo antes de abrir OS, inspeções
              ou laudos para um condomínio.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {!editando && (
              <>
                <Field label="Cliente *" className="md:col-span-2">
                  <select
                    value={form.clientId}
                    disabled={carregando}
                    onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
                    className="input"
                    required
                  >
                    {dados.clientes.length === 0 ? (
                      <option value="">Nenhum cliente disponível</option>
                    ) : (
                      dados.clientes.map((cliente) => (
                        <option key={cliente.id} value={cliente.id}>
                          {cliente.nome}
                        </option>
                      ))
                    )}
                  </select>
                </Field>

                <Field label="Solicitante">
                  <input
                    value={form.solicitante}
                    onChange={(e) => setForm((f) => ({ ...f, solicitante: e.target.value }))}
                    className="input"
                    placeholder="Ex: João Silva (porteiro)"
                  />
                </Field>

                <Field label="Origem">
                  <select
                    value={form.origem}
                    onChange={(e) => setForm((f) => ({ ...f, origem: e.target.value as OrigemOs }))}
                    className="input"
                  >
                    {ORIGENS_OS.map((origem) => (
                      <option key={origem.value} value={origem.value}>
                        {origem.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}

            <Field label="Título *" className="md:col-span-2">
              <input
                value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                className="input"
                placeholder="Ex: Reparo vazamento tubulação — Térreo"
                required
              />
            </Field>

            <Field label="Descrição" className="md:col-span-2">
              <textarea
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                className="input min-h-28 resize-y"
                placeholder="Descreva o problema, evidências, restrições de acesso e contexto relevante."
              />
            </Field>

            <Field label="Categoria">
              <select
                value={form.categoria}
                onChange={(e) =>
                  setForm((f) => ({ ...f, categoria: e.target.value as CategoriaOs }))
                }
                className="input"
              >
                {CATEGORIAS_OS.map((categoria) => (
                  <option key={categoria.value} value={categoria.value}>
                    {categoria.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Prioridade">
              <select
                value={form.prioridade}
                onChange={(e) => {
                  setPrioridadeManual(true);
                  setForm((f) => ({ ...f, prioridade: e.target.value as PrioridadeBacklog }));
                }}
                className="input"
              >
                {PRIORIDADES.map((prioridade) => (
                  <option key={prioridade.value} value={prioridade.value}>
                    {prioridade.label}
                  </option>
                ))}
              </select>
            </Field>

            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-4 gap-3 rounded-[8px] border border-line bg-paper p-3">
              <div className="sm:col-span-1">
                <p className="text-xs font-semibold text-ink-2">GUT</p>
                <p className="text-xs text-ink-3 mt-0.5">
                  Score {score} · {labelPrioridade(prioridadeSugerida)}
                </p>
              </div>
              <GutSelect
                label="Gravidade"
                value={form.gravidade}
                onChange={(v) => setForm((f) => ({ ...f, gravidade: v }))}
              />
              <GutSelect
                label="Urgência"
                value={form.urgencia}
                onChange={(v) => setForm((f) => ({ ...f, urgencia: v }))}
              />
              <GutSelect
                label="Tendência"
                value={form.tendencia}
                onChange={(v) => setForm((f) => ({ ...f, tendencia: v }))}
              />
            </div>

            {!editando && (
              <Field label="Tipo de tarefa *">
                {semTiposTarefa ? (
                  <p className="text-xs text-ink-3">
                    Nenhum tipo de tarefa cadastrado. Cadastre em PCM → Cadastros → Tipos de Tarefa
                    antes de abrir uma OS.
                  </p>
                ) : (
                  <select
                    value={form.tipoTarefaId}
                    onChange={(e) => setForm((f) => ({ ...f, tipoTarefaId: e.target.value }))}
                    className="input"
                    required
                  >
                    {dados.tiposTarefa.map((tipo) => (
                      <option key={tipo.id} value={tipo.id}>
                        {tipo.nome}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            )}

            <Field label="Técnico responsável">
              <select
                value={form.tecnicoId}
                onChange={(e) => setForm((f) => ({ ...f, tecnicoId: e.target.value }))}
                className="input"
              >
                <option value="">Sem técnico</option>
                {dados.tecnicos.map((tecnico) => (
                  <option key={tecnico.id} value={tecnico.id}>
                    {tecnico.nome}
                  </option>
                ))}
              </select>
            </Field>

            {!editando && (
              <Field label="Localização">
                <input
                  value={form.localDescricao}
                  onChange={(e) => setForm((f) => ({ ...f, localDescricao: e.target.value }))}
                  className="input"
                  placeholder="Ex: Térreo — Garagem B"
                />
              </Field>
            )}

            <Field label="Data prevista">
              <input
                type="date"
                value={form.dataPrevista}
                onChange={(e) => setForm((f) => ({ ...f, dataPrevista: e.target.value }))}
                className="input"
              />
            </Field>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-line-soft flex justify-end gap-3 bg-card">
          <button
            type="button"
            onClick={onFechar}
            className="px-4 py-2 rounded-[6px] border border-line text-sm font-semibold text-ink-2 hover:bg-line-soft"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvando || carregando || semClientes || semTiposTarefa}
            className="px-4 py-2 rounded-[6px] bg-navy text-white text-sm font-semibold hover:bg-navy-deep disabled:opacity-60"
          >
            {salvando ? "Salvando..." : editando ? "Salvar alterações" : "Criar OS"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-xs font-semibold text-ink-2">{label}</span>
      {children}
    </div>
  );
}

function GutSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-ink-3">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="input h-9"
      >
        {GUT_OPCOES.map((opcao) => (
          <option key={opcao} value={opcao}>
            {opcao}
          </option>
        ))}
      </select>
    </label>
  );
}

function labelPrioridade(prioridade: PrioridadeBacklog): string {
  return PRIORIDADES.find((p) => p.value === prioridade)?.label ?? prioridade;
}

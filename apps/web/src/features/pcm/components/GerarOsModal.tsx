import { Button, Modal } from "@sinergica/ui";
import { useState } from "react";
import { useFormularioSujo } from "../../../app/use-formulario-sujo";
import type { DadosAberturaOs, EquipamentoAlvoOpcao } from "../application/ordem-servico-gateway";
import type { Chamado } from "../domain/chamados";

export function GerarOsModal({
  chamado,
  destino,
  dadosOs,
  componentes,
  escopoEditavel = false,
  valoresIniciais,
  onCancel,
  onConfirmar,
}: {
  chamado: Chamado;
  destino: "convertido_os" | "backlog";
  dadosOs: DadosAberturaOs;
  componentes?: { itens: EquipamentoAlvoOpcao[]; carregando: boolean; erro: boolean; tentarNovamente: () => void };
  escopoEditavel?: boolean;
  valoresIniciais?: { titulo: string; descricao: string | null; tipoTarefaId: string | null; tecnicoId: string | null; dataPrevista: string | null; equipamentoId: string | null; gravidade: number; urgencia: number; tendencia: number };
  onCancel: () => void;
  onConfirmar: (campos: {
    tipoTarefaId: string;
    tecnicoId: string | null;
    dataPrevista: string | null;
    gravidade: number;
    urgencia: number;
    tendencia: number;
    equipamentoId?: string | null;
    titulo?: string;
    descricao?: string | null;
  }) => Promise<void>;
}) {
  const [tipoTarefaId, setTipoTarefaId] = useState(valoresIniciais?.tipoTarefaId ?? dadosOs.tiposTarefa[0]?.id ?? "");
  const [tecnicoId, setTecnicoId] = useState(valoresIniciais?.tecnicoId ?? "");
  const [dataPrevista, setDataPrevista] = useState(valoresIniciais?.dataPrevista ?? "");
  const [equipamentoId, setEquipamentoId] = useState(valoresIniciais?.equipamentoId ?? "");
  const [titulo, setTitulo] = useState(valoresIniciais?.titulo ?? chamado.titulo);
  const [descricao, setDescricao] = useState(valoresIniciais ? valoresIniciais.descricao ?? "" : chamado.descricao ?? "");
  const [gravidade, setGravidade] = useState<number | "">(valoresIniciais?.gravidade ?? (destino === "backlog" ? "" : 3));
  const [urgencia, setUrgencia] = useState<number | "">(valoresIniciais?.urgencia ?? (destino === "backlog" ? "" : 3));
  const [tendencia, setTendencia] = useState<number | "">(valoresIniciais?.tendencia ?? (destino === "backlog" ? "" : 3));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useFormularioSujo(
    {
      tipoTarefaId: dadosOs.tiposTarefa[0]?.id ?? "",
      tecnicoId: "",
      dataPrevista: "",
      equipamentoId: "",
      titulo: chamado.titulo,
      descricao: chamado.descricao ?? "",
      gravidade: destino === "backlog" ? "" : 3,
      urgencia: destino === "backlog" ? "" : 3,
      tendencia: destino === "backlog" ? "" : 3,
    },
    { tipoTarefaId, tecnicoId, dataPrevista, equipamentoId, titulo, descricao, gravidade, urgencia, tendencia },
  );

  const gutCompleto = gravidade !== "" && urgencia !== "" && tendencia !== "";

  async function confirmar() {
    if (!gutCompleto || (escopoEditavel && !titulo.trim())) return;
    setSalvando(true);
    setErro(null);
    try {
      await onConfirmar({
        tipoTarefaId,
        tecnicoId: tecnicoId || null,
        dataPrevista: dataPrevista || null,
        gravidade: gravidade as number,
        urgencia: urgencia as number,
        tendencia: tendencia as number,
        ...(componentes ? { equipamentoId: equipamentoId || null } : {}),
        ...(escopoEditavel ? { titulo: titulo.trim(), descricao: descricao.trim() || null } : {}),
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível gerar a OS.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      titulo={destino === "convertido_os" ? "Gerar OS" : "Enviar ao backlog"}
    >
      <div className="flex flex-col gap-3">
        <p className="text-body text-ink-2">
          {chamado.numero} · {chamado.titulo}
        </p>
        {escopoEditavel && <>
          <label className="block">
            <span className="mb-1 block text-caption font-semibold text-ink-3">Título da OS *</span>
            <input className="input w-full" value={titulo} maxLength={200} onChange={(e) => setTitulo(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-caption font-semibold text-ink-3">Descrição da OS</span>
            <textarea className="input w-full" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </label>
        </>}
        <div className="block">
          <label
            htmlFor="chamado-gerar-os-tipo-tarefa"
            className="mb-1 block text-caption font-semibold text-ink-3"
          >
            Tipo de tarefa *
          </label>
          {dadosOs.tiposTarefa.length === 0 ? (
            <p className="text-caption text-ink-3">
              Nenhum tipo de tarefa cadastrado. Cadastre em PCM → Cadastros → Tipos de Tarefa.
            </p>
          ) : (
            <select
              id="chamado-gerar-os-tipo-tarefa"
              value={tipoTarefaId}
              onChange={(e) => setTipoTarefaId(e.target.value)}
              className="input w-full"
            >
              {dadosOs.tiposTarefa.map((tipo) => (
                <option key={tipo.id} value={tipo.id}>
                  {tipo.nome}
                </option>
              ))}
            </select>
          )}
        </div>
        <label className="block">
          <span className="mb-1 block text-caption font-semibold text-ink-3">
            Técnico responsável
          </span>
          <select
            value={tecnicoId}
            onChange={(e) => setTecnicoId(e.target.value)}
            className="input w-full"
          >
            <option value="">Sem técnico</option>
            {dadosOs.tecnicos.map((tecnico) => (
              <option key={tecnico.id} value={tecnico.id}>
                {tecnico.nome}
              </option>
            ))}
          </select>
        </label>
        {componentes && <div>
          <label className="block">
            <span className="mb-1 block text-caption font-semibold text-ink-3">Componente (Alvo)</span>
            <select value={equipamentoId} disabled={componentes.carregando || componentes.erro} onChange={(e) => setEquipamentoId(e.target.value)} className="input w-full">
              <option value="">Sem componente</option>
              {componentes.itens.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
            </select>
          </label>
          {componentes.carregando && <p>Carregando componentes…</p>}
          {componentes.erro && <p role="alert">Não foi possível carregar componentes. <button type="button" onClick={componentes.tentarNovamente}>Tentar novamente</button></p>}
        </div>}
        <label className="block">
          <span className="mb-1 block text-caption font-semibold text-ink-3">Data prevista</span>
          <input
            type="date"
            value={dataPrevista}
            onChange={(e) => setDataPrevista(e.target.value)}
            className="input w-full"
          />
        </label>
        {destino === "backlog" && (
          <div className="grid grid-cols-3 gap-2">
            <GutSelect label="Gravidade *" value={gravidade} onChange={setGravidade} />
            <GutSelect label="Urgência *" value={urgencia} onChange={setUrgencia} />
            <GutSelect label="Tendência *" value={tendencia} onChange={setTendencia} />
          </div>
        )}
        {erro && (
          <div className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-body text-danger">
            {erro}
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-line-soft pt-3">
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={confirmar}
            disabled={salvando || !tipoTarefaId || !gutCompleto || (escopoEditavel && !titulo.trim()) || Boolean(componentes?.carregando || componentes?.erro)}
            loading={salvando}
          >
            {salvando ? "Salvando…" : "Confirmar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function GutSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | "";
  onChange: (v: number | "") => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-caption font-semibold text-ink-3">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : "")}
        className="input w-full"
      >
        <option value="">—</option>
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </label>
  );
}

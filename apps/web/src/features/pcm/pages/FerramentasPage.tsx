import { ChevronDown, ChevronUp, Pencil, Plus, RefreshCw, Trash2, Wrench, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import {
  baixarUnidadeFerramenta,
  gerarUnidadesFerramenta,
  listarUnidadesFerramenta,
} from "../application/ferramenta-unidades";
import {
  criarFerramenta,
  desativarFerramenta,
  editarFerramenta,
  listarCategoriasFerramenta,
  listarFerramentas,
} from "../application/ferramentas";
import { type FerramentaUnidadeItem, rotuloStatusUnidade } from "../domain/ferramenta-unidades";
import type {
  FerramentaCategoriaOpcao,
  FerramentaFormData,
  FerramentaItem,
} from "../domain/ferramentas";
import { supabaseFerramentaUnidadesAdapter } from "../infrastructure/supabase-ferramenta-unidades-adapter";
import { supabaseFerramentasAdapter } from "../infrastructure/supabase-ferramentas-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | {
      fase: "pronto";
      ferramentas: FerramentaItem[];
      categorias: FerramentaCategoriaOpcao[];
      unidades: FerramentaUnidadeItem[];
    };

type Modal =
  | { modo: "novo"; ferramenta?: undefined }
  | { modo: "editar"; ferramenta: FerramentaItem }
  | null;

export function FerramentasPage() {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [modal, setModal] = useState<Modal>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [expandida, setExpandida] = useState<string | null>(null);
  const [baixando, setBaixando] = useState<FerramentaUnidadeItem | null>(null);

  const temLeitura = podeAcessar("pcm", "leitura");
  const temEscrita = podeAcessar("pcm", "escrita");

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    try {
      const [ferramentas, categorias, unidades] = await Promise.all([
        listarFerramentas(supabaseFerramentasAdapter),
        listarCategoriasFerramenta(supabaseFerramentasAdapter),
        listarUnidadesFerramenta(supabaseFerramentaUnidadesAdapter),
      ]);
      setEstado({ fase: "pronto", ferramentas, categorias, unidades });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Falha ao carregar ferramentas.",
      });
    }
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  async function salvar(input: FerramentaFormData) {
    if (!user) return;
    setErroAcao(null);
    if (modal?.modo === "editar") {
      await editarFerramenta(supabaseFerramentasAdapter, {
        ...input,
        id: modal.ferramenta.id,
        userId: user.id,
      });
    } else {
      await criarFerramenta(supabaseFerramentasAdapter, { ...input, userId: user.id });
    }
    setModal(null);
    await carregar();
  }

  async function desativar(ferramenta: FerramentaItem) {
    if (!user || !confirm(`Desativar ${ferramenta.nome}?`)) return;
    try {
      setErroAcao(null);
      await desativarFerramenta(supabaseFerramentasAdapter, { id: ferramenta.id, userId: user.id });
      await carregar();
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível desativar.");
    }
  }

  async function gerarUnidades(ferramenta: FerramentaItem, quantidade: number) {
    if (!user) return;
    try {
      setErroAcao(null);
      await gerarUnidadesFerramenta(supabaseFerramentaUnidadesAdapter, {
        ferramentaId: ferramenta.id,
        quantidade,
        userId: user.id,
      });
      await carregar();
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível gerar unidades.");
    }
  }

  async function confirmarBaixa(motivo: string) {
    if (!user || !baixando) return;
    await baixarUnidadeFerramenta(supabaseFerramentaUnidadesAdapter, {
      unidadeId: baixando.id,
      motivo,
      userId: user.id,
    });
    setBaixando(null);
    await carregar();
  }

  if (permissoesCarregando || estado.fase === "carregando")
    return <div className="p-8 text-center text-sm text-ink-3">Carregando...</div>;
  if (!temLeitura) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Acesso restrito</h2>
        <p className="mt-1 text-sm text-ink-3">Você não tem permissão de leitura no módulo PCM.</p>
      </div>
    );
  }
  if (estado.fase === "erro") {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Algo deu errado</h2>
        <p className="mt-1 text-sm text-ink-3">{estado.mensagem}</p>
        <button
          type="button"
          onClick={carregar}
          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-orange hover:text-orange-deep"
        >
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[8px] border border-line bg-card p-4 shadow-[0_1px_2px_rgba(20,28,54,0.035)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-ink">Ferramentas</h3>
            <p className="mt-0.5 text-sm text-ink-3">
              Produtos Auvo tratados como ferramentas e kits operacionais
            </p>
          </div>
          {temEscrita && (
            <button
              type="button"
              onClick={() => setModal({ modo: "novo" })}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-[6px] bg-orange px-3 text-sm font-semibold text-white hover:bg-orange-deep"
            >
              <Plus className="h-4 w-4" />
              Nova ferramenta
            </button>
          )}
        </div>
        {erroAcao && (
          <div className="mt-3 rounded-[6px] border border-[#F2C0B5] bg-[#FFF4F1] px-3 py-2 text-sm text-[#A23B25]">
            {erroAcao}
          </div>
        )}
      </section>

      {estado.ferramentas.length === 0 ? (
        <div className="rounded-[8px] border border-line bg-card px-5 py-10 text-center">
          <Wrench className="mx-auto h-9 w-9 text-ink-3" />
          <p className="mt-3 text-sm text-ink-3">Nenhuma ferramenta cadastrada.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {estado.ferramentas.map((ferramenta) => (
            <FerramentaCard
              key={ferramenta.id}
              ferramenta={ferramenta}
              unidades={estado.unidades.filter((u) => u.ferramentaId === ferramenta.id)}
              expandida={expandida === ferramenta.id}
              onToggleExpandir={() =>
                setExpandida((atual) => (atual === ferramenta.id ? null : ferramenta.id))
              }
              onEditar={temEscrita ? () => setModal({ modo: "editar", ferramenta }) : undefined}
              onDesativar={temEscrita && ferramenta.ativo ? () => desativar(ferramenta) : undefined}
              onGerarUnidades={
                temEscrita
                  ? (quantidade: number) => gerarUnidades(ferramenta, quantidade)
                  : undefined
              }
              onBaixarUnidade={temEscrita ? (unidade) => setBaixando(unidade) : undefined}
            />
          ))}
        </div>
      )}

      {modal && (
        <FerramentaModal
          ferramenta={modal.modo === "editar" ? modal.ferramenta : undefined}
          categorias={estado.categorias}
          onCancel={() => setModal(null)}
          onSalvar={salvar}
        />
      )}

      {baixando && (
        <BaixaModal
          unidade={baixando}
          onCancel={() => setBaixando(null)}
          onConfirmar={confirmarBaixa}
        />
      )}
    </div>
  );
}

function FerramentaCard({
  ferramenta,
  unidades,
  expandida,
  onToggleExpandir,
  onEditar,
  onDesativar,
  onGerarUnidades,
  onBaixarUnidade,
}: {
  ferramenta: FerramentaItem;
  unidades: FerramentaUnidadeItem[];
  expandida: boolean;
  onToggleExpandir: () => void;
  onEditar?: () => void;
  onDesativar?: () => void;
  onGerarUnidades?: (quantidade: number) => void;
  onBaixarUnidade?: (unidade: FerramentaUnidadeItem) => void;
}) {
  const faltamGerar = Math.max(ferramenta.quantidadeTotal - unidades.length, 0);
  return (
    <div className="rounded-[8px] border border-line bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold text-ink">{ferramenta.nome}</h4>
          <p className="mt-1 text-xs text-ink-3">
            Auvo {ferramenta.auvoId ?? "-"} · {ferramenta.categoriaNome ?? "sem categoria"}
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ferramenta.ativo ? "bg-[#E7F6EC] text-[#1E8E45]" : "bg-[#EFF1F4] text-[#5A6175]"}`}
        >
          {ferramenta.ativo ? "Ativa" : "Inativa"}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-3">
        <span>Total: {ferramenta.quantidadeTotal}</span>
        <span>Mínimo: {ferramenta.quantidadeMinima}</span>
        <span>Sync: {ferramenta.auvoSyncStatus ?? "pending"}</span>
      </div>
      {ferramenta.auvoSyncError && (
        <p className="mt-2 text-xs text-[#A23B25]">{ferramenta.auvoSyncError}</p>
      )}

      <button
        type="button"
        onClick={onToggleExpandir}
        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-ink-2 hover:text-ink"
      >
        {expandida ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
        {unidades.length} unidade(s)
      </button>

      {expandida && (
        <div className="mt-2 space-y-2 rounded-[6px] border border-line-soft bg-paper p-2.5">
          {onGerarUnidades && faltamGerar > 0 && (
            <button
              type="button"
              onClick={() => onGerarUnidades(faltamGerar)}
              className="text-xs font-semibold text-orange hover:text-orange-deep"
            >
              Gerar {faltamGerar} unidade(s) (total cadastrado: {ferramenta.quantidadeTotal})
            </button>
          )}
          {unidades.length === 0 ? (
            <p className="text-xs text-ink-3">Nenhuma unidade gerada ainda.</p>
          ) : (
            <ul className="space-y-1.5">
              {unidades.map((unidade) => (
                <li key={unidade.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-ink-2">
                    <span className="font-brand">{unidade.codigo}</span> ·{" "}
                    {rotuloStatusUnidade(unidade.status)}
                    {unidade.status === "atribuida" && unidade.atribuidaANome
                      ? ` com ${unidade.atribuidaANome}`
                      : ""}
                  </span>
                  {onBaixarUnidade && unidade.status !== "baixada" && (
                    <button
                      type="button"
                      onClick={() => onBaixarUnidade(unidade)}
                      className="shrink-0 text-[#A23B25] hover:underline"
                    >
                      Baixar
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-3 flex justify-end gap-2">
        {onEditar && (
          <IconButton label="Editar" icon={<Pencil className="h-3.5 w-3.5" />} onClick={onEditar} />
        )}
        {onDesativar && (
          <IconButton
            label="Desativar"
            danger
            icon={<Trash2 className="h-3.5 w-3.5" />}
            onClick={onDesativar}
          />
        )}
      </div>
    </div>
  );
}

function BaixaModal({
  unidade,
  onCancel,
  onConfirmar,
}: {
  unidade: FerramentaUnidadeItem;
  onCancel: () => void;
  onConfirmar: (motivo: string) => Promise<void>;
}) {
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    try {
      setSalvando(true);
      setErro(null);
      await onConfirmar(motivo);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível dar baixa na unidade.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="w-full max-w-md rounded-[8px] border border-line bg-card shadow-xl">
        <div className="border-b border-line px-4 py-3">
          <h3 className="text-base font-semibold text-ink">Dar baixa em {unidade.codigo}</h3>
          <p className="text-xs text-ink-3">{unidade.ferramentaNome} — ação permanente</p>
        </div>
        <div className="space-y-3 p-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Motivo *</span>
            <textarea
              value={motivo}
              onChange={(event) => setMotivo(event.target.value)}
              className="input min-h-[80px] w-full resize-y"
              placeholder="Ex.: extraviada em campo, quebrada sem conserto..."
            />
          </label>
          {erro && (
            <div className="rounded-[6px] border border-[#F2C0B5] bg-[#FFF4F1] px-3 py-2 text-sm text-[#A23B25]">
              {erro}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-[6px] border border-line px-3 text-sm font-semibold text-ink-2 hover:bg-line-soft"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={salvando}
            className="h-9 rounded-[6px] bg-orange px-3 text-sm font-semibold text-white hover:bg-orange-deep disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Confirmar baixa"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FerramentaModal({
  ferramenta,
  categorias,
  onCancel,
  onSalvar,
}: {
  ferramenta?: FerramentaItem;
  categorias: FerramentaCategoriaOpcao[];
  onCancel: () => void;
  onSalvar: (input: FerramentaFormData) => Promise<void>;
}) {
  const [dados, setDados] = useState<FerramentaFormData>({
    nome: ferramenta?.nome ?? "",
    descricao: ferramenta?.descricao ?? "",
    categoriaId: ferramenta?.categoriaId ?? "",
    quantidadeTotal: ferramenta?.quantidadeTotal ?? 0,
    quantidadeMinima: ferramenta?.quantidadeMinima ?? 0,
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    try {
      setSalvando(true);
      setErro(null);
      await onSalvar(dados);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar ferramenta.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="w-full max-w-2xl rounded-[8px] border border-line bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="text-base font-semibold text-ink">
            {ferramenta ? "Editar ferramenta" : "Nova ferramenta"}
          </h3>
          <button type="button" onClick={onCancel} className="text-ink-3 hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2">
          <Field
            label="Nome *"
            value={dados.nome}
            onChange={(v) => setDados((a) => ({ ...a, nome: v }))}
          />
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Categoria</span>
            <select
              value={dados.categoriaId ?? ""}
              onChange={(event) => setDados((a) => ({ ...a, categoriaId: event.target.value }))}
              className="input w-full"
            >
              <option value="">Sem categoria</option>
              {categorias.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.nome}
                </option>
              ))}
            </select>
          </label>
          <NumberField
            label="Quantidade total"
            value={dados.quantidadeTotal}
            onChange={(v) => setDados((a) => ({ ...a, quantidadeTotal: v }))}
          />
          <NumberField
            label="Quantidade mínima"
            value={dados.quantidadeMinima}
            onChange={(v) => setDados((a) => ({ ...a, quantidadeMinima: v }))}
          />
          <label className="block md:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Descrição</span>
            <textarea
              value={dados.descricao ?? ""}
              onChange={(event) => setDados((a) => ({ ...a, descricao: event.target.value }))}
              className="input min-h-[88px] w-full resize-y"
            />
          </label>
          {erro && (
            <div className="md:col-span-2 rounded-[6px] border border-[#F2C0B5] bg-[#FFF4F1] px-3 py-2 text-sm text-[#A23B25]">
              {erro}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-[6px] border border-line px-3 text-sm font-semibold text-ink-2 hover:bg-line-soft"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="h-9 rounded-[6px] bg-orange px-3 text-sm font-semibold text-white hover:bg-orange-deep disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-ink-3">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="input w-full"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-ink-3">{label}</span>
      <input
        type="number"
        min={0}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="input w-full"
      />
    </label>
  );
}

function IconButton({
  label,
  icon,
  danger,
  onClick,
}: { label: string; icon: ReactNode; danger?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-[6px] border px-3 text-xs font-semibold ${danger ? "border-[#F2C0B5] text-[#A23B25] hover:bg-[#FFF4F1]" : "border-line text-ink-2 hover:bg-line-soft"}`}
    >
      {icon}
      {label}
    </button>
  );
}

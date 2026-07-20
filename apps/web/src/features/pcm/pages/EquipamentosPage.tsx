import { Boxes, Layers, Link2, Pencil, Plus, RefreshCw, Trash2, Wrench, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import {
  criarEquipamento,
  desativarEquipamento,
  editarEquipamento,
  listarClientesEquipamento,
  listarEquipamentos,
  obterContextoItem,
} from "../application/equipamentos";
import type {
  EquipamentoClienteOpcao,
  EquipamentoFormData,
  EquipamentoItem,
  ItemContexto,
  ItemTipo,
} from "../domain/equipamentos";
import { montarArvore } from "../domain/hierarquia";
import type { LocalArvoreNode } from "../domain/hierarquia";
import { supabaseEquipamentosAdapter } from "../infrastructure/supabase-equipamentos-adapter";
import { supabaseHierarquiaAdapter } from "../infrastructure/supabase-hierarquia-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; equipamentos: EquipamentoItem[]; clientes: EquipamentoClienteOpcao[] };

type Modal =
  | { modo: "novo"; equipamento?: undefined }
  | { modo: "editar"; equipamento: EquipamentoItem }
  | null;

type FiltroTipo = "todos" | ItemTipo;

export function EquipamentosPage() {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [modal, setModal] = useState<Modal>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [imagemAmpliada, setImagemAmpliada] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>("todos");
  const [itemDetalheId, setItemDetalheId] = useState<string | null>(null);

  const temLeitura = podeAcessar("pcm", "leitura");
  const temEscrita = podeAcessar("pcm", "escrita");

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    try {
      const [equipamentos, clientes] = await Promise.all([
        listarEquipamentos(supabaseEquipamentosAdapter),
        listarClientesEquipamento(supabaseEquipamentosAdapter),
      ]);
      setEstado({ fase: "pronto", equipamentos, clientes });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem:
          error instanceof Error ? error.message : "Não foi possível carregar equipamentos.",
      });
    }
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  async function salvar(input: EquipamentoFormData) {
    if (!user) return;
    setErroAcao(null);
    if (modal?.modo === "editar") {
      await editarEquipamento(supabaseEquipamentosAdapter, {
        ...input,
        id: modal.equipamento.id,
        userId: user.id,
      });
    } else {
      await criarEquipamento(supabaseEquipamentosAdapter, { ...input, userId: user.id });
    }
    setModal(null);
    await carregar();
  }

  async function desativar(equipamento: EquipamentoItem) {
    if (!user) return;
    try {
      setErroAcao(null);
      const possuiOs = await supabaseEquipamentosAdapter.possuiOsAberta(equipamento.id);
      const msg = possuiOs
        ? `Desativar ${equipamento.nome}? Há vínculo com OS; o histórico será preservado.`
        : `Desativar ${equipamento.nome}?`;
      if (!confirm(msg)) return;
      await desativarEquipamento(supabaseEquipamentosAdapter, {
        id: equipamento.id,
        userId: user.id,
      });
      await carregar();
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível desativar.");
    }
  }

  if (permissoesCarregando)
    return <div className="p-8 text-center text-sm text-ink-3">Carregando...</div>;
  if (!temLeitura) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Acesso restrito</h2>
        <p className="mt-1 text-sm text-ink-3">Você não tem permissão de leitura no módulo PCM.</p>
      </div>
    );
  }
  if (estado.fase === "carregando")
    return <div className="p-8 text-center text-sm text-ink-3">Carregando...</div>;
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
            <h3 className="text-base font-semibold text-ink">Equipamentos</h3>
            <p className="mt-0.5 text-sm text-ink-3">
              Cadastro PCM sincronizado com equipamentos operacionais do Auvo
            </p>
          </div>
          {temEscrita && (
            <button
              type="button"
              onClick={() => setModal({ modo: "novo" })}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-[6px] bg-orange px-3 text-sm font-semibold text-white hover:bg-orange-deep"
            >
              <Plus className="h-4 w-4" />
              Novo equipamento
            </button>
          )}
        </div>
        {erroAcao && (
          <div className="mt-3 rounded-[6px] border border-[#F2C0B5] bg-[#FFF4F1] px-3 py-2 text-sm text-[#A23B25]">
            {erroAcao}
          </div>
        )}
        {/* AC-4: filtro por tipo (equipamento|componente) */}
        <div className="mt-3 flex gap-1.5">
          {(["todos", "equipamento", "componente"] as FiltroTipo[]).map((tipo) => (
            <button
              key={tipo}
              type="button"
              onClick={() => setFiltroTipo(tipo)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                filtroTipo === tipo
                  ? "bg-navy text-white"
                  : "border border-line text-ink-2 hover:bg-line-soft"
              }`}
            >
              {tipo === "todos" ? "Todos" : tipo === "equipamento" ? "Equipamentos" : "Componentes"}
            </button>
          ))}
        </div>
      </section>

      {estado.equipamentos.length === 0 ? (
        <div className="rounded-[8px] border border-line bg-card px-5 py-10 text-center">
          <Wrench className="mx-auto h-9 w-9 text-ink-3" />
          <p className="mt-3 text-sm text-ink-3">Nenhum equipamento cadastrado.</p>
        </div>
      ) : (
        <section className="rounded-[8px] border border-line bg-card overflow-hidden">
          <div className="divide-y divide-line-soft">
            {estado.equipamentos
              .filter((equipamento) => filtroTipo === "todos" || equipamento.tipo === filtroTipo)
              .map((equipamento) => (
                <EquipamentoLinha
                  key={equipamento.id}
                  equipamento={equipamento}
                  onEditar={
                    temEscrita ? () => setModal({ modo: "editar", equipamento }) : undefined
                  }
                  onDesativar={
                    temEscrita && equipamento.ativo ? () => desativar(equipamento) : undefined
                  }
                  onAmpliarImagem={setImagemAmpliada}
                  onVerDetalhe={() => setItemDetalheId(equipamento.id)}
                />
              ))}
          </div>
        </section>
      )}

      {modal && (
        <EquipamentoModal
          equipamento={modal.modo === "editar" ? modal.equipamento : undefined}
          clientes={estado.clientes}
          equipamentosDisponiveis={estado.equipamentos}
          onCancel={() => setModal(null)}
          onSalvar={salvar}
        />
      )}

      {itemDetalheId && (
        <ItemDetalheModal itemId={itemDetalheId} onFechar={() => setItemDetalheId(null)} />
      )}

      {imagemAmpliada && (
        <div className="modal-backdrop">
          <div className="max-h-[85vh] max-w-3xl">
            <div className="flex justify-end pb-2">
              <button
                type="button"
                onClick={() => setImagemAmpliada(null)}
                className="rounded-full bg-card p-1.5 text-ink-2 hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <img
              src={imagemAmpliada}
              alt="Equipamento ampliado"
              className="max-h-[75vh] w-full rounded-[8px] object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function EquipamentoLinha({
  equipamento,
  onEditar,
  onDesativar,
  onAmpliarImagem,
  onVerDetalhe,
}: {
  equipamento: EquipamentoItem;
  onEditar?: () => void;
  onDesativar?: () => void;
  onAmpliarImagem: (url: string) => void;
  onVerDetalhe: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      {equipamento.urlImagem ? (
        <button
          type="button"
          onClick={() => onAmpliarImagem(equipamento.urlImagem as string)}
          className="h-9 w-9 shrink-0 overflow-hidden rounded-[6px] border border-line"
        >
          <img
            src={equipamento.urlImagem}
            alt={equipamento.nome}
            className="h-full w-full object-cover"
          />
        </button>
      ) : (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] border border-line bg-line-soft">
          <Wrench className="h-4 w-4 text-ink-3" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="truncate text-sm font-semibold text-ink">{equipamento.nome}</span>
          <span
            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${equipamento.ativo ? "bg-[#E7F6EC] text-[#1E8E45]" : "bg-[#EFF1F4] text-[#5A6175]"}`}
          >
            {equipamento.ativo ? "Ativo" : "Inativo"}
          </span>
          <span className="shrink-0 rounded-full bg-line-soft px-1.5 py-0.5 text-[10px] font-semibold text-ink-2">
            {equipamento.tipo === "componente" ? "Componente" : "Equipamento"}
          </span>
        </div>
        <p className="truncate text-xs text-ink-3">
          {equipamento.categoria ?? "Sem categoria"} · {equipamento.clienteNome ?? "sem vínculo"}
          {equipamento.localizacao ? ` · ${equipamento.localizacao}` : ""}
          {equipamento.auvoSyncError ? ` · erro: ${equipamento.auvoSyncError}` : ""}
        </p>
      </div>

      <button
        type="button"
        onClick={onVerDetalhe}
        className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-[6px] border border-line px-2.5 text-xs font-semibold text-ink-2 hover:bg-line-soft"
      >
        <Layers className="h-3.5 w-3.5" />
        Detalhe
      </button>

      {onEditar && (
        <button
          type="button"
          onClick={onEditar}
          className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-[6px] border border-line px-2.5 text-xs font-semibold text-ink-2 hover:bg-line-soft"
        >
          <Pencil className="h-3.5 w-3.5" />
          Editar
        </button>
      )}
      {onDesativar && (
        <button
          type="button"
          onClick={onDesativar}
          className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-[6px] border border-[#F2C0B5] px-2.5 text-xs font-semibold text-[#A23B25] hover:bg-[#FFF4F1]"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Desativar
        </button>
      )}
    </div>
  );
}

function EquipamentoModal({
  equipamento,
  clientes,
  equipamentosDisponiveis,
  onCancel,
  onSalvar,
}: {
  equipamento?: EquipamentoItem;
  clientes: EquipamentoClienteOpcao[];
  equipamentosDisponiveis: EquipamentoItem[];
  onCancel: () => void;
  onSalvar: (input: EquipamentoFormData) => Promise<void>;
}) {
  const [dados, setDados] = useState<EquipamentoFormData>({
    nome: equipamento?.nome ?? "",
    identificador: equipamento?.identificador ?? "",
    categoria: equipamento?.categoria ?? "",
    clientId: equipamento?.clientId ?? "",
    localizacao: equipamento?.localizacao ?? "",
    observacoes: equipamento?.observacoes ?? "",
    tipo: equipamento?.tipo ?? "equipamento",
    localId: equipamento?.localId ?? "",
    parentItemId: equipamento?.parentItemId ?? "",
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [locaisDoCliente, setLocaisDoCliente] = useState<LocalArvoreNode[]>([]);

  useEffect(() => {
    if (!dados.clientId) {
      setLocaisDoCliente([]);
      return;
    }
    let cancelado = false;
    supabaseHierarquiaAdapter.listarLocaisDoCliente(dados.clientId).then((locais) => {
      if (!cancelado) setLocaisDoCliente(montarArvore(locais));
    });
    return () => {
      cancelado = true;
    };
  }, [dados.clientId]);

  // AC-5: Componente pode ser filho de um Equipamento do MESMO cliente — lista só equipamentos
  // (não outros componentes) do cliente selecionado, excluindo o próprio item (edição).
  const paisDisponiveis = equipamentosDisponiveis.filter(
    (e) => e.tipo === "equipamento" && e.clientId === dados.clientId && e.id !== equipamento?.id,
  );

  async function salvar() {
    try {
      setSalvando(true);
      setErro(null);
      await onSalvar(dados);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar equipamento.");
    } finally {
      setSalvando(false);
    }
  }

  function setCampo(campo: keyof EquipamentoFormData, valor: string) {
    setDados((atual) => ({ ...atual, [campo]: valor }));
  }

  return (
    <div className="modal-backdrop">
      <div className="w-full max-w-3xl rounded-[8px] border border-line bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="text-base font-semibold text-ink">
            {equipamento ? "Editar equipamento" : "Novo equipamento"}
          </h3>
          <button type="button" onClick={onCancel} className="text-ink-3 hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid max-h-[70vh] grid-cols-1 gap-3 overflow-y-auto p-4 md:grid-cols-2">
          <Field label="Nome *" value={dados.nome} onChange={(v) => setCampo("nome", v)} />
          <Field
            label="Identificador"
            value={dados.identificador ?? ""}
            onChange={(v) => setCampo("identificador", v)}
          />
          <Field
            label="Categoria"
            value={dados.categoria ?? ""}
            onChange={(v) => setCampo("categoria", v)}
          />
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Cliente</span>
            <select
              value={dados.clientId ?? ""}
              onChange={(event) => setCampo("clientId", event.target.value)}
              className="input w-full"
            >
              <option value="">Sem vínculo</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nome}
                  {cliente.auvoId ? ` · Auvo ${cliente.auvoId}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Tipo</span>
            <select
              value={dados.tipo ?? "equipamento"}
              onChange={(event) =>
                setDados((atual) => ({
                  ...atual,
                  tipo: event.target.value as EquipamentoFormData["tipo"],
                  // trocar pra "equipamento" limpa o pai — invariante só faz sentido pra componente
                  parentItemId: event.target.value === "componente" ? atual.parentItemId : "",
                }))
              }
              className="input w-full"
            >
              <option value="equipamento">Equipamento</option>
              <option value="componente">Componente</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Local (AC-4)</span>
            <select
              value={dados.localId ?? ""}
              onChange={(event) => setCampo("localId", event.target.value)}
              className="input w-full"
              disabled={!dados.clientId}
            >
              <option value="">Sem local</option>
              {flattenArvore(locaisDoCliente).map(({ local, profundidade }) => (
                <option key={local.id} value={local.id}>
                  {"— ".repeat(profundidade)}
                  {local.nome}
                </option>
              ))}
            </select>
          </label>
          {dados.tipo === "componente" && (
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-ink-3">
                Equipamento pai (AC-5)
              </span>
              <select
                value={dados.parentItemId ?? ""}
                onChange={(event) => setCampo("parentItemId", event.target.value)}
                className="input w-full"
                disabled={!dados.clientId}
              >
                <option value="">Nenhum</option>
                {paisDisponiveis.map((pai) => (
                  <option key={pai.id} value={pai.id}>
                    {pai.nome}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block md:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Observações</span>
            <textarea
              value={dados.observacoes ?? ""}
              onChange={(event) => setCampo("observacoes", event.target.value)}
              className="input min-h-[92px] w-full resize-y"
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

function flattenArvore(
  nodes: LocalArvoreNode[],
  profundidade = 0,
): Array<{ local: LocalArvoreNode; profundidade: number }> {
  return nodes.flatMap((node) => [
    { local: node, profundidade },
    ...flattenArvore(node.filhos, profundidade + 1),
  ]);
}

/** AC-6 — Detalhe do Item: breadcrumb Cliente>Área>Local + chips de Sistema + componentes
 * filhos aninhados sob o Equipamento pai. */
function ItemDetalheModal({ itemId, onFechar }: { itemId: string; onFechar: () => void }) {
  const [contexto, setContexto] = useState<ItemContexto | null | "carregando">("carregando");

  useEffect(() => {
    setContexto("carregando");
    obterContextoItem(supabaseEquipamentosAdapter, itemId).then(setContexto);
  }, [itemId]);

  return (
    <div className="modal-backdrop">
      <div className="w-full max-w-xl rounded-[8px] border border-line bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="text-base font-semibold text-ink">Detalhe do Item</h3>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="text-ink-3 hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto p-4">
          {contexto === "carregando" ? (
            <p className="text-sm text-ink-3">Carregando…</p>
          ) : contexto === null ? (
            <p className="text-sm text-ink-3">Item não encontrado.</p>
          ) : (
            <>
              <div>
                <h4 className="text-lg font-semibold text-ink">{contexto.item.nome}</h4>
                {/* AC-6: breadcrumb Cliente > Área > Local */}
                <p className="mt-1 text-sm text-ink-3" data-testid="item-breadcrumb">
                  {contexto.breadcrumb
                    ? [
                        contexto.breadcrumb.clienteNome,
                        contexto.breadcrumb.areaNome,
                        contexto.breadcrumb.localNome,
                      ]
                        .filter(Boolean)
                        .join(" > ")
                    : "Sem instalação definida (Local não atribuído)."}
                </p>
              </div>

              <div>
                <h5 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-ink-3">
                  Faz parte de
                </h5>
                {contexto.sistemas.length === 0 ? (
                  <p className="text-sm text-ink-3">Nenhum Sistema.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {contexto.sistemas.map((sistema) => (
                      <span
                        key={sistema.id}
                        className="inline-flex items-center gap-1.5 rounded-full bg-orange-soft px-3 py-1 text-xs font-semibold text-orange-deep"
                      >
                        <Link2 className="h-3 w-3" />
                        {sistema.nome}
                        {sistema.codigo ? ` · ${sistema.codigo}` : ""}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {contexto.componentesFilhos.length > 0 && (
                <div>
                  <h5 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-ink-3">
                    Componentes
                  </h5>
                  <div className="flex flex-col gap-1.5">
                    {contexto.componentesFilhos.map((componente) => (
                      <div
                        key={componente.id}
                        className="flex items-center gap-2 rounded-[6px] border border-line px-3 py-2 text-sm text-ink-2"
                      >
                        <Boxes className="h-3.5 w-3.5 text-ink-3" />
                        {componente.nome}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
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

// E01-S73: admin de tipos de inspeção + checklist templates. D-4 (design.md): parametrização é
// configuração, não operação diária — RLS já exige papel supervisor/superadmin (migration 0091);
// esta tela também confere o papel client-side pra dar feedback antes de tentar salvar.
import { Plus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import {
  carregarParametrizacaoInspecao,
  criarTemplate,
  criarTipoInspecao,
  editarTipoInspecao,
} from "../application/qualidade";
import type { ChecklistTemplate, TipoInspecao } from "../application/qualidade-gateway";
import { SISTEMAS_INSPECAO } from "../domain/inspecoes-laudos";
import { supabaseQualidadeAdapter } from "../infrastructure/supabase-qualidade-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; tipos: TipoInspecao[]; templates: ChecklistTemplate[] };

type Modal = { modo: "tipo"; tipo?: TipoInspecao } | { modo: "template"; tipoId: string } | null;

export function TiposInspecaoPage() {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [modal, setModal] = useState<Modal>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const temLeitura = podeAcessar("pcm", "leitura");
  const temEscrita =
    podeAcessar("pcm", "escrita") && (user?.papel === "supervisor" || user?.papel === "superadmin");

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    try {
      const { tipos, templates } = await carregarParametrizacaoInspecao(supabaseQualidadeAdapter);
      setEstado({ fase: "pronto", tipos, templates });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem:
          error instanceof Error ? error.message : "Não foi possível carregar tipos de inspeção.",
      });
    }
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  async function salvarTipo(nome: string, normaTecnica: string, descricao: string) {
    if (!user) return;
    try {
      setErroAcao(null);
      if (modal?.modo === "tipo" && modal.tipo) {
        await editarTipoInspecao(supabaseQualidadeAdapter, {
          id: modal.tipo.id,
          nome,
          normaTecnica: normaTecnica || null,
          descricao: descricao || null,
          createdBy: user.id,
          updatedBy: user.id,
        });
      } else {
        await criarTipoInspecao(supabaseQualidadeAdapter, {
          nome,
          normaTecnica: normaTecnica || null,
          descricao: descricao || null,
          createdBy: user.id,
        });
      }
      setModal(null);
      await carregar();
    } catch (error) {
      setErroAcao(
        error instanceof Error ? error.message : "Não foi possível salvar o tipo de inspeção.",
      );
    }
  }

  async function salvarTemplate(
    tipoId: string,
    nome: string,
    itens: Array<{ categoria: string; sistema: string; elemento: string; obrigatorio: boolean }>,
  ) {
    if (!user) return;
    try {
      setErroAcao(null);
      await criarTemplate(supabaseQualidadeAdapter, {
        tipoInspecaoId: tipoId,
        nome,
        itens: itens.map((item) => ({
          categoria: item.categoria || null,
          sistema: item.sistema || null,
          elemento: item.elemento || null,
          obrigatorio: item.obrigatorio,
        })),
        createdBy: user.id,
      });
      setModal(null);
      await carregar();
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível salvar o template.");
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
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[8px] border border-line bg-card p-4 shadow-[0_1px_2px_rgba(20,28,54,0.035)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-ink">Tipos de Inspeção</h3>
            <p className="mt-0.5 text-sm text-ink-3">
              Parametrização ABNT NBR 16747 — cada tipo (predial, elétrica, SPDA...) tem seus
              checklists configuráveis. Só supervisor/superadmin edita.
            </p>
          </div>
          {temEscrita && (
            <button
              type="button"
              onClick={() => setModal({ modo: "tipo" })}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-[6px] bg-orange px-3 text-sm font-semibold text-white hover:bg-orange-deep"
            >
              <Plus className="h-4 w-4" />
              Novo tipo
            </button>
          )}
        </div>
        {!temEscrita && podeAcessar("pcm", "escrita") && (
          <p className="mt-3 text-xs text-ink-3">
            Sua conta tem escrita no PCM, mas editar tipos/templates exige papel supervisor ou
            superadmin.
          </p>
        )}
        {erroAcao && (
          <div className="mt-3 rounded-[6px] border border-[#F2C0B5] bg-[#FFF4F1] px-3 py-2 text-sm text-[#A23B25]">
            {erroAcao}
          </div>
        )}
      </section>

      {estado.tipos.length === 0 ? (
        <div className="rounded-[8px] border border-line bg-card px-5 py-10 text-center">
          <p className="text-sm text-ink-3">Nenhum tipo de inspeção cadastrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {estado.tipos.map((tipo) => {
            const templatesDoTipo = estado.templates.filter((t) => t.tipoInspecaoId === tipo.id);
            return (
              <div key={tipo.id} className="rounded-[8px] border border-line bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold text-ink">{tipo.nome}</h4>
                    {tipo.normaTecnica && <p className="text-xs text-ink-3">{tipo.normaTecnica}</p>}
                  </div>
                  {temEscrita && (
                    <button
                      type="button"
                      onClick={() => setModal({ modo: "tipo", tipo })}
                      className="text-xs font-semibold text-ink-2 hover:text-ink"
                    >
                      Editar
                    </button>
                  )}
                </div>
                {tipo.descricao && <p className="mt-2 text-xs text-ink-3">{tipo.descricao}</p>}

                <div className="mt-3 border-t border-line-soft pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">
                    Checklists ({templatesDoTipo.length})
                  </p>
                  {templatesDoTipo.length === 0 ? (
                    <p className="mt-1 text-xs text-ink-3">Nenhum checklist ainda.</p>
                  ) : (
                    <ul className="mt-1 space-y-1">
                      {templatesDoTipo.map((template) => (
                        <li key={template.id} className="text-xs text-ink-2">
                          {template.nome} · {template.itens.length} item(ns)
                        </li>
                      ))}
                    </ul>
                  )}
                  {temEscrita && (
                    <button
                      type="button"
                      onClick={() => setModal({ modo: "template", tipoId: tipo.id })}
                      className="mt-2 text-xs font-semibold text-orange hover:text-orange-deep"
                    >
                      + Novo checklist
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal?.modo === "tipo" && (
        <TipoModal tipo={modal.tipo} onCancel={() => setModal(null)} onSalvar={salvarTipo} />
      )}
      {modal?.modo === "template" && (
        <TemplateModal
          tipoId={modal.tipoId}
          onCancel={() => setModal(null)}
          onSalvar={(nome, itens) => salvarTemplate(modal.tipoId, nome, itens)}
        />
      )}
    </div>
  );
}

function TipoModal({
  tipo,
  onCancel,
  onSalvar,
}: {
  tipo?: TipoInspecao;
  onCancel: () => void;
  onSalvar: (nome: string, normaTecnica: string, descricao: string) => Promise<void>;
}) {
  const [nome, setNome] = useState(tipo?.nome ?? "");
  const [normaTecnica, setNormaTecnica] = useState(tipo?.normaTecnica ?? "");
  const [descricao, setDescricao] = useState(tipo?.descricao ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    try {
      setSalvando(true);
      setErro(null);
      await onSalvar(nome, normaTecnica, descricao);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="w-full max-w-md rounded-[8px] border border-line bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="text-base font-semibold text-ink">
            {tipo ? "Editar tipo de inspeção" : "Novo tipo de inspeção"}
          </h3>
          <button type="button" onClick={onCancel} className="text-ink-3 hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 p-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Nome *</span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="input w-full"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Norma técnica</span>
            <input
              value={normaTecnica ?? ""}
              onChange={(e) => setNormaTecnica(e.target.value)}
              className="input w-full"
              placeholder="Ex: ABNT NBR 16747"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Descrição</span>
            <textarea
              value={descricao ?? ""}
              onChange={(e) => setDescricao(e.target.value)}
              className="input min-h-[70px] w-full resize-y"
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
            onClick={salvar}
            disabled={salvando || !nome.trim()}
            className="h-9 rounded-[6px] bg-orange px-3 text-sm font-semibold text-white hover:bg-orange-deep disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface TemplateItemForm {
  categoria: string;
  sistema: string;
  elemento: string;
  obrigatorio: boolean;
}

function TemplateModal({
  tipoId: _tipoId,
  onCancel,
  onSalvar,
}: {
  tipoId: string;
  onCancel: () => void;
  onSalvar: (nome: string, itens: TemplateItemForm[]) => Promise<void>;
}) {
  const [nome, setNome] = useState("");
  const [itens, setItens] = useState<TemplateItemForm[]>([
    { categoria: "", sistema: "", elemento: "", obrigatorio: false },
  ]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function atualizarItem(indice: number, campo: keyof TemplateItemForm, valor: string | boolean) {
    setItens((atual) =>
      atual.map((item, i) => (i === indice ? { ...item, [campo]: valor } : item)),
    );
  }

  async function salvar() {
    try {
      setSalvando(true);
      setErro(null);
      await onSalvar(
        nome,
        itens.filter((item) => item.categoria || item.elemento),
      );
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar o checklist.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="w-full max-w-xl rounded-[8px] border border-line bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="text-base font-semibold text-ink">Novo checklist</h3>
          <button type="button" onClick={onCancel} className="text-ink-3 hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[70vh] space-y-3 overflow-y-auto p-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Nome do checklist *</span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="input w-full"
            />
          </label>
          <div>
            <span className="mb-1 block text-xs font-semibold text-ink-3">Itens esperados</span>
            <div className="space-y-2">
              {itens.map((item, indice) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: linha de formulário sem id próprio ainda
                  key={indice}
                  className="grid grid-cols-[1fr_1fr_1fr_auto_auto] gap-2"
                >
                  <input
                    placeholder="Categoria"
                    value={item.categoria}
                    onChange={(e) => atualizarItem(indice, "categoria", e.target.value)}
                    className="input h-9"
                  />
                  <select
                    value={item.sistema}
                    onChange={(e) => atualizarItem(indice, "sistema", e.target.value)}
                    className="input h-9"
                  >
                    <option value="">Sistema</option>
                    {SISTEMAS_INSPECAO.map((sistema) => (
                      <option key={sistema.valor} value={sistema.valor}>
                        {sistema.rotulo}
                      </option>
                    ))}
                  </select>
                  <input
                    placeholder="Elemento"
                    value={item.elemento}
                    onChange={(e) => atualizarItem(indice, "elemento", e.target.value)}
                    className="input h-9"
                  />
                  <label className="flex items-center gap-1 text-xs text-ink-3">
                    <input
                      type="checkbox"
                      checked={item.obrigatorio}
                      onChange={(e) => atualizarItem(indice, "obrigatorio", e.target.checked)}
                    />
                    Obrig.
                  </label>
                  <button
                    type="button"
                    onClick={() => setItens((atual) => atual.filter((_, i) => i !== indice))}
                    className="text-xs font-semibold text-[#A23B25] hover:underline"
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                setItens((atual) => [
                  ...atual,
                  { categoria: "", sistema: "", elemento: "", obrigatorio: false },
                ])
              }
              className="mt-2 text-xs font-semibold text-orange hover:text-orange-deep"
            >
              + Adicionar item
            </button>
          </div>
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
            onClick={salvar}
            disabled={salvando || !nome.trim()}
            className="h-9 rounded-[6px] bg-orange px-3 text-sm font-semibold text-white hover:bg-orange-deep disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Salvar checklist"}
          </button>
        </div>
      </div>
    </div>
  );
}

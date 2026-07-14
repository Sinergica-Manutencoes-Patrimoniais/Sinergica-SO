// E01-S66: kits de ferramentas — agrupamento PCM-only (Auvo não tem endpoint de kit/bundle).
// Componente auto-contido (carrega os próprios dados) pra não inchar FerramentasPage.tsx — vive
// como uma seção a mais na mesma página, mesmo padrão visual de Reservas (E01-S64).
import { Package, Plus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { listarUnidadesFerramenta } from "../application/ferramenta-unidades";
import { listarFerramentas } from "../application/ferramentas";
import {
  atribuirKit,
  criarKit,
  desativarKit,
  devolverKit,
  editarKit,
  listarAtribuicoesAtivasKit,
  listarKits,
} from "../application/kits";
import type { FerramentaItem, FuncionarioFerramentaOpcao } from "../domain/ferramentas";
import {
  type KitAtribuicaoAtiva,
  type KitFormData,
  type KitItem,
  itensFaltantes,
  kitAtribuicaoEstaCompleta,
  kitEstaCompleto,
} from "../domain/kits";
import { supabaseFerramentaUnidadesAdapter } from "../infrastructure/supabase-ferramenta-unidades-adapter";
import { supabaseFerramentasAdapter } from "../infrastructure/supabase-ferramentas-adapter";
import { supabaseKitsAdapter } from "../infrastructure/supabase-kits-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | {
      fase: "pronto";
      kits: KitItem[];
      ferramentas: FerramentaItem[];
      funcionarios: FuncionarioFerramentaOpcao[];
      disponivelPorFerramenta: Map<string, number>;
      atribuicoesAtivas: KitAtribuicaoAtiva[];
    };

type Modal = { modo: "novo"; kit?: undefined } | { modo: "editar"; kit: KitItem } | null;

export function KitsSection({ temEscrita }: { temEscrita: boolean }) {
  const { user } = useAuth();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [modal, setModal] = useState<Modal>(null);
  const [atribuindo, setAtribuindo] = useState<KitItem | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    try {
      const [kits, ferramentas, unidades, funcionarios, atribuicoesAtivas] = await Promise.all([
        listarKits(supabaseKitsAdapter),
        listarFerramentas(supabaseFerramentasAdapter),
        listarUnidadesFerramenta(supabaseFerramentaUnidadesAdapter),
        supabaseFerramentasAdapter.listarFuncionarios(),
        listarAtribuicoesAtivasKit(supabaseKitsAdapter),
      ]);
      const disponivelPorFerramenta = new Map<string, number>();
      for (const unidade of unidades) {
        if (unidade.status === "disponivel") {
          disponivelPorFerramenta.set(
            unidade.ferramentaId,
            (disponivelPorFerramenta.get(unidade.ferramentaId) ?? 0) + 1,
          );
        }
      }
      setEstado({
        fase: "pronto",
        kits,
        ferramentas,
        funcionarios,
        disponivelPorFerramenta,
        atribuicoesAtivas,
      });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Falha ao carregar kits.",
      });
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function salvar(input: KitFormData) {
    if (!user) return;
    if (modal?.modo === "editar") {
      await editarKit(supabaseKitsAdapter, { ...input, id: modal.kit.id, userId: user.id });
    } else {
      await criarKit(supabaseKitsAdapter, { ...input, userId: user.id });
    }
    setModal(null);
    await carregar();
  }

  async function desativar(kit: KitItem) {
    if (!user || !confirm(`Desativar o kit ${kit.nome}?`)) return;
    try {
      setErroAcao(null);
      await desativarKit(supabaseKitsAdapter, { id: kit.id, userId: user.id });
      await carregar();
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível desativar o kit.");
    }
  }

  async function confirmarAtribuir(funcionarioId: string) {
    if (!user || !atribuindo) return;
    await atribuirKit(supabaseKitsAdapter, {
      kitId: atribuindo.id,
      funcionarioId,
      userId: user.id,
    });
    setAtribuindo(null);
    await carregar();
  }

  async function devolver(atribuicao: KitAtribuicaoAtiva) {
    if (!user || !confirm(`Devolver o kit de ${atribuicao.funcionarioNome}?`)) return;
    try {
      setErroAcao(null);
      await devolverKit(supabaseKitsAdapter, {
        kitAtribuicaoId: atribuicao.kitAtribuicaoId,
        condicao: "ok",
        userId: user.id,
      });
      await carregar();
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível devolver o kit.");
    }
  }

  if (estado.fase === "carregando") {
    return (
      <section className="rounded-[8px] border border-line bg-card p-4">
        <p className="text-sm text-ink-3">Carregando kits...</p>
      </section>
    );
  }
  if (estado.fase === "erro") {
    return (
      <section className="rounded-[8px] border border-line bg-card p-4">
        <p className="text-sm text-[#A23B25]">{estado.mensagem}</p>
      </section>
    );
  }

  return (
    <section className="rounded-[8px] border border-line bg-card p-4 shadow-[0_1px_2px_rgba(20,28,54,0.035)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-ink">Kits</h3>
          <p className="mt-0.5 text-sm text-ink-3">
            Conjunto nomeado de ferramentas, atribuído/devolvido como uma unidade só (conceito só do
            PCM — o Auvo não tem kit)
          </p>
        </div>
        {temEscrita && (
          <button
            type="button"
            onClick={() => setModal({ modo: "novo" })}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-[6px] bg-orange px-3 text-sm font-semibold text-white hover:bg-orange-deep"
          >
            <Plus className="h-4 w-4" />
            Novo kit
          </button>
        )}
      </div>

      {erroAcao && (
        <div className="mt-3 rounded-[6px] border border-[#F2C0B5] bg-[#FFF4F1] px-3 py-2 text-sm text-[#A23B25]">
          {erroAcao}
        </div>
      )}

      {estado.kits.length === 0 ? (
        <p className="mt-4 text-sm text-ink-3">Nenhum kit cadastrado.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {estado.kits.map((kit) => {
            const completo = kitEstaCompleto(kit.itens, estado.disponivelPorFerramenta);
            const faltando = itensFaltantes(kit.itens, estado.disponivelPorFerramenta);
            return (
              <li key={kit.id} className="rounded-[6px] border border-line-soft bg-paper p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-ink">{kit.nome}</p>
                    <p className="text-xs text-ink-3">
                      {kit.itens
                        .map((item) => `${item.quantidade}× ${item.ferramentaNome}`)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${completo ? "bg-[#E7F6EC] text-[#1E8E45]" : "bg-[#FFF4F1] text-[#A23B25]"}`}
                    >
                      {completo ? "Completo agora" : "Incompleto"}
                    </span>
                    {temEscrita && (
                      <>
                        <button
                          type="button"
                          onClick={() => setModal({ modo: "editar", kit })}
                          className="text-xs font-semibold text-ink-2 hover:text-ink"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setAtribuindo(kit)}
                          disabled={!completo}
                          className="text-xs font-semibold text-orange hover:text-orange-deep disabled:opacity-40"
                        >
                          Atribuir
                        </button>
                        <button
                          type="button"
                          onClick={() => desativar(kit)}
                          className="text-xs font-semibold text-[#A23B25] hover:underline"
                        >
                          Desativar
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {!completo && faltando.length > 0 && (
                  <p className="mt-1 text-xs text-[#A23B25]">
                    Falta: {faltando.map((item) => item.ferramentaNome).join(", ")}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {estado.atribuicoesAtivas.length > 0 && (
        <div className="mt-5 border-t border-line-soft pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">
            Kits atribuídos
          </p>
          <ul className="mt-2 space-y-2">
            {estado.atribuicoesAtivas.map((atribuicao) => {
              const completa = kitAtribuicaoEstaCompleta(atribuicao);
              return (
                <li
                  key={atribuicao.kitAtribuicaoId}
                  className="flex items-center justify-between gap-2 rounded-[6px] border border-line-soft bg-paper px-3 py-2 text-sm"
                >
                  <span className="text-ink-2">
                    <Package className="mr-1.5 inline h-3.5 w-3.5 text-ink-3" />
                    {atribuicao.funcionarioNome} · {atribuicao.itensAindaComTecnico}/
                    {atribuicao.totalItens} unidade(s)
                    {!completa && (
                      <span className="ml-2 text-xs text-[#A16B0B]">
                        kit incompleto com o técnico
                      </span>
                    )}
                  </span>
                  {temEscrita && (
                    <button
                      type="button"
                      onClick={() => devolver(atribuicao)}
                      className="shrink-0 text-xs font-semibold text-ink-2 hover:text-ink"
                    >
                      Devolver kit
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {modal && (
        <KitModal
          kit={modal.modo === "editar" ? modal.kit : undefined}
          ferramentas={estado.ferramentas}
          onCancel={() => setModal(null)}
          onSalvar={salvar}
        />
      )}

      {atribuindo && (
        <AtribuirKitModal
          kit={atribuindo}
          funcionarios={estado.funcionarios}
          onCancel={() => setAtribuindo(null)}
          onConfirmar={confirmarAtribuir}
        />
      )}
    </section>
  );
}

function KitModal({
  kit,
  ferramentas,
  onCancel,
  onSalvar,
}: {
  kit?: KitItem;
  ferramentas: FerramentaItem[];
  onCancel: () => void;
  onSalvar: (input: KitFormData) => Promise<void>;
}) {
  const [nome, setNome] = useState(kit?.nome ?? "");
  const [descricao, setDescricao] = useState(kit?.descricao ?? "");
  const [itens, setItens] = useState<Array<{ ferramentaId: string; quantidade: number }>>(
    kit?.itens.map((item) => ({
      ferramentaId: item.ferramentaId,
      quantidade: item.quantidade,
    })) ?? [{ ferramentaId: "", quantidade: 1 }],
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function atualizarItem(indice: number, campo: "ferramentaId" | "quantidade", valor: string) {
    setItens((atual) =>
      atual.map((item, i) =>
        i === indice ? { ...item, [campo]: campo === "quantidade" ? Number(valor) : valor } : item,
      ),
    );
  }

  function removerItem(indice: number) {
    setItens((atual) => atual.filter((_, i) => i !== indice));
  }

  async function salvar() {
    try {
      setSalvando(true);
      setErro(null);
      await onSalvar({ nome, descricao, itens: itens.filter((item) => item.ferramentaId) });
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar o kit.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="w-full max-w-xl rounded-[8px] border border-line bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="text-base font-semibold text-ink">{kit ? "Editar kit" : "Novo kit"}</h3>
          <button type="button" onClick={onCancel} className="text-ink-3 hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[70vh] space-y-3 overflow-y-auto p-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Nome *</span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="input w-full"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Descrição</span>
            <textarea
              value={descricao ?? ""}
              onChange={(e) => setDescricao(e.target.value)}
              className="input min-h-[60px] w-full resize-y"
            />
          </label>
          <div>
            <span className="mb-1 block text-xs font-semibold text-ink-3">Itens do kit</span>
            <div className="space-y-2">
              {itens.map((item, indice) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: linha de formulário sem id próprio ainda
                  key={indice}
                  className="grid grid-cols-[1fr_90px_auto] gap-2"
                >
                  <select
                    value={item.ferramentaId}
                    onChange={(e) => atualizarItem(indice, "ferramentaId", e.target.value)}
                    className="input h-9"
                  >
                    <option value="">Ferramenta</option>
                    {ferramentas.map((ferramenta) => (
                      <option key={ferramenta.id} value={ferramenta.id}>
                        {ferramenta.nome}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={item.quantidade}
                    onChange={(e) => atualizarItem(indice, "quantidade", e.target.value)}
                    className="input h-9"
                  />
                  <button
                    type="button"
                    onClick={() => removerItem(indice)}
                    className="text-xs font-semibold text-[#A23B25] hover:underline"
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setItens((atual) => [...atual, { ferramentaId: "", quantidade: 1 }])}
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

function AtribuirKitModal({
  kit,
  funcionarios,
  onCancel,
  onConfirmar,
}: {
  kit: KitItem;
  funcionarios: FuncionarioFerramentaOpcao[];
  onCancel: () => void;
  onConfirmar: (funcionarioId: string) => Promise<void>;
}) {
  const [funcionarioId, setFuncionarioId] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    try {
      setSalvando(true);
      setErro(null);
      await onConfirmar(funcionarioId);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível atribuir o kit.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="w-full max-w-md rounded-[8px] border border-line bg-card shadow-xl">
        <div className="border-b border-line px-4 py-3">
          <h3 className="text-base font-semibold text-ink">Atribuir kit {kit.nome}</h3>
        </div>
        <div className="space-y-3 p-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Técnico</span>
            <select
              value={funcionarioId}
              onChange={(e) => setFuncionarioId(e.target.value)}
              className="input w-full"
            >
              <option value="">Escolha o técnico</option>
              {funcionarios.map((funcionario) => (
                <option key={funcionario.id} value={funcionario.id}>
                  {funcionario.nome}
                </option>
              ))}
            </select>
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
            disabled={salvando || !funcionarioId}
            className="h-9 rounded-[6px] bg-orange px-3 text-sm font-semibold text-white hover:bg-orange-deep disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Atribuir"}
          </button>
        </div>
      </div>
    </div>
  );
}

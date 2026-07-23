// MarcacoesClientePage.tsx — E01-S91 AC-1. Catálogo gerenciável de marcações de status de cliente
// (nome+cor) — Configurações → PCM.
import { Edit3, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import {
  criarMarcacao,
  editarMarcacao,
  excluirMarcacao,
  listarMarcacoes,
} from "../application/marcacoes-cliente";
import type { MarcacaoCliente } from "../domain/marcacoes-cliente";
import { supabaseMarcacoesClienteAdapter } from "../infrastructure/supabase-marcacoes-cliente-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; marcacoes: MarcacaoCliente[] };

interface ModalState {
  modo: "criar" | "editar";
  item?: MarcacaoCliente;
}

const COR_PADRAO = "#6B7280";

export function MarcacoesClientePage() {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [modal, setModal] = useState<ModalState | null>(null);
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState(COR_PADRAO);
  const [salvando, setSalvando] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const temLeitura = podeAcessar("pcm", "leitura");
  const temEscrita = podeAcessar("pcm", "escrita");

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    try {
      const marcacoes = await listarMarcacoes(supabaseMarcacoesClienteAdapter);
      setEstado({ fase: "pronto", marcacoes });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Não foi possível carregar marcações.",
      });
    }
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  function abrirModal(next: ModalState) {
    setModal(next);
    setNome(next.item?.nome ?? "");
    setCor(next.item?.cor ?? COR_PADRAO);
    setErroAcao(null);
  }

  async function onSalvar() {
    if (!user || !modal) return;
    setSalvando(true);
    setErroAcao(null);
    try {
      if (modal.modo === "criar") {
        await criarMarcacao(supabaseMarcacoesClienteAdapter, { nome, cor, userId: user.id });
      } else if (modal.item) {
        await editarMarcacao(supabaseMarcacoesClienteAdapter, {
          id: modal.item.id,
          nome,
          cor,
          userId: user.id,
        });
      }
      setModal(null);
      await carregar();
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function onExcluir(item: MarcacaoCliente) {
    if (!window.confirm(`Excluir "${item.nome}"?`)) return;
    setSalvando(true);
    setErroAcao(null);
    try {
      await excluirMarcacao(supabaseMarcacoesClienteAdapter, item.id);
      await carregar();
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível excluir.");
    } finally {
      setSalvando(false);
    }
  }

  if (permissoesCarregando) {
    return <div className="p-8 text-center text-sm text-ink-3">Carregando…</div>;
  }
  if (!temLeitura) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Acesso restrito</h2>
        <p className="mt-1 text-sm text-ink-3">Você não tem permissão de leitura no módulo PCM.</p>
      </div>
    );
  }
  if (estado.fase === "carregando") {
    return <div className="p-8 text-center text-sm text-ink-3">Carregando…</div>;
  }
  if (estado.fase === "erro") {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Algo deu errado</h2>
        <p className="mt-1 text-sm text-ink-3">{estado.mensagem}</p>
        <button type="button" onClick={carregar} className="mt-4 text-sm font-semibold text-orange">
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Marcações de Cliente</h2>
          <p className="text-sm text-ink-3">
            Catálogo de status (nome+cor) — exatamente 1 marcação vigente por cliente
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={carregar} className="btn-secondary">
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
          {temEscrita && (
            <button
              type="button"
              onClick={() => abrirModal({ modo: "criar" })}
              className="btn-primary"
            >
              <Plus className="h-4 w-4" />
              Nova marcação
            </button>
          )}
        </div>
      </div>

      {erroAcao && (
        <div className="rounded-[6px] border border-[#F0C2BD] bg-[#FFF4F2] px-4 py-2 text-sm text-[#A12D24]">
          {erroAcao}
        </div>
      )}

      <section className="rounded-[10px] border border-line bg-card">
        <div className="divide-y divide-line-soft">
          {estado.marcacoes.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-ink-3">
              Nenhuma marcação cadastrada.
            </div>
          ) : (
            estado.marcacoes.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-1 gap-3 px-4 py-3 md:grid-cols-[24px_1fr_96px] md:items-center"
              >
                <span
                  className="h-5 w-5 shrink-0 rounded-full border border-line-soft"
                  style={{ backgroundColor: item.cor }}
                  title={item.cor}
                />
                <p className="font-semibold text-ink">{item.nome}</p>
                {temEscrita && (
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => abrirModal({ modo: "editar", item })}
                      className="rounded-[6px] border border-line p-2 text-ink-2 hover:bg-line-soft"
                      title="Editar"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={salvando}
                      onClick={() => onExcluir(item)}
                      className="rounded-[6px] border border-[#F0C2BD] p-2 text-[#A12D24] hover:bg-[#FFF4F2] disabled:opacity-50"
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      {modal && (
        <div className="modal-backdrop">
          <div className="w-full max-w-lg rounded-[10px] border border-line bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
              <h3 className="text-base font-semibold text-ink">
                {modal.modo === "criar" ? "Nova marcação" : "Editar marcação"}
              </h3>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-[6px] p-2 text-ink-3 hover:bg-line-soft"
                title="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              className="space-y-4 px-4 py-3"
              onSubmit={(event) => {
                event.preventDefault();
                void onSalvar();
              }}
            >
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                  Nome *
                </span>
                <input
                  className="input mt-1"
                  value={nome}
                  onChange={(event) => setNome(event.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                  Cor *
                </span>
                <input
                  type="color"
                  className="mt-1 h-10 w-20 cursor-pointer rounded-[6px] border border-line"
                  value={cor}
                  onChange={(event) => setCor(event.target.value)}
                />
              </label>

              {erroAcao && (
                <div className="rounded-[6px] border border-[#F0C2BD] bg-[#FFF4F2] px-4 py-2 text-sm text-[#A12D24]">
                  {erroAcao}
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-line-soft pt-4">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="rounded-[6px] border border-line px-4 py-2 text-sm font-semibold text-ink-2 hover:bg-line-soft"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="rounded-[6px] bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-deep disabled:opacity-50"
                >
                  {salvando ? "Salvando…" : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

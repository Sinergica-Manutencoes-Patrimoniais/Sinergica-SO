// E01-S78: drawer lateral de detalhe do ativo. Reusa `obterContextoItem` (E01-S76) para
// breadcrumb/sistemas/componentes e acrescenta o histórico de OS (E01-S16). Fecha por X e por Esc.
// E01-S79: passa a permitir editar o ativo direto do drawer (antes só visualização).
import { Pencil, Puzzle, Wrench, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import { obterDetalheAtivo } from "../application/board-ativos";
import type { DetalheAtivo } from "../application/board-ativos";
import {
  editarEquipamento,
  listarClientesEquipamento,
  listarEquipamentos,
} from "../application/equipamentos";
import type {
  EquipamentoClienteOpcao,
  EquipamentoFormData,
  EquipamentoItem,
} from "../domain/equipamentos";
import { ultimaManutencao } from "../domain/historico-ativo";
import { supabaseBoardAtivosAdapter } from "../infrastructure/supabase-board-ativos-adapter";
import { supabaseEquipamentosAdapter } from "../infrastructure/supabase-equipamentos-adapter";
import { EquipamentoModal } from "./EquipamentoModal";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; detalhe: DetalheAtivo };

type OpcoesEdicao = { clientes: EquipamentoClienteOpcao[]; equipamentos: EquipamentoItem[] };

function dataBr(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}

export function DrawerDetalheAtivo({
  itemId,
  onClose,
  onAtualizado,
}: {
  itemId: string;
  onClose: () => void;
  /** notifica o board pra recarregar (item movido/renomeado etc.) após uma edição salva. */
  onAtualizado?: () => void;
}) {
  const { user } = useAuth();
  const { podeAcessar } = usePermissoes();
  const temEscrita = podeAcessar("pcm", "escrita");
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [editando, setEditando] = useState(false);
  const [opcoes, setOpcoes] = useState<OpcoesEdicao | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let vivo = true;
    setEstado({ fase: "carregando" });
    obterDetalheAtivo(supabaseEquipamentosAdapter, supabaseBoardAtivosAdapter, itemId)
      .then((detalhe) => {
        if (vivo) setEstado({ fase: "pronto", detalhe });
      })
      .catch(() => {
        if (vivo) setEstado({ fase: "erro", mensagem: "Não foi possível carregar o detalhe." });
      });
    return () => {
      vivo = false;
    };
  }, [itemId]);

  async function abrirEdicao() {
    setEditando(true);
    if (!opcoes) {
      const [clientes, equipamentos] = await Promise.all([
        listarClientesEquipamento(supabaseEquipamentosAdapter),
        listarEquipamentos(supabaseEquipamentosAdapter),
      ]);
      setOpcoes({ clientes, equipamentos });
    }
  }

  async function salvarEdicao(input: EquipamentoFormData) {
    if (!user || estado.fase !== "pronto" || !estado.detalhe.contexto) return;
    await editarEquipamento(supabaseEquipamentosAdapter, {
      ...input,
      id: estado.detalhe.contexto.item.id,
      userId: user.id,
    });
    setEditando(false);
    const detalhe = await obterDetalheAtivo(
      supabaseEquipamentosAdapter,
      supabaseBoardAtivosAdapter,
      itemId,
    );
    setEstado({ fase: "pronto", detalhe });
    onAtualizado?.();
  }

  const item = estado.fase === "pronto" ? estado.detalhe.contexto?.item : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Esc já fecha via listener global acima. */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />
      <div className="drawer-panel relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-line bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="text-base font-semibold text-ink">Detalhe do ativo</h3>
          <div className="flex items-center gap-3">
            {temEscrita && item && (
              <button
                type="button"
                onClick={abrirEdicao}
                aria-label="Editar ativo"
                className="flex items-center gap-1 text-xs font-semibold text-orange hover:text-orange-deep"
              >
                <Pencil className="h-4 w-4" />
                Editar
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar detalhe do ativo"
              className="text-ink-3 hover:text-ink"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {estado.fase === "carregando" && (
          <div className="p-8 text-center text-sm text-ink-3">Carregando...</div>
        )}
        {estado.fase === "erro" && (
          <div className="p-8 text-center text-sm text-[#A23B25]">{estado.mensagem}</div>
        )}
        {estado.fase === "pronto" && <Conteudo detalhe={estado.detalhe} />}
      </div>

      {editando && item && opcoes && (
        <EquipamentoModal
          equipamento={item}
          clientes={opcoes.clientes}
          equipamentosDisponiveis={opcoes.equipamentos}
          onCancel={() => setEditando(false)}
          onSalvar={salvarEdicao}
        />
      )}
    </div>
  );
}

function Conteudo({ detalhe }: { detalhe: DetalheAtivo }) {
  const { contexto, historicoOs } = detalhe;
  if (!contexto) {
    return <div className="p-8 text-center text-sm text-ink-3">Ativo não encontrado.</div>;
  }
  const { item, breadcrumb, sistemas, componentesFilhos } = contexto;
  const Icone = item.tipo === "componente" ? Puzzle : Wrench;
  const caminho = [
    breadcrumb?.clienteNome,
    breadcrumb?.areaNome,
    breadcrumb?.localNome ?? "Sem local",
  ]
    .filter((v) => v != null && v !== "")
    .join(" › ");

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        {item.urlImagem ? (
          <img src={item.urlImagem} alt="" className="h-16 w-16 rounded object-cover" />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded bg-line-soft">
            <Icone className="h-7 w-7 text-ink-3" />
          </span>
        )}
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold text-ink">{item.nome}</h4>
          <p className="text-xs text-ink-3">
            {item.tipo === "componente" ? "Componente" : "Equipamento"}
            {!item.ativo && " · inativo"}
          </p>
        </div>
      </div>

      <Secao titulo="Instalado em">
        <p className="text-sm text-ink-2">{caminho || "—"}</p>
      </Secao>

      <Secao titulo="Sistemas">
        {sistemas.length === 0 ? (
          <p className="text-xs text-ink-3">Não faz parte de nenhum sistema.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {sistemas.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center gap-1 rounded-full bg-orange-soft px-2 py-0.5 text-[11px] font-semibold text-orange-deep"
              >
                {s.nome}
                {s.codigo && <span className="font-normal text-ink-3">· {s.codigo}</span>}
              </span>
            ))}
          </div>
        )}
      </Secao>

      {componentesFilhos.length > 0 && (
        <Secao titulo="Componentes">
          <ul className="flex flex-col gap-1">
            {componentesFilhos.map((c) => (
              <li key={c.id} className="flex items-center gap-2 text-xs text-ink-2">
                <Puzzle className="h-3.5 w-3.5 text-ink-3" />
                {c.nome}
              </li>
            ))}
          </ul>
        </Secao>
      )}

      <Secao titulo="Histórico de OS">
        {historicoOs === null ? (
          <p className="text-xs text-ink-3">Não foi possível carregar o histórico.</p>
        ) : historicoOs.length === 0 ? (
          <p className="text-xs text-ink-3">Nenhuma OS registrada para este ativo.</p>
        ) : (
          <>
            <p className="mb-2 text-xs text-ink-3">
              Última manutenção:{" "}
              <strong className="text-ink-2">{dataBr(ultimaManutencao(historicoOs))}</strong>
            </p>
            <ul className="flex flex-col divide-y divide-line-soft">
              {historicoOs.map((os) => (
                <li
                  key={os.osId}
                  className="flex items-center justify-between gap-2 py-1.5 text-xs"
                >
                  <span className="font-brand tabular-nums text-ink-3">{os.numero}</span>
                  <span className="min-w-0 flex-1 truncate text-ink-2">
                    {[os.categoria, os.status].filter(Boolean).join(" · ") || "—"}
                  </span>
                  <span className="shrink-0 tabular-nums text-ink-3">{dataBr(os.data)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Secao>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h5 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
        {titulo}
      </h5>
      {children}
    </section>
  );
}

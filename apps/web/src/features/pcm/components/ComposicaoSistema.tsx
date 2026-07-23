// ComposicaoSistema.tsx — E01-S86 AC-1/AC-2/AC-3: composição de um Sistema via checkbox+filtro.
// Componente compartilhado — usado por `SistemasPage.tsx` (PCM) e `VisaoClientePage.tsx` (Visão
// 360, AC-2), mesmo comportamento nos dois pontos de entrada. Staged: marca/desmarca em memória,
// "Salvar" persiste tudo de uma vez (diff, ver `salvarComposicaoSistema`).
import { useCallback, useEffect, useState } from "react";
import {
  listarItensDisponiveis,
  listarItensDoSistema,
  salvarComposicaoSistema,
} from "../application/sistemas";
import type { SistemasGateway } from "../application/sistemas-gateway";
import type { Sistema } from "../domain/sistemas";
import { SeletorItensComFiltro } from "./SeletorItensComFiltro";

export function ComposicaoSistema({
  gateway,
  sistema,
  temEscrita,
  userId,
  onSalvo,
}: {
  gateway: SistemasGateway;
  sistema: Sistema;
  temEscrita: boolean;
  userId: string;
  onSalvo?: () => void;
}) {
  const [estado, setEstado] = useState<
    | { fase: "carregando" }
    | { fase: "erro"; mensagem: string }
    | { fase: "pronto"; itens: Array<{ id: string; nome: string }>; membrosOriginaisIds: string[] }
  >({ fase: "carregando" });
  const [selecionadosIds, setSelecionadosIds] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    try {
      const [itens, membros] = await Promise.all([
        listarItensDisponiveis(gateway, sistema.clienteId),
        listarItensDoSistema(gateway, sistema.id),
      ]);
      const membrosOriginaisIds = membros.map((m) => m.itemId);
      setEstado({ fase: "pronto", itens, membrosOriginaisIds });
      // AC-3: itens já pertencentes ao sistema vêm marcados quando o seletor abre.
      setSelecionadosIds(new Set(membrosOriginaisIds));
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Não foi possível carregar os itens.",
      });
    }
  }, [gateway, sistema.id, sistema.clienteId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function toggle(id: string) {
    setSelecionadosIds((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) {
        proximo.delete(id);
      } else {
        proximo.add(id);
      }
      return proximo;
    });
  }

  async function salvar() {
    setSalvando(true);
    setErroSalvar(null);
    try {
      await salvarComposicaoSistema(gateway, sistema.id, [...selecionadosIds], userId);
      await carregar();
      onSalvo?.();
    } catch (error) {
      setErroSalvar(
        error instanceof Error ? error.message : "Não foi possível salvar a composição.",
      );
    } finally {
      setSalvando(false);
    }
  }

  if (estado.fase === "carregando") {
    return <p className="px-1 py-3 text-sm text-ink-3">Carregando itens…</p>;
  }
  if (estado.fase === "erro") {
    return <p className="px-1 py-3 text-sm text-[#A23B25]">{estado.mensagem}</p>;
  }

  const houveMudanca =
    estado.membrosOriginaisIds.length !== selecionadosIds.size ||
    estado.membrosOriginaisIds.some((id) => !selecionadosIds.has(id));

  return (
    <div className="flex flex-col gap-3">
      <SeletorItensComFiltro
        itens={estado.itens}
        selecionadosIds={selecionadosIds}
        onToggle={toggle}
        disabled={!temEscrita || salvando}
      />
      {erroSalvar && <p className="text-xs text-[#A23B25]">{erroSalvar}</p>}
      {temEscrita && (
        <button
          type="button"
          onClick={salvar}
          disabled={salvando || !houveMudanca}
          className="h-9 self-start rounded-[6px] bg-orange px-3 text-sm font-semibold text-white hover:bg-orange-deep disabled:opacity-50"
        >
          {salvando ? "Salvando…" : "Salvar composição"}
        </button>
      )}
    </div>
  );
}

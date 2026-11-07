import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { validarMovimentoComponente } from "../../application/estrutura-tecnica";
import type { MoverComponenteCommand } from "../../application/estrutura-tecnica-gateway";

export function MovimentarComponente({
  userId,
  clienteId,
  item,
  areas,
  locais,
  pais,
  enviar,
  onConcluido,
}: {
  userId: string;
  clienteId: string;
  item: {
    id: string;
    estruturaRevisao?: number;
    areaId: string | null;
    localId: string | null;
    parentItemId: string | null;
  };
  areas: { id: string; nome: string }[];
  locais: { id: string; areaId: string; nome: string }[];
  pais: { id: string; nome: string }[];
  enviar: (comando: MoverComponenteCommand) => Promise<unknown>;
  onConcluido: () => void;
}) {
  const chave = `sso-movimento:${userId}:${clienteId}:${item.id}`;
  const [recuperacao] = useState(() => {
    try {
      const valor = sessionStorage.getItem(chave);
      const comando = valor ? validarMovimentoComponente(JSON.parse(valor)) : null;
      if (comando && comando.componenteId !== item.id) throw new Error("Componente divergente");
      return { pendente: comando, falhou: false };
    } catch {
      return { pendente: null, falhou: true };
    }
  });
  const [pendente, setPendente] = useState(recuperacao.pendente);
  const [origem] = useState(() => ({ ...item }));
  const origemMudou =
    item.id !== origem.id ||
    item.estruturaRevisao !== origem.estruturaRevisao ||
    item.areaId !== origem.areaId ||
    item.localId !== origem.localId ||
    item.parentItemId !== origem.parentItemId;
  const [areaId, setAreaId] = useState(item.areaId ?? "");
  const [localId, setLocalId] = useState(item.localId ?? "");
  const [parentId, setParentId] = useState(item.parentItemId ?? "");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const montado = useRef(false);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);
  function removerPendenteCorrespondente(comando: MoverComponenteCommand) {
    if (sessionStorage.getItem(chave) !== JSON.stringify(comando)) {
      throw new Error("A operação guardada foi alterada.");
    }
    sessionStorage.removeItem(chave);
  }
  async function conferirSessao() {
    const { data, error } = await supabase.auth.getUser();
    if (error || data.user?.id !== userId || !montado.current) throw new Error("Sessão alterada.");
  }
  async function executar(comando: MoverComponenteCommand, primeiraTentativa = false) {
    setOcupado(true);
    setErro("");
    try {
      await conferirSessao();
      if (sessionStorage.getItem(chave) !== JSON.stringify(comando)) throw new Error("Tentativa alterada.");
      const recibo = z.object({
        requestId: z.string().guid(),
        aggregateId: z.string().guid(),
        revision: z.number().int().positive(),
        linkedIds: z.object({
          clienteId: z.string().guid(),
          areaId: z.string().guid().optional(),
          localId: z.string().guid().optional(),
          parentId: z.string().guid().optional(),
        }),
      }).passthrough().parse(await enviar(comando));
      if (
        recibo.requestId !== comando.requestId ||
        recibo.aggregateId !== comando.componenteId ||
        (recibo.revision !== comando.expectedRevision && recibo.revision !== comando.expectedRevision + 1) ||
        recibo.linkedIds.clienteId !== clienteId ||
        (recibo.linkedIds.areaId ?? null) !== comando.areaId ||
        (recibo.linkedIds.localId ?? null) !== comando.localId ||
        (recibo.linkedIds.parentId ?? null) !== comando.parentId
      ) throw new Error("Recibo divergente.");
      await conferirSessao();
      removerPendenteCorrespondente(comando);
      setPendente(null);
      if (montado.current) onConcluido();
    } catch (falha) {
      if (
        primeiraTentativa &&
        typeof falha === "object" &&
        falha !== null &&
        "code" in falha &&
        (falha.code === "23514" || falha.code === "22023")
      ) {
        try {
          await conferirSessao();
          removerPendenteCorrespondente(comando);
          setPendente(null);
          setAreaId(comando.areaId ?? "");
          setLocalId(comando.localId ?? "");
          setParentId(comando.parentId ?? "");
          setErro("O servidor rejeitou os vínculos. Confira os dados, corrija e tente novamente.");
          return;
        } catch {
          /* Preserva pedido se o armazenamento falhar. */
        }
      }
      setErro("Resultado não confirmado. Repita a mesma tentativa ou procure suporte para reconciliação.");
    } finally {
      setOcupado(false);
    }
  }
  function confirmar() {
    if (origemMudou) return;
    if (!item.estruturaRevisao) {
      setErro("Revisão indisponível. Reabra o detalhe antes de movimentar.");
      return;
    }
    const comando = {
      requestId: crypto.randomUUID(),
      expectedRevision: item.estruturaRevisao,
      componenteId: item.id,
      areaId: areaId || null,
      localId: localId || null,
      parentId: parentId || null,
    };
    try {
      validarMovimentoComponente(comando);
      if (sessionStorage.getItem(chave) !== null) {
        setErro(
          "Existe uma movimentação pendente. Reabra o detalhe para recuperá-la antes de salvar.",
        );
        return;
      }
      sessionStorage.setItem(chave, JSON.stringify(comando));
    } catch {
      setErro("Confira os dados e o armazenamento do navegador antes de continuar.");
      return;
    }
    setPendente(comando);
    void executar(comando, true);
  }
  return (
    <section aria-label="Movimentar Componente">
      {recuperacao.falhou && (
        <p role="alert">
          Não foi possível recuperar uma movimentação anterior. Consulte o suporte antes de
          continuar.
        </p>
      )}
      {erro && <p role="alert">{erro}</p>}
      {!pendente && origemMudou && (
        <p role="alert">
          O Componente mudou durante a edição. Feche e reabra a movimentação para conferir a posição
          atual.
        </p>
      )}
      {!recuperacao.falhou && pendente && (
        <button type="button" disabled={ocupado} onClick={() => void executar(pendente)}>
          {ocupado ? "Salvando…" : "Tentar movimentação novamente"}
        </button>
      )}
      {!recuperacao.falhou && !pendente && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            confirmar();
          }}
        >
          <label>
            Área de destino
            <select
              className="input"
              value={areaId}
              onChange={(e) => {
                setAreaId(e.target.value);
                setLocalId("");
              }}
            >
              <option value="">Sem Área</option>
              {areaId && !areas.some((a) => a.id === areaId) && (
                <option value={areaId}>Área atual indisponível</option>
              )}
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            Local de destino
            <select className="input" value={localId} onChange={(e) => setLocalId(e.target.value)}>
              <option value="">Sem Local</option>
              {localId && !locais.some((l) => l.id === localId && l.areaId === areaId) && (
                <option value={localId}>Local atual indisponível</option>
              )}
              {locais
                .filter((l) => l.areaId === areaId)
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nome}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Componente pai
            <select
              className="input"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value="">Sem pai</option>
              {parentId && !pais.some((p) => p.id === parentId && p.id !== item.id) && (
                <option value={parentId}>Pai atual indisponível</option>
              )}
              {pais
                .filter((p) => p.id !== item.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
            </select>
          </label>
          <button type="submit" disabled={ocupado || origemMudou}>
            Confirmar movimentação
          </button>
        </form>
      )}
    </section>
  );
}

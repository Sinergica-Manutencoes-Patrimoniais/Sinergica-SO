import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import { planoManutencaoKeys } from "../../application/plano-manutencao-queries";
type Pedido = {
  requestId: string;
  clienteId: string;
  planoId: string;
  revision: number;
  versaoId: string;
  modo: "contratos" | "evidencias" | "exigencias";
};

export function IniciarRevisaoContratos({
  userId,
  clienteId,
  planoId,
  revision,
}: { userId: string; clienteId: string; planoId: string; revision: number }) {
  const cache = useQueryClient();
  const storageKey = `sso-revisao-contratos:${JSON.stringify([userId, clienteId, planoId])}`;
  const trava = useRef(false);
  const modo =
    import.meta.env.VITE_SSO_REVISAO_COM_EXIGENCIAS_ENABLED === "true"
      ? "exigencias"
      : import.meta.env.VITE_SSO_REVISAO_COM_EVIDENCIAS_ENABLED === "true"
        ? "evidencias"
        : "contratos";
  const [confirmado, setConfirmado] = useState(false);
  const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return null;
      const p = JSON.parse(raw) as Pedido;
      return p.clienteId === clienteId &&
        p.planoId === planoId &&
        typeof p.requestId === "string" &&
        typeof p.versaoId === "string" &&
        Number.isSafeInteger(p.revision) &&
        (p.modo === "contratos" || p.modo === "evidencias" || p.modo === "exigencias")
        ? p
        : "invalido";
    } catch {
      return "invalido";
    }
  });
  const envio = useMutation({
    mutationFn: async (p: Pedido) => {
      const { data, error } = await supabase
        .schema("pcm")
        .rpc(
          p.modo === "exigencias"
            ? "sso_iniciar_revisao_com_exigencias"
            : p.modo === "evidencias"
              ? "sso_iniciar_revisao_plano_com_evidencias"
              : "sso_iniciar_revisao_plano_com_contratos",
          {
            p_request_id: p.requestId,
            p_cliente_id: p.clienteId,
            p_plano_id: p.planoId,
            p_expected_revision: p.revision,
            p_nova_versao_id: p.versaoId,
          },
        );
      if (error) throw error;
      if (
        !data ||
        data.requestId !== p.requestId ||
        data.reconferenciaNecessaria !== true ||
        (p.modo === "exigencias" && data.reconferenciaExigenciasNecessaria !== true)
      )
        throw new Error("Resposta inválida.");
      return data as {
        contratosCopiados: number;
        itensNaoCopiados: number;
        evidenciasCopiadas?: number;
        evidenciasNaoCopiadas?: number;
        exigenciasPropostas?: number;
      };
    },
    onSuccess: async (r, p) => {
      try {
        if (sessionStorage.getItem(storageKey) !== JSON.stringify(p)) throw new Error();
        sessionStorage.removeItem(storageKey);
      } catch {
        setAviso(
          "Revisão iniciada, mas tentativa local mudou ou não pôde ser removida; procure suporte.",
        );
        return;
      }
      setPendente(null);
      setConfirmado(false);
      setAviso(
        `Revisão iniciada; ${r.contratosCopiados} contrato(s) de resposta copiado(s), ${r.itensNaoCopiados} item(ns) não copiado(s). ${r.evidenciasCopiadas !== undefined ? `${r.evidenciasCopiadas} contrato(s) de evidência copiado(s), ${r.evidenciasNaoCopiadas} não copiado(s). ` : "Contratos de evidência não foram copiados por este fluxo. "}${r.exigenciasPropostas !== undefined ? `${r.exigenciasPropostas} proposta(s) normativa(s) exigem reconferência. ` : ""}Confira todas as perguntas, inclusive novas, antes de aprovar.`,
      );
      await cache.invalidateQueries({ queryKey: planoManutencaoKeys.raiz(userId, clienteId) });
    },
    onError: () =>
      setAviso(
        "Resultado não confirmado ou revisão obsoleta. Repita a mesma tentativa; procure suporte em conflito.",
      ),
    onSettled: () => {
      trava.current = false;
    },
  });
  const enviar = (p: Pedido) => {
    if (trava.current) return;
    if (p.modo !== modo) {
      setAviso(
        "O fluxo da tentativa foi desativado ou alterado; procure suporte antes de continuar.",
      );
      return;
    }
    try {
      const anterior = sessionStorage.getItem(storageKey);
      if (anterior !== null && anterior !== JSON.stringify(p)) throw new Error();
      sessionStorage.setItem(storageKey, JSON.stringify(p));
    } catch {
      setAviso("Tentativa local indisponível ou diferente; nada enviado. Procure suporte.");
      return;
    }
    trava.current = true;
    setPendente(p);
    envio.mutate(p);
  };
  return (
    <section aria-label="Revisão com contratos">
      <h3>Iniciar revisão com contratos de perguntas</h3>
      <p>
        Copia somente contratos com pergunta e questionário iguais à versão aprovada.{" "}
        {modo !== "contratos"
          ? "Inclui contratos de evidência."
          : "Este fluxo não copia contratos de evidência."}{" "}
        {modo === "exigencias" &&
          "Exigências normativas serão propostas para reconferência, sem validação automática."}{" "}
        A conferência de todas as perguntas continua necessária; não altera o questionário Auvo nem
        cria OS.
      </p>
      <label>
        <input
          type="checkbox"
          checked={confirmado}
          disabled={!!pendente || envio.isPending}
          onChange={(e) => setConfirmado(e.target.checked)}
        />{" "}
        Confirmo iniciar revisão e revisar os contratos copiados
      </label>{" "}
      <button
        type="button"
        disabled={!confirmado || !!pendente || envio.isPending}
        onClick={() =>
          enviar({
            requestId: crypto.randomUUID(),
            clienteId,
            planoId,
            revision,
            versaoId: crypto.randomUUID(),
            modo,
          })
        }
      >
        Iniciar revisão com contratos
      </button>
      {pendente === "invalido" && <p role="alert">Tentativa local ilegível; procure suporte.</p>}
      {pendente && pendente !== "invalido" && (
        <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente)}>
          Repetir tentativa pendente
        </button>
      )}
      {aviso && <p role="status">{aviso}</p>}
    </section>
  );
}

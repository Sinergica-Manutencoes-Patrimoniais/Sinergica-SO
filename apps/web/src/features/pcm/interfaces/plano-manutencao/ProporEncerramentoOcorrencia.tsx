import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import { conferirSessaoDiagnostico } from "./diagnostico-revisao-sessao";
type Pedido = {
  requestId: string;
  clienteId: string;
  preparadaId: string;
  declaracaoId: string;
  motivo: string;
  tentativaIncerta?: boolean;
};

export function ProporEncerramentoOcorrencia({
  userId,
  clienteId,
  planoId,
  preparadaId,
  declaracaoId,
  revisao,
  osDeclaradas,
  osAtuais,
  osNaoDeclaradas,
  osAusentes,
  osNaoFinalizadas,
  osSemValidacao,
}: {
  userId: string;
  clienteId: string;
  planoId: string;
  preparadaId: string;
  declaracaoId: string;
  revisao: number;
  osDeclaradas: number;
  osAtuais: number;
  osNaoDeclaradas: number;
  osAusentes: number;
  osNaoFinalizadas: number;
  osSemValidacao: number;
}) {
  const cache = useQueryClient();
  const chave = `sso-proposta-encerramento:${JSON.stringify([userId, clienteId, preparadaId])}`;
  const trava = useRef(false);
  const primeira = useRef(false);
  const [motivo, setMotivo] = useState("");
  const [confirmado, setConfirmado] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try {
      const raw = sessionStorage.getItem(chave);
      if (!raw) return null;
      const p = JSON.parse(raw) as Pedido;
      return p.clienteId === clienteId &&
        p.preparadaId === preparadaId &&
        typeof p.requestId === "string" &&
        typeof p.declaracaoId === "string" &&
        typeof p.motivo === "string" &&
        (p.tentativaIncerta === undefined || typeof p.tentativaIncerta === "boolean")
        ? p
        : "invalido";
    } catch {
      return "invalido";
    }
  });
  const envio = useMutation({
    mutationFn: async (p: Pedido) => {
      await conferirSessaoDiagnostico(userId);
      if (sessionStorage.getItem(chave) !== JSON.stringify(p))
        throw new Error("Tentativa alterada");
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_propor_encerramento_ocorrencia_mediada", {
          p_ator: userId,
          p_cliente: p.clienteId,
          p_plano: planoId,
          p_request: p.requestId,
          p_preparada: p.preparadaId,
          p_declaracao: p.declaracaoId,
          p_motivo: p.motivo,
        });
      if (error) throw error;
      if (
        !data ||
        data.requestId !== p.requestId ||
        data.escopoIntegralComprovado !== false ||
        data.aprovacaoAutorizada !== false ||
        data.ocorrenciaEncerrada !== false ||
        data.osAlteradas !== false
      )
        throw new Error("Resposta inválida.");
    },
    onSuccess: async (_r, p) => {
      try {
        await conferirSessaoDiagnostico(userId);
        if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error();
        sessionStorage.removeItem(chave);
      } catch {
        setAviso("Tentativa não removida; procure suporte.");
        return;
      }
      setPendente(null);
      setConfirmado(null);
      setAviso("Proposta registrada; ocorrência não foi encerrada.");
    },
    onError: async (error, p) => {
      const e = error as { code?: string; message?: string };
      if (primeira.current && e.code === "P0010" && e.message === "declaracao_obsoleta") {
        try {
          await conferirSessaoDiagnostico(userId);
          if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error();
          sessionStorage.removeItem(chave);
          setPendente(null);
          setConfirmado(null);
          setAviso("Declaração alterada. Atualize e confira novamente.");
          await Promise.all([
            cache.invalidateQueries({
              queryKey: ["escopo-preventivo", userId, clienteId, planoId, preparadaId],
            }),
            cache.invalidateQueries({
              queryKey: [
                "diagnostico-fechamento-preventivo",
                userId,
                clienteId,
                planoId,
                preparadaId,
              ],
            }),
          ]);
          return;
        } catch {
          /* Preserva pedido quando houver dúvida. */
        }
      }
      setAviso(
        "Resultado não confirmado ou comparação mudou. Repita a tentativa; procure suporte em conflito.",
      );
    },
    onSettled: () => {
      trava.current = false;
      primeira.current = false;
    },
  });
  const enviar = (p: Pedido) => {
    if (trava.current) return;
    trava.current = true;
    try {
      const anterior = sessionStorage.getItem(chave);
      if (anterior !== null && anterior !== JSON.stringify(p)) throw new Error();
      primeira.current = p.tentativaIncerta === false;
      p = { ...p, tentativaIncerta: true };
      sessionStorage.setItem(chave, JSON.stringify(p));
    } catch {
      trava.current = false;
      setAviso("Não foi possível guardar tentativa; nada enviado.");
      return;
    }
    setPendente(p);
    envio.mutate(p);
  };
  const fotografia = JSON.stringify([
    clienteId,
    planoId,
    preparadaId,
    declaracaoId,
    revisao,
    osDeclaradas,
    osAtuais,
    osNaoDeclaradas,
    osAusentes,
    osNaoFinalizadas,
    osSemValidacao,
    motivo.trim(),
  ]);
  const compativel =
    osDeclaradas > 0 &&
    osDeclaradas === osAtuais &&
    osNaoDeclaradas === 0 &&
    osAusentes === 0 &&
    osNaoFinalizadas === 0 &&
    osSemValidacao === 0;
  return (
    <section aria-label="Proposta de encerramento da ocorrência">
      <h5>Proposta de encerramento</h5>
      <p>
        Revisão {revisao}: declaradas {osDeclaradas}, atuais {osAtuais}, não declaradas{" "}
        {osNaoDeclaradas}, ausentes {osAusentes}, não finalizadas {osNaoFinalizadas}, sem
        finalização validada {osSemValidacao}. Mesmo com números compatíveis, escopo integral e
        validade atual não estão comprovados. A proposta não encerra ocorrência ou OS.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (pendente || !compativel || confirmado !== fotografia || !motivo.trim()) return;
          enviar({
            requestId: crypto.randomUUID(),
            clienteId,
            preparadaId,
            declaracaoId,
            motivo: motivo.trim(),
            tentativaIncerta: false,
          });
        }}
      >
        <fieldset disabled={!!pendente || envio.isPending || !compativel}>
          <label>
            Motivo{" "}
            <textarea
              required
              maxLength={2000}
              value={motivo}
              onChange={(e) => {
                setConfirmado(null);
                setMotivo(e.target.value);
              }}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={confirmado === fotografia}
              onChange={(e) => setConfirmado(e.target.checked ? fotografia : null)}
            />{" "}
            Confirmo somente a proposta, sem encerrar
          </label>
          <button type="submit" disabled={confirmado !== fotografia}>Registrar proposta</button>
        </fieldset>
      </form>
      {pendente === "invalido" && <p role="alert">Tentativa ilegível; procure suporte.</p>}
      {pendente && pendente !== "invalido" && (
        <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente)}>
          Repetir tentativa pendente
        </button>
      )}
      {aviso && <output className="block">{aviso}</output>}
    </section>
  );
}

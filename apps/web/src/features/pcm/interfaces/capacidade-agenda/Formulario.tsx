import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import { supabaseAgendaTecnicoAdapter } from "../../infrastructure/supabase-agenda-tecnico-adapter";
import {
  type DisponibilidadeDeclarada,
  type PedidoDisponibilidade,
  salvarDisponibilidade,
} from "../../infrastructure/supabase-capacidade-agenda-adapter";

export function FormularioDisponibilidade({
  userId,
  clienteId,
  semana,
  item,
  fechar,
}: {
  userId: string;
  clienteId: string;
  semana: string;
  item: DisponibilidadeDeclarada | null;
  fechar: () => void;
}) {
  const storageKey = `sso-capacidade:${JSON.stringify([userId, clienteId, semana])}`;
  const client = useQueryClient();
  const trava = useRef(false);
  const [funcionarioId, setFuncionario] = useState(item?.funcionarioId ?? "");
  const [destinados, setDestinados] = useState(item ? String(item.destinadosMinutos) : "");
  const [reservas, setReservas] = useState(item ? String(item.reservasMinutos) : "");
  const [ausencias, setAusencias] = useState(item ? String(item.ausenciasMinutos) : "");
  const [confirmado, setConfirmado] = useState(false);
  const [revisaoInicial] = useState(item?.revisao ?? 0);
  const revisaoAlterada = (item?.revisao ?? 0) !== revisaoInicial;
  const [mensagem, setMensagem] = useState("");
  const [pendente, setPendente] = useState<PedidoDisponibilidade | "invalido" | null>(() => {
    try {
      const salvo = sessionStorage.getItem(storageKey);
      if (!salvo) return null;
      const p: unknown = JSON.parse(salvo);
      if (!p || typeof p !== "object") return "invalido";
      const v = p as Record<string, unknown>;
      if (
        v.clienteId !== clienteId ||
        v.semanaInicio !== semana ||
        typeof v.id !== "string" ||
        typeof v.requestId !== "string" ||
        typeof v.funcionarioId !== "string" ||
        ![v.destinados, v.reservas, v.ausencias, v.expectedRevision].every(
          (n) => typeof n === "number" && Number.isSafeInteger(n) && n >= 0,
        ) ||
        v.confirmacaoSemSobreposicao !== true
      )
        return "invalido";
      return v as PedidoDisponibilidade;
    } catch {
      return "invalido";
    }
  });
  const tecnicos = useQuery({
    queryKey: ["capacidade-agenda", userId, clienteId, "funcionarios"],
    queryFn: () => supabaseAgendaTecnicoAdapter.listarFuncionarios(),
    gcTime: 0,
  });
  const envio = useMutation({
    mutationFn: async (pedido: PedidoDisponibilidade) => {
      if (sessionStorage.getItem(storageKey) !== JSON.stringify(pedido)) throw new Error("Tentativa divergente.");
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId) throw new Error("Sessão alterada.");
      const resultado = await salvarDisponibilidade(pedido);
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId) throw new Error("Sessão alterada.");
      return resultado;
    },
    onSuccess: async (_resultado, pedido) => {
      try {
        await Promise.all([
          client.invalidateQueries({ queryKey: ["capacidade-agenda", userId, clienteId, semana] }),
          client.invalidateQueries({ queryKey: ["capacidade-snapshot", userId, clienteId, semana] }),
        ]);
        if (sessionStorage.getItem(storageKey) !== JSON.stringify(pedido)) throw new Error("Tentativa divergente.");
        sessionStorage.removeItem(storageKey);
      } catch {
        setMensagem("Dados salvos; tentativa local não pôde ser removida. Procure suporte.");
        return;
      }
      setPendente(null);
      setMensagem("Disponibilidade declarada registrada.");
      fechar();
    },
    onError: () =>
      setMensagem(
        "Resultado não confirmado. Repita a mesma tentativa; para conflito de revisão procure suporte.",
      ),
    onSettled: () => { trava.current = false; },
  });
  const enviar = (pedido: PedidoDisponibilidade, repeticao = false) => {
    if (trava.current) return;
    try {
      const salvo = sessionStorage.getItem(storageKey);
      if (repeticao ? salvo !== JSON.stringify(pedido) : salvo !== null) throw new Error("Tentativa divergente.");
      if (!repeticao) sessionStorage.setItem(storageKey, JSON.stringify(pedido));
    } catch {
      setMensagem("Não foi possível preservar tentativa; nada foi enviado.");
      return;
    }
    setPendente(pedido);
    setMensagem("");
    trava.current = true;
    envio.mutate(pedido);
  };
  return (
    <section aria-label="Declarar disponibilidade">
      <h3>{item ? "Revisar" : "Declarar"} disponibilidade semanal</h3>
      {tecnicos.isError && (
        <p role="alert">
          Não foi possível carregar técnicos.{" "}
          <button type="button" onClick={() => void tecnicos.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (pendente || trava.current || revisaoAlterada) return;
          const valores = [destinados, reservas, ausencias];
          if (
            !funcionarioId || !tecnicos.data?.some((tecnico) => tecnico.id === funcionarioId) ||
            !confirmado ||
            valores.some(
              (x) => !/^\d+$/.test(x) || !Number.isSafeInteger(Number(x)) || Number(x) > 2147483647,
            ) ||
            Number(reservas) + Number(ausencias) > Number(destinados)
          ) {
            setMensagem("Confira técnico, minutos e confirmação de não sobreposição.");
            return;
          }
          enviar({
            requestId: crypto.randomUUID(),
            id: item?.id ?? crypto.randomUUID(),
            clienteId,
            funcionarioId,
            semanaInicio: semana,
            destinados: Number(destinados),
            reservas: Number(reservas),
            ausencias: Number(ausencias),
            expectedRevision: revisaoInicial,
            confirmacaoSemSobreposicao: true,
          });
        }}
      >
        <fieldset
          disabled={!!pendente || envio.isPending || tecnicos.isFetching || tecnicos.isError || revisaoAlterada}
        >
          <label>
            Técnico{" "}
            <select
              required
              value={funcionarioId}
              disabled={!!item}
              onChange={(e) => { setFuncionario(e.target.value); setConfirmado(false); }}
            >
              <option value="">Selecione</option>
              {tecnicos.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            Minutos destinados{" "}
            <input
              required
              inputMode="numeric"
              value={destinados}
              onChange={(e) => { setDestinados(e.target.value); setConfirmado(false); }}
            />
          </label>
          <label>
            Minutos reservados{" "}
            <input
              required
              inputMode="numeric"
              value={reservas}
              onChange={(e) => { setReservas(e.target.value); setConfirmado(false); }}
            />
          </label>
          <label>
            Minutos de ausência{" "}
            <input
              required
              inputMode="numeric"
              value={ausencias}
              onChange={(e) => { setAusencias(e.target.value); setConfirmado(false); }}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={confirmado}
              onChange={(e) => setConfirmado(e.target.checked)}
            />{" "}
            Confirmo que reservas e ausências não se sobrepõem.
          </label>
          <button type="submit">Salvar declaração</button>
        </fieldset>
      </form>
      {revisaoAlterada && <p role="alert">A revisão da disponibilidade mudou. Os valores digitados permanecem nesta tela; feche e abra a revisão atual para conferi-los antes de salvar.</p>}
      {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Procure suporte.</p>}
      {pendente && pendente !== "invalido" && (
        <p>
          Registro pendente para técnico {pendente.funcionarioId}, semana {pendente.semanaInicio}.{" "}
          <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente, true)}>
            Repetir tentativa
          </button>
        </p>
      )}
      {mensagem && <output>{mensagem}</output>}
      <button type="button" onClick={fechar}>
        Fechar
      </button>
    </section>
  );
}

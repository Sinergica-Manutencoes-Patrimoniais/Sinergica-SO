import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { usePermissoes } from "../../../../app/permissoes-context";
import { ChamadoPainel } from "../../components/ChamadoPainel";
import { carregarDadosAberturaOs } from "../../application/abrir-ordem-servico";
import { supabaseOrdemServicoAdapter } from "../../infrastructure/supabase-ordem-servico-adapter";

const uuid = z.string().uuid();
const pedidoSchema = z
  .object({ requestId: uuid, clienteId: uuid, planoId: uuid, preparadaId: uuid })
  .strict();
const resultadoSchema = pedidoSchema
  .extend({
    cicloId: uuid,
    chamadoId: uuid,
    numero: z.string().min(1),
    criado: z.boolean(),
    osCriada: z.literal(false),
    tarefaAuvoCriada: z.literal(false),
  })
  .strict();
type Pedido = z.infer<typeof pedidoSchema>;
type Props = {
  userId: string;
  clienteId: string;
  planoId: string;
  preparadaId: string;
  tipo: "calendario" | "visita";
};

export function ChamadoCicloPreventivo(props: Props) {
  return (
    <Conteudo
      key={JSON.stringify([
        props.userId,
        props.clienteId,
        props.planoId,
        props.preparadaId,
        props.tipo,
      ])}
      {...props}
    />
  );
}

function Conteudo({ userId, clienteId, planoId, preparadaId, tipo }: Props) {
  const chave = `chamado-ciclo-preventivo:${JSON.stringify([userId, clienteId, planoId, preparadaId, tipo])}`;
  const cache = useQueryClient();
  const { carregando, podeAcessar } = usePermissoes();
  const trava = useRef(false);
  const [confirmado, setConfirmado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [chamadoId, setChamadoId] = useState<string | null>(null);
  const [painelAberto, setPainelAberto] = useState(false);
  const catalogos = useQuery({
    queryKey: ["chamado-preventivo-catalogos", userId, clienteId, chamadoId],
    enabled: painelAberto && !!chamadoId && !carregando && podeAcessar("pcm", "escrita"),
    gcTime: 0,
    retry: false,
    queryFn: async ({ signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted)
        throw new Error("Sessão alterada.");
      const dados = await carregarDadosAberturaOs(supabaseOrdemServicoAdapter);
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted)
        throw new Error("Sessão alterada.");
      return { ...dados, clientes: dados.clientes.filter((cliente) => cliente.id === clienteId) };
    },
  });
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try {
      const raw = sessionStorage.getItem(chave);
      if (!raw) return null;
      const pedido = pedidoSchema.parse(JSON.parse(raw));
      return pedido.clienteId === clienteId &&
        pedido.planoId === planoId &&
        pedido.preparadaId === preparadaId
        ? pedido
        : "invalido";
    } catch {
      return "invalido";
    }
  });
  const envio = useMutation({
    mutationFn: async (pedido: Pedido) => {
      const antes = await supabase.auth.getUser();
      if (
        antes.error ||
        antes.data.user?.id !== userId ||
        sessionStorage.getItem(chave) !== JSON.stringify(pedido)
      )
        throw new Error("Sessão ou tentativa alterada.");
      const { data, error } = await supabase
        .schema("pcm")
        .rpc(
          tipo === "visita"
            ? "sso_criar_chamado_ciclo_visita"
            : "sso_criar_chamado_ciclo_preventivo",
          {
            p_request_id: pedido.requestId,
            p_cliente_id: pedido.clienteId,
            p_plano_id: pedido.planoId,
            p_preparada_id: pedido.preparadaId,
          },
        );
      if (error) throw error;
      const resposta = resultadoSchema.parse(data);
      if (
        resposta.requestId !== pedido.requestId ||
        resposta.clienteId !== clienteId ||
        resposta.planoId !== planoId ||
        resposta.preparadaId !== preparadaId
      )
        throw new Error("Resposta divergente.");
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId) throw new Error("Sessão alterada.");
      return resposta;
    },
    onSuccess: async (resposta, pedido) => {
      try {
        if (sessionStorage.getItem(chave) !== JSON.stringify(pedido))
          throw new Error("Tentativa alterada.");
        sessionStorage.removeItem(chave);
        setPendente(null);
        setConfirmado(false);
        setChamadoId(resposta.chamadoId);
        setMensagem(
          `Chamado ${resposta.numero} ${resposta.criado ? "criado" : "localizado"}. Nenhuma OS ou tarefa Auvo foi criada.`,
        );
        await cache.invalidateQueries({ queryKey: ["chamados"] });
      } catch {
        setMensagem(
          "Resposta recebida, mas a tentativa local não pôde ser removida. Procure suporte.",
        );
      }
    },
    onError: () =>
      setMensagem(
        "Resultado não confirmado. Repita a mesma tentativa ou procure suporte para reconciliação.",
      ),
    onSettled: () => {
      trava.current = false;
    },
  });
  function enviar(pedido: Pedido) {
    if (trava.current || (!pendente && !confirmado)) return;
    try {
      const salvo = sessionStorage.getItem(chave);
      if (pendente ? salvo !== JSON.stringify(pedido) : salvo !== null)
        throw new Error("Tentativa divergente.");
      if (!pendente) sessionStorage.setItem(chave, JSON.stringify(pedido));
      trava.current = true;
      setPendente(pedido);
      envio.mutate(pedido);
    } catch {
      setMensagem("Não foi possível guardar a tentativa; nada foi enviado.");
    }
  }
  return (
    <section aria-label="Chamado preventivo">
      <h5>Chamado preventivo</h5>
      {!pendente && (
        <>
          <label>
            <input
              type="checkbox"
              checked={confirmado}
              onChange={(e) => setConfirmado(e.target.checked)}
            />{" "}
            Confirmo a criação ou localização do Chamado deste ciclo
          </label>
          <button
            type="button"
            disabled={!confirmado || envio.isPending}
            onClick={() =>
              enviar({ requestId: crypto.randomUUID(), clienteId, planoId, preparadaId })
            }
          >
            Criar ou localizar Chamado
          </button>
        </>
      )}
      {pendente === "invalido" && (
        <p role="alert">Tentativa local ilegível. Procure suporte antes de tentar novamente.</p>
      )}
      {pendente && pendente !== "invalido" && (
        <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente)}>
          Repetir tentativa pendente
        </button>
      )}
      {mensagem && <output className="block">{mensagem}</output>}
      {chamadoId && (
        <>
          <button
            type="button"
            aria-expanded={painelAberto}
            onClick={() => setPainelAberto((atual) => !atual)}
          >
            {painelAberto ? "Ocultar Chamado" : "Abrir Chamado"}
          </button>
          {painelAberto && catalogos.isError && (
            <p role="alert">
              Não foi possível carregar dados para criação de OS.{" "}
              <button type="button" onClick={() => void catalogos.refetch()}>
                Tentar novamente
              </button>
            </p>
          )}
          {painelAberto && (
            <ChamadoPainel
              chamadoId={chamadoId}
              dadosOs={
                !catalogos.isFetching &&
                !catalogos.isError &&
                !carregando &&
                podeAcessar("pcm", "escrita")
                  ? (catalogos.data ?? null)
                  : null
              }
              temEscrita={!carregando && podeAcessar("pcm", "escrita")}
              auvoTaskId={null}
              onMutou={() => {
                void cache.invalidateQueries({ queryKey: ["chamado-painel", userId, chamadoId] });
              }}
            />
          )}
        </>
      )}
    </section>
  );
}

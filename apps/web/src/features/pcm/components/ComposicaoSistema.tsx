// ComposicaoSistema.tsx — E01-S86 AC-1/AC-2/AC-3: composição de um Sistema via checkbox+filtro.
// Componente compartilhado — usado por `SistemasPage.tsx` (PCM) e `VisaoClientePage.tsx` (Visão
// 360, AC-2), mesmo comportamento nos dois pontos de entrada. Staged: marca/desmarca em memória,
// "Salvar" persiste tudo de uma vez (diff, ver `salvarComposicaoSistema`).
import { Skeleton } from "@sinergica/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  listarItensDisponiveis,
  listarItensDoSistema,
  salvarComposicaoSistema,
} from "../application/sistemas";
import type { SistemaItemOpcao, SistemasGateway } from "../application/sistemas-gateway";
import type { Sistema } from "../domain/sistemas";
import { supabaseCapacidadesSsoAdapter } from "../infrastructure/supabase-capacidades-sso-adapter";
import { supabase } from "../../../lib/supabase-client";
import { SeletorItensComFiltro } from "./SeletorItensComFiltro";

const pedidoSchema = z.object({ requestId: z.string().uuid(), atorId: z.string().uuid(), clienteId: z.string().uuid(),
  sistemaId: z.string().uuid(), observados: z.array(z.string().uuid()).max(1000), desejados: z.array(z.string().uuid()).max(1000) }).strict();
type Pedido = z.infer<typeof pedidoSchema>;

type Props = {
  gateway: SistemasGateway;
  sistema: Sistema;
  temEscrita: boolean;
  userId: string;
  onSalvo?: () => void;
};

export function ComposicaoSistema(props: Props) {
  return <Conteudo key={JSON.stringify([props.userId, props.sistema.clienteId, props.sistema.id])} {...props} />;
}

function Conteudo({
  gateway,
  sistema,
  temEscrita,
  userId,
  onSalvo,
}: Props) {
  const [estado, setEstado] = useState<
    | { fase: "carregando" }
    | { fase: "erro"; mensagem: string }
    | { fase: "pronto"; itens: SistemaItemOpcao[]; membrosOriginaisIds: string[] }
  >({ fase: "carregando" });
  const [selecionadosIds, setSelecionadosIds] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const protecaoLegada = import.meta.env.VITE_SSO_CAPACIDADE_CADASTRO_LEGADO_ENABLED === "true";
  const composicaoAtomica = import.meta.env.VITE_SSO_COMPOSICAO_SISTEMA_ATOMICA_ENABLED === "true";
  const integracaoIncompleta = protecaoLegada && !composicaoAtomica;
  const chave = `sso-composicao-sistema:${JSON.stringify([userId, sistema.clienteId, sistema.id])}`;
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try { const salvo = sessionStorage.getItem(chave); if (!salvo) return null; const p = pedidoSchema.parse(JSON.parse(salvo));
      return p.atorId === userId && p.clienteId === sistema.clienteId && p.sistemaId === sistema.id ? p : "invalido";
    } catch { return "invalido"; }
  });
  const trava = useRef(false);
  const contextoAtual = useRef({ userId, sistemaId: sistema.id, clienteId: sistema.clienteId, temEscrita });
  contextoAtual.current = { userId, sistemaId: sistema.id, clienteId: sistema.clienteId, temEscrita };

  const carregar = useCallback(async () => {
    setEstado((atual) => (atual.fase === "pronto" ? atual : { fase: "carregando" }));
    try {
      const [itens, membros] = await Promise.all([
        listarItensDisponiveis(gateway, sistema.clienteId),
        listarItensDoSistema(gateway, sistema.id),
      ]);
      const membrosOriginaisIds = membros.map((m) => m.itemId);
      setEstado({ fase: "pronto", itens, membrosOriginaisIds });
      // AC-3: itens já pertencentes ao sistema vêm marcados quando o seletor abre.
      setSelecionadosIds(new Set(membrosOriginaisIds));
      return true;
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Não foi possível carregar os itens.",
      });
      return false;
    }
  }, [gateway, sistema.id, sistema.clienteId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function toggle(id: string) {
    if (!temEscrita || salvando || pendente) return;
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

  async function salvar(repeticao?: Pedido) {
    if (!temEscrita || salvando || trava.current || pendente === "invalido" || (pendente && !repeticao)) return;
    if (integracaoIncompleta && !repeticao) {
      setErroSalvar("A proteção de cadastro exige composição atômica. A alteração não foi enviada.");
      return;
    }
    trava.current = true;
    const contexto = { userId, sistemaId: sistema.id, clienteId: sistema.clienteId };
    const selecao = [...selecionadosIds];
    setSalvando(true);
    setErroSalvar(null);
    try {
      if (protecaoLegada) {
        const antes = await supabase.auth.getUser();
        if (antes.error || antes.data.user?.id !== contexto.userId || await supabaseCapacidadesSsoAdapter.autorizarAcao("cadastro.gerir", contexto.clienteId) !== true) throw new Error("Permissão de cadastro indisponível.");
        const depois = await supabase.auth.getUser();
        const atual = contextoAtual.current;
        if (depois.error || depois.data.user?.id !== contexto.userId || !atual.temEscrita || atual.userId !== contexto.userId || atual.clienteId !== contexto.clienteId || atual.sistemaId !== contexto.sistemaId) throw new Error("Sessão ou contexto alterado.");
      }
      if (composicaoAtomica || repeticao) {
        if (!repeticao && estado.fase !== "pronto") throw new Error("Composição indisponível.");
        const p = repeticao ?? pedidoSchema.parse({ requestId: crypto.randomUUID(), atorId: contexto.userId,
          clienteId: contexto.clienteId, sistemaId: contexto.sistemaId,
          observados: estado.fase === "pronto" ? [...estado.membrosOriginaisIds].sort() : [], desejados: selecao.sort() });
        const serializado = JSON.stringify(p);
        if (!repeticao) {
          if (sessionStorage.getItem(chave) !== null) throw new Error("Já existe tentativa pendente.");
          sessionStorage.setItem(chave, serializado); setPendente(p);
        }
        if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada.");
        const antes = await supabase.auth.getUser();
        if (antes.error || antes.data.user?.id !== p.atorId) throw new Error("Sessão alterada.");
        const { data, error } = await supabase.schema("pcm").rpc("sso_salvar_composicao_sistema", {
          p_request_id: p.requestId, p_ator_id: p.atorId, p_cliente_id: p.clienteId, p_sistema_id: p.sistemaId,
          p_observados: p.observados, p_desejados: p.desejados,
        });
        if (error) throw error;
        const r = z.object({ requestId: z.string().uuid(), clienteId: z.string().uuid(), sistemaId: z.string().uuid(), itens: z.array(z.string().uuid()).max(1000) }).strict().parse(data);
        if (r.requestId !== p.requestId || r.clienteId !== p.clienteId || r.sistemaId !== p.sistemaId || JSON.stringify([...r.itens].sort()) !== JSON.stringify([...p.desejados].sort())) throw new Error("Recibo divergente.");
        const depois = await supabase.auth.getUser(); const atual = contextoAtual.current;
        if (depois.error || depois.data.user?.id !== p.atorId || atual.userId !== p.atorId || atual.clienteId !== p.clienteId || atual.sistemaId !== p.sistemaId) throw new Error("Sessão ou contexto alterado.");
        if (!await carregar()) throw new Error("Reconsulta indisponível.");
        const final = await supabase.auth.getUser();
        if (final.error || final.data.user?.id !== p.atorId || sessionStorage.getItem(chave) !== serializado) throw new Error("Sessão ou tentativa alterada.");
        sessionStorage.removeItem(chave); setPendente(null);
      } else {
        await salvarComposicaoSistema(gateway, contexto.sistemaId, selecao, contexto.userId);
        await carregar();
      }
      onSalvo?.();
    } catch (error) {
      setErroSalvar(
        error instanceof Error ? error.message : "Não foi possível salvar a composição.",
      );
    } finally {
      trava.current = false; setSalvando(false);
    }
  }

  if (estado.fase === "carregando") {
    return <Skeleton className="h-4 w-40" />;
  }
  if (estado.fase === "erro") {
    return <div><p className="px-1 py-3 text-body text-danger">{estado.mensagem}</p>
      <button type="button" onClick={() => void carregar()}>Tentar carregar novamente</button>
      {pendente && <p>Existe uma tentativa guardada nesta aba; não inicie outra antes de conferir o resultado.</p>}</div>;
  }

  const houveMudanca =
    estado.membrosOriginaisIds.length !== selecionadosIds.size ||
    estado.membrosOriginaisIds.some((id) => !selecionadosIds.has(id));

  // E01-S154 AC-4: item já membro de OUTRO Sistema fica desabilitado, com o nome dele à mostra.
  const itensParaSeletor = estado.itens.map((item) => ({
    id: item.id,
    nome: item.nome,
    sistemaOutroNome: item.sistemaId && item.sistemaId !== sistema.id ? item.sistemaNome : null,
  }));

  return (
    <div className="flex flex-col gap-3">
      <SeletorItensComFiltro
        itens={itensParaSeletor}
        selecionadosIds={selecionadosIds}
        onToggle={toggle}
        disabled={!temEscrita || salvando || !!pendente}
      />
      {erroSalvar && <p className="text-caption text-danger">{erroSalvar}</p>}
      {integracaoIncompleta && <p role="alert">Composição atômica não habilitada. A proteção de cadastro exige sua ativação antes de salvar novas alterações.</p>}
      {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}
      {pendente && pendente !== "invalido" && <div><p>Uma tentativa anterior pode ter sido aplicada. Repita somente o mesmo pedido.</p>
        <button type="button" disabled={!temEscrita || salvando} onClick={() => void salvar(pendente)}>Repetir tentativa</button></div>}
      {temEscrita && !pendente && (
        <button
          type="button"
          onClick={() => void salvar()}
          disabled={salvando || !houveMudanca || integracaoIncompleta}
          className="h-9 self-start rounded-md bg-orange px-3 text-body font-semibold text-white hover:bg-orange-deep disabled:opacity-50"
        >
          {salvando ? "Salvando…" : "Salvar composição"}
        </button>
      )}
    </div>
  );
}

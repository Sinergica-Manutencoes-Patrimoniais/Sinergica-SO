import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const uuid = z.string().uuid();
const dataIso = z.string().date();
const itemSchema = z
  .object({
    visitaId: uuid,
    revisao: z.number().int().positive(),
    semanaOrigem: dataIso,
    inicioOriginal: z.string().datetime({ offset: true }),
    dataProposta: dataIso,
    inicioProposto: z.string().datetime({ offset: true }).nullable(),
    feriadoId: uuid.nullable(),
    feriadoRevision: z.number().int().positive().nullable(),
    ocorrenciaEsperada: z.boolean(),
  })
  .strict();
const paginaSchema = z
  .object({
    mudancaId: uuid,
    numero: z.number().int().nonnegative(),
    itens: z.array(itemSchema).max(100),
    temMais: z.boolean(),
    proximoNumero: z.number().int().positive(),
    totalItens: z.number().int().nonnegative(),
  })
  .strict();
const sessaoSchema = z
  .object({
    ator: uuid,
    cliente: uuid,
    serie: uuid,
    assinatura: z.string(),
    mudancaId: uuid,
    requestId: uuid,
    estado: z.enum(["montando", "pronta", "aplicada", "invalidada"]),
    paginaAtual: z.number().int().nonnegative(),
    paginaFinal: z.boolean(),
    totalItens: z.number().int().nonnegative(),
    digest: z.string().nullable(),
    paginasRevistas: z.array(z.number().int().nonnegative()),
    revisaoConfirmada: z.boolean(),
    recibo: z.unknown().optional(),
  })
  .strict();
type Sessao = z.infer<typeof sessaoSchema>;
type Item = z.infer<typeof itemSchema>;
type Pagina = z.infer<typeof paginaSchema>;
const inicioSchema = z.object({ requestId: uuid }).strict();

function erroRpc(error: { code?: string; message?: string } | null): never | void {
  if (error) throw new Error(`${error.code ?? "rpc"}:${error.message ?? "falha"}`);
}

type Props = {
  userId: string;
  clienteId: string;
  serieId: string;
  revisao: number;
  dia: number;
  vigencia: string;
  bloqueado: boolean;
  operacionalHabilitado: boolean;
};

function assinatura(props: Props) {
  return JSON.stringify([
    props.userId,
    props.clienteId,
    props.serieId,
    props.revisao,
    props.dia,
    props.vigencia,
  ]);
}

export function AlterarDiaComVisitasV2(props: Props) {
  return <FluxoV2 key={assinatura(props)} assinatura={assinatura(props)} {...props} />;
}

function FluxoV2({
  userId,
  clienteId,
  serieId,
  revisao,
  dia,
  vigencia,
  bloqueado,
  operacionalHabilitado,
  assinatura: assinaturaAtual,
}: {
  userId: string;
  clienteId: string;
  serieId: string;
  revisao: number;
  dia: number;
  vigencia: string;
  bloqueado: boolean;
  operacionalHabilitado: boolean;
  assinatura: string;
}) {
  const identityKey = `sso-mudanca-dia-v2:${JSON.stringify([userId, clienteId, serieId])}`;
  const storageKey = `${identityKey}:${assinaturaAtual}`;
  const pointerKey = `${identityKey}:ativa`;
  const startKey = `${identityKey}:${assinaturaAtual}:inicio`;
  const [sessaoAnterior, setSessaoAnterior] = useState<Sessao | null>(() => {
    try {
      const pointer = sessionStorage.getItem(pointerKey);
      if (!pointer || pointer === storageKey) return null;
      const raw = sessionStorage.getItem(pointer);
      return raw ? sessaoSchema.parse(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  });
  const [sessao, setSessao] = useState<Sessao | null>(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = sessaoSchema.parse(JSON.parse(raw));
      return parsed.ator === userId && parsed.cliente === clienteId && parsed.serie === serieId && parsed.assinatura === assinaturaAtual
        ? parsed
        : null;
    } catch {
      return null;
    }
  });
  const [pagina, setPagina] = useState<Pagina | null>(null);
  const [mensagem, setMensagem] = useState("");

  function gravar(nova: Sessao | null) {
    if (nova) {
      sessionStorage.setItem(storageKey, JSON.stringify(nova));
      sessionStorage.setItem(pointerKey, storageKey);
    } else {
      sessionStorage.removeItem(storageKey);
      if (sessionStorage.getItem(pointerKey) === storageKey) sessionStorage.removeItem(pointerKey);
    }
    setSessao(nova);
  }
  async function conferirAtor(signal?: AbortSignal) {
    const atual = await supabase.auth.getUser();
    if (signal?.aborted || atual.error || atual.data.user?.id !== userId)
      throw new Error("sessao_alterada:Atualize a sessão antes de continuar.");
  }
  async function chamar<T>(nome: string, parametros: Record<string, unknown>, schema: z.ZodType<T>) {
    await conferirAtor();
    const { data, error } = await supabase.schema("pcm").rpc(nome, parametros);
    erroRpc(error);
    const validado = schema.parse(data);
    await conferirAtor();
    return validado;
  }

  const iniciar = useMutation({
    mutationFn: async (requestId: string) => {
      return chamar(
        "sso_iniciar_mudanca_dia_v2",
        {
          p_ator: userId,
          p_request_id: requestId,
          p_cliente_id: clienteId,
          p_serie_id: serieId,
          p_regra_nova_id: crypto.randomUUID(),
          p_expected_revision: revisao,
          p_dia_semana: dia,
          p_vigencia: vigencia,
        },
        z.object({
          mudancaId: uuid,
          requestId: uuid,
          estado: z.enum(["montando", "pronta", "aplicada", "invalidada"]),
          expiraEm: z.string().datetime({ offset: true }),
          paginaSeguinte: z.number().int().nonnegative(),
          paginaFinal: z.boolean(),
          totalItens: z.number().int().nonnegative(),
          digest: z.string().nullable().optional(),
          recibo: z.unknown().optional(),
        }),
      );
    },
    onSuccess: (resultado) => {
      const nova: Sessao = {
        ator: userId,
        cliente: clienteId,
        serie: serieId,
        assinatura: assinaturaAtual,
        mudancaId: resultado.mudancaId,
        requestId: resultado.requestId,
        estado: resultado.estado,
        paginaAtual: Math.max(0, resultado.paginaSeguinte - 1),
        paginaFinal: resultado.paginaFinal,
        totalItens: resultado.totalItens,
        digest: resultado.digest ?? null,
        paginasRevistas: [],
        revisaoConfirmada: false,
        recibo: resultado.recibo,
      };
      gravar(nova);
      sessionStorage.removeItem(startKey);
      setMensagem(resultado.estado === "aplicada" ? "Alteração já aplicada. O recibo foi recuperado por repetição segura." : "Em andamento: fotografia iniciada. Carregue as páginas e confira todos os impactos.");
    },
    onError: (error) => setMensagem(error.message),
  });

  const carregarPagina = useMutation({
    mutationFn: async (numero: number) => {
      if (!sessao) throw new Error("fotografia_indisponivel:Inicie ou retome a fotografia.");
      return chamar(
        "sso_pagina_mudanca_dia_v2",
        { p_ator: userId, p_mudanca_id: sessao.mudancaId, p_numero: numero },
        paginaSchema,
      );
    },
    onSuccess: (resultado) => {
      setPagina(resultado);
      if (!sessao) return;
      const revistas = [...new Set([...sessao.paginasRevistas, resultado.numero])].sort((a, b) => a - b);
      const nova = {
        ...sessao,
        paginaAtual: resultado.numero,
        paginaFinal: !resultado.temMais,
        totalItens: resultado.totalItens,
        paginasRevistas: revistas,
      };
      gravar(nova);
      setMensagem("");
    },
    onError: (error) => setMensagem(error.message),
  });

  const selar = useMutation({
    mutationFn: async () => {
      if (!sessao) throw new Error("fotografia_indisponivel:Inicie a fotografia.");
      return chamar(
        "sso_selar_mudanca_dia_v2",
        { p_ator: userId, p_mudanca_id: sessao.mudancaId },
        z.object({
          mudancaId: uuid,
          estado: z.enum(["pronta", "aplicada", "invalidada"]),
          totalItens: z.number().int().nonnegative(),
          digest: z.string().nullable(),
          recibo: z.unknown().optional(),
          motivo: z.string().optional(),
        }),
      );
    },
    onSuccess: (resultado) => {
      if (!sessao) return;
      gravar({ ...sessao, estado: resultado.estado, totalItens: resultado.totalItens, digest: resultado.digest });
      setMensagem(resultado.estado === "invalidada" ? "A fonte mudou. Inicie uma nova fotografia." : "Fotografia selada. Revise o total e confirme para aplicar.");
    },
    onError: (error) => setMensagem(error.message),
  });

  const confirmar = useMutation({
    mutationFn: async () => {
      if (!sessao) throw new Error("fotografia_indisponivel:Inicie a fotografia.");
      return chamar(
        "sso_confirmar_mudanca_dia_v2",
        { p_ator: userId, p_mudanca_id: sessao.mudancaId },
        z.object({
          requestId: uuid,
          mudancaId: uuid,
          serieId: uuid,
          regraId: uuid,
          revision: z.number().int().positive(),
          visitasMovidas: z.number().int().nonnegative(),
          visitasSuprimidas: z.number().int().nonnegative(),
          efeitoRemoto: z.literal(false),
          digest: z.string(),
        }),
      );
    },
    onSuccess: (recibo) => {
      if (!sessao) return;
      gravar({ ...sessao, estado: "aplicada", revisaoConfirmada: true });
      setMensagem(`Concluído: ${recibo.visitasMovidas} movidas e ${recibo.visitasSuprimidas} suprimidas por feriado.`);
    },
    onError: (error) => {
      setMensagem(`Resultado não confirmado: ${error.message}. Repita para recuperar o recibo se a operação já tiver sido concluída.`);
      if (
        sessao &&
        ["fotografia_visitas_alterada", "impactos_alterados", "revisao_obsoleta"].some((codigo) =>
          error.message.includes(codigo),
        )
      ) {
        void chamar(
          "sso_invalidar_mudanca_dia_v2",
          { p_ator: userId, p_mudanca_id: sessao.mudancaId },
          z.object({ mudancaId: uuid, estado: z.enum(["invalidada", "aplicada"]) }),
        )
          .then((resultado) => {
            if (resultado.estado === "invalidada") gravar({ ...sessao, estado: "invalidada" });
          })
          .catch((erro: Error) => setMensagem(`A fotografia obsoleta não foi encerrada: ${erro.message}`));
      }
    },
  });

  const invalida = useMutation({
    mutationFn: async () => {
      if (!sessao) return;
      await chamar(
        "sso_invalidar_mudanca_dia_v2",
        { p_ator: userId, p_mudanca_id: sessao.mudancaId },
        z.object({ mudancaId: uuid, estado: z.enum(["invalidada", "aplicada"]) }),
      );
    },
    onSuccess: () => {
      if (sessao) gravar({ ...sessao, estado: "invalidada" });
      setMensagem("Fotografia encerrada sem alterar as Visitas. Inicie outra para rever os dados atuais.");
    },
    onError: (error) => setMensagem(error.message),
  });

  const invalidarAnterior = useMutation({
    mutationFn: async () => {
      if (!sessaoAnterior) return;
      return chamar(
        "sso_invalidar_mudanca_dia_v2",
        { p_ator: userId, p_mudanca_id: sessaoAnterior.mudancaId },
        z.object({ mudancaId: uuid, estado: z.enum(["invalidada", "aplicada"]) }),
      );
    },
    onSuccess: (resultado) => {
      if (!sessaoAnterior || !resultado) return;
      const anteriorKey = `${identityKey}:${sessaoAnterior.assinatura}`;
      if (resultado.estado !== "aplicada") sessionStorage.removeItem(anteriorKey);
      if (sessionStorage.getItem(pointerKey) === anteriorKey) sessionStorage.removeItem(pointerKey);
      setSessaoAnterior(null);
      setPagina(null);
      setMensagem(resultado.estado === "aplicada"
        ? "A fotografia anterior já havia sido aplicada; o recibo foi preservado. Os dados antigos não foram reutilizados."
        : "Fotografia anterior encerrada. Os dados antigos não foram reutilizados.");
    },
    onError: (error) => setMensagem(`Não foi possível encerrar a fotografia anterior: ${error.message}`),
  });

  const totalPaginas = sessao?.paginaFinal ? sessao.paginasRevistas.length : 0;
  const todasRevistas = Boolean(
    sessao?.paginaFinal &&
      sessao.paginasRevistas.length === sessao?.paginaAtual + 1 &&
      sessao.paginasRevistas.every((numero, indice) => numero === indice),
  );
  const carregando = iniciar.isPending || carregarPagina.isPending || selar.isPending || confirmar.isPending || invalida.isPending;

  if (!operacionalHabilitado && sessao?.estado !== "aplicada") {
    return (
      <section aria-label="Alteração de dia contratual em lote">
        <p role="status">Fluxo de grande volume preparado. A operação aguarda ensaio de volume e abertura controlada do gate.</p>
        {sessao && (
          <button type="button" disabled={invalida.isPending} onClick={() => invalida.mutate()}>
            Encerrar fotografia sem aplicar
          </button>
        )}
        {sessaoAnterior && (
          <button type="button" disabled={invalidarAnterior.isPending} onClick={() => invalidarAnterior.mutate()}>
            Encerrar fotografia anterior
          </button>
        )}
        {!sessao && !sessaoAnterior && (
          <button type="button" disabled>Preparar fotografia completa das Visitas</button>
        )}
      </section>
    );
  }

  return (
    <section aria-label="Alteração de dia contratual em lote">
      {sessaoAnterior && (
        <div role="alert">
          <p>Os parâmetros da alteração mudaram. A fotografia anterior está oculta e não pode ser retomada neste contexto.</p>
          <button type="button" disabled={carregando || invalidarAnterior.isPending} onClick={() => invalidarAnterior.mutate()}>
            Encerrar fotografia anterior
          </button>
        </div>
      )}
      {!sessao && !sessaoAnterior && (
        <button type="button" disabled={!operacionalHabilitado || bloqueado || !dia || !vigencia || carregando} onClick={() => {
          try {
            const existente = sessionStorage.getItem(startKey);
            const id = existente ? inicioSchema.parse(JSON.parse(existente)).requestId : crypto.randomUUID();
            sessionStorage.setItem(startKey, JSON.stringify({ requestId: id }));
            iniciar.mutate(id);
          } catch {
            setMensagem("Não foi possível guardar a tentativa. Nenhuma fotografia foi iniciada.");
          }
        }}>
          Preparar fotografia completa das Visitas
        </button>
      )}
      {sessao && sessao.estado === "montando" && !pagina && (
        <>
          <p role="status">Em andamento · fotografia salva · página {sessao.paginaAtual + 1}.</p>
          <button type="button" disabled={carregando} onClick={() => carregarPagina.mutate(sessao.paginaAtual)}>
            Retomar fotografia · página {sessao.paginaAtual + 1}
          </button>
        </>
      )}
      {sessao && sessao.estado === "montando" && pagina && (
        <>
          <p role="status">Em andamento · conferência da fotografia.</p>
          <p>
            Página {pagina.numero + 1} · {pagina.itens.length} Visitas · {pagina.totalItens} registradas
            {pagina.temMais ? " · há mais páginas" : " · conjunto completo carregado"}
          </p>
          <ol className="max-h-72 overflow-auto">
            {pagina.itens.map((item: Item) => (
              <li key={item.visitaId}>
                {item.visitaId} · {new Date(item.inicioOriginal).toLocaleDateString("pt-BR")} → {item.inicioProposto ? new Date(item.inicioProposto).toLocaleDateString("pt-BR") : "suprimida por feriado"}
                {item.ocorrenciaEsperada ? " · ocorrência vinculada" : ""}
              </li>
            ))}
          </ol>
          <label>
            <input
              type="checkbox"
              checked={sessao.paginasRevistas.includes(pagina.numero)}
              onChange={(event) => {
                const paginas = event.target.checked
                  ? [...new Set([...sessao.paginasRevistas, pagina.numero])].sort((a, b) => a - b)
                  : sessao.paginasRevistas.filter((numero) => numero !== pagina.numero);
                gravar({ ...sessao, paginasRevistas: paginas });
              }}
            />{" "}
            Revisei os impactos desta página
          </label>
          <div className="flex gap-2">
            {pagina.numero > 0 && (
              <button type="button" disabled={carregando} onClick={() => carregarPagina.mutate(pagina.numero - 1)}>
                Página anterior
              </button>
            )}
            {pagina.temMais && sessao.paginasRevistas.includes(pagina.numero) && (
              <button type="button" disabled={carregando} onClick={() => carregarPagina.mutate(pagina.proximoNumero)}>
                Próxima página
              </button>
            )}
          </div>
          {!pagina.temMais && todasRevistas && (
            <button type="button" disabled={carregando} onClick={() => selar.mutate()}>
              Selar fotografia completa · {sessao.totalItens} Visitas
            </button>
          )}
        </>
      )}
      {sessao && sessao.estado === "montando" && !pagina && sessao.paginaAtual > 0 && (
        <p>Retome a página atual para continuar a conferência.</p>
      )}
      {sessao && sessao.estado === "pronta" && (
        <>
          <p>Fotografia completa selada · {sessao.totalItens} Visitas · vigência {vigencia}.</p>
          <label>
            <input
              type="checkbox"
              checked={sessao.revisaoConfirmada}
              onChange={(event) => gravar({ ...sessao, revisaoConfirmada: event.target.checked })}
            />{" "}
            Conferi todas as páginas e autorizo esta alteração atômica
          </label>
          <button type="button" disabled={bloqueado || !sessao.revisaoConfirmada || carregando} onClick={() => confirmar.mutate()}>
            Confirmar alteração de {sessao.totalItens} Visitas
          </button>
        </>
      )}
      {sessao && sessao.estado === "aplicada" && (
        <>
          <p role="status">Alteração aplicada e recibo preservado para repetição segura.</p>
          <button type="button" disabled={carregando} onClick={() => iniciar.mutate(sessao.requestId)}>
            Recuperar recibo da alteração aplicada
          </button>
        </>
      )}
      {sessao && sessao.estado === "invalidada" && (
        <button type="button" disabled={carregando} onClick={() => { gravar(null); setPagina(null); setMensagem(""); }}>
          Iniciar nova fotografia
        </button>
      )}
      {sessao && sessao.estado !== "aplicada" && (
        <button type="button" disabled={carregando} onClick={() => invalida.mutate()}>
          Encerrar fotografia sem aplicar
        </button>
      )}
      {mensagem && <p role="status">{mensagem}</p>}
      {carregando && <p>Processando fotografia…</p>}
      {totalPaginas > 0 && <span className="sr-only">{totalPaginas} páginas revisadas</span>}
    </section>
  );
}

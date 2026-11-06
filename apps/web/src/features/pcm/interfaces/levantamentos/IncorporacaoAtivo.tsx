import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { useCategoriasAtivo, useComponentesDoCliente, useLocaisDoCliente, useSistemasDoCliente } from "../../application/ativos-cliente-queries";
import { supabaseCapacidadesSsoAdapter } from "../../infrastructure/supabase-capacidades-sso-adapter";
import { supabaseCatalogosSimplesAdapter } from "../../infrastructure/supabase-catalogos-simples-adapter";
import { supabaseEquipamentosAdapter } from "../../infrastructure/supabase-equipamentos-adapter";
import { supabaseHierarquiaAdapter } from "../../infrastructure/supabase-hierarquia-adapter";
import { pedidoAtivoSchema, type PedidoAtivo, supabaseLevantamentosAdapter } from "../../infrastructure/supabase-levantamentos-adapter";
import { supabaseSistemasAdapter } from "../../infrastructure/supabase-sistemas-adapter";
import { SelecionarCriacaoAtivo } from "./CriacaoAtivosLote";
import { SelecionarCriacaoGrupo } from "./CriacaoGruposLote";

type Props = { userId: string; clienteId: string; loteId: string; chave: string; revisao: number; tipo: string; atributos: Record<string, unknown> };
export function IncorporacaoAtivo(props: Props) {
  if (import.meta.env.VITE_SSO_INCORPORACAO_ATIVOS_ENABLED !== "true" ||
    !["sistema", "equipamento", "componente", "grupo_quantitativo"].includes(props.tipo)) return null;
  return <ComPermissao key={JSON.stringify([props.userId, props.clienteId, props.loteId, props.chave])} {...props} />;
}

function ComPermissao(props: Props) {
  const permissao = useQuery({ queryKey: ["levantamentos", props.userId, props.clienteId, "incorporacao-permissao"],
    queryFn: async ({signal}) => {const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==props.userId||signal.aborted)throw new Error("Sessão alterada.");const permitida=await supabaseCapacidadesSsoAdapter.autorizarAcao("cadastro.aprovar",props.clienteId);const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==props.userId||signal.aborted)throw new Error("Sessão alterada.");return permitida;},
    gcTime: 0, refetchOnWindowFocus: true });
  if (permissao.isPending || permissao.isFetching) return <output>Verificando permissão de incorporação…</output>;
  if (permissao.isError) return <p role="alert">Não foi possível verificar permissão. <button type="button" onClick={() => void permissao.refetch()}>Tentar novamente</button></p>;
  return permissao.data === true ? <Conteudo {...props} /> : null;
}

function Conteudo({ userId, clienteId, loteId, chave, revisao, tipo, atributos }: Props) {
  const chaveLocal = `sso-incorporacao-ativo:${JSON.stringify([userId, clienteId, loteId, chave])}`;
  const [pendente, setPendente] = useState<PedidoAtivo | "invalido" | null>(() => {
    try {
      const salvo = sessionStorage.getItem(chaveLocal);
      if (!salvo) return null;
      const p = pedidoAtivoSchema.parse(JSON.parse(salvo));
      return p.loteId === loteId && p.chave === chave && p.tipo === tipo ? p : "invalido";
    } catch { return "invalido"; }
  });
  const [localId, setLocalId] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [sistemaId, setSistemaId] = useState("");
  const [parentId, setParentId] = useState("");
  const [codigo, setCodigo] = useState(typeof atributos.codigoInformado === "string" ? atributos.codigoInformado : "");
  const [quantidade, setQuantidade] = useState("");
  const [fotoConfirmada, setFotoConfirmada] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const enviando = useRef(false);
  const client = useQueryClient();
  const locais = useLocaisDoCliente(supabaseHierarquiaAdapter, clienteId);
  const sistemas = useSistemasDoCliente(supabaseSistemasAdapter, clienteId);
  const equipamentos = useComponentesDoCliente(supabaseEquipamentosAdapter, clienteId);
  const categorias = useCategoriasAtivo(supabaseCatalogosSimplesAdapter);
  const codigoStaging = useQuery({ queryKey: ["levantamentos",userId,clienteId,loteId,chave,"codigo-aprovacao",revisao], gcTime:0,
    queryFn: async ({signal}) => { const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");
      const {data,error}=await supabase.schema("pcm").rpc("sso_codigo_aprovacao_autorizado",{p_lote_id:loteId,p_chave:chave}).abortSignal(signal);
      if(error)throw error; const codigoLido=z.array(z.object({codigo:z.string(),revisao:z.number().int().positive()}).strict()).max(1).parse(data)[0] ?? null;
      const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");return codigoLido; } });
  const foto = JSON.stringify([userId,clienteId,loteId,chave,revisao,tipo,atributos,localId,categoriaId,sistemaId,parentId,codigo,quantidade,codigoStaging.data]);
  const confirmado = fotoConfirmada === foto;
  const consultas = [locais, sistemas, equipamentos, categorias, codigoStaging];
  const pronto = consultas.every((q) => !q.isPending && !q.isFetching && !q.isError);
  // Groups currently have no public-code field. Do not drop an approved staging
  // code even when the original imported row no longer contains that value.
  const grupoComCodigo = tipo === "grupo_quantitativo" &&
    (Boolean(codigoStaging.data?.codigo?.trim()) || (atributos.codigoInformado != null && String(atributos.codigoInformado).trim() !== ""));
  const grupoCodigoHabilitado = import.meta.env.VITE_SSO_INCORPORAR_GRUPO_CODIGO_ENABLED === "true";
  const envio = useMutation({ mutationFn: async (pedido: PedidoAtivo) => {
      const antes=await supabase.auth.getUser();
      if(antes.error||antes.data.user?.id!==userId||sessionStorage.getItem(chaveLocal)!==JSON.stringify(pedido))throw new Error("Sessão ou tentativa alterada.");
      const resposta=await supabaseLevantamentosAdapter.incorporarAtivo(pedido);
      const depois=await supabase.auth.getUser();
      if(depois.error||depois.data.user?.id!==userId||sessionStorage.getItem(chaveLocal)!==JSON.stringify(pedido))throw new Error("Sessão ou tentativa alterada.");
      return resposta;
    },
    onSuccess: async (_resposta, pedido) => {
      try {
        await client.invalidateQueries({ queryKey: ["levantamentos", userId, clienteId, "lotes"], refetchType:"none" });
        await client.invalidateQueries({ queryKey: ["pcm", "ativos-cliente", clienteId], refetchType:"none" });
        const atual=await supabase.auth.getUser();
        if(atual.error||atual.data.user?.id!==userId)throw new Error("Sessão alterada.");
        if (sessionStorage.getItem(chaveLocal) !== JSON.stringify(pedido)) throw new Error("Tentativa divergente");
        sessionStorage.removeItem(chaveLocal);
      } catch { setAviso("Registro confirmado, mas tentativa local não foi limpa. Consulte suporte."); return; }
      setPendente(null); setFotoConfirmada(null);
      setAviso("Ativo incorporado. As demais linhas continuam independentes.");
      void client.refetchQueries({ queryKey: ["levantamentos", userId, clienteId, "lotes"], type:"active" });
      void client.refetchQueries({ queryKey: ["pcm", "ativos-cliente", clienteId], type:"active" });
    },
    onError: () => setAviso("Resultado não confirmado. Repita a mesma tentativa ou consulte suporte em caso de conflito."),
    onSettled: () => { enviando.current = false; },
  });
  function enviar(p: PedidoAtivo) {
    if (enviando.current) return;
    enviando.current = true; setAviso(""); envio.mutate(p);
  }
  function iniciar() {
    if (!pronto || !confirmado || pendente || enviando.current || (grupoComCodigo && !grupoCodigoHabilitado)) return;
    try {
      if (!locais.data?.some((l) => l.id === localId && l.ativo) ||
        (sistemaId && !sistemas.data?.some((s) => s.id === sistemaId && s.ativo)) ||
        (parentId && !equipamentos.data?.some((e) => e.id === parentId && e.ativo && e.tipo === "equipamento" && e.localId === localId)) ||
        (tipo === "grupo_quantitativo" && !categorias.data?.some((c) => c.id === categoriaId)))
        throw new Error("Seleção não está disponível.");
      const p = pedidoAtivoSchema.parse({ requestId: crypto.randomUUID(), loteId, chave, revisao, tipo,
        localId: localId.trim(), categoriaId: categoriaId.trim() || null, sistemaId: sistemaId.trim() || null,
        parentId: parentId.trim() || null, codigo: tipo === "grupo_quantitativo" && !grupoComCodigo ? null : codigoStaging.data?.codigo ?? (codigo.trim() || null),
        quantidade: quantidade ? Number(quantidade) : null, codigoRevision: codigoStaging.data?.revisao ?? 0 });
      if (sessionStorage.getItem(chaveLocal) !== null) throw new Error("Tentativa existente");
      sessionStorage.setItem(chaveLocal, JSON.stringify(p)); setPendente(p); enviar(p);
    } catch { setAviso("Confira os identificadores, a quantidade e o armazenamento da sessão. Nada foi enviado."); }
  }
  return <section aria-label={`Incorporação de ativo ${chave}`}>
    <p>Cria apenas esta linha no cadastro oficial. Confira os vínculos do mesmo Cliente e incorpore primeiro os pais. Para cadastro existente, utilize a opção de vínculo ou atualização disponível na linha.</p>
    {grupoComCodigo && !grupoCodigoHabilitado &&
      <p role="alert">Esta linha informa código, mas a incorporação de Grupo com código ainda não está disponível. Não envie até resolver a compatibilidade.</p>}
    {grupoComCodigo && grupoCodigoHabilitado && <p>Código a incorporar: {codigoStaging.data?.codigo ?? codigo}. A atribuição ocorre na mesma transação do Grupo.</p>}
    {consultas.some((q) => q.isFetching || q.isPending) && <output>Carregando cadastros…</output>}
    {consultas.some((q) => q.isError) && <p role="alert">Não foi possível carregar os cadastros. <button type="button" onClick={() => { for (const q of consultas) if (q.isError) void q.refetch(); }}>Tentar novamente</button></p>}
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}
    {pendente && pendente !== "invalido" ? <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente)}>Repetir tentativa de incorporação</button> :
      !pendente && <form onSubmit={(e) => { e.preventDefault(); iniciar(); }}>
        <label>Local <select required disabled={!pronto} value={localId} onChange={(e) => { setLocalId(e.target.value); setParentId(""); }}><option value="">Selecione</option>{locais.data?.filter((l) => l.ativo).map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}</select></label>
        {tipo !== "grupo_quantitativo" && <label>Código definitivo <input required value={codigoStaging.data?.codigo ?? codigo} readOnly={!!codigoStaging.data} maxLength={200} onChange={(e) => setCodigo(e.target.value)} />{codigoStaging.data && " Candidato conferido no staging."}</label>}
        {tipo !== "sistema" && <label>Sistema (opcional) <select disabled={!pronto} value={sistemaId} onChange={(e) => setSistemaId(e.target.value)}><option value="">Nenhum</option>{sistemas.data?.filter((s) => s.ativo).map((s) => <option key={s.id} value={s.id}>{s.nome} {s.codigo ? `(${s.codigo})` : ""}</option>)}</select></label>}
        {tipo === "componente" && <label>Equipamento pai (opcional) <select disabled={!pronto || !localId} value={parentId} onChange={(e) => setParentId(e.target.value)}><option value="">Nenhum</option>{equipamentos.data?.filter((e) => e.ativo && e.tipo === "equipamento" && e.localId === localId).map((e) => <option key={e.id} value={e.id}>{e.nome} {e.identificador ? `(${e.identificador})` : ""}</option>)}</select></label>}
        {tipo === "grupo_quantitativo" && <><label>Categoria <select required disabled={!pronto} value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}><option value="">Selecione</option>{categorias.data?.map((c) => <option key={c.id} value={c.id}>{c.descricao}</option>)}</select></label><label>Quantidade <input required type="number" min="1" step="1" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} /></label></>}
        {fotoConfirmada && !confirmado && <p role="alert">Dados ou revisão mudaram. Confira novamente antes de incorporar.</p>}
        <label><input type="checkbox" checked={confirmado} onChange={(e) => setFotoConfirmada(e.target.checked ? foto : null)} /> Conferi classificação, localização, vínculos, código e possíveis duplicidades.</label>
        {tipo !== "grupo_quantitativo" && <SelecionarCriacaoAtivo item={{chave,tipo:tipo as "sistema" | "equipamento" | "componente",atributos,localId,sistemaId:sistemaId || null,parentId:parentId || null,codigo:codigoStaging.data?.codigo ?? codigo.trim(),codigoRevision:codigoStaging.data?.revisao ?? 0}} pronto={pronto && confirmado && !!localId && !!(codigoStaging.data?.codigo ?? codigo.trim())} />}
        {tipo === "grupo_quantitativo" && <SelecionarCriacaoGrupo item={{chave,atributos,localId,categoriaId,sistemaId:sistemaId || null,quantidade:Number(quantidade),codigoRevision:codigoStaging.data?.revisao ?? 0,codigo:grupoComCodigo ? codigoStaging.data?.codigo ?? (codigo.trim() || null) : null}} pronto={pronto && confirmado && (!grupoComCodigo || grupoCodigoHabilitado) && !!localId && !!categoriaId && Number.isSafeInteger(Number(quantidade)) && Number(quantidade)>0} />}
        <button type="submit" disabled={!pronto || !confirmado || envio.isPending || (grupoComCodigo && !grupoCodigoHabilitado)}>Incorporar ativo</button>
      </form>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}

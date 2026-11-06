import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { analisarEstruturaCsv, COLUNAS_ESTRUTURA, type DiagnosticoLinhaCsv, type LinhaImportacaoEstrutura } from "../../application/importacao-estrutura-csv";
import { supabaseCapacidadesSsoAdapter } from "../../infrastructure/supabase-capacidades-sso-adapter";
import { QuarentenaCsv } from "./QuarentenaCsv";

const pedidoSchema=z.object({requestId:z.string().uuid(),clienteId:z.string().uuid(),chaveOrigem:z.string().trim().min(1).max(200),
  linhas:z.array(z.object({chave:z.string().min(1).max(200),tipo:z.enum(["area","local","sublocal","sistema","equipamento","componente","grupo_quantitativo"]),atributos:z.record(z.string())}).strict()).min(1).max(1000)}).strict();
type Pedido=z.infer<typeof pedidoSchema>;
export function ImportacaoCsv(props:{userId:string;clienteId:string;onRecebido?:(loteId:string)=>void}){
  if(import.meta.env.VITE_SSO_IMPORTACAO_ESTRUTURA_CSV_ENABLED!=="true")return null;
  return <Conteudo key={JSON.stringify([props.userId,props.clienteId])} {...props} />;
}
function Conteudo({userId,clienteId,onRecebido}:{userId:string;clienteId:string;onRecebido?:(loteId:string)=>void}){
  const storageKey=`sso-importacao-estrutura:${JSON.stringify([userId,clienteId])}`;
  const [pendente,setPendente]=useState<Pedido | "invalido" | null>(()=>{try{const v=sessionStorage.getItem(storageKey);if(!v)return null;const p=pedidoSchema.parse(JSON.parse(v));return p.clienteId===clienteId ? p : "invalido";}catch{return "invalido";}});
  const [linhas,setLinhas]=useState<LinhaImportacaoEstrutura[] | null>(null);const [diagnosticos,setDiagnosticos]=useState<DiagnosticoLinhaCsv[] | null>(null);const [chaveOrigem,setChaveOrigem]=useState("");const [aviso,setAviso]=useState("");const [confirmado,setConfirmado]=useState(false);const trava=useRef(false);const leitura=useRef(0);const client=useQueryClient();
  useEffect(() => () => { leitura.current++; }, []);
  const permissao=useQuery({queryKey:["levantamentos",userId,clienteId,"codigo-permissao"],queryFn:async()=>{const antes=await supabase.auth.getUser();if(antes.error || antes.data.user?.id!==userId)throw new Error("Sessão alterada.");const permitido=await supabaseCapacidadesSsoAdapter.autorizarAcao("cadastro.gerir",clienteId);const depois=await supabase.auth.getUser();if(depois.error || depois.data.user?.id!==userId)throw new Error("Sessão alterada.");return permitido;},gcTime:0,refetchOnWindowFocus:true});
  const permitido=permissao.data===true && !permissao.isFetching && !permissao.isError;
  const envio=useMutation({mutationFn:async(p:Pedido)=>{if(sessionStorage.getItem(storageKey)!==JSON.stringify(p))throw new Error("Tentativa divergente.");const antes=await supabase.auth.getUser();if(antes.error || antes.data.user?.id!==userId || sessionStorage.getItem(storageKey)!==JSON.stringify(p))throw new Error("Sessão ou tentativa alterada.");const {data,error}=await supabase.schema("pcm").rpc("sso_receber_levantamento_manual",{p_request_id:p.requestId,p_cliente_id:p.clienteId,p_origem_declarada:"planilha",p_chave_origem:p.chaveOrigem,p_linhas:p.linhas});if(error)throw error;
    const r=z.object({aggregateId:z.string().uuid(),revision:z.number().int().positive(),state:z.literal("pendente"),created:z.boolean(),linkedIds:z.object({}).strict(),warnings:z.array(z.string()),requestId:z.string().uuid()}).strict().parse(data);if(r.requestId!==p.requestId)throw new Error("Resposta divergente");const depois=await supabase.auth.getUser();if(depois.error || depois.data.user?.id!==userId)throw new Error("Sessão alterada.");return r;
  },onSuccess:async(r,p)=>{try{await client.invalidateQueries({queryKey:["levantamentos",userId,clienteId,"lotes"]});const atual=await supabase.auth.getUser();if(atual.error || atual.data.user?.id!==userId || sessionStorage.getItem(storageKey)!==JSON.stringify(p))throw new Error("Sessão ou tentativa alterada");sessionStorage.removeItem(storageKey);}catch{setAviso("Não foi possível concluir a conferência da sessão ou tentativa. Consulte o recibo antes de outra recepção.");return;}
    setPendente(null);setLinhas(null);setDiagnosticos(null);setConfirmado(false);setAviso("Lote recebido para conferência. Nenhum cadastro oficial foi criado ou alterado.");onRecebido?.(r.aggregateId);
  },onError:()=>setAviso("Resultado não confirmado. Repita a mesma tentativa ou consulte suporte."),onSettled:()=>{trava.current=false;}});
  function enviar(p:Pedido){if(!permitido || trava.current)return;trava.current=true;envio.mutate(p);}
  async function abrir(file:File | undefined){const seq=++leitura.current;setLinhas(null);setDiagnosticos(null);setConfirmado(false);setAviso("");if(!file)return;try{if(!/\.csv$/i.test(file.name) || file.size>1048576)throw new Error("Use CSV UTF-8 de até 1 MiB.");const texto=new TextDecoder("utf-8",{fatal:true}).decode(await file.arrayBuffer());const dados=analisarEstruturaCsv(texto);if(seq===leitura.current){setDiagnosticos(dados);if(dados.every(d=>d.linha!==null))setLinhas(dados.map(d=>d.linha!));}}catch(e){if(seq===leitura.current)setAviso(e instanceof Error ? e.message : "Arquivo inválido.");}}
  function iniciar(){if(!permitido || !linhas || !confirmado || pendente || trava.current)return;try{const p=pedidoSchema.parse({requestId:crypto.randomUUID(),clienteId,chaveOrigem,linhas});if(new TextEncoder().encode(JSON.stringify(p.linhas)).length>1048576)throw new Error("Lote muito grande.");if(sessionStorage.getItem(storageKey)!==null)throw new Error("Tentativa existente");sessionStorage.setItem(storageKey,JSON.stringify(p));setPendente(p);enviar(p);}catch{setAviso("Confira a identificação, os dados e a sessão. Nada foi enviado.");}}
  if(permissao.isPending || permissao.isFetching)return <output>Verificando acesso à importação…</output>;
  if(permissao.isError)return <p role="alert">Não foi possível verificar acesso. <button type="button" onClick={()=>void permissao.refetch()}>Tentar novamente</button></p>;
  if(!permitido)return null;
  return <section><h3>Importar estrutura para conferência</h3><p>Exporte a planilha como CSV UTF-8 separado por ponto e vírgula. A origem será declarada, não verificada. A recepção não aprova nem altera cadastro oficial.</p>
    <p>Colunas: chave;tipo;nome;observacoes;quantidade;codigoInformado;referenciaPai;sistemaProvisorio;localProvisorio;classificacao</p>
    <p>A conferência local aponta referências de pai, ciclos, códigos e nomes repetidos no arquivo e quantidade de Grupo suspeita. Para Sistemas e Locais sugeridos, coincidências com chaves do arquivo são apenas indícios: podem ser descrições livres ou referências externas. O PCM deve confirmar vínculos e duplicidades antes da aprovação.</p>
    <button type="button" onClick={()=>{const arquivo=new Blob([`\uFEFF${COLUNAS_ESTRUTURA.join(";")}\r\n`],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(arquivo);const link=document.createElement("a");link.href=url;link.download="modelo-levantamento-estrutura.csv";link.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);}}>Baixar modelo CSV</button>
    {pendente==="invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}
    {pendente && pendente!=="invalido" ? <button type="button" disabled={envio.isPending} onClick={()=>enviar(pendente)}>Repetir recepção pendente</button> : !pendente && <>
      <label>Identificação do lote <input value={chaveOrigem} maxLength={200} onChange={(e)=>{setChaveOrigem(e.target.value);setConfirmado(false);}} /></label>
      <label>Arquivo <input type="file" accept=".csv,text/csv" onChange={(e)=>void abrir(e.target.files?.[0])} /></label>
      <QuarentenaCsv userId={userId} clienteId={clienteId} chaveOrigem={chaveOrigem} diagnosticos={diagnosticos}/>
      {diagnosticos && <><p>{diagnosticos.length} registro(s): {diagnosticos.filter(d=>d.erros.length===0).length} estruturalmente apto(s), {diagnosticos.filter(d=>d.erros.length>0).length} com erro estrutural. Isso não comprova códigos, vínculos ou ausência de duplicidades no cadastro oficial; PCM deverá conferir o lote.</p><ol>{diagnosticos.map(d=><li key={d.numero}>Registro {d.numero} · {d.chave || "chave ausente"} · {d.tipo || "tipo ausente"} · {d.erros.length ? `erro: ${d.erros.join(" ")}` : "estrutura apta à recepção"}{d.alertas.length ? ` · alerta: ${d.alertas.join(" ")}` : ""}</li>)}</ol>{!linhas && <p role="alert">Corrija os registros com erro estrutural e envie novamente o arquivo completo. Nenhuma linha foi descartada ou recebida.</p>}</>}
      {linhas && <><p>{linhas.length} linha(s) para recepção. Códigos informados são preservados; hierarquia, duplicidades e códigos devem ser revisados no lote.</p>
        <details><summary>Conferir conteúdo que será enviado</summary><p>Prévia local dos valores da planilha, antes da recepção. Não valida classificação, vínculos, códigos ou duplicidade no cadastro oficial.</p><ol>{linhas.map(linha=><li key={linha.chave}><strong>{linha.chave}</strong> · {linha.tipo}<dl>{Object.entries(linha.atributos).map(([campo,valor])=><div key={campo}><dt>{campo}</dt><dd style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{valor}</dd></div>)}</dl></li>)}</ol></details>
        <label><input type="checkbox" checked={confirmado} onChange={(e)=>setConfirmado(e.target.checked)} /> Conferi que este é o arquivo correto para o Cliente.</label>
        <button type="button" disabled={!confirmado || !chaveOrigem.trim() || envio.isPending} onClick={iniciar}>Receber lote</button></>}
    </>}{aviso && <p role="status">{aviso}</p>}
  </section>;
}

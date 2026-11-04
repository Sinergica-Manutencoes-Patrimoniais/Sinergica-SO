import { useEffect, useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import { supabaseCapacidadesSsoAdapter } from "../../infrastructure/supabase-capacidades-sso-adapter";

type Registro = { id:string; classificacao:string; dados:Record<string,string|number|null> };
type Props = { userId:string; clienteId:string; tipo:"referencias"|"planos"|"mapeamento-planos"; registros:Registro[]; parcial:boolean; disponivel:boolean };

/** Exportação local de resultados já consultados, sem criar aceite ou migração. */
export function RelatorioPrevia({userId,clienteId,tipo,registros,parcial,disponivel}:Props){
  const [ocupado,setOcupado]=useState(false);const [aviso,setAviso]=useState("");const geracao=useRef(0);const ativo=useRef(true);
  const assinatura=JSON.stringify({userId,clienteId,tipo,registros,parcial,disponivel});const atual=useRef(assinatura);atual.current=assinatura;
  useEffect(()=>{ativo.current=true;return()=>{ativo.current=false;geracao.current++;};},[]);
  async function autorizar(){
    if(await supabaseCapacidadesSsoAdapter.autorizarAcao("plano.gerir",clienteId)!==true)throw new Error("Acesso indisponível.");
    if(tipo==="mapeamento-planos" || import.meta.env.VITE_SSO_PREFLIGHT_MIGRACAO_MEDIADO_ENABLED==="true"){
      const {data,error}=await supabase.schema("pcm").rpc("sso_autorizar_exportacao_preflight",{p_ator_id:userId,p_cliente_id:clienteId});
      if(error||data!==true)throw new Error("Acesso indisponível.");
    }
  }
  async function baixar(){
    if(ocupado||!disponivel||!registros.length)return;const inicio=assinatura;const tentativa=++geracao.current;setOcupado(true);setAviso("");
    try{
      const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||!ativo.current||atual.current!==inicio||geracao.current!==tentativa)throw new Error("Contexto alterado.");
      await autorizar();
      const contagens:Record<string,number>={};for(const registro of registros)contagens[registro.classificacao]=(contagens[registro.classificacao]??0)+1;
      const documento={tipo,clienteId,geradoEm:new Date().toISOString(),abrangencia:parcial?"paginas_carregadas_incompletas":"paginas_carregadas_sem_proxima_pagina",
        ressalva:"Prévia de leitura, não é fotografia transacional, aceite ou autorização de migração. Não infere Visitas ou vínculos por proximidade temporal.",contagens,registros};
      const conteudo=JSON.stringify(documento,null,2);await autorizar();const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId||!ativo.current||atual.current!==inicio||geracao.current!==tentativa)throw new Error("Contexto alterado.");
      const url=URL.createObjectURL(new Blob([conteudo],{type:"application/json"}));
      try{const link=document.createElement("a");link.href=url;link.download=`previa-migracao-${tipo}.json`;link.click();}finally{URL.revokeObjectURL(url);}
      setAviso("Relatório gerado com as páginas carregadas; confira a abrangência antes de compartilhar.");
    }catch{if(ativo.current)setAviso("Não foi possível gerar o relatório. Confira sessão e dados consultados.");}finally{if(ativo.current)setOcupado(false);}
  }
  const contagens=new Map<string,number>();for(const r of registros)contagens.set(r.classificacao,(contagens.get(r.classificacao)??0)+1);
  return <section aria-label={`Resumo da prévia de ${tipo}`}><p>{registros.length} registro(s) nas páginas carregadas. {parcial?"Há outras páginas; resumo incompleto.":"Nenhuma página adicional indicada; alterações concorrentes ainda podem afetar o resultado."}</p>
    {contagens.size>0&&<ul>{[...contagens.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([nome,total])=><li key={nome}>{nome}: {total}</li>)}</ul>}
    <p>O arquivo contém identificadores do Cliente e dos registros; compartilhe somente com pessoas autorizadas.</p>
    <button type="button" disabled={ocupado||!disponivel||!registros.length} onClick={()=>void baixar()}>Baixar prévia em JSON</button>{aviso&&<p role="status">{aviso}</p>}
  </section>;
}

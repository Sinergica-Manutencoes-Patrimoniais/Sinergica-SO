import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { supabase } from "../../src/lib/supabase-client";
import { AcoesRevisaoPlano } from "../../src/features/pcm/interfaces/plano-manutencao/AcoesRevisaoPlano";
import { PreviaOcorrenciasVisita } from "../../src/features/pcm/interfaces/plano-manutencao/PreviaOcorrenciasVisita";
const clienteId="16610000-0000-0000-0000-00000000000a", planoId="16610000-0000-0000-0000-000000000121", versaoId="16610000-0000-0000-0000-000000000181", serieId="16610000-0000-0000-0000-000000000061";
function App(){const [email,setEmail]=useState("");const [senha,setSenha]=useState("");const [userId,setUserId]=useState("");const [erro,setErro]=useState("");const [gerar,setGerar]=useState(false);const rotinaId=new URLSearchParams(location.search).get("rotina") ?? "";
 return <main><h1>Ensaio sintético de revisão e Visita</h1>{!userId?<form onSubmit={async e=>{e.preventDefault();const {data,error}=await supabase.auth.signInWithPassword({email,password:senha});if(error||!data.user){setErro("Login indisponível");return;}setSenha("");setUserId(data.user.id);}}><label>E-mail sintético<input value={email} onChange={e=>setEmail(e.target.value)} /></label><label>Senha sintética<input type="password" value={senha} onChange={e=>setSenha(e.target.value)} /></label><button>Entrar</button>{erro&&<p role="alert">{erro}</p>}</form>:<><AcoesRevisaoPlano userId={userId} clienteId={clienteId} plano={{id:planoId,clienteId,nome:"Plano sintético",estado:"em_revisao",revisao:3}} bloqueado={false}/><button onClick={()=>setGerar(true)}>Abrir geração sintética</button>{gerar&&<PreviaOcorrenciasVisita userId={userId} clienteId={clienteId} planoId={planoId} versaoId={versaoId} rotinaId={rotinaId} serieId={serieId} revision={4}/>}</>}</main>;
}
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><App/></QueryClientProvider>);

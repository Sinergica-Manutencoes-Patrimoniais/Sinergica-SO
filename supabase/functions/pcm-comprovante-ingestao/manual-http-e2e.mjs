// SOMENTE rede interna e cluster descartável com fixtures manual_s180_ingestao_fixture_e2e.sql.
// Requer proxy manual-gateway-local.mjs, endpoints Deno e JWT_SECRET sintético.
import {createHmac} from "node:crypto";
const secret=process.env.SSO_TEST_JWT_SECRET;if(!secret)throw Error("SSO_TEST_JWT_SECRET ausente");
const b=x=>Buffer.from(JSON.stringify(x)).toString("base64url"),h=b({alg:"HS256",typ:"JWT"});
const sign=p=>{const q=b({...p,exp:Math.floor(Date.now()/1000)+300});return `${h}.${q}.${createHmac("sha256",secret).update(`${h}.${q}`).digest("base64url")}`;};
const user=sign({role:"authenticated",user_role:"superadmin",aud:"authenticated",sub:"16891000-0000-4000-8000-000000000001"}),service=sign({role:"service_role"});
const request="16891000-0000-4000-8000-000000000095",despesa="16891000-0000-4000-8000-000000000054",base={authorization:`Bearer ${user}`};
let r=await fetch("http://sso_s180_fim_ingestao:8000/",{method:"POST",headers:{...base,"x-request-id":request,"x-despesa-id":despesa,"content-type":"application/pdf"},body:"%PDF-1 synthetic"});
if(r.status!==200)throw Error(`ingestao: ${r.status}`);const resultado=await r.json();
r=await fetch("http://sso_s180_http_storage:8787/rest/v1/rpc/sso_realizar_despesa_ingestao",{method:"POST",headers:{...base,"content-type":"application/json","content-profile":"pcm"},body:JSON.stringify({p_request_id:request,p_despesa_id:despesa,p_expected_revision:1,p_realizado_centavos:100,p_comprovante_objeto_id:resultado.objetoId})});if(r.status!==200)throw Error(`realizacao: ${r.status}`);
r=await fetch("http://sso_s180_fim_unificado:8000/",{method:"POST",headers:{...base,"x-despesa-id":despesa}});if(r.status!==200||await r.text()!=="%PDF-1 synthetic")throw Error(`leitura: ${r.status}`);
r=await fetch("http://sso_s180_fim_legado:8000/",{method:"POST",headers:{...base,"content-type":"application/json"},body:JSON.stringify({lancamentoId:despesa})});if(r.status!==404)throw Error(`rota legada: ${r.status}`);
const caminho=`16891000-0000-4000-8000-000000000002/${despesa}/${request}`;
r=await fetch(`http://127.0.0.1:5000/object/sso-despesas-visita/${caminho}`,{method:"PUT",headers:{authorization:`Bearer ${service}`,"x-upsert":"true","content-type":"application/pdf"},body:"%PDF-2 adulterado"});if(r.status!==200)throw Error(`adulteracao: ${r.status}`);
r=await fetch("http://sso_s180_fim_unificado:8000/",{method:"POST",headers:{...base,"x-despesa-id":despesa}});if(r.status!==409)throw Error(`leitura adulterada: ${r.status}`);
console.log("OK: ingestão 200, realização 200, leitura 200, legado 404, alteração 409");

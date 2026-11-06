// SOMENTE clone sintético em rede interna. Necessita fixture S180, gates no clone,
// migrations 1003/1005/1007/1011/1012/1013/1016/1018, proxy local e Edge em execução.
// SSO_TEST_PG_URL deve apontar ao PostgreSQL DO CLONE com credenciais sintéticas.
import {createHmac} from "node:crypto";
import {createRequire} from "node:module";
const secret=process.env.SSO_TEST_JWT_SECRET,pgUrl=process.env.SSO_TEST_PG_URL;if(!secret||!pgUrl)throw Error("Configuração sintética ausente");
const {Client}=createRequire("/app/package.json")("pg"),db=new Client({connectionString:pgUrl});await db.connect();
const b=x=>Buffer.from(JSON.stringify(x)).toString("base64url"),h=b({alg:"HS256",typ:"JWT"});
const sign=p=>{const q=b({...p,exp:Math.floor(Date.now()/1000)+300});return `${h}.${q}.${createHmac("sha256",secret).update(`${h}.${q}`).digest("base64url")}`;};
const user=sign({role:"authenticated",user_role:"superadmin",aud:"authenticated",sub:"16891000-0000-4000-8000-000000000001"}),service=sign({role:"service_role"});
const request="16891000-0000-4000-8000-000000000095",despesa="16891000-0000-4000-8000-000000000054",legacy="16891000-0000-4000-8000-000000000055",base={authorization:`Bearer ${user}`};
let r=await fetch("http://sso_s180_hist_ingestao:8000/",{method:"POST",headers:{...base,"x-request-id":request,"x-despesa-id":despesa,"content-type":"application/pdf"},body:"%PDF-1 synthetic"});if(r.status!==200)throw Error(`ingestao: ${r.status}`);const objeto=await r.json();
r=await fetch("http://sso_s180_http_storage:8787/rest/v1/rpc/sso_realizar_despesa_ingestao",{method:"POST",headers:{...base,"content-type":"application/json","content-profile":"pcm"},body:JSON.stringify({p_request_id:request,p_despesa_id:despesa,p_expected_revision:1,p_realizado_centavos:100,p_comprovante_objeto_id:objeto.objetoId})});if(r.status!==200)throw Error(`realizacao: ${r.status}`);
const ler=async(id,token=user)=>fetch("http://sso_s180_hist_edge:8000/",{method:"POST",headers:{authorization:`Bearer ${token}`,"x-despesa-id":id,"x-revisao":"2"}});
r=await ler(despesa);if(r.status!==200||await r.text()!=="%PDF-1 synthetic")throw Error(`historico mediado: ${r.status}`);
r=await ler(despesa,"invalido");if(r.status!==401)throw Error(`token invalido: ${r.status}`);
const caminho=`16891000-0000-4000-8000-000000000002/${legacy}/16891000-0000-4000-8000-000000000066`;
r=await fetch(`http://127.0.0.1:5000/object/sso-despesas-visita/${caminho}`,{method:"POST",headers:{authorization:`Bearer ${service}`,"content-type":"application/pdf"},body:"%PDF-legado"});if(r.status!==200)throw Error(`upload legado: ${r.status}`);const legado=await r.json();
await db.query("begin");await db.query("set local app.auvo_sync_write='true'");await db.query("insert into pcm.despesas_visita(id,visita_id,cliente_id,categoria_id,data,descricao,previsto_centavos,realizado_centavos,created_by) values ($1,$2,$3,$4,'2026-11-01','Legado sintético',100,100,$5)",[legacy,"16891000-0000-4000-8000-000000000052","16891000-0000-4000-8000-000000000002","16891000-0000-4000-8000-000000000053","16891000-0000-4000-8000-000000000001"]);await db.query("insert into pcm.despesa_visita_realizacoes(despesa_id,revisao,valor_centavos,comprovante_objeto_id,comprovante_caminho,ator_id,request_id) values($1,2,100,$2,$3,$4,$5)",[legacy,legado.Id,caminho,"16891000-0000-4000-8000-000000000001","16891000-0000-4000-8000-000000000067"]);await db.query("commit");
r=await ler(legacy);if(r.status!==200||await r.text()!=="%PDF-legado")throw Error(`historico legado: ${r.status}`);
const caminhoMediado=`16891000-0000-4000-8000-000000000002/${despesa}/${request}`;r=await fetch(`http://127.0.0.1:5000/object/sso-despesas-visita/${caminhoMediado}`,{method:"PUT",headers:{authorization:`Bearer ${service}`,"x-upsert":"true","content-type":"application/pdf"},body:"%PDF-adulterado"});if(r.status!==200)throw Error(`alteracao: ${r.status}`);
r=await ler(despesa);if(r.status!==409)throw Error(`digest divergente: ${r.status}`);
await db.query("update config.usuarios set ativo=false where user_id=$1",["16891000-0000-4000-8000-000000000001"]);r=await ler(legacy);if(r.status!==404)throw Error(`revogado: ${r.status}`);
console.log("OK: mediado 200, legado 200, token inválido 401, bytes alterados 409, revogado 404");await db.end();

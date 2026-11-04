// Exclusivo para container Storage descartável, em rede sem saída e banco sintético.
import { createHmac } from 'node:crypto';
const fase = process.argv[2];
if (!['ativo', 'revogado'].includes(fase)) throw new Error('fase inválida');
const user='16891000-0000-4000-8000-000000000001';
const cliente='16891000-0000-4000-8000-000000000002';
const prefix = '16891000-0000-4000-8000-0000000000';
const suffix=process.env.HTTP_TEST_SUFFIX ?? '97';
if (!/^\d{2}$/.test(suffix)) throw new Error('sufixo inválido');
const secret='synthetic-only-secret-with-at-least-32-characters';
const enc=(v)=>Buffer.from(JSON.stringify(v)).toString('base64url');
const a=enc({alg:'HS256',typ:'JWT'}), b=enc({sub:user,role:'authenticated',user_role:'superadmin',exp:Math.floor(Date.now()/1000)+300});
const jwt=`${a}.${b}.${createHmac('sha256',secret).update(`${a}.${b}`).digest('base64url')}`;
const items=[
 ['sso-grupos-fotos',`${cliente}/${prefix}06/${prefix}97`,'image/jpeg'],
 ['sso-material-evidencias',`${cliente}/${prefix}51/2/${prefix}97`,'image/jpeg'],
 ['sso-levantamento-fotos',`${cliente}/${prefix}50/${prefix}97`,'image/jpeg'],
 ['sso-levantamento-documentos',`${cliente}/${prefix}50/${prefix}97`,'application/pdf'],
 ['sso-retorno-evidencias',`${cliente}/${prefix}18/${prefix}97`,'image/jpeg'],
 ['sso-despesas-visita',`${cliente}/${prefix}54/${prefix}97`,'application/pdf'],
];
for (const [bucket,path,mime] of items) {
 const chave = path.replace(/97$/, suffix);
 const r=await fetch(`http://127.0.0.1:5000/object/${bucket}/${chave}`,{method:'POST',headers:{authorization:`Bearer ${jwt}`,'content-type':mime},body:'bytes sintéticos'});
 const corpo=await r.text();
 if ((fase==='ativo' && r.status !== 200) || (fase==='revogado' && (r.status !== 400 || !corpo.includes('row-level security')))) throw Error(`${bucket}: HTTP ${r.status}: ${corpo}`);
 console.log(`${fase}: ${bucket} HTTP ${r.status}`);
}
if(fase==='ativo') {
 const r=await fetch(`http://127.0.0.1:5000/object/sso-despesas-visita/${cliente}/${prefix}54/${prefix}95`,{method:'POST',headers:{authorization:'Bearer invalido','content-type':'application/pdf'},body:'sintético'});
 if (![400,401].includes(r.status)) throw Error(`JWT inválido: HTTP ${r.status}`);
 console.log(`JWT inválido: HTTP ${r.status}`);
}

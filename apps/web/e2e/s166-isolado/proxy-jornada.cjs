// Executar apenas no contêiner do navegador ligado à rede interna atestada.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const id=process.env.S166_ISOLATED_ID;
if(!/^[0-9a-f]{12}$/.test(id||''))throw Error('ID de ensaio inválido');
const root='/tmp/sso-jornada-dist';
http.createServer((req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:5189');
 const route=url.pathname.startsWith('/auth/v1/')?['auth',url.pathname.slice(8)]:url.pathname.startsWith('/rest/v1/')?['rest',url.pathname.slice(8)]:null;
 if(route){if(url.pathname.includes('sso_decidir_impacto_comparado')){fs.appendFileSync('/tmp/sso-proxy-eventos','recebido\n');req.on('end',()=>fs.appendFileSync('/tmp/sso-proxy-eventos','entrada-completa\n'));}const target=`sso-s166-e2e-${id}-${route[0]}`;const p=http.request({hostname:target,port:route[0]==='auth'?9999:3000,path:route[1]+url.search,method:req.method,headers:{...req.headers,host:target}},r=>{if(url.pathname.includes('sso_decidir_impacto_comparado'))fs.appendFileSync('/tmp/sso-proxy-eventos','resposta-'+r.statusCode+'\n');res.writeHead(r.statusCode,r.headers);r.pipe(res)});p.on('error',()=>{res.writeHead(502);res.end()});req.pipe(p);return;}
 const name=url.pathname==='/'?'/e2e/s166-isolado/jornada.html':url.pathname;
 const file=path.resolve(root,'.'+name);if(!file.startsWith(root+'/')){res.writeHead(403);res.end();return;}
 fs.readFile(file,(e,data)=>{if(e){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(data)});
}).listen(5189,'127.0.0.1');

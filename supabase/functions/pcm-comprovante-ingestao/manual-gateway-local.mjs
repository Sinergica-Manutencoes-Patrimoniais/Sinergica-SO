// Proxy de teste apenas para rede Docker interna; não usar em produção.
import http from "node:http";
const rotas=[["/auth/v1/","sso_s180_http_auth",9999],["/rest/v1/","sso_s180_http_rest",3000],["/storage/v1/","sso_s180_http_storage",5000]];
http.createServer((req,res)=>{const rota=rotas.find(([prefix])=>req.url?.startsWith(prefix));if(!rota){res.writeHead(404).end();return;}const [prefix,host,port]=rota;const upstream=http.request({host,port,method:req.method,path:`/${req.url.slice(prefix.length)}`,headers:req.headers},r=>{res.writeHead(r.statusCode??502,r.headers);r.pipe(res);});upstream.on("error",()=>res.writeHead(502).end());req.pipe(upstream);}).listen(8787,"0.0.0.0");

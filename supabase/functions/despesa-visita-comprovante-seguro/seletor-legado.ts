// Usar somente resultado autorizado do seletor de serviço, nunca dados do cliente.
export function caminhoLegado(dados:unknown,despesaId:string):string|null {
 if(!dados||typeof dados!=="object")return null;
 const d=dados as Record<string,unknown>;
 if(d.origem!=="legado"||d.digest!==null||typeof d.caminho!=="string")return null;
 const p=d.caminho.split("/"),uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 return p.length===3&&p.every(x=>uuid.test(x))&&p[1]?.toLowerCase()===despesaId.toLowerCase()?d.caminho:null;
}

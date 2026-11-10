type Resultado<T> = { ok:true; valor:T } | { ok:false; motivo:"formato"|"fuso"|"precisao"|"inexistente"|"ambiguo" };

function formatador(fuso: string): Intl.DateTimeFormat | null {
  try { return new Intl.DateTimeFormat("en-CA",{timeZone:fuso,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}); }
  catch { return null; }
}
function civil(format: Intl.DateTimeFormat, instante: number): string {
  const p=Object.fromEntries(format.formatToParts(new Date(instante)).map((parte)=>[parte.type,parte.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
}
function instanteExplicito(valor: string): number | null {
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(valor))return null;
  if(!civilValido(valor.slice(0,19)))return null;
  const numero=Date.parse(valor);return Number.isFinite(numero)?numero:null;
}
function civilValido(valor: string): boolean {
  const p=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(valor);
  if(!p||Number(p[1])<2000||Number(p[1])>2100||Number(p[4])>23||Number(p[5])>59||Number(p[6])>59)return false;
  const d=new Date(0);d.setUTCFullYear(Number(p[1]),Number(p[2])-1,Number(p[3]));
  return d.getUTCFullYear()===Number(p[1])&&d.getUTCMonth()===Number(p[2])-1&&d.getUTCDate()===Number(p[3]);
}
/** Converte somente quando a representação civil identifica um único instante. */
export function utcParaHorarioAuvo(valor: string,fuso: string): Resultado<string> {
  const numero=instanteExplicito(valor);if(numero===null)return {ok:false,motivo:"formato"};
  if(numero%1000!==0)return {ok:false,motivo:"precisao"};
  const format=formatador(fuso);if(!format)return {ok:false,motivo:"fuso"};
  const local=civil(format,numero);if(!civilValido(local))return {ok:false,motivo:"formato"};
  // A inversão detecta qualquer outra ocorrência dentro da faixa de offsets suportada.
  const inverso=horarioAuvoParaUtc(local,fuso);if(!inverso.ok)return inverso;
  if(Date.parse(inverso.valor)!==numero)return {ok:false,motivo:"formato"};
  return {ok:true,valor:local};
}

/** Uma data civil sem offset é aceita somente se existir exatamente uma vez no fuso informado. */
export function horarioAuvoParaUtc(valor: string,fuso: string): Resultado<string> {
  if(!civilValido(valor))return {ok:false,motivo:"formato"};
  const format=formatador(fuso);if(!format)return {ok:false,motivo:"fuso"};
  const base=Date.parse(`${valor}Z`);const candidatos:number[]=[];
  // Offsets modernos variam dentro de ±14 horas e são expressos em minutos.
  for(let minutos=-840;minutos<=840;minutos++){
    const candidato=base+minutos*60000;if(civil(format,candidato)===valor)candidatos.push(candidato);
    if(candidatos.length>1)return {ok:false,motivo:"ambiguo"};
  }
  if(candidatos.length===0)return {ok:false,motivo:"inexistente"};
  return {ok:true,valor:new Date(candidatos[0]!).toISOString()};
}

// @vitest-environment jsdom
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { afterEach,expect,it,vi } from 'vitest';
const api=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('../../../../lib/supabase-client',()=>({supabase:{schema:()=>({rpc:api.rpc})}}));
vi.mock('./diagnostico-revisao-sessao',()=>({conferirSessaoDiagnostico:async()=>{}}));
import { VigenciaSerieRotina } from './VigenciaSerieRotina';
const id=(n:number)=>`16610000-0000-4000-8000-${String(n).padStart(12,'0')}`;
afterEach(()=>{cleanup();sessionStorage.clear();vi.resetAllMocks();});
it('usa leitura mediada e preserva o pedido após falha de envio',async()=>{
 api.rpc.mockImplementation((nome:string)=>nome==='sso_listar_vigencias_serie_mediada'?{abortSignal:async()=>({data:[],error:null})}:Promise.resolve({data:null,error:new Error('rede')}));
 const c=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
 render(<QueryClientProvider client={c}><VigenciaSerieRotina userId={id(1)} clienteId={id(2)} planoId={id(3)} rotinaId={id(4)} serieId={id(5)}/></QueryClientProvider>);
 await waitFor(()=>expect(api.rpc).toHaveBeenCalledWith('sso_listar_vigencias_serie_mediada',expect.objectContaining({p_ator:id(1),p_cliente:id(2)})));
 fireEvent.change(screen.getByLabelText('Data inicial'),{target:{value:'2026-12-01'}});fireEvent.change(screen.getByLabelText('Motivo'),{target:{value:'Conferido'}});fireEvent.click(screen.getByRole('button',{name:'Confirmar vigência'}));
 await screen.findByText(/Resultado não confirmado/);expect(screen.getByRole('button',{name:'Repetir mesmo pedido'})).toBeTruthy();expect(sessionStorage.length).toBe(1);
});
it.each(['inicial','replay','serializacao'] as const)('conflito de vigência: %s',async cenario=>{
 let envios=0;const erro={code:cenario==='serializacao'?'40001':'P0011',message:'revisao_obsoleta'};
 api.rpc.mockImplementation((nome:string)=>nome==='sso_listar_vigencias_serie_mediada'?{abortSignal:async()=>({data:[{id:id(6),inicio:'2026-01-01',fim:null,revisao:1}],error:null})}:nome==='sso_listar_eventos_vigencia_mediada'?{abortSignal:async()=>({data:[],error:null})}:(envios++,Promise.resolve({data:null,error:cenario==='replay'&&envios===1?new Error('rede'):erro})));
 const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});render(<QueryClientProvider client={client}><VigenciaSerieRotina userId={id(1)} clienteId={id(2)} planoId={id(3)} rotinaId={id(4)} serieId={id(5)}/></QueryClientProvider>);
 fireEvent.click(await screen.findByRole('button',{name:'Histórico'}));fireEvent.change(screen.getByLabelText('Ação'),{target:{value:'encerrar'}});fireEvent.change(screen.getByLabelText('Data final'),{target:{value:'2026-12-01'}});fireEvent.change(screen.getByLabelText('Motivo'),{target:{value:'Conferido'}});fireEvent.click(screen.getByRole('button',{name:'Confirmar vigência'}));
 if(cenario==='inicial'){await screen.findByText(/A vigência mudou/);expect(sessionStorage.length).toBe(0);}else{const retry=await screen.findByRole('button',{name:'Repetir mesmo pedido'});await screen.findByText(/Resultado não confirmado/);if(cenario==='replay'){fireEvent.click(retry);await waitFor(()=>expect(envios).toBe(2));}expect(sessionStorage.length).toBe(1);}
});

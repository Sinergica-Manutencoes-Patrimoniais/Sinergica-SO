// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const api=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('../../../../lib/supabase-client',()=>({supabase:{auth:{getUser:async()=>({data:{user:{id:'16660000-0000-4000-8000-000000000001'}},error:null})},schema:()=>({rpc:api.rpc})}}));
vi.mock('../../infrastructure/supabase-capacidades-sso-adapter',()=>({supabaseCapacidadesSsoAdapter:{autorizarAcao:async()=>true}}));
import { TransicaoPlano } from './TransicaoPlano';
const id=(n:number)=>`16660000-0000-4000-8000-${String(n).padStart(12,'0')}`;
afterEach(()=>{cleanup();sessionStorage.clear();vi.resetAllMocks();});
it.each(['primeira','serializacao','replay'] as const)('transição preserva pedido conforme resultado: %s',async c=>{
 const erro={code:c==='serializacao'?'40001':'P0011',message:'revisao_obsoleta'};
 if(c==='replay')api.rpc.mockResolvedValueOnce({error:new Error('rede')}).mockResolvedValueOnce({error:erro});else api.rpc.mockResolvedValue({error:erro});
 const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
 render(<QueryClientProvider client={client}><TransicaoPlano userId={id(1)} clienteId={id(2)} plano={{id:id(3),revisao:1,estado:'aprovado'} as never} bloqueado={false}/></QueryClientProvider>);
 fireEvent.change(screen.getByLabelText('Vigência'),{target:{value:'2026-11-05'}});fireEvent.change(screen.getByLabelText('Motivo'),{target:{value:'Teste'}});fireEvent.click(screen.getByRole('checkbox'));await waitFor(()=>expect((screen.getByRole('button',{name:'Confirmar transição local'}) as HTMLButtonElement).disabled).toBe(false));fireEvent.click(screen.getByRole('button',{name:'Confirmar transição local'}));
 if(c==='primeira'){await screen.findByText(/O Plano mudou/);expect(sessionStorage.length).toBe(0);}else{const retry=await screen.findByRole('button',{name:'Repetir mesmo pedido'});if(c==='replay'){await screen.findByText(/Resultado não confirmado/);fireEvent.click(retry);await waitFor(()=>expect(api.rpc).toHaveBeenCalledTimes(2));}await screen.findByText(/Resultado não confirmado/);expect(sessionStorage.length).toBe(1);}
});

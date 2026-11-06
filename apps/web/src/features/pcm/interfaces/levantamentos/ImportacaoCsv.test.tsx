// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ImportacaoCsv } from './ImportacaoCsv';
const m=vi.hoisted(()=>({rpc:vi.fn(),getUser:vi.fn(),autorizar:vi.fn()}));
vi.mock('../../../../lib/supabase-client',()=>({supabase:{schema:()=>({rpc:m.rpc}),auth:{getUser:m.getUser}}}));
vi.mock('../../infrastructure/supabase-capacidades-sso-adapter',()=>({supabaseCapacidadesSsoAdapter:{autorizarAcao:m.autorizar}}));
vi.mock('./QuarentenaCsv',()=>({QuarentenaCsv:()=>null}));
vi.mock('./RevisaoQuarentenaCsv',()=>({RevisaoQuarentenaCsv:()=>null}));
const cliente='17799500-0000-4000-8000-00000000000a';
const pedido={requestId:'17799500-0000-4000-8000-000000000040',clienteId:cliente,chaveOrigem:'lote-1',linhas:[{chave:'1',tipo:'sistema',atributos:{nome:'Sistema'}}]};
const chave=`sso-importacao-estrutura:${JSON.stringify(['user-a',cliente])}`;
beforeEach(()=>{vi.stubEnv('VITE_SSO_IMPORTACAO_ESTRUTURA_CSV_ENABLED','true');sessionStorage.setItem(chave,JSON.stringify(pedido));m.autorizar.mockResolvedValue(true);m.getUser.mockReset().mockResolvedValue({data:{user:{id:'user-a'}},error:null});m.rpc.mockReset().mockResolvedValue({data:{aggregateId:'17799500-0000-4000-8000-000000000015',revision:1,state:'pendente',created:true,linkedIds:{},warnings:[],requestId:pedido.requestId},error:null});});
afterEach(()=>{cleanup();sessionStorage.clear();vi.clearAllMocks();vi.unstubAllEnvs();});
async function montar(){render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}><ImportacaoCsv userId="user-a" clienteId={cliente}/></QueryClientProvider>);return await screen.findByRole('button',{name:'Repetir recepção pendente'});}
it('preserva lote pendente e não envia sob sessão diferente',async()=>{const botao=await montar();m.getUser.mockResolvedValue({data:{user:{id:'user-b'}},error:null});fireEvent.click(botao);expect(await screen.findByText(/Resultado não confirmado/)).toBeTruthy();expect(m.rpc).not.toHaveBeenCalled();expect(sessionStorage.getItem(chave)).toBe(JSON.stringify(pedido));});
it('preserva tentativa se sessão muda durante recepção',async()=>{const botao=await montar();m.getUser.mockResolvedValueOnce({data:{user:{id:'user-a'}},error:null}).mockResolvedValueOnce({data:{user:{id:'user-b'}},error:null});fireEvent.click(botao);expect(await screen.findByText(/Resultado não confirmado/)).toBeTruthy();expect(m.rpc).toHaveBeenCalledTimes(1);expect(sessionStorage.getItem(chave)).toBe(JSON.stringify(pedido));});

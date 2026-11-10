-- Apenas banco sintético dedicado, nunca executar em banco oficial.
DO $$ BEGIN IF current_database() <> 'sso_transporte_169' THEN RAISE EXCEPTION 'banco_sintetico_obrigatorio'; END IF; END $$;
\set ON_ERROR_STOP on
begin;
update pcm.sso_reconciliacao_cronograma_gate set habilitado=true;
update pcm.cronograma_importacao_comandos c set
 payload=jsonb_build_object('tipo','receber','loteId',l.id,'clienteId',l.cliente_id,'fonteId',l.fonte_id,'matriz',l.matriz),
 resultado=jsonb_build_object('aggregateId',l.id,'revision',1,'state','pendente','created',true,'requestId',c.request_id)
from pcm.cronograma_importacao_lotes l where l.id='00000000-0000-0000-0000-000000000010';
insert into pcm.cronograma_importacao_comandos(request_id,ator_id,cliente_id,payload,resultado)
select '00000000-0000-0000-0000-000000000032',r.ator_id,l.cliente_id,
 jsonb_build_object('tipo','anotar','loteId',l.id,'expectedRevision',1,'numeroLinha',r.numero_linha,'observacao',r.observacao),
 jsonb_build_object('aggregateId',l.id,'revision',2,'state','pendente','created',true,'requestId','00000000-0000-0000-0000-000000000032'::uuid,'anotacaoId',r.id)
from pcm.cronograma_importacao_lotes l join pcm.cronograma_importacao_revisoes r on r.lote_id=l.id;
do $$
declare a jsonb; b jsonb;
begin
 a:=pcm.sso_reconciliar_cronograma_por_ator('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000030','00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000020',2,'ensaio');
 b:=pcm.sso_reconciliar_cronograma_por_ator('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000030','00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000020',2,'ensaio');
 if a is distinct from b or (select count(*) from pcm.sso_levantamento_comandos)<>3 or (select count(*) from pcm.sso_levantamento_conferencias)<>1 then raise exception 'transporte incorreto'; end if;
end $$;
rollback;

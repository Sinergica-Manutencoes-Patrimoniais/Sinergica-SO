-- E01-S167 AC-5: pcm.sso_diagnosticar_aptidao_chamado, pcm.sso_listar_itens_aptidao_chamado e
-- pcm.sso_encerrar_chamado_conferido (0621/0611, recriada em 1027) nunca receberam
-- `grant execute ... to authenticated` em nenhuma migration — confirmado por busca em todo
-- supabase/migrations/ e por chamada direta via psql local (42883, função não resolve pro papel
-- `authenticated`). São wrappers top-level com guarda de autorização própria
-- (`config.sso_autorizar_acao('chamado.encerrar', ...)`) e os dois gates (`chamado_os_gate`,
-- `sso_encerramento_chamado_gate`) continuam fechados em produção — esta migration só habilita a
-- RPC a ser chamada quando os gates abrirem; não muda nenhuma regra de negócio.
-- `pcm.sso_comando_escopo_chamado` (0333/1027) permanece sem grant de propósito: só é chamada de
-- dentro de outras funções security definer (contexto do dono, não do chamador), nunca
-- diretamente — não precisa e não deve ganhar grant aqui.
--
-- Reverso: revoke execute on function pcm.sso_diagnosticar_aptidao_chamado(uuid,uuid) from authenticated;
--          revoke execute on function pcm.sso_listar_itens_aptidao_chamado(uuid,uuid,text,uuid,integer) from authenticated;
--          revoke execute on function pcm.sso_encerrar_chamado_conferido(uuid,uuid,uuid,bigint,text) from authenticated;

grant execute on function pcm.sso_diagnosticar_aptidao_chamado(uuid, uuid) to authenticated;
grant execute on function pcm.sso_listar_itens_aptidao_chamado(uuid, uuid, text, uuid, integer) to authenticated;
grant execute on function pcm.sso_encerrar_chamado_conferido(uuid, uuid, uuid, bigint, text) to authenticated;

-- ADR-0187: só cadastra a ação; não cria perfil, vínculo ou concessão.
insert into config.sso_acoes(codigo,modulo,nivel,exige_concessao_individual)
values('visita.cancelar','pcm','escrita',false)
on conflict (codigo) do nothing;

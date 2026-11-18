-- E00-S26 — Capacidades sensíveis ponta a ponta (ADR-1690).
--
-- A fundação já existe inteira desde E01-S170 (`config.sso_acoes`, `sso_perfis`,
-- `sso_usuario_perfis`, `sso_concessoes`, `config.sso_autorizar_acao`) e tem UI administrativa
-- (`CapacidadesWorkspace`, superadmin). O achado do Fabrício ("quem tem escrita no módulo pode
-- aprovar/cancelar/exportar/ver custo") é real: das ações sensíveis nomeadas no Pacote
-- Consolidado, só `plano.gerir` nasceu com `exige_concessao_individual=true`; as outras —
-- `cadastro.aprovar` (aprovar), `chamado.encerrar` (cancelar), `custo.ler` (visualizar valores
-- internos), `visita.cancelar` (cancelar) — nasceram `false`, herdáveis por perfil sem concessão
-- própria.
--
-- `execucao.validar` (validar) foi cogitada e DESCARTADA desta lista: `E01-S170_perfis_acumulaveis
-- .test.sql` já prova, de propósito, que ela acumula por perfil ("usuário acumula capacidades dos
-- dois perfis", "segundo perfil permanece efetivo") — é uma decisão de design anterior e testada,
-- não um descuido. Mudar isso aqui quebraria contrato já intencional; fica registrado como
-- divergência consciente da spec (SPEC_DEVIATION), não como gap.
--
-- Reverso: update config.sso_acoes set exige_concessao_individual = false
--            where codigo in ('cadastro.aprovar','chamado.encerrar','custo.ler','visita.cancelar');
--
-- SEGURO HOJE (confirmado antes de aplicar): não existe nenhuma linha real em
-- `config.sso_concessoes` com `perfil_id` preenchido em produção — a busca por
-- `insert into config.sso_concessoes` fora de corpo de função/teste retorna vazio para os 4
-- códigos acima. Então esta migration **não revoga nenhum acesso em uso**; só fecha a porta de
-- perfil-herdado pra quando alguém criar o primeiro perfil real pela UI.
do $$
begin
  update config.sso_acoes
  set exige_concessao_individual = true
  where codigo in ('cadastro.aprovar', 'chamado.encerrar', 'custo.ler', 'visita.cancelar')
    and exige_concessao_individual is distinct from true;
end $$;

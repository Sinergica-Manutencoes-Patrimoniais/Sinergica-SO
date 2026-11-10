-- ADR-0080: fase compatível; a origem nova continua bloqueada.
alter table pcm.ocorrencias_preventivas
  add column origem text not null default 'legado',
  add constraint ocorrencia_preventiva_origem_faseada check (origem = 'legado');

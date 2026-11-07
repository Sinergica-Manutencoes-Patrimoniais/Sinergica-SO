-- ADR-0377: compatibilidade estrutural para evidência geral não exigida no contrato.
alter table pcm.sso_conferencias_cobertura_retorno alter column evidencia_id drop not null;

-- ADR-1270: acesso de serviço ao recebimento já protegido; gate permanece fechado.
grant execute on function pcm.sso_receber_envelope_origem_campo(text, bigint, text, text, timestamptz, jsonb) to service_role;

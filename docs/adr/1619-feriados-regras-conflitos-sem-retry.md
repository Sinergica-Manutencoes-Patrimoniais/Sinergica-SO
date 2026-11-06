# ADR 1619 — Conflitos de feriados e mudança de dia

Status: aceito para implementação; homologação pendente.

Guardas explícitas de revisão, fotografia e impactos nas decisões de feriado, supressão de semana e mudança de dia retornam `P0018` em vez de `40001`, evitando retry transacional para conflitos de negócio. Replays continuam processados nos pontos originais; exceções reais de serialização permanecem inalteradas. A interface de mudança de dia reconhece somente as mensagens previstas em rejeição inicial, mantendo a tentativa em caso de resultado anterior incerto. Interfaces que ainda não reconhecem o novo código preservam a tentativa para recuperação.

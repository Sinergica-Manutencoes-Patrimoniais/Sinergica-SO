# ADR-0538 — Fuso explícito na versão aprovada

Status: preparado, gate desligado, não aplicado nem homologado. Quando ativado, nova aprovação exige configuração IANA previamente declarada pelo PCM e congela fuso, origem declarada e vigência inicial no snapshot; alterações posteriores do cadastro não mudam versões históricas. Ausência ou IANA inválido bloqueia aprovação. Nenhum valor é presumido e snapshots antigos não são reescritos.

A configuração é declaração, não prova de vínculo contratual nem validade normativa; a geração ainda não consome este snapshot. Vigência da configuração, concorrência/ordem dos triggers, conflito de revisões, fontes antigas, fuso UTC e demais gates requerem implementação, testes e revisão adversarial. Proteção de impactos 0715 continua bloqueando aprovação de revisão.

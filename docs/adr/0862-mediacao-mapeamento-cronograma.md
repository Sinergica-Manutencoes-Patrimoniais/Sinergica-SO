# ADR-0862 — Mediação de classificação e mapeamento do cronograma

Status: preparado, gates fechados; homologação pendente.

A recepção do cronograma compartilha staging S178 e possui mediação própria. Para permitir conferência sem expor diretamente funções privadas, acrescentamos wrappers para classificar, mapear, listar mapeamentos e selecionar alvos. Usam a mesma autorização `plano.gerir`, trava compartilhada de autorização e gate da ADR-0860; núcleos privados continuam responsáveis por revisão, replay, isolamento de Cliente e validação de alvo. A listagem de alvos tinha referência ambígua a `id`; sua correção qualifica a tabela sem alterar filtros.

Os comandos não aprovam nem incorporam dados. Gates não são ativados por esta migration; a abertura exige testes de concorrência de revogação, revisão adversarial e homologação. Conferência consolidada, identidade, revisão, aprovação e incorporação permanecem fora deste recorte.

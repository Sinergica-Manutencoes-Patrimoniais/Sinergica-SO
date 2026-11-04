# ADR-1043 — Filtro por competência de faturáveis

**Status:** preparação, não homologada.

A consulta experimental de faturáveis passa a oferecer intervalo inclusivo de competências, em adição a Cliente, situação e origem. A filtragem ocorre antes da paginação por ID; sem os limites, a consulta mantém a semântica anterior. Os limites são primeiros dias de meses civis e o servidor rejeita intervalo invertido. Não alterar a RPC anterior nem habilitar automaticamente a nova interface.

A nova RPC reutiliza o gate fechado e a mesma capacidade da consulta do ADR-0943, com trava compartilhada do gate e de autorização. Mantém leitura apenas; não cria cobrança, documento ou lançamento. A interface usa flag própria desligada. Cada página é uma consulta separada, não uma fotografia transacional, e a validação no cliente não substitui autorização do servidor.

Antes de ativar: aplicar migrations em ordem em ambiente isolado; validar autorização e revogação reais, paginação sob alteração concorrente, fronteiras de meses e fuso, isolamento por Cliente, cobertura dos escritores do gate e das fontes de permissão, desempenho e plano de índice em volume representativo. Exigir testes integrados, pgTAP e revisão adversarial. Gate e homologação permanecem fechados.

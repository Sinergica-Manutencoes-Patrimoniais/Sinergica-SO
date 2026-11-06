# ADR-0038 — Seleção paginada de destinos técnicos

**Status:** decisão para implementação local E01-S176. **Data:** 2026-10-27.

Uma consulta intermediada oferece Áreas, Locais e Componentes ativos de um único Cliente para a movimentação. Exige capacidade atual `cadastro.gerir`, usa filtro literal e cursor por UUID com limite máximo, e retorna somente identificação, nome e Área do Local. Não altera cadastros e não oferece dados de outros Clientes. Os seletores podem buscar e carregar páginas adicionais; o servidor continua validando o destino na transação de escrita.

Antes de homologar, testar grandes volumes, cancelamento e seleção de vínculos atuais fora das páginas carregadas, e substituir consultas legadas não paginadas das demais superfícies quando no escopo. Permissões antigas de escrita continuam sujeitas ao gate de transição descrito na ADR-0037.

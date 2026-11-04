# ADR-0206 — Relatórios internos de despesas nas telas existentes

**Estado:** preparação bloqueada; sem homologação ou implantação.

A tela existente de relatório do Cliente pode exibir, separadamente do artefato público, a consulta interna de despesas por período e técnico da ADR-0198. Os dados financeiros não integram `RelatorioCliente`, PDF, publicação ou Portal. A tela de detalhe da OS pode consultar suas parcelas rateadas em diferentes Visitas por período: considera somente a versão mais recente de cada rateio e despesa ativa, separa previsão de despesas ainda não realizadas de realizado alocado e assinala vínculos encerrados. Despesas não rateadas ficam somente no total da Visita/Cliente e não são inferidas como pertencentes à OS.

Consulta exige autorização atual por Cliente/OS; gate privado e função revogada, interface com flag desligada. Antes de abrir, validar exposição, exportações, cache, rateios históricos, tratamento de transferência, concorrência e arredondamento, limites, testes de acesso cruzado e revisão adversarial. Não alterar Financeiro real nem somar previsão a realizado.

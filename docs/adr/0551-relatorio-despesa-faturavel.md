# ADR-0551 — relatório separado de despesas e faturáveis

Status: proposto; não aplicado nem homologado. A consulta interna exige capacidades de despesas e faturáveis, Cliente e gates dos dois domínios. Previsão e realização usam data da despesa; faturáveis usam a data de competência (primeiro dia do mês). São medidas distintas, não somáveis: faturável pode ter origem em despesa ou outro fato. Valores ausentes são contados, não presumidos como zero individual. Não se expõe no Portal nem se cria cobrança. Revisar semântica de período, escopo, desempenho e conciliação antes de ativar.

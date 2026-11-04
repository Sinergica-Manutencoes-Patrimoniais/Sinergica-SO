# ADR-0897 — Interpretação isolada de células OOXML

Data: 2026-10-30 · Status: preparação; importação XLSX permanece bloqueada.

Preparar interpretação de XML de uma aba já extraído por componente futuro confiável e limitado. Preservar coordenadas, texto numérico exato, booleanos, strings compartilhadas, células explicitamente vazias, tipo original, estilo e fórmulas com eventual valor em cache. Não calcular fórmulas, inferir datas a partir de estilos ou converter valores em programação/executado. A identificação de datas e estilos depende de metadados do livro; até então números permanecem números como texto, não datas inventadas.

O XML isolado recebe limites de bytes, linhas, colunas e células; rejeita DTD, XML malformado, referências duplicadas ou inválidas, índices de strings inexistentes e tipos desconhecidos. Este componente não extrai ZIP, não abre arquivo, não executa em worker, não faz rede e não grava dados. Sua existência não comprova segurança de XLSX: limits de descompressão, CRC, caminhos, ZIP64, XML das demais partes, cancelamento e compatibilidade dos originais continuam obrigatórios antes de ativar o recurso. Reverter significa não chamar o componente; nenhum dado persistido é alterado.

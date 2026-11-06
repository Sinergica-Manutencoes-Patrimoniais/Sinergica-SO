# ADR-0285 — Breadcrumb seguro de Grupo

Consulta privada resolve ancestralidade do Local do Grupo até a raiz na mesma Área e Cliente, exige nós ativos, detecta ciclos e limita a 64 níveis. Caminho inválido ou incompleto é explicitado sem apresentar cadeia parcial como válida. Não altera hierarquia; permissões de leitura de cadastro são verificadas no servidor.

Gate e execução permanecem fechados. Testar ciclos, ancestrais indisponíveis e limites antes de ativar.

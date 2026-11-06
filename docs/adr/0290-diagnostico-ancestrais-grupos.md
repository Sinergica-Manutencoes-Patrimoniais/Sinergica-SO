# ADR-0290 — Diagnóstico paginado de ancestrais de Grupo

Consulta privada examina, por páginas de até 100 Grupos ativos do Cliente, o caminho físico até a raiz. Identifica ciclo, ancestral ausente/inativo/incompatível e limite de 64 níveis sem retornar nomes ou dados de outros Clientes. Cada Grupo integra apenas uma categoria; resultados por página são fotografias informativas e podem mudar entre requisições. Nenhuma correção é realizada.

Gate e execução permanecem fechados. Testes de segurança, paginação, concorrência e ciclos são necessários antes de ativação.

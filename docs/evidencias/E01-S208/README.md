# Apresentação da homologação de 27/11

Capturas no Chromium local com CSS compilado pelo Vite, um cliente e uma OS fictícios. A sessão usou respostas simuladas para as consultas das telas. A integração de Marketing não foi exercitada. O aviso de erro de consulta aos grupos que aparece na captura anterior de Estrutura é da sessão simulada.

| Verificação | Antes | Depois |
| --- | --- | --- |
| CT-52 · Indicadores com retorno vazio | [Captura](meta-antes.png) | [Captura](meta-depois.png) |
| CT-53 · Receita por campanha com retorno vazio | [Captura](receita-antes.png) | [Captura](receita-depois.png) |
| Grupo Quantitativo | [Escuro](grupo-antes.png) | [Escuro](grupo-depois.png) · [Claro](grupo-claro-depois.png) |
| Detalhe do Equipamento | [Escuro](equipamento-antes.png) | [Escuro](equipamento-depois.png) · [Claro](equipamento-claro-depois.png) |
| Painel da OS na Operação | [Captura](os-operacao-antes.png) | [Captura](os-operacao-depois.png) |
| Detalhe da OS na Visão 360 (460 px) | [Captura](os-antes.png) | [Captura](os-depois.png) |
| Trilha Área → Local | [Captura](trilha-antes.png) | [Captura](trilha-depois.png) |
| Visão 360 → Estrutura | [Avisos anteriores](avisos-tela-antes.png) | [Aviso consolidado](avisos-tela-depois.png) · [Superadmin com detalhes abertos](avisos-admin-depois.png) · [Perfil de leitura](avisos-leitura-depois.png) |

## Prova e contraprova

A mesma verificação rodou com o código de `origin/main` (`27825bcf`) e com a correção aplicada.

| Asserção no Chromium | Contraprova em `27825bcf` | Resultado com a correção |
| --- | --- | --- |
| Retorno vazio nos dois relatórios | Havia uma tabela sem linhas, com cabeçalhos e uma mensagem logo abaixo. | A mensagem com o período substitui a tabela. Com uma campanha fictícia, a tabela e a linha reaparecem. Uma falha simulada no CT-52 exibe a ação de tentar de novo. |
| Tema no resumo do Grupo e na seção de identificação do Equipamento | Os fundos das seções eram transparentes. O contêiner já usava o token de cartão. | Fundo computado `rgb(16, 19, 29)` no tema escuro e `rgb(244, 242, 236)` no claro, ambos resolvidos de `--color-paper`. O contêiner do Equipamento usa `--color-card`. |
| Descrição e campo Local da OS com referências extensas sem espaços | O detalhe na Visão 360 media 1.054 px de rolagem horizontal extra. O painel da Operação usava `overflow-wrap: normal`. | O detalhe da Visão 360, o painel da Operação e seu modal expandido têm 0 px de rolagem horizontal extra. A descrição preserva a quebra original. |
| Nome atual na trilha | `Área: Área Técnica` aparecia duas vezes. | O texto aparece uma vez, com `aria-current="location"`. O botão da Área continua disponível após navegar ao Local. |
| Aviso único na Estrutura | Cinco cartões individuais com as flags locais, em comparação com os 13 do relato. | Os cinco registros renderizam um aviso. O nome da flag de Política de Equipment aparece no diagnóstico do superadmin. O perfil de leitura não recebe o diagnóstico nem o nome técnico. |

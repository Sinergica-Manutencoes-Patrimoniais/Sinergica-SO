# ADR-0072 — Seletores de OS e funcionários para Visita

**Status:** decisão para implementação local E01-S171. **Data:** 2026-10-27.

Seletores consultam uma Visita no Cliente autorizado com `visita.confirmar`, paginam por ID e retornam somente dados operacionais mínimos. OS selecionáveis são do Cliente, não removidas e sem vínculo vigente em qualquer Visita; exibem estado atual para decisão do PCM. Funcionários selecionáveis são ativos e não removidos; opção explícita permite omitir integrantes vigentes ao compor equipe, ou incluí-los para escolha de responsável. Busca é literal, limitada e sem interpretação de curingas.

O seletor é uma prévia: comandos transacionais continuam responsáveis pela validação de Cliente, estado de edição, vínculo e concorrência. Disponibilidade e capacidade não são calculadas. Não cria OS, equipe, agenda ou integração externa.

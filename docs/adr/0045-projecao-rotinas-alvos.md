# ADR-0045 — Projeção legível de Rotinas

**Status:** decisão para implementação local E01-S165. **Data:** 2026-10-27.

A listagem paginada de uma versão devolve os campos da Rotina e o nome atual do alvo e do questionário por uma projeção no servidor, sem depender de permissões cadastrais adicionais e sem N+1. Exige `plano.gerir` atual no Cliente do Plano, confirma que a versão pertence ao Plano e restringe os joins de alvo ao mesmo Cliente. Nome ou alvo indisponível aparece explicitamente; nunca inferir identidade.

O nome exibido é do cadastro atual, não snapshot histórico. Antes de aprovar versões e atender consultas históricas, preservar e apresentar identificação e conteúdo congelados apropriados. A consulta não altera dados nem realiza integração externa. Leitura para não gestores e revisão adversarial seguem pendentes.

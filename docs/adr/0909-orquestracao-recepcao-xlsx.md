---
name: "docs-adr-0909-orquestracao-recepcao-xlsx-md"
description: "Documento Sinérgica SO: ADR-0909 — Orquestração da recepção XLSX atestada"
alwaysApply: false
---

# ADR-0909 — Orquestração da recepção XLSX atestada

Data: 2026-10-30 · Status: preparação; rota e gates fechados.

O serviço de recepção usa token de usuário e chave pública Supabase para confirmar identidade e `plano.gerir`, processa cópia do XLSX em worker, assina matriz derivada e bytes com chave exclusiva e chama a RPC atestada usando o mesmo token. O banco revalida autorização e assinatura na mesma transação; cliente não fornece matriz nem ator. Pedido e lote são UUIDs estáveis fornecidos pela tentativa para permitir repetição. Arquivo com pendência impeditiva não é gravado. Nenhum segredo, matriz, arquivo ou assinatura é registrado ou retornado ao navegador.

Esta preparação não registra endpoint, não provisiona chave e não abre gates. Antes da ativação: validar Supabase/Edge real, deadline, limites e concorrência distribuída, chave e rotação, prova de revalidação durante espera e revisão adversarial. Respostas de erro incerto exigem repetir o mesmo pedido; não gerar novas identidades automaticamente.

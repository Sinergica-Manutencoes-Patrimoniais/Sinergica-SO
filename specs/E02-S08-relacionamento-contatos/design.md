---
name: design
description: Arquitetura — base transversal de contatos e timeline.
alwaysApply: false
---

# Design — Base Única de Contatos

## Decisão
Criar o schema `relacionamento` como bounded context transversal leve. Ele guarda a pessoa/canal,
enquanto `pcm`, `comercial` e `atendimento` continuam donos dos seus registros operacionais.

## Modelo
- `relacionamento.contatos`
- `relacionamento.identidades_contato`
- `relacionamento.vinculos`
- `relacionamento.fn_upsert_contato_whatsapp(...)`
- `relacionamento.get_timeline_contato(...)`

## Integrações
- `atendimento.conversas.contato_id`
- `atendimento.conversas.lead_id`
- `comercial.leads.contato_id`
- `atendimento.fn_registrar_mensagem_entrada(...)` resolve/cria contato por WhatsApp.
- `pcm-ze-agent` grava `contato_id` ao criar lead comercial.

## Segurança
RLS por módulo: quem tem leitura em `atendimento`, `comercial` ou `pcm` consegue ler contatos e
timeline; escrita exige escrita em pelo menos um desses módulos. `service_role` é usado para
automação de webhook/agente.

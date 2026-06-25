---
name: testes
description: Pirâmide de testes, padrões de mock e cobertura. Puxe ao escrever teste de qualquer camada.
alwaysApply: false
---

# Testes

> Cada `AC` da spec tem um teste de aceite — **é o gate**. Teste o que dói quando quebra:
> regra de negócio, persistência, borda. Não persiga 100% de cobertura; persiga **confiança**.
> Config: `vitest.config.ts` (threshold de cobertura bloqueia a CI). Exemplos reais: feature
> `0001` (unidade de domínio) e `0002` (integração + borda).

## Pirâmide (deste stack)
| Camada                | O que cobre                                  | Como (exemplo)                                            |
|-----------------------|----------------------------------------------|----------------------------------------------------------|
| **Unidade (domínio)** | invariantes e regra pura, sem I/O            | `src/domain/comissao/*.test.ts`                          |
| **Integração (app)**  | caso de uso + porta via **adapter in-memory**| `src/application/registrar-comissao.test.ts`             |
| **Borda (interfaces)**| validação Zod + mapeamento de erro problem+json | `src/interfaces/http/registrar-comissao.test.ts`      |
| **Contrato**          | schema Zod de entrada/payload de webhook     | testar `Schema.parse` com input válido/ inválido         |
| **Produção (banco)**  | adapter Supabase + RLS                        | Supabase local / pgTAP (`db/rls-test.md`), fora da CI    |
| **E2E (quando exigir)**| caminho crítico no browser                  | Playwright smoke (> 5 deploys/sem ou > 3 fluxos críticos)|

> A **integração com adapter in-memory** é o truque central: testa o caso de uso de verdade
> (com persistência), roda na CI **sem banco**, e o adapter de produção implementa o mesmo contrato.

## Onde ficam
Junto do arquivo testado, mesmo diretório: `arquivo.ts` + `arquivo.test.ts`.

## Determinismo
Injete efeitos (relógio, geração de id, repositório) em vez de usar globais — ver
`RegistrarComissaoDeps`. Teste determinístico não tem `Date.now()` nem `Math.random()` solto.

## Padrões de mock
```ts
// fetch / API externa
vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "1" }) }));

// variáveis de ambiente (restauram com vi.unstubAllEnvs no afterEach)
vi.stubEnv("ALGUM_SECRET", "test");

// logger estruturado: silencie com o sink injetável (não faça spy em console)
definirSink(() => {}); // ver src/shared/log.ts
```
Prefira **adapter in-memory** a mock de cliente Supabase: testa o contrato, não a biblioteca.

## O que NÃO testar
- Biblioteca de UI pronta (shadcn/ui), CSS, integração real com Supabase no unit (use Supabase local).

## Cobertura
- Gate em `vitest.config.ts` (`npm run test:coverage`) — **bloqueante na CI**.
- O adapter de produção (Supabase) é excluído do threshold: é testado via banco (`db/rls-test.md`).
- Cobertura é piso, não meta: 100% verde com asserts fracos não protege nada.

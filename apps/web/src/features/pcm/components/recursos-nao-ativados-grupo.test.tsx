// @vitest-environment jsdom
// DEF-30: o detalhe do Chamado empilhava um bloco `RecursoNaoAtivado` por sub-tela desligada (6
// no caso relatado, CH-3301). Este teste prova a contenção: N sub-telas desligadas registradas no
// mesmo `RecursosNaoAtivadosGrupo` produzem UM bloco agrupado (`data-recursos-nao-ativados-grupo`)
// com os N avisos dentro, em vez de N blocos soltos — sem alterar `RecursoNaoAtivado` nem seu
// contrato (os testes de `packages/ui/src/RecursoNaoAtivado.test.tsx` continuam cobrindo o AC-6
// isolado).
import { RecursoNaoAtivado, type RecursoNaoAtivadoProps } from "@sinergica/ui";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import {
  RecursosNaoAtivadosGrupo,
  useRecursoNaoAtivadoAgrupado,
} from "./recursos-nao-ativados-grupo";

afterEach(cleanup);

/** Simula uma sub-tela guardada por flag, igual às 6 do ChamadoPainel (EntradaOrdensChamado,
 * CriarOsChamado, CanonicalizarVinculoLegado, ConversaoIntegral, AvaliacaoEscopo, GestaoEscopo). */
function SubTelaDesligada({ info }: { info: RecursoNaoAtivadoProps }) {
  const agrupado = useRecursoNaoAtivadoAgrupado(info);
  if (agrupado) return null;
  return <RecursoNaoAtivado {...info} />;
}

const RECURSOS = [
  "Ordens de Serviço vinculadas ao Chamado",
  "Criar OS neste Chamado",
  "Canonicalizar vínculo legado do Chamado",
  "Conversão integral do Chamado",
  "Conferência de escopo do Chamado",
  "Gestão de escopo do Chamado",
] as const;

it("agrupa N sub-telas desligadas num único bloco, não N blocos soltos", () => {
  render(
    <RecursosNaoAtivadosGrupo>
      {RECURSOS.map((recurso) => (
        <SubTelaDesligada
          key={recurso}
          info={{ recurso, podeAdministrar: true, faltando: [`FLAG_${recurso}`] }}
        />
      ))}
    </RecursosNaoAtivadosGrupo>,
  );

  // Único contêiner de agrupamento — não um por sub-tela.
  const grupos = document.querySelectorAll("[data-recursos-nao-ativados-grupo]");
  expect(grupos).toHaveLength(1);

  // Nenhum conteúdo perdido: as 6 sub-telas continuam visíveis dentro do bloco único.
  for (const recurso of RECURSOS) {
    expect(screen.getByText(recurso)).toBeInTheDocument();
  }
  expect(screen.getByText("6 recursos deste painel ainda não estão ativados")).toBeInTheDocument();

  // Nenhum bloco de `RecursoNaoAtivado` ficou solto fora do agrupamento.
  const blocosRecurso = document.querySelectorAll("[data-recurso-nao-ativado]");
  expect(blocosRecurso).toHaveLength(6);
  for (const bloco of blocosRecurso) {
    expect(bloco.closest("[data-recursos-nao-ativados-grupo]")).not.toBeNull();
  }
});

it("quem não administra continua vendo que existem recursos não ativados, sem nome de flag", () => {
  render(
    <RecursosNaoAtivadosGrupo>
      {RECURSOS.slice(0, 2).map((recurso) => (
        <SubTelaDesligada
          key={recurso}
          info={{ recurso, podeAdministrar: false, faltando: [`FLAG_${recurso}`] }}
        />
      ))}
    </RecursosNaoAtivadosGrupo>,
  );

  expect(screen.getByText("2 recursos deste painel ainda não estão ativados")).toBeInTheDocument();
  expect(screen.queryByText(/FLAG_/)).not.toBeInTheDocument();
});

it("fora de um grupo, a sub-tela continua desenhando seu próprio bloco (comportamento preservado)", () => {
  render(
    <SubTelaDesligada
      info={{
        recurso: "Criar OS neste Chamado",
        podeAdministrar: true,
        faltando: ["VITE_SSO_CRIAR_OS_CHAMADO_ENABLED"],
      }}
    />,
  );

  expect(document.querySelectorAll("[data-recursos-nao-ativados-grupo]")).toHaveLength(0);
  expect(screen.getByText("Criar OS neste Chamado")).toBeInTheDocument();
});

it("1 único recurso desligado usa singular no rótulo do grupo", () => {
  render(
    <RecursosNaoAtivadosGrupo>
      <SubTelaDesligada info={{ recurso: RECURSOS[0], podeAdministrar: true, faltando: ["X"] }} />
    </RecursosNaoAtivadosGrupo>,
  );

  expect(screen.getByText("1 recurso deste painel ainda não está ativado")).toBeInTheDocument();
});

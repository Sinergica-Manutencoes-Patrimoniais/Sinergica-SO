import type { ReactNode } from "react";

// Caderno de homologação, Onda 2 — "Tentar novamente" que repete a mesma negação para sempre.
//
// Nas telas de consulta, qualquer falha caía num `<p role="alert">` com um botão "Tentar
// novamente" ao lado. Para queda de rede isso é certo: a próxima tentativa pode dar certo. Para
// negação de autorização do servidor (403/42501) e para recurso ainda não liberado (55000), não:
// a resposta é determinística, o botão repete a mesma negação indefinidamente e a pessoa fica
// tentando algo que nunca vai funcionar sozinho. Foi o que a homologação viu em "Organizar
// linhas" (DEF-11) e no painel de orçamento da OS (DEF-12).
//
// Quem chama classifica o erro (apps/web `mensagemFalhaAtivacao`) e decide: com
// `onTentarNovamente`, o aviso oferece repetir; sem ele, só explica. Este componente não conhece
// Supabase nem errcode — recebe a decisão pronta.
export function AvisoFalhaConsulta({
  children,
  onTentarNovamente,
  rotulo = "Tentar novamente",
}: {
  children: ReactNode;
  onTentarNovamente?: () => void;
  rotulo?: string;
}) {
  return (
    <p role="alert">
      {children}
      {onTentarNovamente && (
        <>
          {" "}
          <button type="button" onClick={onTentarNovamente}>
            {rotulo}
          </button>
        </>
      )}
    </p>
  );
}

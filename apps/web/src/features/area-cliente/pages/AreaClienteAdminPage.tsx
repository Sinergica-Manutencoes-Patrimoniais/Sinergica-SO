import { Building2, CheckCircle2, Copy, ExternalLink, ShieldCheck, UserPlus } from "lucide-react";
import { useState } from "react";
import { resolverUrlPortal, usaDeploySeparado } from "../domain/url-portal";

const RECURSOS_PORTAL = [
  "Painel do condomínio",
  "Assessment e inspeções",
  "Chamados",
  "Histórico de OS, notas e anexos",
  "Documentos, laudos e relatórios",
  "Cronograma e conformidade",
  "Notificações e pesquisa de satisfação",
  "Aprovação de orçamento",
  "Faturas, vencimentos e segunda via",
];

export function AreaClienteAdminPage({ onAbrirClientes }: { onAbrirClientes: () => void }) {
  const [copiado, setCopiado] = useState(false);
  const origemAtual = window.location.origin;
  const urlConfigurada = import.meta.env.VITE_PORTAL_URL as string | undefined;
  const urlPortal = resolverUrlPortal(urlConfigurada, origemAtual);
  const deploySeparado = usaDeploySeparado(urlConfigurada, origemAtual);

  async function copiarEndereco() {
    await navigator.clipboard.writeText(urlPortal);
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="page-stack">
      <section className="surface-card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="page-title">Área do Cliente</h2>
              <span className="rounded-full bg-success-soft px-2.5 py-1 text-micro font-semibold text-success">
                Portal implementado
              </span>
            </div>
            <p className="page-subtitle">
              Central interna para criar acessos e orientar testes do portal do síndico.
            </p>
          </div>
          <button
            type="button"
            onClick={onAbrirClientes}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-orange px-3 text-body font-semibold text-white hover:bg-orange-deep"
          >
            <Building2 className="h-4 w-4" />
            Abrir Clientes
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-orange-deep/25 bg-orange-soft/60 p-4">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-orange-deep" />
          <div>
            <h3 className="text-body font-semibold text-ink">
              Por que o portal não abre nesta sessão?
            </h3>
            <p className="mt-1 text-body leading-relaxed text-ink-2">
              Isto é intencional: um usuário interno nunca entra na interface do cliente. O portal
              só aparece quando o login tem papel <strong>cliente-sindico</strong> e vínculo com um
              cliente. A separação protege dados internos e evita simulação insegura de identidade.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="surface-card p-5">
          <h3 className="text-body font-semibold text-ink">Como liberar e testar um cliente</h3>
          <ol className="mt-4 flex flex-col gap-4">
            <Passo
              numero="1"
              titulo="Abra o cadastro do cliente"
              descricao="Entre em PCM → Clientes, escolha o condomínio e abra a Visão 360."
            />
            <Passo
              numero="2"
              titulo='Use "Criar acesso ao portal"'
              descricao="Informe nome, e-mail e senha inicial do síndico. O sistema cria o login e o vínculo 1:1 com aquele cliente."
            />
            <Passo
              numero="3"
              titulo="Teste numa janela privativa"
              descricao="Abra o endereço abaixo em janela anônima/privativa e entre com a conta cliente-síndico. Assim a sessão interna permanece aberta."
            />
          </ol>

          <div className="mt-5 rounded-md border border-line bg-paper p-3">
            <p className="text-caption font-semibold uppercase tracking-wide text-ink-3">
              Endereço do portal
            </p>
            <p className="mt-1 break-all text-body font-semibold text-ink">{urlPortal}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={copiarEndereco}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-line px-3 text-body font-semibold text-ink-2 hover:bg-line-soft"
              >
                <Copy className="h-4 w-4" />
                {copiado ? "Copiado" : "Copiar endereço"}
              </button>
              {deploySeparado && (
                <a
                  href={urlPortal}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-line px-3 text-body font-semibold text-ink-2 hover:bg-line-soft"
                >
                  <ExternalLink className="h-4 w-4" />
                  Abrir portal
                </a>
              )}
            </div>
            <p className="mt-3 text-caption leading-relaxed text-ink-3">
              {deploySeparado
                ? "Deploy separado configurado. Este endereço entrega somente o bundle do portal."
                : "Deploy separado ainda não configurado no Netlify. Para teste, o mesmo endereço do SO direciona automaticamente contas cliente-síndico ao portal."}
            </p>
          </div>
        </section>

        <section className="surface-card p-5">
          <h3 className="text-body font-semibold text-ink">O que já está disponível</h3>
          <ul className="mt-4 flex flex-col gap-2">
            {RECURSOS_PORTAL.map((recurso) => (
              <li key={recurso} className="flex items-start gap-2 text-body text-ink-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                {recurso}
              </li>
            ))}
          </ul>
          <div className="mt-5 rounded-md border border-line p-3">
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-ink-3" />
              <p className="text-body font-semibold text-ink">Regra de acesso</p>
            </div>
            <p className="mt-1 text-caption leading-relaxed text-ink-3">
              Cada login cliente-síndico acessa somente um condomínio. A RLS do Supabase aplica o
              isolamento mesmo que alguém tente chamar a API fora da interface.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function Passo({
  numero,
  titulo,
  descricao,
}: {
  numero: string;
  titulo: string;
  descricao: string;
}) {
  return (
    <li className="flex gap-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-orange text-caption font-bold text-white">
        {numero}
      </span>
      <div>
        <p className="text-body font-semibold text-ink">{titulo}</p>
        <p className="mt-0.5 text-body leading-relaxed text-ink-2">{descricao}</p>
      </div>
    </li>
  );
}

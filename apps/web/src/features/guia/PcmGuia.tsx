import { ArrowRight, BookOpen, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { type AssuntoManualPcm, MANUAL_PCM } from "./pcm-manual";

function assuntoDoEndereco() {
  const id = window.location.hash.replace(/^#pcm-/, "");
  return MANUAL_PCM.find((assunto) => assunto.id === id) ?? MANUAL_PCM[0];
}

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function textoPesquisavel(assunto: AssuntoManualPcm) {
  return normalizar(
    [
      assunto.titulo,
      assunto.resumo,
      assunto.palavrasChave,
      assunto.quando,
      ...assunto.passos.flatMap((passo) => [passo.titulo, passo.texto]),
      ...assunto.conferir,
      ...assunto.duvidas.flatMap((duvida) => [duvida.pergunta, duvida.resposta]),
    ].join(" "),
  );
}

/** E01-S164: manual por tarefa, alcançável diretamente pelos links de ajuda do PCM. */
export function PcmGuia() {
  const [assunto, setAssunto] = useState(assuntoDoEndereco);
  const [busca, setBusca] = useState("");
  const titulo = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const atualizar = () => setAssunto(assuntoDoEndereco());
    window.addEventListener("hashchange", atualizar);
    return () => window.removeEventListener("hashchange", atualizar);
  }, []);

  useEffect(() => {
    if (window.location.hash === `#pcm-${assunto.id}`) titulo.current?.focus();
  }, [assunto.id]);

  const termos = normalizar(busca).trim().split(/\s+/).filter(Boolean);
  const resultados = MANUAL_PCM.filter((item) =>
    termos.every((termo) => textoPesquisavel(item).includes(termo)),
  );

  function selecionar(proximo: AssuntoManualPcm) {
    setAssunto(proximo);
    setBusca("");
  }

  return (
    <div className="page-stack">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 flex items-center gap-2 text-caption text-ink-3">
            <BookOpen className="h-4 w-4" aria-hidden="true" /> Guia do SO · PCM
          </p>
          <h1 className="page-title">Manual da operação</h1>
          <p className="page-subtitle">
            Do primeiro Chamado à execução, com o Cliente 360 como espaço de trabalho.
          </p>
        </div>
        <p className="text-caption text-ink-3">Revisado em 14/10/2026</p>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="surface-card p-4" aria-label="Índice do manual PCM">
          <label className="block text-caption text-ink-2">
            Buscar no manual
            <span className="relative mt-2 block">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
                aria-hidden="true"
              />
              <input
                type="search"
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Ex.: abrir OS, etiqueta"
                className="input w-full pl-9"
                style={{ paddingLeft: "2.25rem" }}
              />
            </span>
          </label>
          <output className="mt-3 block text-caption text-ink-3">
            {resultados.length} de {MANUAL_PCM.length} assuntos
          </output>
          <nav aria-label="Assuntos do manual" className="mt-2 flex flex-col gap-1">
            {resultados.map((item) => (
              <a
                key={item.id}
                href={`#pcm-${item.id}`}
                onClick={() => selecionar(item)}
                aria-current={assunto.id === item.id ? "page" : undefined}
                className={`rounded-md px-3 py-2 text-body transition-colors ${assunto.id === item.id ? "bg-orange-soft text-orange-deep" : "text-ink-2 hover:bg-line-soft"}`}
              >
                {item.titulo}
              </a>
            ))}
          </nav>
          {resultados.length === 0 && (
            <div className="mt-3 text-body text-ink-2">
              <p>Nenhum assunto encontrado. Tente “Chamado”, “Componente” ou “Auvo”.</p>
              <button
                type="button"
                onClick={() => setBusca("")}
                className="mt-2 text-orange hover:underline"
              >
                Limpar busca
              </button>
            </div>
          )}
          <p className="mt-4 border-t border-line-soft pt-3 text-caption leading-relaxed text-ink-3">
            A ajuda das telas abre este manual em outra aba. Mantenha seu formulário aberto e volte
            à aba original para continuar.
          </p>
        </aside>

        <article className="min-w-0 space-y-5" aria-labelledby={`pcm-${assunto.id}`}>
          <header className="surface-card p-5">
            <h2
              id={`pcm-${assunto.id}`}
              ref={titulo}
              tabIndex={-1}
              className="text-heading font-medium text-ink scroll-mt-4"
            >
              {assunto.titulo}
            </h2>
            <p className="mt-2 text-body leading-relaxed text-ink-2">{assunto.resumo}</p>
            <p className="mt-4 border-t border-line-soft pt-3 text-body leading-relaxed text-ink-2">
              <span className="font-medium text-ink">Quando usar: </span>
              {assunto.quando}
            </p>
          </header>

          {assunto.id === "inicio" && (
            <section className="surface-card p-5" aria-labelledby="manual-escolha">
              <h3 id="manual-escolha" className="mb-3 text-body font-medium text-ink">
                Qual caminho seguir?
              </h3>
              <dl className="space-y-3 text-body">
                {[
                  [
                    "Recebi uma solicitação",
                    "chamados",
                    "Abra um Chamado; reúna contexto antes de decidir a execução.",
                  ],
                  [
                    "Já sei qual serviço executar",
                    "os",
                    "Gere a OS do Chamado existente ou use Nova OS para um trabalho direto.",
                  ],
                  [
                    "Preciso decidir o que fazer primeiro",
                    "backlog",
                    "Revise a prioridade no backlog e planeje a execução.",
                  ],
                  [
                    "O serviço precisa se repetir",
                    "preventivas",
                    "Crie um plano preventivo para o alvo e a periodicidade definidos.",
                  ],
                ].map(([necessidade, id, orientacao]) => (
                  <div key={id} className="border-b border-line-soft pb-3 last:border-0 last:pb-0">
                    <dt className="font-medium text-ink">{necessidade}</dt>
                    <dd className="mt-1 leading-relaxed text-ink-2">
                      {orientacao}{" "}
                      <a
                        href={`#pcm-${id}`}
                        onClick={() =>
                          selecionar(MANUAL_PCM.find((item) => item.id === id) ?? MANUAL_PCM[0])
                        }
                        className="text-orange hover:underline"
                        aria-label={`Ver roteiro: ${necessidade}`}
                      >
                        Ver roteiro
                      </a>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <section className="surface-card p-5" aria-labelledby="manual-passo-a-passo">
            <h3 id="manual-passo-a-passo" className="mb-4 text-body font-medium text-ink">
              Passo a passo
            </h3>
            <ol className="list-decimal space-y-5 pl-5 text-body marker:text-ink-3">
              {assunto.passos.map((passo) => (
                <li key={passo.titulo} className="pl-1">
                  <h4 className="font-medium text-ink">{passo.titulo}</h4>
                  <p className="mt-1 leading-relaxed text-ink-2">{passo.texto}</p>
                </li>
              ))}
            </ol>
          </section>

          <section
            className="rounded-lg border border-line bg-surface p-5"
            aria-labelledby="manual-conferencia"
          >
            <h3 id="manual-conferencia" className="mb-3 text-body font-medium text-ink">
              Como saber se deu certo
            </h3>
            <ul className="list-disc space-y-2 pl-5 text-body leading-relaxed text-ink-2">
              {assunto.conferir.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="surface-card p-5" aria-labelledby="manual-duvidas">
            <h3 id="manual-duvidas" className="mb-2 text-body font-medium text-ink">
              Dúvidas durante a tarefa
            </h3>
            {assunto.duvidas.map((duvida) => (
              <details
                key={duvida.pergunta}
                className="border-b border-line-soft py-3 last:border-0"
              >
                <summary className="cursor-pointer text-body font-medium text-ink">
                  {duvida.pergunta}
                </summary>
                <p className="mt-2 text-body leading-relaxed text-ink-2">{duvida.resposta}</p>
              </details>
            ))}
          </section>

          <nav aria-label="Continue no manual" className="surface-card p-5">
            <h3 className="mb-3 text-body font-medium text-ink">Continue no manual</h3>
            <ul className="flex flex-col gap-3">
              {assunto.relacionados.map((id) => {
                const relacionado = MANUAL_PCM.find((item) => item.id === id);
                return relacionado ? (
                  <li key={id}>
                    <a
                      href={`#pcm-${id}`}
                      onClick={() => selecionar(relacionado)}
                      className="inline-flex items-center gap-2 text-body text-orange hover:underline"
                    >
                      {relacionado.titulo}
                      <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                    </a>
                  </li>
                ) : null;
              })}
            </ul>
          </nav>
        </article>
      </div>
    </div>
  );
}

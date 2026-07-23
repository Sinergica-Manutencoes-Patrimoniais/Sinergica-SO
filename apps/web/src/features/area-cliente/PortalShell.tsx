import type { PortalSection } from "@sinergica/portal-core";
import { useCallback, useEffect, useId, useState } from "react";
import { useAuth } from "../../app/auth-context";
import type { PortalSnapshot } from "./application/portal-gateway";
import { supabasePortalAdapter } from "./infrastructure/supabase-portal-adapter";

type Secao = PortalSection;

const SECOES: Array<{ id: Secao; label: string }> = [
  { id: "painel", label: "Painel" },
  { id: "assessment", label: "Assessment" },
  { id: "chamados", label: "Chamados" },
  { id: "os", label: "Ordens de serviço" },
  { id: "documentos", label: "Documentos" },
  { id: "cronograma", label: "Cronograma e conformidade" },
  { id: "notificacoes", label: "Notificações" },
  { id: "orcamentos", label: "Orçamentos" },
  { id: "financeiro", label: "Financeiro" },
];

export function PortalShell() {
  const { user, logout } = useAuth();
  const [secao, setSecao] = useState<Secao>("painel");
  const [snapshot, setSnapshot] = useState<PortalSnapshot | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setSnapshot(await supabasePortalAdapter.carregar());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar o portal.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <img src="/logos/logo-horizontal-positivo.png" alt="Sinérgica" className="h-8" />
            <p className="mt-1 text-xs text-ink-3">Portal do Cliente</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">{snapshot?.cliente.nome ?? user?.nome}</p>
            <button
              type="button"
              onClick={logout}
              className="text-xs font-semibold text-orange hover:text-orange-deep"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <nav className="border-b border-line bg-card" aria-label="Portal do Cliente">
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4">
          {SECOES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSecao(item.id)}
              className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold ${secao === item.id ? "border-orange text-orange" : "border-transparent text-ink-3 hover:text-ink"}`}
            >
              {item.label}
              {item.id === "notificacoes" &&
                snapshot &&
                snapshot.notificacoes.some((n) => !n.lidaAt) && (
                  <span className="ml-2 rounded-full bg-orange px-1.5 py-0.5 text-[10px] text-white">
                    nova
                  </span>
                )}
            </button>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-7xl p-4 md:p-6">
        {carregando && <Estado mensagem="Carregando dados do condomínio…" />}
        {!carregando && erro && <Estado mensagem={erro} acao={recarregar} />}
        {!carregando && snapshot && (
          <>
            {secao === "painel" && <Painel data={snapshot} onNavegar={setSecao} />}
            {secao === "assessment" && <Assessments data={snapshot} />}
            {secao === "chamados" && <Chamados data={snapshot} onAtualizar={recarregar} />}
            {secao === "os" && <OrdensServico data={snapshot} onAtualizar={recarregar} />}
            {secao === "documentos" && <Documentos data={snapshot} />}
            {secao === "cronograma" && <Cronograma data={snapshot} />}
            {secao === "notificacoes" && <Notificacoes data={snapshot} onAtualizar={recarregar} />}
            {secao === "orcamentos" && <Orcamentos data={snapshot} onAtualizar={recarregar} />}
            {secao === "financeiro" && <Financeiro data={snapshot} />}
          </>
        )}
      </main>
    </div>
  );
}

function Painel({ data, onNavegar }: { data: PortalSnapshot; onNavegar: (secao: Secao) => void }) {
  const proximas = data.visitas
    .filter((v) => v.data >= new Date().toISOString().slice(0, 10) && v.status !== "cancelado")
    .slice(0, 3);
  const abertos = data.chamados.filter((c) => !["cancelado", "convertido_os"].includes(c.status));
  const osAbertas = data.os.filter((os) => !["concluida", "cancelada"].includes(os.status));
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Kpi titulo="OS em andamento" valor={osAbertas.length} onClick={() => onNavegar("os")} />
      <Kpi titulo="Chamados abertos" valor={abertos.length} onClick={() => onNavegar("chamados")} />
      <Kpi
        titulo="Próximas visitas"
        valor={proximas.length}
        onClick={() => onNavegar("cronograma")}
      />
      <Kpi
        titulo="Documentos"
        valor={data.documentos.length}
        onClick={() => onNavegar("documentos")}
      />
      <section className="rounded-xl border border-line bg-card p-5 md:col-span-2">
        <h2 className="font-semibold">Próximas preventivas</h2>
        {proximas.length ? (
          proximas.map((v) => (
            <Linha key={v.id} principal={dataPt(v.data)} secundario={`${v.tipo} · ${v.status}`} />
          ))
        ) : (
          <Vazio texto="Nenhuma visita programada." />
        )}
      </section>
      <section className="rounded-xl border border-line bg-card p-5 md:col-span-2">
        <h2 className="font-semibold">Últimos documentos</h2>
        {data.documentos.length ? (
          data.documentos
            .slice(0, 3)
            .map((d) => (
              <Linha key={d.id} principal={d.titulo} secundario={`${d.tipo} · ${dataPt(d.data)}`} />
            ))
        ) : (
          <Vazio texto="Nenhum documento disponível." />
        )}
      </section>
    </div>
  );
}

function Assessments({ data }: { data: PortalSnapshot }) {
  if (!data.assessments.length) return <Vazio texto="Nenhum assessment disponível." />;
  return (
    <div className="grid gap-4">
      {data.assessments.map((a) => (
        <section key={a.id} className="rounded-xl border border-line bg-card p-5">
          <h2 className="font-semibold">{a.titulo}</h2>
          <p className="text-sm text-ink-3">
            {dataPt(a.data)} · {a.status}
          </p>
          <div className="mt-4 divide-y divide-line-soft">
            {a.itens.map((i) => (
              <div key={i.id} className="py-3">
                <p className="text-sm font-medium">{i.descricao}</p>
                <p className="text-xs text-ink-3">
                  Condição: {i.resultado}
                  {i.responsavel ? ` · Responsável: ${i.responsavel}` : ""}
                </p>
                {i.fotoPath && (
                  <button
                    type="button"
                    onClick={() => i.fotoPath && abrirArquivo("inspecoes-midia", i.fotoPath)}
                    className="mt-1 text-xs font-semibold text-orange"
                  >
                    Abrir foto
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Chamados({
  data,
  onAtualizar,
}: { data: PortalSnapshot; onAtualizar: () => Promise<void> }) {
  const [novo, setNovo] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [comentario, setComentario] = useState<Record<string, string>>({});
  const [novoArquivo, setNovoArquivo] = useState<File | undefined>();
  const [arquivos, setArquivos] = useState<Record<string, File | undefined>>({});
  const agir = async (fn: () => Promise<void>) => {
    await fn();
    await onAtualizar();
  };
  return (
    <div className="grid gap-4">
      <div className="flex justify-between">
        <h1 className="text-xl font-semibold">Chamados</h1>
        <button
          type="button"
          onClick={() => setNovo(!novo)}
          className="rounded-lg bg-orange px-4 py-2 text-sm font-semibold text-white"
        >
          Novo chamado
        </button>
      </div>
      {novo && (
        <section className="rounded-xl border border-line bg-card p-5">
          <Campo label="Título" value={titulo} onChange={setTitulo} />
          <Campo label="Descrição" value={descricao} onChange={setDescricao} area />
          <label className="mt-3 block text-sm text-ink-2">
            Anexo opcional
            <input
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              onChange={(e) => setNovoArquivo(e.target.files?.[0])}
              className="mt-1 block w-full text-sm"
            />
          </label>
          <button
            type="button"
            disabled={!titulo.trim()}
            onClick={() =>
              agir(() => supabasePortalAdapter.abrirChamado(titulo, descricao, novoArquivo)).then(
                () => {
                  setNovo(false);
                  setTitulo("");
                  setDescricao("");
                  setNovoArquivo(undefined);
                },
              )
            }
            className="mt-3 rounded-lg bg-orange px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Enviar
          </button>
        </section>
      )}
      {!data.chamados.length && <Vazio texto="Nenhum chamado aberto." />}
      {data.chamados.map((c) => (
        <section key={c.id} className="rounded-xl border border-line bg-card p-5">
          <div className="flex justify-between gap-3">
            <div>
              <h2 className="font-semibold">
                {c.numero} · {c.titulo}
              </h2>
              <p className="text-sm text-ink-3">{c.descricao || "Sem descrição"}</p>
            </div>
            <Badge texto={c.status} />
          </div>
          <div className="mt-4 rounded-lg bg-paper px-3">
            {[
              ...data.chamadoEventos.filter((item) => item.referenciaId === c.id),
              ...data.chamadoInteracoes.filter((item) => item.referenciaId === c.id),
            ]
              .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
              .map((item) => (
                <Linha
                  key={item.id}
                  principal={item.texto}
                  secundario={`${item.autor ?? "evento"} · ${dataPt(item.createdAt)}`}
                />
              ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <input
              placeholder="Adicionar comentário"
              value={comentario[c.id] ?? ""}
              onChange={(e) => setComentario((v) => ({ ...v, [c.id]: e.target.value }))}
              className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm"
            />
            <input
              type="file"
              aria-label={`Anexo do chamado ${c.numero}`}
              accept="image/jpeg,image/png,application/pdf"
              onChange={(e) => setArquivos((v) => ({ ...v, [c.id]: e.target.files?.[0] }))}
              className="max-w-52 text-xs"
            />
            <button
              type="button"
              disabled={!comentario[c.id]?.trim() && !arquivos[c.id]}
              onClick={() =>
                agir(() =>
                  supabasePortalAdapter.comentarChamado(
                    c.id,
                    comentario[c.id] ?? "",
                    arquivos[c.id],
                  ),
                ).then(() => {
                  setComentario((v) => ({ ...v, [c.id]: "" }));
                  setArquivos((v) => ({ ...v, [c.id]: undefined }));
                })
              }
              className="rounded-lg border border-orange px-3 py-2 text-sm font-semibold text-orange disabled:opacity-50"
            >
              Comentar
            </button>
          </div>
        </section>
      ))}
    </div>
  );
}

function OrdensServico({
  data,
  onAtualizar,
}: { data: PortalSnapshot; onAtualizar: () => Promise<void> }) {
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [arquivos, setArquivos] = useState<Record<string, File | undefined>>({});
  if (!data.os.length) return <Vazio texto="Nenhuma ordem de serviço." />;
  return (
    <div className="grid gap-4">
      {data.os.map((os) => (
        <section key={os.id} className="rounded-xl border border-line bg-card p-5">
          <div className="flex justify-between gap-3">
            <div>
              <h2 className="font-semibold">
                {os.numero} · {os.titulo}
              </h2>
              <p className="text-sm text-ink-3">
                {os.categoria} · aberta em {dataPt(os.createdAt)}
              </p>
            </div>
            <Badge texto={os.status} />
          </div>
          {data.osNotas.some((item) => item.referenciaId === os.id) && (
            <div className="mt-4 rounded-lg bg-paper px-3">
              {data.osNotas
                .filter((item) => item.referenciaId === os.id)
                .map((item) => (
                  <Linha
                    key={item.id}
                    principal={item.texto}
                    secundario={`${item.autor ?? "nota"} · ${dataPt(item.createdAt)}`}
                  />
                ))}
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <input
              placeholder="Adicionar nota para a equipe"
              value={notas[os.id] ?? ""}
              onChange={(e) => setNotas((v) => ({ ...v, [os.id]: e.target.value }))}
              className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm"
            />
            <input
              type="file"
              aria-label={`Anexo da OS ${os.numero}`}
              accept="image/jpeg,image/png,application/pdf"
              onChange={(e) => setArquivos((v) => ({ ...v, [os.id]: e.target.files?.[0] }))}
              className="max-w-52 text-xs"
            />
            <button
              type="button"
              disabled={!notas[os.id]?.trim() && !arquivos[os.id]}
              onClick={async () => {
                await supabasePortalAdapter.adicionarNotaOs(
                  os.id,
                  notas[os.id] ?? "",
                  arquivos[os.id],
                );
                setNotas((v) => ({ ...v, [os.id]: "" }));
                setArquivos((v) => ({ ...v, [os.id]: undefined }));
                await onAtualizar();
              }}
              className="rounded-lg border border-orange px-3 py-2 text-sm font-semibold text-orange disabled:opacity-50"
            >
              Adicionar
            </button>
          </div>
        </section>
      ))}
    </div>
  );
}

function Documentos({ data }: { data: PortalSnapshot }) {
  if (!data.documentos.length) return <Vazio texto="Nenhum documento disponível." />;
  return (
    <section className="overflow-hidden rounded-xl border border-line bg-card">
      <div className="divide-y divide-line-soft">
        {data.documentos.map((d) => (
          <div key={d.id} className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="font-medium">{d.titulo}</p>
              <p className="text-xs text-ink-3">
                {d.tipo} · {dataPt(d.data)}
              </p>
            </div>
            {d.bucket && d.path ? (
              <button
                type="button"
                onClick={() => d.bucket && d.path && abrirArquivo(d.bucket, d.path)}
                className="text-sm font-semibold text-orange"
              >
                Baixar
              </button>
            ) : (
              <span className="text-xs text-ink-3">Registro sem arquivo</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function Cronograma({ data }: { data: PortalSnapshot }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-line bg-card p-5">
        <h2 className="font-semibold">Preventivas</h2>
        {data.visitas.length ? (
          data.visitas.map((v) => (
            <Linha key={v.id} principal={dataPt(v.data)} secundario={`${v.tipo} · ${v.status}`} />
          ))
        ) : (
          <Vazio texto="Sem cronograma PMOC." />
        )}
      </section>
      <section className="rounded-xl border border-line bg-card p-5">
        <h2 className="font-semibold">Conformidade</h2>
        {data.conformidade.length ? (
          data.conformidade.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between border-b border-line-soft py-3"
            >
              <div>
                <p className="text-sm font-medium">{c.titulo}</p>
                <p className="text-xs text-ink-3">Vigência até {dataPt(c.venceEm)}</p>
              </div>
              <Badge texto={c.status} />
            </div>
          ))
        ) : (
          <Vazio texto="Sem contratos ou laudos." />
        )}
      </section>
    </div>
  );
}

function Notificacoes({
  data,
  onAtualizar,
}: { data: PortalSnapshot; onAtualizar: () => Promise<void> }) {
  if (!data.notificacoes.length && !data.osAguardandoAvaliacao.length)
    return <Vazio texto="Nenhuma notificação." />;
  return (
    <div className="grid gap-4">
      {data.osAguardandoAvaliacao.map((os) => (
        <Pesquisa key={os.id} osId={os.id} titulo={os.titulo} onAtualizar={onAtualizar} />
      ))}
      {data.notificacoes.map((n) => (
        <button
          key={n.id}
          type="button"
          onClick={async () => {
            if (!n.lidaAt) {
              await supabasePortalAdapter.marcarNotificacaoLida(n.id);
              await onAtualizar();
            }
          }}
          className={`rounded-xl border p-4 text-left ${n.lidaAt ? "border-line bg-card" : "border-orange bg-orange/5"}`}
        >
          <div className="flex justify-between">
            <p className="font-semibold">{n.titulo}</p>
            <span className="text-xs text-ink-3">{dataPt(n.createdAt)}</span>
          </div>
          <p className="mt-1 text-sm text-ink-2">{n.mensagem}</p>
        </button>
      ))}
    </div>
  );
}

function Pesquisa({
  osId,
  titulo,
  onAtualizar,
}: { osId: string; titulo: string; onAtualizar: () => Promise<void> }) {
  const [csat, setCsat] = useState(5);
  const [nps, setNps] = useState(10);
  const [comentario, setComentario] = useState("");
  return (
    <section className="rounded-xl border border-orange bg-card p-5">
      <h2 className="font-semibold">Como foi o atendimento? · {titulo}</h2>
      <div className="mt-3 flex flex-wrap gap-4">
        <label className="text-sm">
          Satisfação (1–5){" "}
          <input
            type="number"
            min={1}
            max={5}
            value={csat}
            onChange={(e) => setCsat(Number(e.target.value))}
            className="ml-2 w-16 rounded border border-line p-1"
          />
        </label>
        <label className="text-sm">
          NPS (0–10){" "}
          <input
            type="number"
            min={0}
            max={10}
            value={nps}
            onChange={(e) => setNps(Number(e.target.value))}
            className="ml-2 w-16 rounded border border-line p-1"
          />
        </label>
      </div>
      <Campo label="Comentário opcional" value={comentario} onChange={setComentario} area />
      <button
        type="button"
        onClick={async () => {
          await supabasePortalAdapter.responderSatisfacao(osId, csat, nps, comentario);
          await onAtualizar();
        }}
        className="mt-3 rounded-lg bg-orange px-4 py-2 text-sm font-semibold text-white"
      >
        Enviar avaliação
      </button>
    </section>
  );
}

function Orcamentos({
  data,
  onAtualizar,
}: { data: PortalSnapshot; onAtualizar: () => Promise<void> }) {
  const [motivos, setMotivos] = useState<Record<string, string>>({});
  if (!data.orcamentos.length) return <Vazio texto="Nenhum orçamento disponível." />;
  return (
    <div className="grid gap-4">
      {data.orcamentos.map((o) => (
        <section key={o.id} className="rounded-xl border border-line bg-card p-5">
          <div className="flex justify-between">
            <div>
              <h2 className="font-semibold">
                {o.numero} · {o.titulo}
              </h2>
              <p className="text-sm text-ink-3">
                Validade: {o.validoAte ? dataPt(o.validoAte) : "não informada"}
              </p>
            </div>
            <div className="text-right">
              <p className="font-semibold">{reais(o.valorCentavos)}</p>
              <Badge texto={o.status} />
            </div>
          </div>
          {o.itens.length > 0 && (
            <ul className="mt-4 list-inside list-disc text-sm text-ink-2">
              {o.itens.map((i, n) => (
                <li key={`${o.id}-${n}`}>{i.descricao ?? `Item ${n + 1}`}</li>
              ))}
            </ul>
          )}
          {o.status === "pendente" && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={async () => {
                  await supabasePortalAdapter.decidirOrcamento(o.id, "aprovado");
                  await onAtualizar();
                }}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Aprovar
              </button>
              <input
                placeholder="Motivo da recusa"
                value={motivos[o.id] ?? ""}
                onChange={(e) => setMotivos((v) => ({ ...v, [o.id]: e.target.value }))}
                className="min-w-52 flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={!motivos[o.id]?.trim()}
                onClick={async () => {
                  await supabasePortalAdapter.decidirOrcamento(o.id, "recusado", motivos[o.id]);
                  await onAtualizar();
                }}
                className="rounded-lg border border-red-500 px-4 py-2 text-sm font-semibold text-red-600 disabled:opacity-50"
              >
                Recusar
              </button>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function Financeiro({ data }: { data: PortalSnapshot }) {
  if (!data.faturas.length) return <Vazio texto="Nenhuma fatura disponível." />;
  return (
    <section className="overflow-hidden rounded-xl border border-line bg-card">
      <div className="divide-y divide-line-soft">
        {data.faturas.map((f) => (
          <div key={f.id} className="grid gap-2 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
            <div>
              <p className="font-medium">{f.descricao || "Fatura"}</p>
              <p className="text-xs text-ink-3">
                Vencimento: {f.vencimento ? dataPt(f.vencimento) : "—"}
              </p>
            </div>
            <div className="sm:text-right">
              <p className="font-semibold">{reais(f.valorCentavos)}</p>
              <Badge texto={f.status} />
            </div>
            {f.segundaVia?.link ? (
              <a
                href={f.segundaVia.link}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-orange"
              >
                2ª via
              </a>
            ) : (
              <span className="text-xs text-ink-3">2ª via indisponível</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function Kpi({ titulo, valor, onClick }: { titulo: string; valor: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-line bg-card p-5 text-left hover:border-orange"
    >
      <p className="text-sm text-ink-3">{titulo}</p>
      <p className="mt-2 text-3xl font-semibold">{valor}</p>
    </button>
  );
}
function Linha({ principal, secundario }: { principal: string; secundario: string }) {
  return (
    <div className="border-b border-line-soft py-3 last:border-0">
      <p className="text-sm font-medium">{principal}</p>
      <p className="text-xs text-ink-3">{secundario}</p>
    </div>
  );
}
function Badge({ texto }: { texto: string }) {
  return (
    <span className="inline-flex rounded-full bg-line-soft px-2 py-1 text-xs font-semibold text-ink-2">
      {texto.replaceAll("_", " ")}
    </span>
  );
}
function Vazio({ texto }: { texto: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-card p-8 text-center text-sm text-ink-3">
      {texto}
    </div>
  );
}
function Estado({ mensagem, acao }: { mensagem: string; acao?: () => void }) {
  return (
    <div className="p-12 text-center text-sm text-ink-3">
      <p>{mensagem}</p>
      {acao && (
        <button type="button" onClick={acao} className="mt-3 font-semibold text-orange">
          Tentar novamente
        </button>
      )}
    </div>
  );
}
function Campo({
  label,
  value,
  onChange,
  area = false,
}: { label: string; value: string; onChange: (v: string) => void; area?: boolean }) {
  const id = useId();
  const props = {
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(e.target.value),
    className: "mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm",
  };
  return (
    <label htmlFor={id} className="mt-3 block text-sm text-ink-2">
      {label}
      {area ? <textarea id={id} {...props} rows={3} /> : <input id={id} {...props} />}
    </label>
  );
}
function dataPt(valor: string) {
  const d = new Date(valor.length === 10 ? `${valor}T12:00:00` : valor);
  return Number.isNaN(d.getTime()) ? valor : new Intl.DateTimeFormat("pt-BR").format(d);
}
function reais(centavos: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    centavos / 100,
  );
}
async function abrirArquivo(bucket: string, path: string) {
  const url = await supabasePortalAdapter.urlAssinada(bucket, path);
  window.open(url, "_blank", "noopener,noreferrer");
}

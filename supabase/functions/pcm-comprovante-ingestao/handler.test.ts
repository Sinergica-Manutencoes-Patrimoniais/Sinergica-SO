import { criarHandler, type Dependencias } from "./handler.ts";

const uid = "18090000-0000-4000-8000-000000000001";
const despesa = "18090000-0000-4000-8000-000000000002";
const objeto = "18090000-0000-4000-8000-000000000003";
const bytes = new Uint8Array([37, 80, 68, 70, 45, 49]);
const req = () => new Request("http://localhost/", { method: "POST", headers: { "x-request-id": uid, "x-despesa-id": despesa }, body: Uint8Array.from(bytes).buffer });
const assert = (v: boolean) => { if (!v) throw new Error("Asserção falhou"); };
function dependencias(): Dependencias {
  return { autenticar: async () => ({ usuario: uid }), habilitado: async () => true,
    autorizar: async () => true, suporteVersaoImutavel: async () => true,
    reservar: async (_i, _p, digest) => ({ estado: "nova", digest, clienteId: uid, caminho: `${uid}/${despesa}/${objeto}` }),
    subirImutavel: async () => ({ objetoId: objeto, versao: "v1" }), lerVersao: async () => bytes,
    confirmar: async () => ({ objetoId: objeto }) };
}
Deno.test("falha antes de reservar ou enviar se versão imutável não é comprovada", async () => {
  let alteracoes = 0; const d = dependencias(); d.suporteVersaoImutavel = async () => false;
  d.reservar = async (_i, _p, digest) => { alteracoes++; return { estado: "nova", digest, caminho: "x" }; };
  const r = await criarHandler(d)(req()); assert(r.status === 503 && alteracoes === 0);
});
Deno.test("reauthoriza, compara bytes e confirma somente versão imutável", async () => {
  let autorizacoes = 0, confirmacoes = 0; const d = dependencias();
  d.autorizar = async () => { autorizacoes++; return true; };
  d.confirmar = async () => { confirmacoes++; return { objetoId: objeto }; };
  const r = await criarHandler(d)(req()); assert(r.status === 200 && autorizacoes === 2 && confirmacoes === 1);
});
Deno.test("revogação e bytes diferentes impedem confirmação", async () => {
  let confirmacoes = 0; const d = dependencias(); d.confirmar = async () => { confirmacoes++; return { objetoId: objeto }; };
  d.lerVersao = async () => new Uint8Array([1]); assert((await criarHandler(d)(req())).status === 409);
  d.lerVersao = async () => bytes; let n = 0; d.autorizar = async () => ++n === 1;
  assert((await criarHandler(d)(req())).status === 404 && confirmacoes === 0);
});
Deno.test("reserva pendente e caminho divergente não disparam upload", async () => {
  let uploads = 0; const d = dependencias(); d.subirImutavel = async () => { uploads++; return { objetoId: objeto, versao: "v1" }; };
  d.reservar = async (_i, _p, digest) => ({ estado: "pendente", digest });
  assert((await criarHandler(d)(req())).status === 409);
  d.reservar = async (_i, _p, digest) => ({ estado: "nova", digest, clienteId: objeto, caminho: `${uid}/${despesa}/${objeto}` });
  assert((await criarHandler(d)(req())).status === 503 && uploads === 0);
});
Deno.test("gate, autenticação e permissão bloqueiam antes de reservar", async () => {
  let reservas = 0; const d = dependencias(); d.reservar = async (_i, _p, digest) => { reservas++; return { estado: "pendente", digest }; };
  d.habilitado = async () => false; assert((await criarHandler(d)(req())).status === 503);
  d.habilitado = async () => true; d.autorizar = async () => false; assert((await criarHandler(d)(req())).status === 404);
  d.autenticar = async () => { throw new Error("sem sessão"); }; assert((await criarHandler(d)(req())).status === 401 && reservas === 0);
});
Deno.test("recuperação concluída não confia em objeto sem conferir versão e bytes", async () => {
  const d = dependencias();
  d.reservar = async (_i, _p, digest) => ({ estado: "concluida", digest, objetoId: objeto, versao: "v1" });
  d.lerVersao = async () => new Uint8Array([1]);
  assert((await criarHandler(d)(req())).status !== 200);
  d.lerVersao = async () => bytes;
  assert((await criarHandler(d)(req())).status === 200);
});

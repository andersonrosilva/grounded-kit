/**
 * [Passo 5 · Fake de fetch] `fetch` falso e roteirizado para testar os adaptadores de provider sem rede (ADR-010).
 *
 * `createFakeFetch(handler)` devolve um `fetch` que registra cada chamada em `calls` (URL, init e corpo JSON já lido)
 * e responde com o que o `handler` devolver (uma `Response`, ou lança para simular falha de rede). Se o `signal` do
 * `init` já estiver abortado, rejeita com `AbortError`, como o `fetch` real.
 */
export interface FakeFetchCall {
  url: string;
  init: RequestInit;
  /** Corpo da requisição, já convertido de JSON (undefined se não havia corpo). */
  body: unknown;
}

export interface FakeFetch {
  fetch: typeof fetch;
  calls: FakeFetchCall[];
}

export type FakeFetchHandler = (call: FakeFetchCall) => Response | Promise<Response>;

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function createFakeFetch(handler: FakeFetchHandler): FakeFetch {
  const calls: FakeFetchCall[] = [];
  const fakeFetch = async (
    input: string | URL | Request,
    init: RequestInit = {},
  ): Promise<Response> => {
    if (init.signal?.aborted) {
      throw new DOMException('This operation was aborted', 'AbortError');
    }
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const body = typeof init.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
    const call: FakeFetchCall = { url, init, body };
    calls.push(call);
    return handler(call);
  };
  return { fetch: fakeFetch as typeof fetch, calls };
}

// Transport-only GraphQL client for the Linear seeding pipeline. Knows how to send a
// document and get data back over HTTP. Does NOT know what an issue or a project is —
// no domain helpers (createIssue, etc.) belong here. Those are the executor's job in a
// later task. Leaf module: imports nothing from the other lib/*.mjs files.
//
// Mirrors the directory idiom (tasks.mjs / members.mjs / heartbeat.mjs / labels.mjs /
// manifest.mjs) in spirit — honest error messages naming the offending thing, no classes
// where a function will do — but this module necessarily carries state (the API key, the
// injected fetch, retry config) across a network call, so it is the one class in the
// directory. `fetchImpl` is a constructor param specifically so tests never touch the
// network: pass a fake that returns canned Response-shaped objects.
const ENDPOINT = "https://api.linear.app/graphql";

// Linear retries: 429 (rate limit) and 5xx (server/gateway failure) are the two classes of
// failure where the same request is worth sending again. 4xx other than 429 (400 bad query,
// 401 bad key, 404, ...) means the request itself is wrong and resending it verbatim will
// fail identically every time — those throw immediately instead of burning retry budget.
function isRetryableStatus(status) {
  return status === 429 || status >= 500;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Reads the body as text first, then parses it ourselves, rather than calling res.json()
// directly. Two reasons:
//   1. Linear can sit behind a proxy that returns an HTML error page on a 502/504 — that
//      body is not JSON. res.json() would throw a bare SyntaxError ("Unexpected token '<'")
//      that names neither the HTTP status nor what was actually returned. Parsing text
//      ourselves lets the thrown error name both.
//   2. It gives one code path for "non-JSON body" regardless of whether the status was a
//      success or a non-retryable failure (e.g. a 400 with a plaintext body), instead of
//      two different failure shapes depending on status.
async function readJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Linear API returned a non-JSON response (HTTP ${res.status}): ${text.slice(0, 200)}`
    );
  }
}

export class LinearClient {
  // A Linear personal API key is sent raw in Authorization (OAuth tokens use "Bearer <token>";
  // personal API keys do not — sending "Bearer <key>" is a real, silent-until-you-read-the-docs
  // mistake this constructor comment exists to head off).
  constructor({ apiKey, fetchImpl = globalThis.fetch, endpoint = ENDPOINT, maxRetries = 3, retryDelayMs = 1000 }) {
    if (!apiKey) throw new Error("LINEAR_API_KEY is not set");
    Object.assign(this, { apiKey, fetchImpl, endpoint, maxRetries, retryDelayMs });
  }

  // maxRetries counts RETRIES, not total attempts: total attempts made is maxRetries + 1
  // (the initial attempt, plus up to maxRetries resends). With the default maxRetries = 3
  // that is 4 HTTP calls in the worst case. Backoff before retry N (0-indexed) is
  // retryDelayMs * 2 ** N, so with the default retryDelayMs = 1000 the waits are
  // 1000ms, 2000ms, 4000ms.
  //
  // Retrying is only applied here to the transport failure (429/5xx) itself. Whether a
  // *mutation* is safe to retry is a different question this method deliberately does not
  // answer — see the module-level note below.
  async query(document, variables = {}) {
    const body = JSON.stringify({ query: document, variables });
    const headers = { "Content-Type": "application/json", Authorization: this.apiKey };

    let res;
    for (let attempt = 0; ; attempt++) {
      res = await this.fetchImpl(this.endpoint, { method: "POST", headers, body });

      if (!isRetryableStatus(res.status)) break;

      if (attempt >= this.maxRetries) {
        throw new Error(
          `Linear API request failed after ${attempt + 1} attempt(s): last response was HTTP ${res.status}`
        );
      }
      await wait(this.retryDelayMs * 2 ** attempt);
    }

    const payload = await readJson(res);

    // The normal GraphQL failure mode: the server answers 200 with a body shaped like
    // { errors: [...], data: null } (or partial data alongside errors). An HTTP-level
    // status check alone would miss this entirely, so it is checked unconditionally,
    // independent of res.status.
    if (payload.errors) {
      throw new Error(
        `Linear API returned GraphQL error(s): ${payload.errors.map((e) => e.message).join("; ")}`
      );
    }

    // A non-retryable HTTP failure (400, 401, 403, 404, ...) that came back with a JSON
    // body but no GraphQL `errors` envelope — e.g. an auth gateway rejecting the request
    // before it reaches Linear's own GraphQL layer. Without this check the request would
    // silently "succeed" and hand the caller `undefined` as data.
    const ok = res.status >= 200 && res.status < 300;
    if (!ok) {
      throw new Error(`Linear API request failed: HTTP ${res.status}: ${JSON.stringify(payload)}`);
    }

    return payload.data;
  }
}

import { test } from "node:test";
import assert from "node:assert/strict";
import { LinearClient } from "../lib/client.mjs";

// --- fixtures: fake Response-shaped objects, never touch the network ---

function jsonResponse(status, body) {
  return { status, text: async () => JSON.stringify(body) };
}

function textResponse(status, text) {
  return { status, text: async () => text };
}

// Replays `responses` in call order and records every (url, options) pair passed in, so
// assertions can inspect exactly what was sent and exactly how many times fetch fired.
// Throws (rather than hanging or returning undefined) if the client calls it more times
// than the test configured — a bug here should fail loudly, not time out mysteriously.
function sequenceFetch(responses) {
  const calls = [];
  let i = 0;
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (i >= responses.length) {
      throw new Error(
        `sequenceFetch: called ${calls.length} time(s) but only ${responses.length} response(s) configured`
      );
    }
    return responses[i++];
  };
  return { fetchImpl, calls };
}

// --- constructor ---

test("constructor throws without an API key", () => {
  assert.throws(() => new LinearClient({}), /LINEAR_API_KEY is not set/);
});

// --- request shape ---

test("sends the raw API key with no Bearer prefix", async () => {
  const { fetchImpl, calls } = sequenceFetch([jsonResponse(200, { data: { ok: true } })]);
  const client = new LinearClient({ apiKey: "lin_api_abc123", fetchImpl });
  await client.query("query { ok }");
  assert.equal(calls[0].options.headers.Authorization, "lin_api_abc123");
  assert.doesNotMatch(calls[0].options.headers.Authorization, /Bearer/);
});

test("posts the query and variables as JSON with Content-Type application/json", async () => {
  const { fetchImpl, calls } = sequenceFetch([jsonResponse(200, { data: { ok: true } })]);
  const client = new LinearClient({ apiKey: "key", fetchImpl });
  await client.query("query Foo($id: String!) { issue(id: $id) { id } }", { id: "abc" });
  assert.equal(calls[0].url, "https://api.linear.app/graphql");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers["Content-Type"], "application/json");
  const sent = JSON.parse(calls[0].options.body);
  assert.equal(sent.query, "query Foo($id: String!) { issue(id: $id) { id } }");
  assert.deepEqual(sent.variables, { id: "abc" });
});

test("variables defaults to {} when omitted", async () => {
  const { fetchImpl, calls } = sequenceFetch([jsonResponse(200, { data: { ok: true } })]);
  const client = new LinearClient({ apiKey: "key", fetchImpl });
  await client.query("query { ok }");
  assert.deepEqual(JSON.parse(calls[0].options.body).variables, {});
});

// --- success path ---

test("returns payload.data on success", async () => {
  const { fetchImpl } = sequenceFetch([jsonResponse(200, { data: { viewer: { id: "u1" } } })]);
  const client = new LinearClient({ apiKey: "key", fetchImpl });
  const data = await client.query("query { viewer { id } }");
  assert.deepEqual(data, { viewer: { id: "u1" } });
});

// --- GraphQL errors (the normal failure mode, independent of HTTP status) ---

test("a GraphQL errors array throws with the joined messages, even on HTTP 200", async () => {
  const { fetchImpl } = sequenceFetch([
    jsonResponse(200, {
      errors: [{ message: "Field 'nope' doesn't exist" }, { message: "second problem" }],
    }),
  ]);
  const client = new LinearClient({ apiKey: "key", fetchImpl });
  await assert.rejects(() => client.query("query { nope }"), /Field 'nope' doesn't exist.*second problem/);
});

// --- retry: 429 ---

test("a 429 retries and then succeeds", async () => {
  const { fetchImpl, calls } = sequenceFetch([
    jsonResponse(429, { errors: [{ message: "rate limited" }] }),
    jsonResponse(200, { data: { ok: true } }),
  ]);
  const client = new LinearClient({ apiKey: "key", fetchImpl, retryDelayMs: 1 });
  const data = await client.query("query { ok }");
  assert.deepEqual(data, { ok: true });
  assert.equal(calls.length, 2);
});

// --- retry: exhaustion, and the exact maxRetries semantics ---

test("retries exhaust and throw, naming the status and the exact attempt count", async () => {
  const { fetchImpl, calls } = sequenceFetch([
    jsonResponse(503, {}),
    jsonResponse(503, {}),
    jsonResponse(503, {}),
    jsonResponse(503, {}),
  ]);
  const client = new LinearClient({ apiKey: "key", fetchImpl, retryDelayMs: 1, maxRetries: 3 });
  await assert.rejects(
    () => client.query("query { ok }"),
    /failed after 4 attempt\(s\): last response was HTTP 503/
  );
  // maxRetries counts RETRIES, not total attempts: 3 retries on top of the initial
  // attempt is 4 total HTTP calls. This is the semantic the test pins.
  assert.equal(calls.length, 4);
});

test("succeeding on the very last available retry still works (pins the off-by-one boundary)", async () => {
  const { fetchImpl, calls } = sequenceFetch([
    jsonResponse(500, {}),
    jsonResponse(500, {}),
    jsonResponse(500, {}),
    jsonResponse(200, { data: { ok: true } }),
  ]);
  const client = new LinearClient({ apiKey: "key", fetchImpl, retryDelayMs: 1, maxRetries: 3 });
  const data = await client.query("query { ok }");
  assert.deepEqual(data, { ok: true });
  assert.equal(calls.length, 4);
});

test("maxRetries = 0 makes exactly one attempt, no retries", async () => {
  const { fetchImpl, calls } = sequenceFetch([jsonResponse(503, {})]);
  const client = new LinearClient({ apiKey: "key", fetchImpl, retryDelayMs: 1, maxRetries: 0 });
  await assert.rejects(() => client.query("query { ok }"), /failed after 1 attempt\(s\)/);
  assert.equal(calls.length, 1);
});

// --- backoff shape: exponential, and fast in tests (no dangling timers) ---

test("backoff delay grows exponentially between retries", async () => {
  // Asserts the delays REQUESTED, not elapsed wall-clock. A real-clock version of this test
  // was flaky: under CPU contention the first measured gap could exceed the second even though
  // the backoff was perfectly exponential. Injecting the sleep also keeps the suite fast and
  // leaves no dangling timers.
  const slept = [];
  const responses = [jsonResponse(503, {}), jsonResponse(503, {}), jsonResponse(200, { data: { ok: true } })];
  let i = 0;
  const fetchImpl = async () => responses[i++];
  const client = new LinearClient({
    apiKey: "key",
    fetchImpl,
    retryDelayMs: 30,
    maxRetries: 3,
    sleepImpl: async (ms) => slept.push(ms),
  });

  assert.deepEqual(await client.query("query { ok }"), { ok: true });
  assert.deepEqual(slept, [30, 60], "delays must double: retryDelayMs * 2**attempt");
});

test("backoff uses the default 1000ms base when retryDelayMs is not overridden", async () => {
  const slept = [];
  const responses = [jsonResponse(429, {}), jsonResponse(429, {}), jsonResponse(200, { data: { ok: true } })];
  let i = 0;
  const client = new LinearClient({
    apiKey: "key",
    fetchImpl: async () => responses[i++],
    sleepImpl: async (ms) => slept.push(ms),
  });
  await client.query("query { ok }");
  assert.deepEqual(slept, [1000, 2000]);
});
// --- non-retryable HTTP failures: never retried, always thrown with the status named ---

test("a 4xx other than 429 does not retry", async () => {
  const { fetchImpl, calls } = sequenceFetch([jsonResponse(400, { message: "bad query" })]);
  const client = new LinearClient({ apiKey: "key", fetchImpl, retryDelayMs: 1 });
  await assert.rejects(() => client.query("query { ok }"));
  assert.equal(calls.length, 1);
});

test("a non-retryable HTTP failure with a JSON body but no GraphQL errors envelope throws naming the status", async () => {
  const { fetchImpl } = sequenceFetch([jsonResponse(401, { message: "Unauthorized" })]);
  const client = new LinearClient({ apiKey: "bad-key", fetchImpl });
  await assert.rejects(() => client.query("query { ok }"), /Linear API request failed: HTTP 401/);
});

// --- non-JSON bodies: wrapped to name the status and a body snippet, not a bare SyntaxError ---

test("a non-JSON body (e.g. an HTML error page from a proxy) throws naming the status and a body snippet", async () => {
  const { fetchImpl } = sequenceFetch([textResponse(200, "<html><body>502 Bad Gateway</body></html>")]);
  const client = new LinearClient({ apiKey: "key", fetchImpl });
  await assert.rejects(() => client.query("query { ok }"), /non-JSON response \(HTTP 200\): <html>/);
});

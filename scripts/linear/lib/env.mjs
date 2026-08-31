// Process/env-facing helpers shared by the three CLIs that talk to Linear (plan.mjs, apply.mjs,
// verify.mjs). Deliberately NOT in client.mjs — that module is a leaf with no process/env
// knowledge (see its own module comment) — this is a small home for the one thing all three
// CLIs did identically before this existed: refuse to start with a clear, one-line message
// when LINEAR_API_KEY is missing, rather than let the LinearClient constructor's generic throw
// surface as an unhandled-rejection stack trace.
export function requireApiKey() {
  if (!process.env.LINEAR_API_KEY) {
    console.error(
      "LINEAR_API_KEY is not set. Copy .env.example to .env and add your Linear personal API key, " +
        "or export it in your shell before running this command."
    );
    process.exit(1);
  }
}

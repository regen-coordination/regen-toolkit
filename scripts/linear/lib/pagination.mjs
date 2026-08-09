// Shared GraphQL connection-pagination helpers. Used by plan.mjs (issues, labels — both grow
// with ordinary use of this pipeline, see plan.mjs's own comment on why those two are paginated
// and the rest aren't) and verify.mjs (the batched issue-by-id lookup, page size 250 like
// everything else in this pipeline). No I/O, no network of its own — `client` is always handed
// in, mirroring the rest of this directory's pure/injected-dependency idiom.
export async function fetchAllPages(client, { query, variables, connectionPath }) {
  const readConnection = (data) => connectionPath.reduce((node, key) => node[key], data);

  const data = await client.query(query, variables);
  const first = readConnection(data);
  let nodes = first.nodes;
  let pageInfo = first.pageInfo;

  while (pageInfo?.hasNextPage) {
    const page = await client.query(query, { ...variables, after: pageInfo.endCursor });
    const next = readConnection(page);
    nodes = nodes.concat(next.nodes);
    pageInfo = next.pageInfo;
  }

  return nodes;
}

// Resolves a connection's full node list given a page already fetched (`firstPage`, shaped
// `{ nodes, pageInfo }`) — fetches the rest via fetchAllPages only if that first page actually
// said there was more, rather than always re-issuing the first query. This is the
// `hasNextPage ? fetchAllPages(...) : nodes` shape that used to be repeated once per connection
// at each call site.
export async function resolveConnection(client, firstPage, { query, variables, connectionPath }) {
  return firstPage.pageInfo?.hasNextPage
    ? fetchAllPages(client, { query, variables, connectionPath })
    : firstPage.nodes;
}

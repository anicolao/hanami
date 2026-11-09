export function readLaunch(search) {
  const p = new URLSearchParams(search),
    mode = p.get("launch"),
    table = (p.get("table") || "").toUpperCase(),
    name = (p.get("name") || "").trim();
  if (mode !== null && !["create", "join"].includes(mode))
    throw Error("This invitation needs a create or join instruction.");
  if (table && !/^[A-Z0-9]{5,8}$/.test(table))
    throw Error("Use a table code of 5–8 letters or numbers.");
  if (mode && (!table || !name || name.length > 24))
    throw Error(
      "This invitation needs a table code and name of up to 24 characters.",
    );
  let returnTo = null;
  try {
    const u = new URL(p.get("returnTo"));
    if (["https:", "http:"].includes(u.protocol) && !u.username && !u.password)
      returnTo = u.href;
  } catch {}
  return { mode, table, name, returnTo };
}
export function launchChoice(launch, state, uid) {
  if (!launch.mode || state.players.some((p) => p.controller === uid))
    return null;
  if (launch.mode === "create") {
    if (state.phase !== "empty")
      throw Error(
        "This table already exists. Ask your room to create another.",
      );
    return { type: "create", name: launch.name };
  }
  if (state.phase === "empty") return null; // Guest arriving first waits for host.
  if (state.phase !== "gathering")
    throw Error("The game has begun. You can watch this table.");
  return { type: "join", name: launch.name };
}

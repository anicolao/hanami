export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

// A retry must retain its rule version as well as its actor and chosen intent.
// Commands saved before protocol 2 had no explicit version in local storage.
export function sameCommand(saved, actor, pending) {
  return saved.actor === actor && saved.version === (pending.version ?? 1) &&
    canonicalJson(saved.intent) === canonicalJson(pending.intent);
}

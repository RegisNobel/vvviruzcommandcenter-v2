type JsonValue = Record<string, unknown> | Array<unknown>;

export function stringifyJsonLd(value: JsonValue) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

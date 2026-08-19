const DEFAULT_RANDOM_ID_LENGTH = 24;

export function foundryRandomId(
  length: number = DEFAULT_RANDOM_ID_LENGTH,
): string {
  const runtime = (
    globalThis as typeof globalThis & {
      foundry?: { readonly utils?: { randomID?(size?: number): string } };
    }
  ).foundry;
  const foundryId = runtime?.utils?.randomID?.(length);
  if (typeof foundryId === "string" && foundryId.length > 0) return foundryId;

  // Keeps isolated unit/loader environments working when they provide Web
  // Crypto but not Foundry's complete runtime. Browser gameplay uses randomID.
  const cryptoRuntime = globalThis.crypto as Partial<Crypto>;
  if (typeof cryptoRuntime.randomUUID === "function") {
    return cryptoRuntime.randomUUID().replaceAll("-", "");
  }
  throw new Error("D6E2.RandomIdUnavailable");
}

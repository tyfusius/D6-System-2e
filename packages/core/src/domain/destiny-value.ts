/** A claimed Destiny document or record must still exist before it is used. */
export function requireDestinyValue<T>(value: T | null | undefined): T {
  if (value === null || value === undefined)
    throw new Error("D6E2.Destiny.Error.MissingState");
  return value;
}

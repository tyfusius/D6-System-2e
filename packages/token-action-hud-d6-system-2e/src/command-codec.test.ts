import { describe, expect, it } from "vitest";
import { decodeHudCommand, encodeHudCommand } from "./command-codec";

describe("HUD command codec", () => {
  it("round-trips identifiers without depending on Core's delimiter", () => {
    const command = { kind: "skill", id: "shooting|specialized" } as const;
    expect(decodeHudCommand(encodeHudCommand(command))).toEqual(command);
  });

  it.each(["", "skill|shooting", "d6e2:%7Bbad"])(
    "rejects malformed values: %s",
    (value) => expect(decodeHudCommand(value)).toBeNull(),
  );
});

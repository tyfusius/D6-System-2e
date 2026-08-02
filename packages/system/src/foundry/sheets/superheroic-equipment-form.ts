export function superheroicGadgetTargetChanges(
  value: unknown,
): Record<string, string> {
  if (typeof value === "string") {
    const [kind, id] = value.split(":", 2);
    if ((kind === "attribute" || kind === "skill") && id) {
      return {
        "system.gadgetTargetKind": kind,
        "system.gadgetTargetId": id,
      };
    }
  }
  return {
    "system.gadgetTargetKind": "",
    "system.gadgetTargetId": "",
  };
}

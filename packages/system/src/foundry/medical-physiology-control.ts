export type MedicalPhysiologyKind = "unknown" | "biological" | "mechanical";

function physiologyKind(value: string): value is MedicalPhysiologyKind {
  return ["unknown", "biological", "mechanical"].includes(value);
}

export function medicalPhysiologyUpdate(
  current: { readonly revision?: unknown },
  kind: string,
): Record<string, unknown> | undefined {
  if (!physiologyKind(kind)) return undefined;
  const revision = Number(current.revision);
  return {
    "system.medical.physiology": {
      kind,
      source: "world",
      revision:
        (Number.isSafeInteger(revision) && revision >= 0 ? revision : 0) + 1,
    },
  };
}

export function bindMedicalPhysiologyControl(
  root: ParentNode,
  options: {
    readonly canClassify: () => boolean;
    readonly current: () => { readonly revision?: unknown };
    readonly persist: (changes: Record<string, unknown>) => Promise<unknown>;
  },
): void {
  const select = root.querySelector<HTMLSelectElement>(
    'select[name="medical.physiology"]',
  );
  if (!select) return;
  select.addEventListener("change", () => {
    if (!options.canClassify()) return;
    const changes = medicalPhysiologyUpdate(options.current(), select.value);
    if (changes) void options.persist(changes);
  });
}

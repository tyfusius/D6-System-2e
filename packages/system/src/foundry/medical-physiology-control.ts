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

interface MedicalPhysiologyControlOptions {
  readonly canClassify: () => boolean;
  readonly current: () => { readonly revision?: unknown };
  readonly persist: (changes: Record<string, unknown>) => Promise<unknown>;
}
const physiologyBindings = new WeakMap<
  HTMLSelectElement,
  { options: MedicalPhysiologyControlOptions }
>();

export function bindMedicalPhysiologyControl(
  root: ParentNode,
  options: MedicalPhysiologyControlOptions,
): void {
  const select = root.querySelector<HTMLSelectElement>(
    'select[name="medical.physiology"]',
  );
  if (!select) return;
  const currentBinding = physiologyBindings.get(select);
  if (currentBinding) {
    currentBinding.options = options;
    return;
  }
  const binding = { options };
  physiologyBindings.set(select, binding);
  select.addEventListener("change", () => {
    if (!binding.options.canClassify()) return;
    const changes = medicalPhysiologyUpdate(
      binding.options.current(),
      select.value,
    );
    if (changes) void binding.options.persist(changes);
  });
}

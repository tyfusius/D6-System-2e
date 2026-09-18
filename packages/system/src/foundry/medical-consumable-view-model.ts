export interface MedicalOptionVM {
  readonly value: string;
  readonly label: string;
  readonly selected: boolean;
  readonly disabled?: boolean;
}

export interface MedicalRowVM {
  readonly label: string;
  readonly value: string;
  readonly tone?: "neutral" | "warning" | "danger" | "success";
}

export interface MedicalControlVM {
  readonly action: string;
  readonly label: string;
  readonly disabled?: boolean;
  readonly reason?: string;
}

export interface MedicalConsumableItemVM {
  readonly isMedical: boolean;
  readonly categoryOptions: readonly MedicalOptionVM[];
  readonly effectLabel: string;
  readonly compatibilityLabel: string;
  readonly durationLabel: string;
  readonly actionCostLabel: string;
  readonly doseCostLabel: string;
  readonly priceGuidance: string;
  readonly canUse: boolean;
  readonly useLabel: string;
  readonly unavailableReason: string;
}

export interface MedicalInventoryUseVM {
  readonly itemId: string;
  readonly label: string;
  readonly disabled: boolean;
  readonly reason: string;
}

export interface MedicalPhysiologyVM {
  readonly kind: "unknown" | "biological" | "mechanical";
  readonly label: string;
  readonly canClassify: boolean;
  readonly options: readonly MedicalOptionVM[];
}

export interface MedicalStimVM {
  readonly useId: string;
  readonly status: "active" | "needs-attention" | "expired" | "ended";
  readonly statusLabel: string;
  readonly itemName: string;
  readonly remainingLabel: string;
  readonly expiryLabel: string;
  readonly suppressionLabel: string;
  readonly applicable: boolean;
  readonly needsAttention: boolean;
  readonly componentEnabled: boolean;
  readonly controls: readonly MedicalControlVM[];
  readonly history: readonly {
    readonly rootMessageId: string;
    readonly label: string;
    readonly summary: string;
    readonly canOpen: boolean;
  }[];
}

export interface MedicalCombatVM {
  readonly physiology: MedicalPhysiologyVM;
  readonly stim?: MedicalStimVM;
}

export function medicalAuthorityViewRequired(input: {
  readonly markerVersion: unknown;
  readonly storedAuthority: unknown;
}): boolean {
  return input.markerVersion === 1 || input.storedAuthority != null;
}

export function medicalStimAdjustedSheetPenalty(input: {
  readonly applicable: boolean;
  readonly conditionPenaltyScore: number;
  readonly woundPenaltyScore: number;
}): number {
  const condition = Number.isFinite(input.conditionPenaltyScore)
    ? Math.max(0, input.conditionPenaltyScore)
    : 0;
  const wound = Number.isFinite(input.woundPenaltyScore)
    ? Math.max(0, input.woundPenaltyScore)
    : 0;
  return input.applicable ? Math.max(0, condition - wound) : condition;
}

export function medicalUseDialogVM(
  input: MedicalUseDialogVM,
): MedicalUseDialogVM {
  return Object.freeze({
    ...input,
    useModeOptions: Object.freeze(
      input.useModeOptions.map((option) => Object.freeze({ ...option })),
    ),
    patientOptions: Object.freeze(
      input.patientOptions.map((option) => Object.freeze({ ...option })),
    ),
    rollModeOptions: Object.freeze(
      input.rollModeOptions.map((option) => Object.freeze({ ...option })),
    ),
  });
}

export interface MedicalUseDialogVM {
  readonly title: string;
  readonly useMode: "self" | "administer";
  readonly useModeOptions: readonly MedicalOptionVM[];
  readonly patientUuid: string;
  readonly patientOptions: readonly MedicalOptionVM[];
  readonly rollMode: "publicroll" | "gmroll" | "selfroll" | "blindroll";
  readonly rollModeOptions: readonly MedicalOptionVM[];
  readonly doseLabel: string;
  readonly effectLabel: string;
  readonly durationLabel: string;
  readonly actionCostLabel: string;
  readonly eligibilityLabel: string;
  readonly eligible: boolean;
  readonly pending: boolean;
  readonly submitLabel: string;
  readonly cancelLabel: string;
}

export interface MedicalRootVM {
  readonly title: string;
  readonly statusLabel: string;
  readonly administratorLabel: string;
  readonly patientLabel: string;
  readonly itemLabel: string;
  readonly durationRollHtml: string;
  readonly contextRows: readonly MedicalRowVM[];
  readonly resultRows: readonly MedicalRowVM[];
  readonly nextStepLabel: string;
  readonly terminal: boolean;
  readonly controls: readonly MedicalControlVM[];
}

export interface WoundTreatmentAuditVM {
  readonly familyLabel: string;
  readonly baseCategoryLabel: string;
  readonly baseValue: number;
  readonly finalCategoryLabel: string;
  readonly finalValue: number;
  readonly selfTreatment: boolean;
}

export function medicalCategoryOptions(
  isMedical: boolean,
  isContainer = false,
  containerLabel = "Container",
): readonly MedicalOptionVM[] {
  return Object.freeze([
    Object.freeze({
      value: "general",
      label: "General gear",
      selected: !isMedical && !isContainer,
    }),
    Object.freeze({
      value: "container",
      label: containerLabel,
      selected: isContainer,
    }),
    Object.freeze({
      value: "medical-consumable",
      label: "Medical consumable",
      selected: isMedical,
    }),
  ]);
}

export function medicalPhysiologyVM(input: {
  readonly kind: MedicalPhysiologyVM["kind"];
  readonly canClassify: boolean;
}): MedicalPhysiologyVM {
  const labels = {
    unknown: "Unknown",
    biological: "Biological",
    mechanical: "Mechanical",
  } as const;
  return Object.freeze({
    kind: input.kind,
    label: labels[input.kind],
    canClassify: input.canClassify,
    options: Object.freeze(
      Object.entries(labels).map(([value, label]) =>
        Object.freeze({ value, label, selected: value === input.kind }),
      ),
    ),
  });
}

/** Keeps the default character combat UI clean until the component or saved state exists. */
export function medicalCombatVM(input: {
  readonly componentEnabled: boolean;
  readonly physiology: MedicalPhysiologyVM;
  readonly stim?: MedicalStimVM;
}): MedicalCombatVM | undefined {
  if (!input.componentEnabled && !input.stim) return undefined;
  return Object.freeze({
    physiology: input.physiology,
    ...(input.stim ? { stim: input.stim } : {}),
  });
}

function foundryRollRenderFixture(total: 1 | 4 | 6, visible = true): string {
  return `<div class="dice-roll"><div class="dice-result"><div class="dice-formula">1d6</div><div class="dice-tooltip"><section class="tooltip-part"><div class="dice"><ol class="dice-rolls"><li class="roll die d6">${visible ? total : "?"}</li></ol></div></section></div><h4 class="dice-total">${visible ? total : "•••"}</h4></div></div>`;
}

export function medicalConsumableVmFixtures() {
  const physiology = medicalPhysiologyVM({
    kind: "biological",
    canClassify: true,
  });
  const activeStim: MedicalStimVM = Object.freeze({
    useId: "fixture-active",
    status: "active",
    statusLabel: "Active",
    itemName: "Model B stim",
    remainingLabel: "4 rounds",
    expiryLabel: "Expires on entry to round 9",
    suppressionLabel: "Wound penalty suppressed (−1D)",
    applicable: true,
    needsAttention: false,
    componentEnabled: true,
    controls: Object.freeze([
      Object.freeze({ action: "end-effect", label: "End effect" }),
    ]),
    history: Object.freeze([
      Object.freeze({
        rootMessageId: "fixture-root-active",
        label: "Model B stim",
        summary: "Applied to Wounded patient",
        canOpen: true,
      }),
    ]),
  });
  const needsAttention: MedicalStimVM = Object.freeze({
    ...activeStim,
    useId: "fixture-unresolved",
    status: "needs-attention",
    statusLabel: "Needs attention",
    remainingLabel: "Timing unavailable",
    expiryLabel: "GM timing repair required",
    suppressionLabel: "No suppression while timing is unresolved",
    applicable: false,
    needsAttention: true,
    controls: Object.freeze([
      Object.freeze({ action: "repair-timing", label: "Repair timing" }),
      Object.freeze({ action: "end-effect", label: "End effect" }),
    ]),
  });
  const expired: MedicalStimVM = Object.freeze({
    ...activeStim,
    useId: "fixture-expired",
    status: "expired",
    statusLabel: "Expired",
    remainingLabel: "Expired",
    expiryLabel: "Expired at campaign time 125",
    suppressionLabel: "No active suppression",
    applicable: false,
    controls: Object.freeze([]),
  });
  const ended: MedicalStimVM = Object.freeze({
    ...expired,
    useId: "fixture-ended",
    status: "ended",
    statusLabel: "Ended by GM",
    expiryLabel: "Effect ended before natural expiry",
  });
  const item: MedicalConsumableItemVM = Object.freeze({
    isMedical: true,
    categoryOptions: medicalCategoryOptions(true),
    effectLabel: "Suppress Wounded or Severely Wounded penalty",
    compatibilityLabel: "Biological patients",
    durationLabel: "1D rounds",
    actionCostLabel: "1 action",
    doseCostLabel: "1 dose",
    priceGuidance: "75 credits (playtest guidance)",
    canUse: true,
    useLabel: "Use medical consumable",
    unavailableReason: "",
  });
  const dialog: MedicalUseDialogVM = medicalUseDialogVM({
    title: "Use Model B stim",
    useMode: "self",
    useModeOptions: Object.freeze([
      Object.freeze({ value: "self", label: "Self", selected: true }),
      Object.freeze({
        value: "administer",
        label: "Administer",
        selected: false,
      }),
    ]),
    patientUuid: "Actor.fixture-patient",
    patientOptions: Object.freeze([
      Object.freeze({
        value: "Actor.fixture-patient",
        label: "Tala Venn",
        selected: true,
      }),
    ]),
    rollMode: "blindroll",
    rollModeOptions: Object.freeze([
      Object.freeze({
        value: "publicroll",
        label: "Public Roll",
        selected: false,
      }),
      Object.freeze({
        value: "gmroll",
        label: "Private GM Roll",
        selected: false,
      }),
      Object.freeze({ value: "selfroll", label: "Self Roll", selected: false }),
      Object.freeze({
        value: "blindroll",
        label: "Blind GM Roll",
        selected: true,
      }),
    ]),
    doseLabel: "1 of 3 doses",
    effectLabel: item.effectLabel,
    durationLabel: item.durationLabel,
    actionCostLabel: item.actionCostLabel,
    eligibilityLabel: "Ready",
    eligible: true,
    pending: false,
    submitLabel: "Use stim",
    cancelLabel: "Cancel",
  });
  const root: MedicalRootVM = Object.freeze({
    title: "Model B stim",
    statusLabel: "Ready to roll duration",
    administratorLabel: "Tala Venn",
    patientLabel: "Tala Venn",
    itemLabel: "Model B stim",
    durationRollHtml: "",
    contextRows: Object.freeze([
      Object.freeze({ label: "Injury", value: "Wounded" }),
      Object.freeze({ label: "Dose", value: "1 dose" }),
      Object.freeze({ label: "Action", value: "1 action" }),
    ]),
    resultRows: Object.freeze([]),
    nextStepLabel: "Roll the duration, then apply the effect.",
    terminal: false,
    controls: Object.freeze([
      Object.freeze({ action: "continue", label: "Continue" }),
      Object.freeze({ action: "cancel", label: "Cancel" }),
    ]),
  });
  const durationRoot = (
    total: 1 | 4 | 6,
    durationRollHtml = foundryRollRenderFixture(total),
    durationLabel = `${total} ${total === 1 ? "round" : "rounds"}`,
  ): MedicalRootVM =>
    Object.freeze({
      ...root,
      statusLabel: "Duration recorded",
      durationRollHtml,
      resultRows: Object.freeze([
        Object.freeze({ label: "Duration", value: durationLabel }),
      ]),
      nextStepLabel: "Continue to commit the action, dose, and effect.",
      controls: Object.freeze([
        Object.freeze({ action: "continue", label: "Continue" }),
        Object.freeze({ action: "end-operation", label: "End operation" }),
      ]),
    });
  const claimedRoot: MedicalRootVM = Object.freeze({
    ...root,
    statusLabel: "Progress needs confirmation",
    nextStepLabel: "Check saved progress for the existing duration.",
    controls: Object.freeze([
      Object.freeze({
        action: "continue",
        label: "Check saved progress",
      }),
      Object.freeze({ action: "end-operation", label: "End operation" }),
    ]),
  });
  const appliedRoot: MedicalRootVM = Object.freeze({
    ...durationRoot(4),
    statusLabel: "Complete",
    nextStepLabel: "Effect active",
    terminal: true,
    controls: Object.freeze([]),
  });
  return Object.freeze({
    item,
    inventory: Object.freeze({
      itemId: "fixture-item",
      label: "Use",
      disabled: false,
      reason: "",
    }),
    combat: Object.freeze({
      absentWhenDisabled: medicalCombatVM({
        componentEnabled: false,
        physiology,
      }),
      active: medicalCombatVM({
        componentEnabled: true,
        physiology,
        stim: activeStim,
      }),
      activeCampaign: medicalCombatVM({
        componentEnabled: true,
        physiology,
        stim: Object.freeze({
          ...activeStim,
          useId: "fixture-campaign",
          remainingLabel: "20 seconds remaining",
          expiryLabel: "Campaign clock",
        }),
      }),
      activeDuration1: medicalCombatVM({
        componentEnabled: true,
        physiology,
        stim: Object.freeze({
          ...activeStim,
          useId: "fixture-duration-1",
          remainingLabel: "1 round",
          expiryLabel: "Expires on entry to round 8",
        }),
      }),
      activeDuration6: medicalCombatVM({
        componentEnabled: true,
        physiology,
        stim: Object.freeze({
          ...activeStim,
          useId: "fixture-duration-6",
          remainingLabel: "6 rounds",
          expiryLabel: "Expires on entry to round 13",
        }),
      }),
      unresolved: medicalCombatVM({
        componentEnabled: true,
        physiology,
        stim: needsAttention,
      }),
      expired: medicalCombatVM({
        componentEnabled: true,
        physiology,
        stim: expired,
      }),
      ended: medicalCombatVM({
        componentEnabled: true,
        physiology,
        stim: ended,
      }),
      disabledWithSavedState: medicalCombatVM({
        componentEnabled: false,
        physiology,
        stim: Object.freeze({
          ...activeStim,
          componentEnabled: false,
          applicable: false,
          suppressionLabel: "Rules component disabled",
        }),
      }),
      woundedParent: Object.freeze({
        combat: Object.freeze({
          condition: "wounded",
          conditionLabel: "Wounded",
          conditionTrackLabel: "Wounds",
          woundPenaltyLabel: "−1D",
          conditionEditable: true,
          conditions: Object.freeze([
            Object.freeze({
              value: "healthy",
              label: "Healthy",
              current: false,
              penaltyLabel: "",
              cssClass: "",
              description: "No wound penalty",
              descriptionId: "fixture-healthy",
              terminal: false,
              actionsUnavailable: false,
            }),
            Object.freeze({
              value: "wounded",
              label: "Wounded",
              current: true,
              penaltyLabel: "−1D",
              cssClass: "is-current",
              description: "Wounded: −1D",
              descriptionId: "fixture-wounded",
              terminal: false,
              actionsUnavailable: false,
            }),
          ]),
          medical: medicalCombatVM({
            componentEnabled: true,
            physiology,
            stim: activeStim,
          }),
          medicalHtml: "<!-- rendered medical-stim-status partial -->",
        }),
      }),
    }),
    dialog: Object.freeze({
      ready: dialog,
      administer: Object.freeze({
        ...dialog,
        useMode: "administer" as const,
        useModeOptions: Object.freeze([
          Object.freeze({ value: "self", label: "Self", selected: false }),
          Object.freeze({
            value: "administer",
            label: "Administer",
            selected: true,
          }),
        ]),
        patientUuid: "Actor.fixture-patient",
        patientOptions: Object.freeze([
          Object.freeze({
            value: "Actor.fixture-administrator",
            label: "Tala Venn",
            selected: false,
          }),
          Object.freeze({
            value: "Actor.fixture-patient",
            label: "Rook",
            selected: true,
          }),
        ]),
      }),
      pending: Object.freeze({
        ...dialog,
        pending: true,
        submitLabel: "Applying…",
      }),
      blocked: Object.freeze({
        ...dialog,
        eligible: false,
        eligibilityLabel: "Unknown physiology",
        submitLabel: "Unavailable",
      }),
      blockedReasons: Object.freeze({
        noDoses: Object.freeze({
          ...dialog,
          eligible: false,
          eligibilityLabel: "No doses remain",
          submitLabel: "Unavailable",
        }),
        mechanical: Object.freeze({
          ...dialog,
          eligible: false,
          eligibilityLabel: "Model B is for biological patients",
          submitLabel: "Unavailable",
        }),
        unconscious: Object.freeze({
          ...dialog,
          eligible: false,
          eligibilityLabel: "Patient is unconscious",
          submitLabel: "Unavailable",
        }),
        activeEffect: Object.freeze({
          ...dialog,
          eligible: false,
          eligibilityLabel: "A Model B effect is already active",
          submitLabel: "Unavailable",
        }),
        actionUnavailable: Object.freeze({
          ...dialog,
          eligible: false,
          eligibilityLabel: "Current action unavailable",
          submitLabel: "Unavailable",
        }),
      }),
    }),
    root: Object.freeze({
      ready: root,
      claimed: claimedRoot,
      duration1: durationRoot(1),
      duration4: durationRoot(4),
      duration6: durationRoot(6),
      partialAction: Object.freeze({
        ...claimedRoot,
        statusLabel: "Action committed; progress needs confirmation",
        nextStepLabel: "Check saved progress to commit the dose and effect.",
      }),
      partialDose: Object.freeze({
        ...claimedRoot,
        statusLabel: "Dose committed; progress needs confirmation",
        nextStepLabel: "Check saved progress to commit the patient effect.",
      }),
      complete: appliedRoot,
      audience: Object.freeze({
        public: durationRoot(1),
        gmVisible: durationRoot(4),
        selfVisible: durationRoot(6),
        hidden: durationRoot(
          4,
          foundryRollRenderFixture(4, false),
          "Hidden roll",
        ),
      }),
      privateApplied: Object.freeze({
        ...appliedRoot,
        durationRollHtml: foundryRollRenderFixture(4, false),
        resultRows: Object.freeze([
          Object.freeze({ label: "Duration", value: "Hidden roll" }),
        ]),
      }),
    }),
    woundTreatmentAudit: Object.freeze({
      familyLabel: "OpenD6 Space Medicine",
      baseCategoryLabel: "Moderate",
      baseValue: 15,
      finalCategoryLabel: "Difficult",
      finalValue: 20,
      selfTreatment: true,
    }),
    settings: Object.freeze({
      profileMedicalConsumables: Object.freeze({
        checked: true,
        label: "Medical Consumables",
        hint: "Enable Model B stims and self-treatment.",
      }),
    }),
  });
}

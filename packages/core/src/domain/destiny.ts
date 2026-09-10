import { requireDestinyValue } from "./destiny-value";
import type {
  D6DestinyCommandV1,
  D6DestinyConfigurationV1,
  D6DestinyDeliveryV1,
  D6DestinyFace,
  D6DestinyPrincipal,
  D6DestinyStateV1,
} from "../contracts/destiny";

function requireThat(value: unknown, reason: string): asserts value {
  if (!value) throw new RangeError(`D6E2.Destiny.Error.${reason}`);
}
function boundedText(value: string, maximum = 2000): void {
  requireThat(
    typeof value === "string" &&
      value.trim().length > 0 &&
      value.length <= maximum,
    "TextRequired",
  );
}
function die(value: number): void {
  requireThat(
    Number.isInteger(value) && value >= 1 && value <= 6,
    "InvalidDie",
  );
}
function owns(principal: D6DestinyPrincipal, actorId: string): void {
  requireThat(
    principal.isGM || principal.actorIds.includes(actorId),
    "OwnerRequired",
  );
}
function gm(principal: D6DestinyPrincipal): void {
  requireThat(principal.isGM, "GMRequired");
}

export function normalizeDestinyConfiguration(
  value: unknown,
): D6DestinyConfigurationV1 {
  const raw =
    value && typeof value === "object"
      ? (value as Partial<D6DestinyConfigurationV1>)
      : {};
  return Object.freeze({
    version: 1,
    enabled: raw.version === 1 && raw.enabled === true,
    size: raw.size === 1 || raw.size === 2 ? raw.size : 3,
  });
}

export function initialDestinyState(): D6DestinyStateV1 {
  return Object.freeze({
    version: 1,
    revision: 0,
    sessionId: "",
    status: "uninitialized",
    nominatedUserId: "",
    coins: [],
    proposals: {},
    effects: {},
    spends: [],
    temptations: {},
    receipts: {},
  });
}

export function destinyLightAllocation(size: number, rolled: number): number {
  requireThat(Number.isInteger(size) && size >= 1 && size <= 3, "PoolSize");
  die(rolled);
  return Math.min(size, Math.ceil(rolled / 2));
}

export function destinyDifficultyShift(
  before: number,
  ladder: readonly number[],
  side: D6DestinyFace,
  lightDirection: "lower" | "raise" = "lower",
): number {
  requireThat(
    Number.isFinite(before) &&
      ladder.length >= 2 &&
      ladder.every(
        (v, i) =>
          Number.isFinite(v) &&
          (i === 0 || v > requireDestinyValue(ladder[i - 1])),
      ),
    "DifficultyScale",
  );
  // Profiles currently store named anchors, not category interval bounds.
  // An off-anchor custom value cannot safely identify its category.
  const index = ladder.indexOf(before);
  requireThat(index >= 0, "CustomDifficultyCategory");
  const lower = (side === "light") === (lightDirection === "lower");
  const next = ladder[index + (lower ? -1 : 1)];
  requireThat(next !== undefined, "DifficultyBoundary");
  return next;
}

/** Only an incoming outcome is reduced. Existing accumulated health is never an input. */
export function destinyIncomingWound(
  outcomes: readonly string[],
  incoming: string,
): { before: number; after: string } | undefined {
  const index = outcomes.indexOf(incoming);
  if (index < 0 || incoming === "none") return undefined;
  const before = index + (outcomes[0] === "none" ? 0 : 1);
  return {
    before,
    after: before === 1 ? "none" : requireDestinyValue(outcomes[index - 1]),
  };
}

/** Validate durable top-level structure and coin/reservation invariants before using a ledger. */
export function validateDestinyState(
  value: unknown,
): asserts value is D6DestinyStateV1 {
  const s = value as D6DestinyStateV1;
  const raw = value as { version?: unknown } | null;
  const isArray = (v: unknown): boolean => Array.isArray(v);
  const map = (v: unknown) =>
    Boolean(v && typeof v === "object" && !Array.isArray(v));
  requireThat(
    raw?.version === 1 &&
      Number.isSafeInteger(s.revision) &&
      s.revision >= 0 &&
      typeof s.sessionId === "string" &&
      typeof s.nominatedUserId === "string" &&
      ["uninitialized", "awaiting-roll", "active"].includes(s.status),
    "Version",
  );
  requireThat(
    isArray(s.coins) &&
      s.coins.length <= 3 &&
      (s.status === "uninitialized"
        ? s.coins.length === 0
        : s.coins.length >= 1) &&
      new Set(s.coins.map((c) => c.id)).size === s.coins.length,
    "PoolSize",
  );
  requireThat(
    map(s.proposals) &&
      map(s.effects) &&
      map(s.temptations) &&
      map(s.receipts) &&
      isArray(s.spends),
    "Version",
  );
  for (const c of s.coins) {
    requireThat(
      typeof c.id === "string" && ["light", "dark"].includes(c.face),
      "Version",
    );
    if (c.reservationId) {
      const p = s.proposals[c.reservationId];
      requireThat(
        c.face === "light" &&
          p?.coinId === c.id &&
          ["pending", "revision"].includes(p.status),
        "CoinUnavailable",
      );
    }
  }
  for (const p of Object.values(s.proposals)) {
    requireThat(
      typeof p.id === "string" &&
        [
          "pending",
          "revision",
          "rejected",
          "cancelled",
          "delivering",
          "approved",
        ].includes(p.status),
      "Version",
    );
    if (["pending", "revision"].includes(p.status))
      requireThat(
        s.coins.some((c) => c.reservationId === p.id && c.id === p.coinId),
        "CoinUnavailable",
      );
  }
  requireThat(
    new Set(s.spends.map((spend) => spend.key)).size === s.spends.length,
    "SameEffect",
  );
}

export function validateDestinyDelivery(delivery: D6DestinyDeliveryV1): void {
  requireThat(
    typeof delivery === "object" && (delivery as unknown) !== null,
    "DeliveryRequired",
  );
  if (delivery.kind === "fact") {
    boundedText(delivery.fact);
    return;
  }
  requireThat(
    (delivery as { kind: unknown }).kind === "equipment",
    "DeliveryRequired",
  );
  boundedText(delivery.actorId, 128);
  boundedText(delivery.itemId, 128);
  boundedText(delivery.name, 160);
  requireThat(
    typeof delivery.description === "string" &&
      delivery.description.length <= 4000,
    "InvalidEquipment",
  );
  requireThat(
    Number.isInteger(delivery.quantity) &&
      delivery.quantity >= 1 &&
      delivery.quantity <= 20,
    "InvalidEquipment",
  );
  requireThat(
    Number.isInteger(delivery.charges) &&
      delivery.charges >= 0 &&
      delivery.charges <= 100,
    "InvalidEquipment",
  );
  requireThat(
    ["session", "permanent"].includes(delivery.permanence),
    "InvalidEquipment",
  );
  if (delivery.sourceUuid !== undefined) boundedText(delivery.sourceUuid, 256);
}

/** Pure, immutable and revision checked. Caller validates document authority/evidence. */
export function transitionDestiny(
  state: D6DestinyStateV1,
  command: D6DestinyCommandV1,
  principal: D6DestinyPrincipal,
): D6DestinyStateV1 {
  requireThat(
    (state as { version: unknown }).version === 1 &&
      (command as { version: unknown }).version === 1,
    "Version",
  );
  boundedText(command.id, 128);
  boundedText(principal.userId, 128);
  const identity = JSON.stringify(command);
  const receipt = state.receipts[command.id];
  if (receipt) {
    requireThat(
      receipt.userId === principal.userId && receipt.command === identity,
      "ReceiptConflict",
    );
    return state;
  }
  requireThat(
    command.expectedRevision === state.revision &&
      command.sessionId === state.sessionId,
    "RevisionConflict",
  );
  const next = structuredClone(state) as {
    -readonly [K in keyof D6DestinyStateV1]: D6DestinyStateV1[K];
  };
  const op = command.operation;
  requireThat(
    typeof op === "object" &&
      (op as unknown) !== null &&
      typeof op.kind === "string",
    "InvalidCommand",
  );
  const coin = (id: string, face: D6DestinyFace, reservationId?: string) => {
    const value = next.coins.find((c) => c.id === id);
    requireThat(
      value?.face === face &&
        (value.reservationId === undefined ||
          value.reservationId === reservationId),
      "CoinUnavailable",
    );
    return value;
  };
  const flip = (
    id: string,
    face: D6DestinyFace,
    kind: D6DestinyStateV1["spends"][number]["kind"],
    effectId: string,
    key: string,
    reservationId?: string,
  ) => {
    coin(id, face, reservationId);
    requireThat(!next.spends.some((s) => s.key === key), "SameEffect");
    next.coins = next.coins.map((c) =>
      c.id === id ? { id, face: face === "light" ? "dark" : "light" } : c,
    );
    next.spends = [
      ...next.spends,
      {
        id: command.id,
        key,
        coinId: id,
        userId: principal.userId,
        side: face,
        kind,
        effectId,
      },
    ];
  };
  if (op.kind === "framework-edit") {
    owns(principal, op.edit.actorId);
    boundedText(op.edit.id, 128);
    boundedText(op.edit.frameworkId, 128);
    requireThat(
      !state.frameworkEdits?.[op.edit.id] &&
        Array.isArray(op.edit.patches) &&
        op.edit.patches.length > 0 &&
        op.edit.patches.length <= 100,
      "InvalidCommand",
    );
    next.frameworkEdits = {
      ...state.frameworkEdits,
      [op.edit.id]: {
        ...structuredClone(op.edit),
        userId: principal.userId,
        status: "pending",
      },
    };
  } else if (op.kind === "framework-edited") {
    gm(principal);
    const edit = state.frameworkEdits?.[op.editId];
    requireThat(edit, "InvalidCommand");
    next.frameworkEdits = {
      ...state.frameworkEdits,
      [edit.id]: {
        ...edit,
        status: op.error ? "rejected" : "applied",
        ...(op.error ? { error: op.error } : {}),
      },
    };
  } else if (op.kind === "reset") {
    gm(principal);
    boundedText(op.sessionId, 128);
    boundedText(op.nominatedUserId, 128);
    requireThat(op.sessionId !== state.sessionId, "SessionIdentity");
    requireThat(
      !Object.values(state.proposals).some((p) => p.status === "delivering") &&
        !Object.values(state.temptations).some(
          (t) =>
            t.status === "rolling" ||
            t.status === "applying" ||
            (t.status === "failed" && !t.adjudicated) ||
            (t.status === "sampled" && !t.completed),
        ),
      "RecoveryRequired",
    );
    destinyLightAllocation(op.size, 1);
    if (state.sessionId)
      next.archives = {
        ...state.archives,
        [state.sessionId]: { proposals: state.proposals, spends: state.spends },
      };
    Object.assign(next, {
      sessionId: op.sessionId,
      status: "awaiting-roll",
      nominatedUserId: op.nominatedUserId,
      coins: Array.from({ length: op.size }, (_, i) => ({
        id: `coin-${i + 1}`,
        face: "dark",
      })),
      proposals: {},
      effects: {},
      spends: [],
      temptations: {},
    });
    delete next.sessionRoll;
    delete next.sessionRollClaim;
  } else if (op.kind === "claim-session-roll") {
    requireThat(
      state.status === "awaiting-roll" &&
        principal.userId === state.nominatedUserId &&
        !principal.isGM,
      "NominatedPlayerRequired",
    );
    requireThat(!state.sessionRollClaim, "RollClaimed");
    boundedText(op.claimId, 128);
    next.sessionRollClaim = op.claimId;
  } else if (op.kind === "session-roll") {
    requireThat(
      state.status === "awaiting-roll" &&
        principal.userId === state.nominatedUserId &&
        !principal.isGM,
      "NominatedPlayerRequired",
    );
    const light = destinyLightAllocation(state.coins.length, op.die);
    next.coins = state.coins.map((c, i) => ({
      id: c.id,
      face: i < light ? "light" : "dark",
    }));
    next.status = "active";
    next.sessionRoll = op.die;
  } else if (op.kind === "cleanup-delivery") {
    gm(principal);
    const archive = state.archives?.[op.sessionId];
    const p = archive?.proposals[op.proposalId];
    requireThat(
      p && ["removed", "retained", "missing"].includes(op.status),
      "DeliveryRequired",
    );
    next.archives = {
      ...state.archives,
      [op.sessionId]: {
        ...archive,
        proposals: {
          ...archive.proposals,
          [p.id]: { ...p, cleanup: op.status },
        },
      },
    };
  } else {
    requireThat(state.status === "active", "SessionRequired");
    switch (op.kind) {
      case "correct": {
        gm(principal);
        boundedText(op.reason);
        requireThat(
          op.faces.length === state.coins.length &&
            op.faces.every((f) => ["light", "dark"].includes(f)),
          "PoolSize",
        );
        requireThat(!state.coins.some((c) => c.reservationId), "ReservedCoin");
        next.coins = state.coins.map((c, i) => ({
          id: c.id,
          face: requireDestinyValue(op.faces[i]),
        }));
        break;
      }
      case "propose": {
        requireThat(!principal.isGM, "PlayerRequired");
        const p = op.proposal;
        owns(principal, p.actorId);
        boundedText(p.id, 128);
        boundedText(p.story, 4000);
        requireThat(
          typeof p.situation === "string" && p.situation.length <= 1000,
          "TextRequired",
        );
        boundedText(p.request, 1000);
        requireThat(!state.proposals[p.id], "ProposalExists");
        coin(p.coinId, "light");
        next.proposals = {
          ...state.proposals,
          [p.id]: {
            ...p,
            userId: principal.userId,
            status: "pending",
            review: "",
          },
        };
        next.coins = state.coins.map((c) =>
          c.id === p.coinId ? { ...c, reservationId: p.id } : c,
        );
        break;
      }
      case "revise":
      case "cancel":
      case "review":
      case "delivered": {
        const p = state.proposals[op.proposalId];
        requireThat(p, "ProposalMissing");
        if (op.kind === "delivered") {
          gm(principal);
          requireThat(p.status === "delivering", "ProposalState");
          if (op.itemId !== undefined) {
            requireThat(p.delivery?.kind === "equipment", "DeliveryRequired");
            boundedText(op.itemId, 128);
          }
          next.proposals = {
            ...state.proposals,
            [p.id]: {
              ...p,
              status: "approved",
              ...(op.itemId && p.delivery?.kind === "equipment"
                ? { delivery: { ...p.delivery, itemId: op.itemId } }
                : {}),
              ...(op.itemFingerprint
                ? { itemFingerprint: op.itemFingerprint }
                : {}),
            },
          };
          break;
        }
        requireThat(
          p.status === "pending" || p.status === "revision",
          "ProposalState",
        );
        if (op.kind === "review") {
          gm(principal);
          requireThat(
            typeof op.review === "string" && op.review.length <= 2000,
            "TextRequired",
          );
          if (op.decision === "approve") {
            requireThat(op.delivery, "DeliveryRequired");
            validateDestinyDelivery(op.delivery);
            flip(
              p.coinId,
              "light",
              "flashback",
              p.id,
              `flashback:${p.id}`,
              p.id,
            );
            next.proposals = {
              ...state.proposals,
              [p.id]: {
                ...p,
                status: "delivering",
                review: op.review,
                delivery: structuredClone(op.delivery),
              },
            };
          } else {
            requireThat(
              ["revision", "reject"].includes(op.decision),
              "ProposalState",
            );
            next.proposals = {
              ...state.proposals,
              [p.id]: {
                ...p,
                status: op.decision === "revision" ? "revision" : "rejected",
                review: op.review,
              },
            };
            if (op.decision === "reject")
              next.coins = next.coins.map((c) =>
                c.reservationId === p.id ? { id: c.id, face: c.face } : c,
              );
          }
        } else {
          requireThat(
            principal.isGM || p.userId === principal.userId,
            "OwnerRequired",
          );
          if (op.kind === "cancel") {
            next.proposals = {
              ...state.proposals,
              [p.id]: { ...p, status: "cancelled" },
            };
            next.coins = state.coins.map((c) =>
              c.reservationId === p.id ? { id: c.id, face: c.face } : c,
            );
          } else {
            requireThat(
              !principal.isGM && p.userId === principal.userId,
              "OwnerRequired",
            );
            if (op.actorId) owns(principal, op.actorId);
            boundedText(op.story, 4000);
            requireThat(
              typeof op.situation === "string" && op.situation.length <= 1000,
              "TextRequired",
            );
            boundedText(op.request, 1000);
            next.proposals = {
              ...state.proposals,
              [p.id]: {
                ...p,
                ...(op.actorId ? { actorId: op.actorId } : {}),
                ...(op.equipmentRequested === undefined
                  ? {}
                  : { equipmentRequested: op.equipmentRequested }),
                story: op.story,
                situation: op.situation,
                request: op.request,
                status: "pending",
              },
            };
          }
        }
        break;
      }
      case "open-effect": {
        const e = op.effect;
        owns(principal, e.actorId);
        boundedText(e.id, 128);
        boundedText(e.key, 256);
        boundedText(e.label, 160);
        requireThat(
          !state.effects[e.id] && e.userId === principal.userId,
          "EffectIdentity",
        );
        requireThat(
          ["difficulty", "incoming-hit", "talent", "complication"].includes(
            e.kind,
          ) && ["light", "dark", "either"].includes(e.side),
          "EffectIdentity",
        );
        requireThat(
          Number.isFinite(e.before) && Array.isArray(e.ladder),
          "EffectIdentity",
        );
        requireThat(
          e.lightDirection === undefined ||
            ["lower", "raise"].includes(e.lightDirection),
          "EffectIdentity",
        );
        if (e.public === true)
          requireThat(e.kind === "difficulty" && principal.isGM, "GMRequired");
        if (e.narrative !== undefined) boundedText(e.narrative);
        if (e.situation !== undefined)
          requireThat(
            typeof e.situation === "string" && e.situation.length <= 1000,
            "TextRequired",
          );
        next.effects = {
          ...state.effects,
          [e.id]: { ...structuredClone(e), after: e.before, status: "open" },
        };
        break;
      }
      case "close-effect": {
        const e = state.effects[op.effectId];
        requireThat(e, "EffectMissing");
        requireThat(
          principal.isGM || e.userId === principal.userId,
          "OwnerRequired",
        );
        next.effects = { ...state.effects, [e.id]: { ...e, status: "closed" } };
        break;
      }
      case "spend": {
        const e = state.effects[op.effectId];
        requireThat(e?.status === "open", "EffectClosed");
        const side = principal.isGM ? "dark" : "light";
        if (
          !principal.isGM &&
          !(
            e.kind === "difficulty" &&
            e.public === true &&
            e.lightDirection === "raise"
          )
        )
          owns(principal, e.actorId);
        requireThat(e.side === "either" || e.side === side, "WrongSide");
        let after = e.before;
        if (e.kind === "difficulty")
          after = destinyDifficultyShift(
            e.before,
            e.ladder,
            side,
            e.lightDirection,
          );
        if (e.kind === "incoming-hit") {
          requireThat(e.before > 0, "NoIncomingWound");
          after = e.before - 1;
        }
        flip(op.coinId, side, e.kind, e.id, e.key);
        next.effects = {
          ...state.effects,
          [e.id]: { ...e, after, spendId: command.id },
        };
        break;
      }
      case "sample": {
        const a = op.activation;
        owns(principal, a.actorId);
        boundedText(a.id, 128);
        boundedText(a.frameworkId, 128);
        boundedText(a.resourceRoleId, 128);
        boundedText(a.ownerId, 128);
        requireThat(!state.temptations[a.id], "ActivationExists");
        next.temptations = {
          ...state.temptations,
          [a.id]: {
            ...a,
            userId: principal.userId,
            sessionId: state.sessionId,
            poolRevision: state.revision,
            faces: state.coins.map((c) => c.face),
            status: "sampled",
          },
        };
        break;
      }
      case "claim-power-roll":
      case "record-power-roll":
      case "complete-power": {
        const t = state.temptations[op.activationId];
        requireThat(t, "ActivationMissing");
        requireThat(principal.userId === t.userId, "OwnerRequired");
        requireThat(!t.completed, "ActivationComplete");
        if (op.kind === "complete-power") {
          requireThat(
            (t.checks?.length ?? 0) === Object.keys(t.rollResults ?? {}).length,
            "RecoveryRequired",
          );
          next.temptations = {
            ...state.temptations,
            [t.id]: {
              ...t,
              completed: true,
              status: t.status === "sampled" ? "clear" : t.status,
            },
          };
          break;
        }
        requireThat(
          Number.isInteger(op.index) && op.index >= 0,
          "RollEvidence",
        );
        const step = t.checks?.[op.index];
        requireThat(step, "RollEvidence");
        const requests = t.rollRequests ?? {};
        const results = t.rollResults ?? {};
        if (op.kind === "claim-power-roll") {
          requireThat(!requests[op.index], "RollClaimed");
          requireThat(op.index === Object.keys(results).length, "RollEvidence");
          const context = op.request.context?.extraordinaryPower;
          requireThat(
            op.request.source.actorId === t.actorId &&
              op.request.source.itemId === step.itemId &&
              context?.frameworkId === t.frameworkId &&
              context.roleId === step.roleId &&
              context.checkIndex === op.index + 1 &&
              context.checkCount === t.checks.length,
            "RollEvidence",
          );
          next.temptations = {
            ...state.temptations,
            [t.id]: {
              ...t,
              rollRequests: {
                ...requests,
                [op.index]: structuredClone(op.request),
              },
            },
          };
        } else {
          requireThat(
            requests[op.index] &&
              !results[op.index] &&
              JSON.stringify(requests[op.index]) ===
                JSON.stringify(op.result.request),
            "RollEvidence",
          );
          const originals = op.result.wildFaceGroups?.map((g) => g[0]) ?? [
            op.result.wildFaces[0],
          ];
          const trigger =
            t.status === "sampled" &&
            t.faces.length === 3 &&
            t.faces.every((f) => f === "dark") &&
            originals.includes(1);
          next.temptations = {
            ...state.temptations,
            [t.id]: {
              ...t,
              rollResults: {
                ...results,
                [op.index]: structuredClone(op.result),
              },
              ...(trigger
                ? { originalWild: 1, status: "rolling" as const }
                : {}),
            },
          };
        }
        break;
      }
      case "claim-temptation-dice":
      case "save-temptation-dice":
      case "tempt":
      case "temptation-roll":
      case "consequence-applied":
      case "adjudicate":
      case "recover-temptation":
      case "abandon-power": {
        const t = state.temptations[op.activationId];
        requireThat(t, "ActivationMissing");
        requireThat(
          principal.isGM || t.userId === principal.userId,
          "OwnerRequired",
        );
        if (op.kind === "claim-temptation-dice") {
          gm(principal);
          requireThat(t.status === "rolling" && !t.diceClaimed, "RollClaimed");
          next.temptations = {
            ...state.temptations,
            [t.id]: { ...t, diceClaimed: true },
          };
        } else if (op.kind === "save-temptation-dice") {
          gm(principal);
          requireThat(
            t.status === "rolling" &&
              t.diceClaimed &&
              !t.diceArtifact &&
              typeof op.artifact === "string" &&
              op.artifact.length < 20000,
            "RollEvidence",
          );
          next.temptations = {
            ...state.temptations,
            [t.id]: { ...t, diceArtifact: op.artifact },
          };
        } else if (op.kind === "abandon-power") {
          gm(principal);
          boundedText(op.reason);
          requireThat(!t.completed, "ActivationComplete");
          next.temptations = {
            ...state.temptations,
            [t.id]: {
              ...t,
              completed: true,
              recovery: { userId: principal.userId, reason: op.reason },
              status: t.status === "sampled" ? "clear" : t.status,
            },
          };
        } else if (op.kind === "recover-temptation") {
          gm(principal);
          die(op.die);
          boundedText(op.reason);
          requireThat(t.status === "rolling", "TemptationClaimed");
          next.temptations = {
            ...state.temptations,
            [t.id]: {
              ...t,
              die: op.die,
              status: op.die >= 4 ? "resisted" : "applying",
              recovery: { userId: principal.userId, reason: op.reason },
            },
          };
        } else if (op.kind === "tempt") {
          die(op.originalWild);
          requireThat(t.status === "sampled", "TemptationClaimed");
          const trigger =
            t.faces.length === 3 &&
            t.faces.every((f) => f === "dark") &&
            op.originalWild === 1;
          next.temptations = {
            ...state.temptations,
            [t.id]: {
              ...t,
              originalWild: op.originalWild,
              status: trigger ? "rolling" : "sampled",
            },
          };
        } else if (op.kind === "temptation-roll") {
          gm(principal);
          die(op.die);
          requireThat(t.status === "rolling", "TemptationClaimed");
          next.temptations = {
            ...state.temptations,
            [t.id]: {
              ...t,
              die: op.die,
              status: op.die >= 4 ? "resisted" : "applying",
            },
          };
        } else if (op.kind === "consequence-applied") {
          gm(principal);
          requireThat(t.status === "applying", "TemptationClaimed");
          next.temptations = {
            ...state.temptations,
            [t.id]: { ...t, status: "failed" },
          };
        } else {
          gm(principal);
          requireThat(t.status === "failed", "TemptationClaimed");
          next.temptations = {
            ...state.temptations,
            [t.id]: { ...t, adjudicated: true },
          };
        }
        break;
      }
      default:
        requireThat(false, "InvalidCommand");
    }
  }
  next.revision = state.revision + 1;
  next.receipts = {
    ...state.receipts,
    [command.id]: { userId: principal.userId, command: identity },
  };
  return Object.freeze(next);
}

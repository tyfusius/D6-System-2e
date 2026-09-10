import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  firstEditionSegmentMovementPlan,
  resolveD6Roll,
  type D6RollMode,
} from "@d6-system-2e/core";
import {
  createFirstEditionRelativeMovement,
  advanceFirstEditionRelativeMovement,
  type FirstEditionRelativeMovement,
} from "../application/first-edition-relative-movement";
import {
  claimFirstEditionActionStage,
  recordFirstEditionActionStage,
} from "../application/first-edition-action-root";
import { registerMovementMessageVisibility } from "./first-edition-movement-visibility";
const owner = { id: "owner", active: true, isGM: false },
  gm = { id: "gm", active: true, isGM: true },
  otherGM = { id: "otherGM", active: true, isGM: true },
  outsider = { id: "outsider", active: true, isGM: false };
let root: FirstEditionRelativeMovement | undefined;
let viewer = gm;
let hooks: Map<string, (id: unknown, context: unknown) => unknown>;
let config: { ChatMessage: { documentClass: typeof NativeMessage } };
let messages: Map<string, NativeMessage>;
/** Native 14.367 author/whisper getters, as verified in
 * .agent-runtime/core-first-edition-movement/self-privacy/native-visibility-evidence.json.
 * A hidden native content render consumes isContentVisible, not whisper alone. */
class NativeMessage {
  readonly id = "root";
  author = gm;
  whisper = ["owner"];
  blind = false;
  rolls = [{}];
  content = "Movement result: total 8";
  get isAuthor() {
    return viewer === this.author;
  }
  get isRoll() {
    return this.rolls.length > 0;
  }
  get visible() {
    return this.whisper.length
      ? this.isRoll || this.isAuthor || this.whisper.includes(viewer.id)
      : true;
  }
  get isContentVisible() {
    if (this.isAuthor) {
      if (this.blind && !viewer.isGM) return false;
    } else if (this.whisper.length && !this.whisper.includes(viewer.id))
      return false;
    return this.visible;
  }
  getFlag() {
    return root;
  }
  update() {
    return Promise.resolve();
  }
  delete() {
    return Promise.resolve();
  }
  renderNativeContent() {
    return this.isContentVisible ? this.content : "???";
  }
  nativePermission() {
    return this.isAuthor;
  }
}
function setViewer(user: typeof gm) {
  viewer = user;
  Object.assign(game, { user });
}
function fixture(
  mode: D6RollMode = "selfroll",
  state: "pending" | "claimed" | "recorded" | "complete" = "recorded",
  controller = "owner",
  segmented = false,
) {
  let value = createFirstEditionRelativeMovement({
    rootMessageId: "root",
    operationId: "movement",
    coordinatorUserId: "gm",
    controllerUserId: controller,
    subject: {
      actorId: "actor",
      actorUuid: "Actor.actor",
      sceneId: "scene",
      tokenUuid: "Scene.scene.Token.token",
    },
    runtime: {
      profileId: "first-edition",
      movementStrategyId: segmented
        ? "open-d6.movement.segmented"
        : "open-d6.movement.relative",
      actionEconomyStrategyId: "economy",
    },
    combat: {
      uuid: "Combat.combat",
      combatantUuid: "Combat.combat.Combatant.c",
      revision: 2,
    },
    source: { attributeId: "agility" },
    planInput: { baseMove: 10, distance: segmented ? 3 : 15, type: "land" },
    ...(segmented
      ? {
          segment: {
            round: 1,
            actionId: "run",
            spentActionCount: 0,
            plannedActionCount: 3,
            effectiveScores: [9, 12, 12],
            reactive: false,
            plan: firstEditionSegmentMovementPlan({
              baseMove: 10,
              plannedActionCount: 3,
              effectiveScores: [9, 12, 12],
              running: true,
            }),
          },
          spend: {
            kind: "segment-movement" as const,
            actorUuid: "Actor.actor",
            combatUuid: "Combat.combat",
            combatantUuid: "Combat.combat.Combatant.c",
            expectedRevision: 2,
            actions: { value: 1, unit: "actions" as const },
            distance: { value: 3, unit: "meters" as const },
          },
        }
      : {}),
    translation: {
      kind: "token-translation",
      actorUuid: "Actor.actor",
      sceneId: "scene",
      tokenUuid: "Scene.scene.Token.token",
      from: { x: 0, y: 0, unit: "pixels" },
      to: { x: 1500, y: 0, unit: "pixels" },
      distance: { value: segmented ? 3 : 15, unit: "meters" },
      measurement: { sceneUnits: "m", gridSize: 100, gridDistance: 1 },
    },
  });
  if (state === "pending") return value;
  const stage = value.action.stages[0];
  if (!stage) throw Error("stage");
  const request = {
    contractVersion: 2 as const,
    kind: "attribute" as const,
    label: "Movement",
    score: 6,
    resultModifier: 0,
    difficulty: value.plan.difficulty,
    heroPointUse: "none" as const,
    rollMode: mode,
    source: { actorId: "actor", actorName: "Mover", attributeId: "agility" },
  };
  const runtime = {
    profileId: "first-edition",
    successEvaluator: "first-edition-meets" as const,
    wildPolicy: "first-edition" as const,
  };
  const claimed = claimFirstEditionActionStage(
    value.action,
    stage.id,
    controller,
    { kind: "d6-roll", request, runtime },
  );
  if (state === "claimed") return { ...value, action: claimed };
  const result = resolveD6Roll({
    ...runtime,
    request,
    baseFaces: [4],
    wildFaces: [4],
  });
  value = {
    ...value,
    action: recordFirstEditionActionStage(claimed, stage.id, {
      kind: "d6-roll",
      result,
      artifacts: [
        {
          version: 1,
          serialized: "saved",
          evidence: {
            faces: [4, 4],
            total: 8,
            formula: "2d6",
            fingerprint: "a".repeat(64),
          },
        },
      ],
    }),
  };
  while (state === "complete" && value.action.status === "open") {
    value = advanceFirstEditionRelativeMovement(value);
    if (value.action.status !== "open") break;
    const effect = value.action.stages.find((s) => s.state !== "recorded");
    if (effect?.spec.kind !== "effect") throw Error("effect");
    value = advanceFirstEditionRelativeMovement({
      ...value,
      action: recordFirstEditionActionStage(
        claimFirstEditionActionStage(value.action, effect.id, controller, {
          kind: "effect",
        }),
        effect.id,
        {
          kind: "effect",
          plan: effect.spec.plan,
          receiptKey: `${effect.id}:effect`,
          authorityReceiptId: "saved",
          outcome: "applied",
        },
      ),
    });
  }
  return value;
}
beforeEach(() => {
  root = fixture();
  viewer = gm;
  hooks = new Map();
  messages = new Map();
  config = { ChatMessage: { documentClass: NativeMessage } };
  vi.stubGlobal("CONFIG", config);
  vi.stubGlobal("game", {
    user: viewer,
    users: {
      get: (id: string) =>
        [owner, gm, otherGM, outsider].find((u) => u.id === id),
    },
    messages,
  });
  vi.stubGlobal("Hooks", {
    on: (name: string, handler: (id: unknown, context: unknown) => unknown) => {
      hooks.set(name, handler);
    },
  });
});
afterEach(() => vi.unstubAllGlobals());
describe("native Movement Self Roll visibility", () => {
  it("reproduces the native author exception and filters only the full content", () => {
    const native = new NativeMessage();
    expect(native.isContentVisible).toBe(true);
    registerMovementMessageVisibility();
    const message = new config.ChatMessage.documentClass();
    expect(message.visible).toBe(true);
    expect(message.isAuthor).toBe(true);
    expect(message.nativePermission()).toBe(true);
    expect(message.isContentVisible).toBe(false);
    expect(message.renderNativeContent()).toBe("???");
    setViewer(owner);
    expect(message.renderNativeContent()).toBe("Movement result: total 8");
    expect(message.whisper).toEqual(["owner"]);
    expect(message.author).toBe(gm);
  });
  it.each(["claimed", "recorded", "complete"] as const)(
    "guards %s self evidence before render, including historical reload",
    (state) => {
      root = structuredClone(fixture("selfroll", state));
      registerMovementMessageVisibility();
      const message = new config.ChatMessage.documentClass();
      if (state === "claimed") message.rolls = [];
      expect(message.isContentVisible).toBe(false);
      setViewer(owner);
      expect(message.isContentVisible).toBe(true);
    },
  );
  it.each([gm, otherGM, outsider])(
    "suppresses DSN even if ghost settings would allow viewer $id",
    (user) => {
      registerMovementMessageVisibility();
      const message = new config.ChatMessage.documentClass();
      messages.set(message.id, message);
      setViewer(user);
      const context = { willTrigger3DRoll: true };
      hooks.get("diceSoNiceMessagePreProcess")?.(message.id, context);
      expect(context.willTrigger3DRoll).toBe(false);
      setViewer(owner);
      const ownerContext = { willTrigger3DRoll: true };
      hooks.get("diceSoNiceMessagePreProcess")?.(message.id, ownerContext);
      expect(ownerContext.willTrigger3DRoll).toBe(true);
    },
  );
  it.each(["publicroll", "gmroll", "blindroll"] as const)(
    "delegates %s content and DSN decisions to native behavior",
    (mode) => {
      root = fixture(mode);
      registerMovementMessageVisibility();
      const message = new config.ChatMessage.documentClass();
      message.whisper =
        mode === "publicroll"
          ? []
          : mode === "gmroll"
            ? ["owner", "gm"]
            : ["gm"];
      message.blind = mode === "blindroll";
      messages.set(message.id, message);
      for (const user of [owner, gm, otherGM]) {
        setViewer(user);
        const native = new NativeMessage();
        native.whisper = message.whisper;
        native.blind = message.blind;
        expect(message.isContentVisible).toBe(native.isContentVisible);
        const context = { willTrigger3DRoll: native.isContentVisible };
        hooks.get("diceSoNiceMessagePreProcess")?.(message.id, context);
        expect(context.willTrigger3DRoll).toBe(native.isContentVisible);
      }
    },
  );
  it("preserves a same-author GM Self Roll and a pending root with no self claim", () => {
    registerMovementMessageVisibility();
    const message = new config.ChatMessage.documentClass();
    root = fixture("selfroll", "recorded", "gm");
    message.whisper = ["gm"];
    expect(message.isContentVisible).toBe(true);
    root = fixture("selfroll", "pending");
    message.whisper = ["owner", "gm"];
    expect(message.isContentVisible).toBe(true);
  });
  it("delegates legacy messages, invalid roots and mismatched provenance", () => {
    registerMovementMessageVisibility();
    const message = new config.ChatMessage.documentClass();
    root = undefined;
    expect(message.isContentVisible).toBe(true);
    root = fixture();
    root = {
      ...root,
      action: { ...root.action, coordinatorUserId: "otherGM" },
    };
    expect(message.isContentVisible).toBe(true);
    root = fixture();
    root = { ...root, version: 2 } as unknown as FirstEditionRelativeMovement;
    expect(message.isContentVisible).toBe(true);
    root = fixture();
    message.author = owner;
    setViewer(owner);
    message.whisper = ["gm"];
    expect(message.isContentVisible).toBe(true);
  });
  it("wraps the configured custom class idempotently without broadening its visibility", () => {
    class CustomMessage extends NativeMessage {
      custom = true;
      override get isContentVisible() {
        return false;
      }
    }
    config.ChatMessage.documentClass = CustomMessage;
    registerMovementMessageVisibility();
    const Wrapped = config.ChatMessage.documentClass;
    registerMovementMessageVisibility();
    expect(config.ChatMessage.documentClass).toBe(Wrapped);
    expect(hooks.size).toBe(1);
    setViewer(owner);
    const message = new Wrapped();
    expect(message).toBeInstanceOf(CustomMessage);
    expect(message.isContentVisible).toBe(false);
    expect(message.nativePermission()).toBe(false);
    expect(message.author).toBe(gm);
  });
});

it.each(["claimed", "recorded", "complete"] as const)(
  "guards V2 Running %s content and ghost DSN for the excluded author",
  (state) => {
    root = structuredClone(fixture("selfroll", state, "owner", true));
    registerMovementMessageVisibility();
    const message = new config.ChatMessage.documentClass();
    messages.set(message.id, message);
    expect(message.isContentVisible).toBe(false);
    expect(message.isAuthor).toBe(true);
    expect(message.nativePermission()).toBe(true);
    const context = { willTrigger3DRoll: true };
    hooks.get("diceSoNiceMessagePreProcess")?.(message.id, context);
    expect(context.willTrigger3DRoll).toBe(false);
    setViewer(owner);
    expect(message.isContentVisible).toBe(true);
  },
);
it.each(["publicroll", "gmroll", "blindroll"] as const)(
  "keeps native V2 Running %s role visibility",
  (mode) => {
    root = fixture(mode, "recorded", "owner", true);
    registerMovementMessageVisibility();
    const message = new config.ChatMessage.documentClass();
    message.whisper =
      mode === "publicroll" ? [] : mode === "gmroll" ? ["owner", "gm"] : ["gm"];
    message.blind = mode === "blindroll";
    for (const user of [owner, gm, otherGM, outsider]) {
      setViewer(user);
      const native = new NativeMessage();
      native.whisper = message.whisper;
      native.blind = message.blind;
      expect(message.isContentVisible).toBe(native.isContentVisible);
    }
  },
);

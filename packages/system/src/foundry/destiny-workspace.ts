import { requireDestinyValue } from "@d6-system-2e/core";
import {
  exportDestinyRecoveryKey,
  importDestinyRecoveryKey,
} from "./destiny-crypto";
import {
  initialDestinyState,
  destinyDifficultyShift,
  type D6DestinyDeliveryV1,
  type D6DestinyEffectV1,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { applicationV2FormOptions } from "./application-v2-form-options";
import {
  destinyConfiguration,
  destinyPrivateView,
  destinyPublicState,
  previewDestinyDelivery,
  refreshDestinyView,
  requestDestiny,
  rollDestinySession,
} from "./destiny-service";
import { newDestinyItemId } from "./destiny-equipment";
import { foundryRandomId } from "./foundry-random-id";

export const destinyText = (key: string): string =>
  game.i18n.localize(`D6E2.Destiny.${key}`);
export function destinyLabels(): Record<string, string> {
  return Object.fromEntries(
    [
      "pool",
      "destiny",
      "openPool",
      "managePool",
      "movePool",
      "awaitingSession",
      "navigation",
      "use",
      "pending",
      "history",
      "reviseProposal",
      "flashback",
      "flashbackHelp",
      "actingCharacter",
      "preparationStory",
      "required",
      "storyPlaceholder",
      "currentSituation",
      "proposedBenefit",
      "requestEquipment",
      "equipmentRequestHelp",
      "reservationHelp",
      "resubmit",
      "requestApproval",
      "withdraw",
      "equipmentRequested",
      "revise",
      "review",
      "noPending",
      "noPendingHelp",
      "gmReview",
      "reviewHelp",
      "delivery",
      "fictionOnly",
      "existingEquipment",
      "customGear",
      "equipmentDelivery",
      "recipient",
      "gearName",
      "capability",
      "quantity",
      "charges",
      "permanence",
      "temporary",
      "permanent",
      "reviewNote",
      "previewApproval",
      "approvalSummary",
      "approvalCost",
      "approveAndSpend",
      "requestRevision",
      "reject",
      "eligibleEffect",
      "before",
      "after",
      "confirmSpend",
      "noHistory",
      "noHistoryHelp",
      "gmControls",
      "session",
      "sessionHelp",
      "poolSize",
      "nominatedPlayer",
      "nominate",
      "rollSession",
      "newSession",
      "correctPool",
      "correctionHelp",
      "light",
      "dark",
      "correctionReason",
      "reviewCorrection",
      "back",
      "close",
      "complicationTitle",
      "complicationHelp",
      "complicationStory",
      "complicationCost",
      "commitComplication",
      "keyRecoveryTitle",
      "exportRecoveryKey",
      "importRecoveryKey",
      "keyRecoveryHelp",
    ].map((k) => [k, destinyText(k)]),
  );
}
export function destinySummary(): string {
  const s = destinyPublicState();
  return `${s.coins.filter((c) => c.face === "light").length} ${destinyText("light")} · ${s.coins.filter((c) => c.face === "dark").length} ${destinyText("dark")}`;
}
const Base = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
);
type View =
  | "use"
  | "pending"
  | "history"
  | "session"
  | "correction"
  | "proposal"
  | "effect"
  | "complication";
type Draft = Record<string, string | boolean>;
const escape = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
export async function confirmDestiny(
  title: string,
  detail: string,
): Promise<boolean> {
  return (
    (await foundry.applications.api.DialogV2.wait<boolean>({
      classes: ["d6e2", "od6roll-dialog"],
      window: { title },
      content: `<p>${escape(detail)}</p>`,
      modal: true,
      rejectClose: false,
      buttons: [
        { action: "cancel", label: destinyText("back"), callback: () => false },
        {
          action: "confirm",
          label: destinyText("Confirm"),
          callback: () => true,
        },
      ],
    })) === true
  );
}

export class D6DestinyWorkspace extends Base {
  static override DEFAULT_OPTIONS = {
    id: "d6-destiny-workspace",
    tag: "form",
    classes: ["d6e2", "d6-destiny-workspace"],
    position: { width: 560, height: 640 },
    window: { title: "D6E2.Destiny.destiny", resizable: true },
    form: applicationV2FormOptions({
      handler: () => Promise.resolve(),
      submitOnChange: false,
      closeOnSubmit: false,
    }),
  };
  static override PARTS = {
    content: {
      template: `systems/${SYSTEM_ID}/templates/destiny/workspace.hbs`,
    },
  };
  #view: View = "use";
  #coinId = "";
  #requestId = "";
  #use = "difficulty";
  #busy = false;
  #error = "";
  #notice = "";
  #drafts = new Map<string, Draft>();
  #preview: D6DestinyDeliveryV1 | undefined;
  #previewIdentity = "";
  #previewFor = "";
  #focus = "";
  #focusAction = "";
  #focusRequest = "";
  #selection: { start: number | null; end: number | null } | undefined;
  #renderedScope = "";
  #opener: HTMLElement | undefined;
  #openerSelector = "";
  #navigation = 0;
  #catalogLoading:
    Promise<readonly { value: string; label: string }[]> | undefined;
  #catalog: readonly { value: string; label: string }[] | undefined;
  #scope(): string {
    return `${this.#view}:${this.#requestId}`;
  }
  #draft(): Draft {
    const key = this.#scope();
    let value = this.#drafts.get(key);
    if (!value) {
      value = {};
      this.#drafts.set(key, value);
    }
    return value;
  }
  #value(key: string, fallback = ""): string {
    const value = this.#draft()[key];
    return typeof value === "string" ? value : fallback;
  }
  #capture(): void {
    if (!this.rendered) return;
    const captured = this.#drafts.get(this.#renderedScope) ?? {};
    this.#drafts.set(this.#renderedScope, captured);
    for (const field of Array.from(
      this.element.querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >("input[name],select[name],textarea[name]"),
    ))
      captured[field.name] =
        field instanceof HTMLInputElement && field.type === "checkbox"
          ? field.checked
          : field.value;
    const active = document.activeElement;
    this.#focus = "";
    this.#focusAction = "";
    this.#focusRequest = "";
    this.#selection = undefined;
    if (active instanceof HTMLElement && this.element.contains(active)) {
      this.#focus = active.getAttribute("name") ?? "";
      this.#focusAction = active.dataset.action ?? "";
      this.#focusRequest =
        active.closest<HTMLElement>("[data-request-id]")?.dataset.requestId ??
        "";
      this.#selection =
        active instanceof HTMLTextAreaElement ||
        (active instanceof HTMLInputElement &&
          ["text", "search"].includes(active.type))
          ? { start: active.selectionStart, end: active.selectionEnd }
          : undefined;
    }
  }
  async open(view: View = "use", coinId = "", requestId = ""): Promise<void> {
    if (this.#busy) return;
    const generation = ++this.#navigation;
    if (!this.rendered && document.activeElement instanceof HTMLElement) {
      this.#opener = document.activeElement;
      const control = this.#opener.closest<HTMLElement>(
        "#d6-destiny-dock button[data-action]",
      );
      this.#openerSelector = control
        ? `#d6-destiny-dock button[data-action="${CSS.escape(control.dataset.action ?? "")}"]${control.dataset.coinId ? `[data-coin-id="${CSS.escape(control.dataset.coinId)}"]` : ""}`
        : "";
    }
    this.#capture();
    this.#view = view;
    this.#coinId = coinId;
    this.#requestId = requestId;
    this.#error = "";
    try {
      await refreshDestinyView();
    } catch (error) {
      if (generation === this.#navigation)
        this.#error = game.i18n.localize(
          error instanceof Error ? error.message : "D6E2.Destiny.Error.Failed",
        );
    }
    if (generation === this.#navigation) this.render(true);
  }
  refresh(): void {
    if (this.rendered) {
      this.#capture();
      this.render();
    }
  }
  #eligible(): D6DestinyEffectV1[] {
    const side = game.user?.isGM ? "dark" : "light";
    return Object.values(destinyPrivateView()?.effects ?? {}).filter(
      (e) =>
        e.status === "open" &&
        !e.spendId &&
        (e.side === side || e.side === "either") &&
        e.kind === (this.#use === "wound" ? "incoming-hit" : this.#use),
    );
  }
  async #items(): Promise<readonly { value: string; label: string }[]> {
    if (this.#catalog) return this.#catalog;
    if (this.#catalogLoading) return this.#catalogLoading;
    this.#catalogLoading = (async () => {
      const items = (game.items?.contents ?? [])
        .filter((i) => ["gear", "weapon", "armor"].includes(i.type))
        .map((i) => ({ value: `Item.${i.id}`, label: i.name }));
      for (const pack of game.packs?.contents ?? []) {
        if (pack.documentName !== "Item") continue;
        const indexed = pack as unknown as {
          getIndex?: (options: { fields: string[] }) => Promise<{
            contents: readonly { _id: string; name: string; type: string }[];
          }>;
        };
        const index = await indexed.getIndex?.({ fields: ["type"] });
        for (const i of index?.contents ?? [])
          if (["gear", "weapon", "armor"].includes(i.type))
            items.push({
              value: `Compendium.${pack.collection}.Item.${i._id}`,
              label: `${i.name} · ${pack.metadata.label ?? ""}`,
            });
      }
      this.#catalog = items;
      return items;
    })()
      .catch((error: unknown) => {
        this.#catalog = [];
        throw error;
      })
      .finally(() => {
        this.#catalogLoading = undefined;
      });
    return this.#catalogLoading;
  }
  override _prepareContext(): Promise<Record<string, unknown>> {
    this.#capture();
    const state = destinyPrivateView();
    const shared = destinyPublicState();
    const gm = game.user?.isGM === true;
    const labels = destinyLabels();
    const draft = this.#draft();
    const own = (game.actors?.contents ?? []).filter(
      (a) =>
        gm || a.testUserPermission(requireDestinyValue(game.user), "OWNER"),
    );
    const actorId = this.#value(
      "actorId",
      state?.proposals[this.#requestId]?.actorId ?? own[0]?.id ?? "",
    );
    const options = own.map((a) => ({
      value: a.id,
      label: a.name,
      selected: a.id === actorId,
    }));
    const side = gm ? "dark" : "light";
    const coin =
      shared.coins.find((c) => c.id === this.#coinId) ??
      shared.coins.find((c) => c.face === side && !c.reservationId);
    if (coin) this.#coinId = coin.id;
    const usable =
      shared.status === "active" &&
      coin?.face === side &&
      !coin.reservationId &&
      !this.#busy;
    const proposals = Object.values(state?.proposals ?? {});
    const selected = state?.proposals[this.#requestId];
    const pending = proposals.filter(
      (p) =>
        p.status === "pending" ||
        p.status === "revision" ||
        p.status === "delivering",
    );
    const effects = this.#eligible();
    const effectId = this.#value("effectId", effects[0]?.id ?? "");
    const e = effects.find((e) => e.id === effectId);
    let after = e?.before;
    let reason = "";
    if (e?.kind === "difficulty")
      try {
        after = destinyDifficultyShift(
          e.before,
          e.ladder,
          side,
          e.lightDirection,
        );
      } catch (error) {
        reason = game.i18n.localize(
          error instanceof Error ? error.message : "D6E2.Destiny.Error.Failed",
        );
      }
    else if (e?.kind === "incoming-hit") after = e.before - 1;
    const mode = this.#value("deliveryMode", "fiction");
    const deliveryActorId = this.#value(
      "deliveryActorId",
      selected?.actorId ?? own[0]?.id ?? "",
    );
    const items =
      gm && this.#view === "pending" && mode === "catalog"
        ? (this.#catalog ?? [])
        : [];
    const story = this.#value("story", selected?.story ?? "");
    const situation = this.#value("situation", selected?.situation ?? "");
    const benefit = this.#value("benefit", selected?.request ?? "");
    const history = [
      ...Object.values(state?.archives ?? {}).flatMap((a) => a.spends),
      ...(state?.spends ?? []),
    ].map((s) => ({
      label: destinyText(s.kind === "incoming-hit" ? "wound" : s.kind),
      actorName: "",
      sideLabel: destinyText(s.side),
      timeLabel: "",
      detail: destinyText(s.side === "light" ? "LightSpend" : "DarkSpend"),
    }));
    const quantity = this.#value("deliveryQuantity", "1"),
      charges = this.#value("deliveryCharges", "0"),
      permanence = this.#value("deliveryPermanence", "temporary");
    return Promise.resolve({
      draftScope: this.#scope(),
      labels,
      title: destinyText(this.#view === "use" ? "destiny" : this.#view),
      subtitle: "",
      summary: destinySummary(),
      busy:
        this.#busy ||
        (gm &&
          this.#view === "pending" &&
          mode === "catalog" &&
          !this.#catalog),
      error: this.#error,
      notice: this.#notice,
      canManage: gm,
      announcement: "",
      canBack: this.#view !== "use",
      footerHint: destinyText("footerHelp"),
      pendingCount: pending.length,
      lightImage: `systems/${SYSTEM_ID}/assets/ui/destiny-light.svg`,
      darkImage: `systems/${SYSTEM_ID}/assets/ui/destiny-dark.svg`,
      isUseView: ["use", "proposal", "effect", "complication"].includes(
        this.#view,
      ),
      isPendingView: this.#view === "pending",
      isHistoryView: this.#view === "history",
      showChoices: this.#view === "use",
      showProposal: this.#view === "proposal",
      showComplication: this.#view === "complication",
      showRequest: this.#view === "pending",
      showEffect: this.#view === "effect",
      showHistory: this.#view === "history",
      showSession: this.#view === "session",
      showCorrection: this.#view === "correction",
      selectedCoinSide: side,
      coinLabel: destinyText(side),
      coinHelp: destinyText(side === "light" ? "LightSpend" : "DarkSpend"),
      choices: [
        ...(gm ? ["complication"] : ["flashback"]),
        "difficulty",
        "wound",
        "talent",
      ].map((kind) => {
        const typed = !["flashback", "complication"].includes(kind);
        const available = Boolean(
          usable &&
          own.length &&
          (!typed ||
            Object.values(state?.effects ?? {}).some(
              (e) =>
                e.status === "open" &&
                !e.spendId &&
                e.kind === (kind === "wound" ? "incoming-hit" : kind) &&
                (e.side === "either" || e.side === side),
            )),
        );
        return {
          kind,
          label: destinyText(kind),
          description: destinyText(`${kind}Help`),
          available,
          reason: available ? "" : destinyText("NoEligibleContext"),
          icon:
            kind === "flashback"
              ? "fa-clock-rotate-left"
              : kind === "wound"
                ? "fa-shield-heart"
                : "fa-circle-half-stroke",
        };
      }),
      actors: options,
      complication: {
        actorId,
        situation,
        story,
        canCommit: Boolean(usable && gm && actorId && story.trim()),
      },
      proposal: {
        actorId,
        story,
        situation,
        benefit,
        equipmentRequested:
          draft.equipmentRequested === undefined
            ? selected?.equipmentRequested === true
            : draft.equipmentRequested === true,
        revisionNote: selected?.review ?? "",
        isRevision: selected?.status === "revision",
        canSubmit:
          Boolean(usable && actorId && story.trim() && benefit.trim()) ||
          selected?.status === "revision",
      },
      requests: proposals.map((p) => ({
        id: p.id,
        actorName:
          game.actors?.get(p.actorId)?.name ?? destinyText("MissingActor"),
        requesterName: game.users?.get(p.userId)?.name ?? "",
        statusLabel: destinyText(`Status.${p.status}`),
        story: p.story,
        situation: p.situation,
        benefit: p.request,
        equipmentRequested: p.equipmentRequested,
        reviewNote: p.review,
        canRevise: !gm && p.userId === game.user?.id && p.status === "revision",
        canCancel: ["pending", "revision"].includes(p.status),
        canReview: gm && ["pending", "revision"].includes(p.status),
        working: p.status === "delivering",
        selected: p.id === this.#requestId,
      })),
      ...(gm && selected
        ? {
            review: {
              requestId: selected.id,
              canApprove: Boolean(
                this.#preview &&
                this.#previewFor === selected.id &&
                this.#previewIdentity === JSON.stringify(draft) &&
                !this.#busy,
              ),
              deliveryMode: mode,
              fictionSelected: mode === "fiction",
              catalogSelected: mode === "catalog",
              customSelected: mode === "custom",
              actorId: deliveryActorId,
              itemUuid: this.#value("deliveryItemUuid", items[0]?.value ?? ""),
              name: this.#value("deliveryName"),
              description: this.#value("deliveryDescription"),
              quantity,
              charges,
              permanence,
              temporarySelected: permanence === "temporary",
              permanentSelected: permanence === "permanent",
              comment: this.#value("reviewComment"),
              preview: this.#preview
                ? this.#preview.kind === "fact"
                  ? this.#preview.fact
                  : `${game.actors?.get(this.#preview.actorId)?.name ?? destinyText("MissingActor")} · ${this.#preview.name} · ${this.#preview.quantity} × ${this.#preview.charges} ${destinyText("charges")} · ${destinyText(this.#preview.permanence === "session" ? "temporary" : "permanent")}`
                : "",
              issue: destinyText("ChargeScopeHelp"),
            },
          }
        : {}),
      deliveryActors: own.map((a) => ({
        value: a.id,
        label: a.name,
        selected: a.id === deliveryActorId,
      })),
      deliveryItems: items.map((i) => ({
        ...i,
        selected:
          i.value === this.#value("deliveryItemUuid", items[0]?.value ?? ""),
      })),
      showDeliveryItem: mode === "catalog",
      showCustomDelivery: mode === "custom",
      showDeliveryDetails: mode !== "fiction",
      effectTitle: destinyText(this.#use),
      effectHelp: destinyText(`${this.#use}Help`),
      effects: effects.map((e) => ({
        value: e.id,
        label: e.label,
        selected: e.id === effectId,
      })),
      effect: {
        selectedId: effectId,
        summary: e?.label ?? "",
        before: e?.before ?? "",
        after: after ?? "",
        reason,
        canCommit: Boolean(usable && e && !reason),
      },
      history,
      security: {
        status: destinyText("SecurityStatus"),
        help: "",
        canExport: gm,
        canImport: gm,
      },
      session: {
        statusLabel: destinyText(`Session.${shared.status}`),
        help: labels.sessionHelp,
        canNominate: gm,
        canRoll:
          shared.status === "awaiting-roll" &&
          shared.nominatedUserId === game.user?.id &&
          !state?.sessionRollClaim,
        canReset: gm,
      },
      players: (game.users?.contents ?? [])
        .filter((u) => !u.isGM)
        .map((u) => ({
          value: u.id,
          label: u.name,
          selected:
            u.id === this.#value("nominatedPlayerId", shared.nominatedUserId),
        })),
      poolSizes: [
        {
          value: destinyConfiguration().size,
          label: `${destinyConfiguration().size} · ${destinyText("ConfiguredPoolSize")}`,
          selected: true,
        },
      ],
      correctionCoins: shared.coins.map((c) => ({
        id: c.id,
        label: destinyText("coin"),
        lightSelected: this.#value(`correction.${c.id}`, c.face) === "light",
        darkSelected: this.#value(`correction.${c.id}`, c.face) === "dark",
      })),
      correctionReason: this.#value("correctionReason"),
    });
  }
  override async _onRender(
    context: Record<string, unknown>,
    options: { readonly parts: readonly string[] },
  ): Promise<void> {
    await super._onRender(context, options);
    this.#renderedScope =
      typeof context.draftScope === "string"
        ? context.draftScope
        : this.#scope();
    this.element.style.maxHeight = "calc(100vh - 24px)";
    this.element.style.maxWidth = "calc(100vw - 24px)";
    this.element.removeEventListener("click", this.#click);
    this.element.addEventListener("click", this.#click);
    this.element.removeEventListener("input", this.#input);
    this.element.addEventListener("input", this.#input);
    this.element.removeEventListener("change", this.#change);
    this.element.addEventListener("change", this.#change);
    const target = this.#focus
      ? this.element.querySelector<HTMLElement>(
          `[name="${CSS.escape(this.#focus)}"]`,
        )
      : Array.from(
          this.element.querySelectorAll<HTMLElement>("button[data-action]"),
        ).find(
          (e) =>
            e.dataset.action === this.#focusAction &&
            (e.closest<HTMLElement>("[data-request-id]")?.dataset.requestId ??
              "") === this.#focusRequest,
        );
    const active = document.activeElement;
    const ownsFocus =
      !active || active === document.body || this.element.contains(active);
    if (ownsFocus) target?.focus();
    if (
      game.user?.isGM &&
      this.#view === "pending" &&
      this.#value("deliveryMode") === "catalog" &&
      !this.#catalog
    ) {
      const generation = this.#navigation;
      const scope = this.#scope();
      void this.#items()
        .catch((error: unknown) => {
          if (generation === this.#navigation)
            this.#error = game.i18n.localize(
              error instanceof Error
                ? error.message
                : "D6E2.Destiny.Error.InvalidEquipment",
            );
        })
        .finally(() => {
          if (
            this.rendered &&
            generation === this.#navigation &&
            scope === this.#scope()
          )
            this.refresh();
        });
    }
    if (
      ownsFocus &&
      this.#selection &&
      (target instanceof HTMLTextAreaElement ||
        target instanceof HTMLInputElement)
    )
      target.setSelectionRange(this.#selection.start, this.#selection.end);
  }
  override async close(): Promise<void> {
    this.#navigation++;
    const restore =
      this.rendered && this.element.contains(document.activeElement);
    await super.close();
    if (restore)
      (this.#opener?.isConnected
        ? this.#opener
        : this.#openerSelector
          ? document.querySelector<HTMLElement>(this.#openerSelector)
          : null
      )?.focus();
  }
  #input = () => {
    this.#capture();
    this.#preview = undefined;
    const proposal = this.element.querySelector<HTMLButtonElement>(
      '[data-action="submitDestinyProposal"]',
    );
    if (proposal)
      proposal.disabled =
        this.#busy ||
        !this.#value("story").trim() ||
        !this.#value("benefit").trim() ||
        !this.#value("actorId");
    const complication = this.element.querySelector<HTMLButtonElement>(
      '[data-action="commitDestinyComplication"]',
    );
    if (complication)
      complication.disabled =
        this.#busy || !this.#value("story").trim() || !this.#value("actorId");
    const approve = this.element.querySelector<HTMLButtonElement>(
      '[data-action="approveDestinyProposal"]',
    );
    if (approve) approve.disabled = true;
  };
  #change = (event: Event) => {
    this.#input();
    if (
      (event.target as HTMLElement).matches(
        'select[name="deliveryMode"],select[name="effectId"]',
      )
    )
      this.render();
  };
  #click = (event: Event) => {
    const control = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "button[data-action]",
    );
    if (
      !control ||
      control.getAttribute("aria-disabled") === "true" ||
      control.disabled
    )
      return;
    const action = control.dataset.action;
    if (this.#busy && action !== "closeDestiny" && action !== "backDestiny")
      return;
    event.preventDefault();
    this.#capture();
    void this.#action(control).catch((error: unknown) => {
      this.#error = game.i18n.localize(
        error instanceof Error ? error.message : "D6E2.Destiny.Error.Failed",
      );
      if (this.rendered) this.render();
    });
  };
  async #action(control: HTMLElement): Promise<void> {
    const action = control.dataset.action;
    const requestId =
      control.closest<HTMLElement>("[data-request-id]")?.dataset.requestId ??
      this.#requestId;
    this.#error = "";
    if (action === "closeDestiny") {
      await this.close();
      return;
    }
    if (action === "backDestiny") {
      this.#navigation++;
      this.#view = "use";
      this.#coinId = "";
      this.render();
      return;
    }
    if (action === "openDestinyView") {
      await this.open(control.dataset.view as View);
      return;
    }
    if (action === "chooseDestinyUse") {
      this.#use = control.dataset.use ?? "difficulty";
      this.#view =
        this.#use === "flashback"
          ? "proposal"
          : this.#use === "complication"
            ? "complication"
            : "effect";
      this.#requestId = "";
      this.render();
      return;
    }
    if (
      action === "reviewDestinyProposal" ||
      action === "reviseDestinyProposal"
    ) {
      this.#requestId = requestId;
      this.#view = action === "reviewDestinyProposal" ? "pending" : "proposal";
      this.#preview = undefined;
      this.render();
      return;
    }
    if (
      action === "previewDestinyEffect" ||
      action === "refreshDestinyDelivery"
    ) {
      this.render();
      return;
    }
    const draft = structuredClone(this.#draft());
    const view = this.#view;
    const coinId = this.#coinId;
    const value = (key: string, fallback = "") =>
      typeof draft[key] === "string" ? draft[key] : fallback;
    const navigate = (target: View) => {
      if (this.#view === view) this.#view = target;
    };
    this.#busy = true;
    this.render();
    try {
      const state = ["exportDestinyKey", "importDestinyKey"].includes(
        action ?? "",
      )
        ? (destinyPrivateView() ?? initialDestinyState())
        : await refreshDestinyView();
      const p = state.proposals[requestId];
      if (action === "exportDestinyKey" || action === "importDestinyKey") {
        const importing = action === "importDestinyKey";
        const entry = await foundry.applications.api.DialogV2.wait<{
          passphrase: string;
          file?: File;
        } | null>({
          classes: ["d6e2", "od6roll-dialog"],
          window: {
            title: destinyText(
              importing ? "importRecoveryKey" : "exportRecoveryKey",
            ),
          },
          modal: true,
          rejectClose: false,
          content: `<p>${escape(destinyText("BackupHelp"))}</p><label>${escape(destinyText("BackupPassphrase"))}<input name="passphrase" type="password" minlength="12" autocomplete="new-password" required></label>${importing ? '<input type="file" name="recoveryFile" accept="application/json,.json" required>' : ""}`,
          buttons: [
            {
              action: "cancel",
              label: destinyText("back"),
              callback: () => null,
            },
            {
              action: "confirm",
              label: destinyText(
                importing ? "importRecoveryKey" : "exportRecoveryKey",
              ),
              callback: (_e, b) => {
                const pass = b.form?.elements.namedItem("passphrase");
                const file = b.form?.elements.namedItem("recoveryFile");
                return pass instanceof HTMLInputElement
                  ? {
                      passphrase: pass.value,
                      ...(file instanceof HTMLInputElement && file.files?.[0]
                        ? { file: file.files[0] }
                        : {}),
                    }
                  : null;
              },
            },
          ],
        });
        if (entry) {
          if (importing) {
            if (!entry.file)
              throw new Error("D6E2.Destiny.Error.BackupInvalid");
            await importDestinyRecoveryKey(
              await entry.file.text(),
              entry.passphrase,
            );
            await refreshDestinyView();
          } else {
            const encrypted = await exportDestinyRecoveryKey(entry.passphrase);
            const url = URL.createObjectURL(
              new Blob([encrypted], { type: "application/json" }),
            );
            const link = document.createElement("a");
            link.href = url;
            link.download = "destiny-recovery-key.json";
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }
        }
      } else if (action === "submitDestinyProposal") {
        const story = value("story", p?.story ?? ""),
          situation = value("situation", p?.situation ?? ""),
          request = value("benefit", p?.request ?? "");
        if (p?.status === "revision")
          await requestDestiny({
            kind: "revise",
            proposalId: p.id,
            story,
            situation,
            request,
            actorId: value("actorId", p.actorId),
            equipmentRequested: draft.equipmentRequested === true,
          });
        else
          await requestDestiny({
            kind: "propose",
            proposal: {
              id: foundryRandomId(),
              actorId: value("actorId"),
              coinId,
              story,
              situation,
              request,
              equipmentRequested: draft.equipmentRequested === true,
            },
          });
        navigate("pending");
        this.#notice = destinyText("ProposalSubmitted");
      } else if (action === "cancelDestinyProposal") {
        if (p) await requestDestiny({ kind: "cancel", proposalId: p.id });
      } else if (
        action === "requestDestinyRevision" ||
        action === "rejectDestinyProposal"
      ) {
        if (p)
          await requestDestiny({
            kind: "review",
            proposalId: p.id,
            decision:
              action === "requestDestinyRevision" ? "revision" : "reject",
            review: value("reviewComment"),
          });
      } else if (action === "previewDestinyDelivery") {
        if (!game.user?.isGM || !p)
          throw new Error("D6E2.Destiny.Error.GMRequired");
        const mode = value("deliveryMode", "fiction");
        let delivery: D6DestinyDeliveryV1;
        if (mode === "fiction")
          delivery = {
            kind: "fact",
            fact: value("reviewComment", p.request) || p.request,
          };
        else {
          const uuid = value("deliveryItemUuid");
          const item =
            mode === "catalog"
              ? ((await fromUuid(uuid)) as FoundryItemDocument | null)
              : null;
          if (
            mode === "catalog" &&
            !(await this.#items()).some((i) => i.value === uuid)
          )
            throw new Error("D6E2.Destiny.Error.InvalidEquipment");
          delivery = {
            kind: "equipment",
            actorId: value("deliveryActorId", p.actorId),
            itemId: newDestinyItemId(),
            ...(mode === "catalog" ? { sourceUuid: uuid } : {}),
            name:
              mode === "catalog" ? (item?.name ?? "") : value("deliveryName"),
            description: value("deliveryDescription"),
            quantity: Number(value("deliveryQuantity", "1")),
            charges: Number(value("deliveryCharges", "0")),
            permanence:
              value("deliveryPermanence", "temporary") === "permanent"
                ? "permanent"
                : "session",
          };
        }
        this.#preview = await previewDestinyDelivery(delivery);
        this.#previewIdentity = JSON.stringify(draft);
        this.#previewFor = p.id;
      } else if (action === "approveDestinyProposal") {
        if (
          !p ||
          !this.#preview ||
          this.#previewFor !== p.id ||
          this.#previewIdentity !== JSON.stringify(draft)
        )
          throw new Error("D6E2.Destiny.Error.DeliveryPreviewRequired");
        await requestDestiny({
          kind: "review",
          proposalId: p.id,
          decision: "approve",
          review: value("reviewComment"),
          delivery: this.#preview,
        });
        this.#preview = undefined;
      } else if (action === "commitDestinyEffect") {
        const id = value("effectId", this.#eligible()[0]?.id ?? "");
        await requestDestiny({ kind: "spend", effectId: id, coinId });
        navigate("history");
      } else if (action === "commitDestinyComplication") {
        const id = foundryRandomId();
        await requestDestiny({
          kind: "open-effect",
          effect: {
            id,
            key: `fiction:${id}`,
            kind: "complication",
            actorId: value("actorId"),
            userId: requireDestinyValue(game.user).id,
            label: destinyText("complication"),
            side: "dark",
            before: 0,
            ladder: [],
            narrative: value("story"),
            situation: value("situation"),
          },
        });
        await requestDestiny({ kind: "spend", effectId: id, coinId });
        await requestDestiny({ kind: "close-effect", effectId: id });
        navigate("history");
      } else if (action === "rollDestinySession") await rollDestinySession();
      else if (
        action === "nominateDestinyPlayer" ||
        action === "resetDestinySession"
      ) {
        if (!game.user?.isGM) throw new Error("D6E2.Destiny.Error.GMRequired");
        if (
          await confirmDestiny(
            destinyText("newSession"),
            destinyText("ResetConfirmation"),
          )
        )
          await requestDestiny({
            kind: "reset",
            sessionId: foundryRandomId(),
            size: destinyConfiguration().size,
            nominatedUserId: value("nominatedPlayerId"),
          });
      } else if (action === "correctDestinyPool") {
        const faces = state.coins.map((c) =>
          value(`correction.${c.id}`, c.face) === "light"
            ? ("light" as const)
            : ("dark" as const),
        );
        if (
          await confirmDestiny(
            destinyText("correctPool"),
            `${faces.map((f) => destinyText(f)).join(" · ")} — ${value("correctionReason")}`,
          )
        )
          await requestDestiny({
            kind: "correct",
            faces,
            reason: value("correctionReason"),
          });
      }
    } finally {
      this.#busy = false;
      if (this.rendered) this.render();
    }
  }
}
export const destinyWorkspace = new D6DestinyWorkspace();

import { SYSTEM_ID, SYSTEM_NAME } from "../constants";
import { observeThemeRegistry, themeRegistry } from "../registries/themes";
import { SHARED_SETTING_KEYS } from "../settings/settings-catalog";
import { stringSetting } from "../settings/setting-values";

export const D6_SYSTEM_2E_DICE_SYSTEM_ID = SYSTEM_ID;
export const D6_SYSTEM_2E_STANDARD_COLORSET_ID = "d6-system-2e-standard";
export const D6_SYSTEM_2E_STANDARD_DICE_FONT = "Arial Black";
export const D6_SYSTEM_2E_WILD_COLORSET_ID = "d6-system-2e-wild";
export const D6_SYSTEM_2E_WILD_SIX_LABEL =
  "systems/d6-system-2e/assets/dice/wild-six.png";

export function d6System2eDiceAppearance(denomination: "d6" | "dw" = "d6"): {
  readonly colorset: string;
  readonly font: string;
  readonly system: string;
} {
  const selectedDice = selectedThemeDice();
  return {
    colorset:
      denomination === "dw"
        ? (selectedDice?.wildDie?.colorsetId ?? D6_SYSTEM_2E_WILD_COLORSET_ID)
        : (selectedDice?.colorsetId ?? D6_SYSTEM_2E_STANDARD_COLORSET_ID),
    font: D6_SYSTEM_2E_STANDARD_DICE_FONT,
    system: selectedDice?.systemId ?? D6_SYSTEM_2E_DICE_SYSTEM_ID,
  };
}

function selectedThemeDice():
  ReturnType<typeof themeRegistry.current>[number]["dice"] | undefined {
  const renderedTheme =
    typeof document === "undefined"
      ? "classic"
      : (document.documentElement.dataset.d6System2eTheme ?? "classic");
  const worldTheme = stringSetting(
    SHARED_SETTING_KEYS.worldTheme,
    renderedTheme,
  );
  const userTheme = stringSetting(SHARED_SETTING_KEYS.userTheme, "inherit");
  const selectedThemeId = userTheme === "inherit" ? worldTheme : userTheme;
  return themeRegistry.current().find(({ id }) => id === selectedThemeId)?.dice;
}

type DiceSoNiceAppearanceScope = Record<string, unknown> & {
  colorset?: string;
  font?: string;
  system?: string;
};

type DiceSoNiceSavedAppearance = Record<string, DiceSoNiceAppearanceScope>;

function synchronizedDiceSoNiceAppearance(
  current: unknown,
  dice: NonNullable<ReturnType<typeof selectedThemeDice>>,
): DiceSoNiceSavedAppearance {
  const source =
    current && typeof current === "object"
      ? (current as DiceSoNiceSavedAppearance)
      : {};
  const synchronized = Object.fromEntries(
    Object.entries(source).map(([scope, appearance]) => [
      scope,
      {
        ...appearance,
        colorset:
          scope === "dw"
            ? (dice.wildDie?.colorsetId ?? D6_SYSTEM_2E_WILD_COLORSET_ID)
            : dice.colorsetId,
        font: D6_SYSTEM_2E_STANDARD_DICE_FONT,
        system: dice.systemId,
      },
    ]),
  );
  synchronized.global = {
    ...(source.global ?? {}),
    colorset: dice.colorsetId,
    font: D6_SYSTEM_2E_STANDARD_DICE_FONT,
    system: dice.systemId,
  };
  return synchronized;
}

export async function synchronizeDiceSoNiceThemePreference(
  themeId: string,
): Promise<void> {
  const dice = themeRegistry.current().find(({ id }) => id === themeId)?.dice;
  const user = game.user as
    | {
        getFlag(scope: string, key: string): unknown;
        setFlag(scope: string, key: string, value: unknown): Promise<unknown>;
      }
    | undefined;
  if (!dice || !user) return;
  const current = user.getFlag("dice-so-nice", "appearance");
  await user.setFlag(
    "dice-so-nice",
    "appearance",
    synchronizedDiceSoNiceAppearance(current, dice),
  );
}

interface DiceSoNiceApi {
  addColorset(
    colorset: {
      readonly background: string;
      readonly category: string;
      readonly description: string;
      readonly edge: string;
      readonly foreground: string;
      readonly labelComposite: "tint";
      readonly material: string;
      readonly name: string;
      readonly outline: string;
      readonly texture: string;
      readonly visibility: "hidden" | "visible";
    },
    mode?: "default",
  ): Promise<void> | void;
  addDicePreset(
    preset: {
      readonly colorset: string;
      readonly font?: string;
      readonly labelScale?: number;
      readonly labels: readonly string[];
      readonly system: string;
      readonly type: string;
      readonly values: { readonly max: number; readonly min: number };
    },
    shape?: string,
  ): void;
  addSystem(
    system: { readonly id: string; readonly name: string },
    mode?: "default",
  ): void;
  preloadPresets?(systemId: string): Promise<void>;
  waitFor3DAnimationByMessageID?(messageId: string): Promise<boolean>;
}

let activeDiceSoNiceApi: DiceSoNiceApi | undefined;
const registeredColorsets = new Set<string>();
const registeredDiceSystems = new Set<string>();

export async function waitForDiceSoNiceRollAnimation(
  messageId: string,
  dice3d:
    | Pick<DiceSoNiceApi, "waitFor3DAnimationByMessageID">
    | undefined = activeDiceSoNiceApi,
): Promise<void> {
  await dice3d?.waitFor3DAnimationByMessageID?.(messageId);
}

async function addThemeColorset(
  dice3d: DiceSoNiceApi,
  theme: ReturnType<typeof themeRegistry.current>[number],
): Promise<void> {
  const dice = theme.dice;
  if (!dice || registeredColorsets.has(dice.colorsetId)) return;
  registeredColorsets.add(dice.colorsetId);
  await dice3d.addColorset(
    {
      background: dice.body,
      category: SYSTEM_NAME,
      description: `${dice.name} Standard Die`,
      edge: dice.edge,
      foreground: dice.face,
      labelComposite: "tint",
      material: "metal",
      name: dice.colorsetId,
      outline: "none",
      texture: "none",
      visibility: "visible",
    },
    "default",
  );
  if (dice.wildDie && !registeredColorsets.has(dice.wildDie.colorsetId)) {
    registeredColorsets.add(dice.wildDie.colorsetId);
    await dice3d.addColorset(
      {
        background: dice.wildDie.body,
        category: SYSTEM_NAME,
        description: `${dice.name} Wild Die`,
        edge: dice.wildDie.edge,
        foreground: dice.wildDie.face,
        labelComposite: "tint",
        material: "metal",
        name: dice.wildDie.colorsetId,
        outline: "none",
        texture: "none",
        visibility: "hidden",
      },
      "default",
    );
  }
}

export const D6_SYSTEM_2E_STANDARD_DICE_TYPES = Object.freeze([
  Object.freeze({
    labels: Object.freeze(["1", "2"]),
    shape: "d2",
    values: Object.freeze({ min: 1, max: 2 }),
  }),
  Object.freeze({
    labels: Object.freeze(["1", "2", "3", "4"]),
    shape: "d4",
    values: Object.freeze({ min: 1, max: 4 }),
  }),
  Object.freeze({
    labels: Object.freeze(["1", "2", "3", "4", "5", "6"]),
    shape: "d6",
    values: Object.freeze({ min: 1, max: 6 }),
  }),
  Object.freeze({
    labels: Object.freeze(["1", "2", "3", "4", "5", "6", "7", "8"]),
    shape: "d8",
    values: Object.freeze({ min: 1, max: 8 }),
  }),
  Object.freeze({
    labels: Object.freeze(["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"]),
    shape: "d10",
    values: Object.freeze({ min: 1, max: 10 }),
  }),
  Object.freeze({
    labels: Object.freeze([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "11",
      "12",
    ]),
    shape: "d12",
    values: Object.freeze({ min: 1, max: 12 }),
  }),
  Object.freeze({
    labels: Object.freeze([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "11",
      "12",
      "13",
      "14",
      "15",
      "16",
      "17",
      "18",
      "19",
      "20",
    ]),
    shape: "d20",
    values: Object.freeze({ min: 1, max: 20 }),
  }),
  Object.freeze({
    labels: Object.freeze([
      "10",
      "20",
      "30",
      "40",
      "50",
      "60",
      "70",
      "80",
      "90",
      "00",
    ]),
    shape: "d100",
    values: Object.freeze({ min: 1, max: 100 }),
  }),
  Object.freeze({
    labels: Object.freeze(["-", "", "+"]),
    shape: "df",
    values: Object.freeze({ min: -1, max: 1 }),
  }),
]);

function addThemeDiceSystem(
  dice3d: DiceSoNiceApi,
  theme: ReturnType<typeof themeRegistry.current>[number],
): boolean {
  const dice = theme.dice;
  if (!dice || registeredDiceSystems.has(dice.systemId)) return false;
  registeredDiceSystems.add(dice.systemId);
  dice3d.addSystem({ id: dice.systemId, name: dice.name }, "default");
  for (const dieType of D6_SYSTEM_2E_STANDARD_DICE_TYPES) {
    dice3d.addDicePreset(
      {
        colorset: dice.colorsetId,
        font: D6_SYSTEM_2E_STANDARD_DICE_FONT,
        labelScale: 0.72,
        labels: [...dieType.labels],
        system: dice.systemId,
        type: dieType.shape,
        values: { ...dieType.values },
      },
      dieType.shape,
    );
  }
  dice3d.addDicePreset(
    {
      colorset: dice.wildDie?.colorsetId ?? D6_SYSTEM_2E_WILD_COLORSET_ID,
      font: D6_SYSTEM_2E_STANDARD_DICE_FONT,
      labelScale: 0.72,
      labels: dice.wildDieLabels
        ? [...dice.wildDieLabels]
        : ["1", "2", "3", "4", "5", D6_SYSTEM_2E_WILD_SIX_LABEL],
      system: dice.systemId,
      type: "dw",
      values: { min: 1, max: 6 },
    },
    "dw",
  );
  return true;
}

async function installContributedThemes(dice3d: DiceSoNiceApi): Promise<void> {
  for (const theme of themeRegistry.current()) {
    if (theme.id === "classic") continue;
    await addThemeColorset(dice3d, theme);
    if (addThemeDiceSystem(dice3d, theme) && theme.dice) {
      await dice3d.preloadPresets?.(theme.dice.systemId);
    }
  }
}

function isDiceSoNiceApi(value: unknown): value is DiceSoNiceApi {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DiceSoNiceApi>;
  return (
    typeof candidate.addColorset === "function" &&
    typeof candidate.addDicePreset === "function" &&
    typeof candidate.addSystem === "function"
  );
}

export async function installD6System2eDicePresets(
  dice3d: DiceSoNiceApi,
): Promise<void> {
  const classicTheme = themeRegistry
    .current()
    .find((theme) => theme.id === "classic");
  if (!classicTheme) {
    throw new Error("D6 System Second Edition classic theme is unavailable");
  }

  registeredColorsets.clear();
  registeredDiceSystems.clear();
  await addThemeColorset(dice3d, classicTheme);
  registeredColorsets.add(D6_SYSTEM_2E_WILD_COLORSET_ID);
  await dice3d.addColorset(
    {
      background: classicTheme.tokens.accent,
      category: SYSTEM_NAME,
      description: "D6 System Second Edition Wild Die",
      edge: classicTheme.tokens.accentBright,
      foreground: classicTheme.tokens.background,
      labelComposite: "tint",
      material: "metal",
      name: D6_SYSTEM_2E_WILD_COLORSET_ID,
      outline: "none",
      texture: "none",
      visibility: "hidden",
    },
    "default",
  );
  addThemeDiceSystem(dice3d, classicTheme);
  await dice3d.preloadPresets?.(D6_SYSTEM_2E_DICE_SYSTEM_ID);
  await installContributedThemes(dice3d);
  console.info(`${SYSTEM_NAME} | Registered Dice So Nice dice presets`);
}

export function registerDiceSoNiceIntegration(): void {
  Hooks.on("d6e2ThemeChanged", (themeId: unknown) => {
    if (typeof themeId !== "string") return;
    void synchronizeDiceSoNiceThemePreference(themeId).catch(
      (error: unknown) => {
        console.error(
          `${SYSTEM_NAME} | Dice So Nice theme preference synchronization failed`,
          error,
        );
      },
    );
  });
  observeThemeRegistry(() => {
    if (!activeDiceSoNiceApi) return;
    void installContributedThemes(activeDiceSoNiceApi).catch(
      (error: unknown) => {
        console.error(
          `${SYSTEM_NAME} | Dice So Nice theme registration failed`,
          error,
        );
      },
    );
  });
  Hooks.on("diceSoNiceReady", (value: unknown) => {
    if (!isDiceSoNiceApi(value)) {
      console.warn(`${SYSTEM_NAME} | Dice So Nice API was not recognized`);
      return;
    }
    activeDiceSoNiceApi = value;
    void installD6System2eDicePresets(value)
      .then(() => {
        const selectedThemeId =
          typeof document === "undefined"
            ? "classic"
            : (document.documentElement.dataset.d6System2eTheme ?? "classic");
        return synchronizeDiceSoNiceThemePreference(selectedThemeId);
      })
      .catch((error: unknown) => {
        console.error(
          `${SYSTEM_NAME} | Dice So Nice registration failed`,
          error,
        );
      });
  });
}

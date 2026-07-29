import { SYSTEM_ID, SYSTEM_NAME } from "../constants";
import { themeRegistry } from "../registries/themes";

export const D6_SYSTEM_2E_DICE_SYSTEM_ID = SYSTEM_ID;
export const D6_SYSTEM_2E_STANDARD_COLORSET_ID = "d6-system-2e-standard";
export const D6_SYSTEM_2E_STANDARD_DICE_FONT = "Amiri";
export const D6_SYSTEM_2E_WILD_COLORSET_ID = "d6-system-2e-wild";

export function d6System2eDiceAppearance(denomination: "d6" | "dw" = "d6"): {
  readonly colorset: string;
  readonly font: string;
  readonly system: string;
} {
  return {
    colorset:
      denomination === "dw"
        ? D6_SYSTEM_2E_WILD_COLORSET_ID
        : D6_SYSTEM_2E_STANDARD_COLORSET_ID,
    font: D6_SYSTEM_2E_STANDARD_DICE_FONT,
    system: D6_SYSTEM_2E_DICE_SYSTEM_ID,
  };
}

interface DiceSoNiceApi {
  addColorset(
    colorset: {
      readonly background: string;
      readonly category: string;
      readonly description: string;
      readonly edge: string;
      readonly foreground: string;
      readonly material: string;
      readonly name: string;
      readonly outline: string;
      readonly texture: string;
      readonly visibility: "hidden";
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

  dice3d.addSystem(
    { id: D6_SYSTEM_2E_DICE_SYSTEM_ID, name: SYSTEM_NAME },
    "default",
  );
  await dice3d.addColorset(
    {
      background: classicTheme.tokens.accent,
      category: SYSTEM_NAME,
      description: "D6 System Second Edition Standard Die",
      edge: classicTheme.tokens.accentBright,
      foreground: classicTheme.tokens.background,
      material: "metal",
      name: D6_SYSTEM_2E_STANDARD_COLORSET_ID,
      outline: "#6f4b18",
      texture: "none",
      visibility: "hidden",
    },
    "default",
  );
  await dice3d.addColorset(
    {
      background: "#090a0c",
      category: SYSTEM_NAME,
      description: "D6 System Second Edition Wild Die",
      edge: "#4b3518",
      foreground: "#e3b85f",
      material: "metal",
      name: D6_SYSTEM_2E_WILD_COLORSET_ID,
      outline: "#020304",
      texture: "none",
      visibility: "hidden",
    },
    "default",
  );
  for (const dieType of D6_SYSTEM_2E_STANDARD_DICE_TYPES) {
    dice3d.addDicePreset(
      {
        colorset: D6_SYSTEM_2E_STANDARD_COLORSET_ID,
        font: D6_SYSTEM_2E_STANDARD_DICE_FONT,
        labels: [...dieType.labels],
        system: D6_SYSTEM_2E_DICE_SYSTEM_ID,
        type: dieType.shape,
        values: { ...dieType.values },
      },
      dieType.shape,
    );
  }
  dice3d.addDicePreset(
    {
      colorset: D6_SYSTEM_2E_WILD_COLORSET_ID,
      font: D6_SYSTEM_2E_STANDARD_DICE_FONT,
      labelScale: 1,
      labels: ["1", "2", "3", "4", "5", "6"],
      system: D6_SYSTEM_2E_DICE_SYSTEM_ID,
      type: "dw",
      values: { min: 1, max: 6 },
    },
    "dw",
  );
  await dice3d.preloadPresets?.(D6_SYSTEM_2E_DICE_SYSTEM_ID);
  console.info(`${SYSTEM_NAME} | Registered Dice So Nice dice presets`);
}

export function registerDiceSoNiceIntegration(): void {
  Hooks.on("diceSoNiceReady", (value: unknown) => {
    if (!isDiceSoNiceApi(value)) {
      console.warn(`${SYSTEM_NAME} | Dice So Nice API was not recognized`);
      return;
    }
    void installD6System2eDicePresets(value).catch((error: unknown) => {
      console.error(`${SYSTEM_NAME} | Dice So Nice registration failed`, error);
    });
  });
}

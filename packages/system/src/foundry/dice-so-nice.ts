import { SYSTEM_ID, SYSTEM_NAME } from "../constants";

export const D6_SYSTEM_2E_DICE_SYSTEM_ID = SYSTEM_ID;
export const D6_SYSTEM_2E_WILD_COLORSET_ID = "d6-system-2e-wild";

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
  dice3d.addSystem(
    { id: D6_SYSTEM_2E_DICE_SYSTEM_ID, name: SYSTEM_NAME },
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
  dice3d.addDicePreset(
    {
      colorset: D6_SYSTEM_2E_WILD_COLORSET_ID,
      labelScale: 1,
      labels: ["1", "2", "3", "4", "5", "6"],
      system: D6_SYSTEM_2E_DICE_SYSTEM_ID,
      type: "dw",
      values: { min: 1, max: 6 },
    },
    "dw",
  );
  await dice3d.preloadPresets?.(D6_SYSTEM_2E_DICE_SYSTEM_ID);
  console.info(`${SYSTEM_NAME} | Registered Dice So Nice Wild Die preset`);
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

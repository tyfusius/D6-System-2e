import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { medicalConsumableVmFixtures } from "../packages/system/src/foundry/medical-consumable-view-model.ts";

const output = resolve(
  process.argv[2] ??
    ".agent-runtime/core-model-b-stims/medical-consumable-vm-fixtures.json",
);
await mkdir(resolve(output, ".."), { recursive: true });
await writeFile(
  output,
  `${JSON.stringify(medicalConsumableVmFixtures(), null, 2)}\n`,
  "utf8",
);
console.log(output);

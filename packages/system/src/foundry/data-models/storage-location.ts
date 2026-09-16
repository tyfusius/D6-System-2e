import {
  currencyHolderField,
  migrationField,
  storageRootFields,
} from "./fields.js";

const { HTMLField } = foundry.data.fields;

export class StorageLocationDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema(): Record<string, object> {
    return {
      _migration: migrationField(),
      ...storageRootFields(),
      currencyWallet: currencyHolderField(),
      biography: new HTMLField({
        initial: "",
        nullable: false,
        required: true,
      }),
    };
  }
}

import { isD6ProfileApi } from "./d6-system-api";
import { register1876Contributions } from "./register";

Hooks.once("ready", () => {
  const api: unknown = game.system.api;
  if (!isD6ProfileApi(api)) {
    ui.notifications.warn(game.i18n.localize("WESTERN1876.ApiUnavailable"));
    return;
  }
  register1876Contributions(api, (key) => game.i18n.localize(key));
});

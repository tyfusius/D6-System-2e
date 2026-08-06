import { initializeD6System2e, readyD6System2e } from "./foundry/bootstrap";

Hooks.once("init", initializeD6System2e);
Hooks.once("ready", readyD6System2e);

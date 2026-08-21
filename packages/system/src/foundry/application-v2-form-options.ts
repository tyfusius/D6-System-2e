export interface ApplicationV2FormOptions<THandler> {
  readonly closeOnSubmit: boolean;
  readonly handler: THandler;
  readonly submitOnChange: boolean;
}

export function applicationV2FormOptions<THandler>(
  options: ApplicationV2FormOptions<THandler>,
): ApplicationV2FormOptions<THandler> {
  return Object.freeze(options);
}

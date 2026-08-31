export function hideoutSheetAccess(
  active: boolean,
  editable: boolean,
  isGm: boolean,
): Readonly<{ active: boolean; canEdit: boolean; gm: boolean }> {
  return Object.freeze({
    active,
    canEdit: active && editable,
    gm: active && editable && isGm,
  });
}

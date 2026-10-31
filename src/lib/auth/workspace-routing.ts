// Inputs must come from freshly authorized active memberships, never client roles.
export function chooseWorkspace(activeSalonIds: readonly string[], selected?: string) {
  if (selected && activeSalonIds.includes(selected)) return selected;
  return activeSalonIds.length === 1 ? activeSalonIds[0] : null;
}

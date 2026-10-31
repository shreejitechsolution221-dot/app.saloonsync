export function passwordChecks(password: string, confirmation: string, minimum: number) {
  return { longEnough: password.length >= minimum, withinLimit: password.length <= 128, matches: Boolean(password && confirmation && password === confirmation) };
}

export function suggestPassword(minimum: number) {
  const groups = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%&*-_'];
  const alphabet = groups.join('');
  const pick = (characters: string) => {
    const limit = 256 - 256 % characters.length;
    const bytes = new Uint8Array(1);
    do { crypto.getRandomValues(bytes); } while (bytes[0] >= limit);
    return characters[bytes[0] % characters.length];
  };
  const length = Math.min(128, Math.max(20, minimum + 4));
  const chars = groups.map(pick);
  while (chars.length < length) chars.push(pick(alphabet));
  // Fisher-Yates with unbiased crypto choices, never Math.random.
  for (let i = chars.length - 1; i > 0; i--) {
    const bytes = new Uint8Array(1); const limit = 256 - 256 % (i + 1);
    do { crypto.getRandomValues(bytes); } while (bytes[0] >= limit);
    const j = bytes[0] % (i + 1); [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

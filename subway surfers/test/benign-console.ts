export const BENIGN_CONSOLE_PATTERNS: RegExp[] = [
  /Failed to load resource: net::ERR_INTERNET_DISCONNECTED/,
];

export function isBenign(text: string): boolean {
  return BENIGN_CONSOLE_PATTERNS.some((re) => re.test(text));
}

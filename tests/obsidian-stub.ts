// Minimal offline stand-in for the Obsidian host API; unit tests never touch a vault or network.
export class TFile {}
export class Notice {}
export async function requestUrl(): Promise<never> { throw new Error('Network access is not available in offline tests.'); }

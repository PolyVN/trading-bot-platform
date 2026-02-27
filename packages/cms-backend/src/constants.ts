export const EXCHANGES = ['polymarket', 'okx'] as const;
export type Exchange = (typeof EXCHANGES)[number];

export type BadgeState = 'green' | 'yellow' | 'red' | 'grey'

export interface BadgeThresholds {
  greenDays: number   // check-in within this many days = green
  yellowDays: number  // check-in within this many days = yellow, else red
}

export const BADGE_THRESHOLDS: BadgeThresholds = {
  greenDays: 7,
  yellowDays: 30,
}

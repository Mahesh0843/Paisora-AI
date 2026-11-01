let unlocked = false;
let backgroundTime = 0;

export function setUnlocked(value: boolean) {
  unlocked = value;
}
export function getUnlocked(): boolean {
  return unlocked;
}
export function setBackgroundTime(ts: number) {
  backgroundTime = ts;
}
export function getBackgroundTime(): number {
  return backgroundTime;
}

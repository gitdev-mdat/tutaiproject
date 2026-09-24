export const CURATED_STATIC_LIMIT = 3;

export function hasCuratedShelfNavigation(totalItems: number): boolean {
  return totalItems > CURATED_STATIC_LIMIT;
}

export function getCuratedShelfPageSize(isCompact: boolean, isMobile: boolean): number {
  if (isMobile) return 1;
  return isCompact ? 2 : 3;
}

export function getCuratedShelfMaxIndex(totalItems: number, pageSize: number): number {
  return Math.max(0, totalItems - Math.max(1, pageSize));
}

export function getNextCuratedShelfIndex(
  currentIndex: number,
  direction: -1 | 1,
  totalItems: number,
  pageSize: number
): number {
  const maxIndex = getCuratedShelfMaxIndex(totalItems, pageSize);
  return Math.min(maxIndex, Math.max(0, currentIndex + direction));
}

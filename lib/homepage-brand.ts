export const HOMEPAGE_PROJECT_LIMIT = 4;

export function moveOrderedItem(
  itemIds: string[],
  itemId: string,
  direction: -1 | 1
) {
  const currentIndex = itemIds.indexOf(itemId);
  const nextIndex = currentIndex + direction;

  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= itemIds.length) {
    return itemIds;
  }

  const reordered = [...itemIds];
  [reordered[currentIndex], reordered[nextIndex]] = [
    reordered[nextIndex],
    reordered[currentIndex]
  ];

  return reordered;
}

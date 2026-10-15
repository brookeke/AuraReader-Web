const SCROLL_DIRECTION_THRESHOLD = 8;

export function getHeaderVisibility({
  currentScrollY,
  previousScrollY,
  headerHeight,
  locked = false,
}) {
  if (locked || currentScrollY <= headerHeight) return "visible";

  const scrollDelta = currentScrollY - previousScrollY;
  if (scrollDelta > SCROLL_DIRECTION_THRESHOLD) return "hidden";
  if (scrollDelta < -SCROLL_DIRECTION_THRESHOLD) return "visible";
  return "unchanged";
}

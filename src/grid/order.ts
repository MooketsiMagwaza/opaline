export type Bounds = { left: number; top: number; right: number; bottom: number; width: number; height: number };

/** The middle of a tile means "group"; its edges remain available for inserting between tiles. */
export function isCentralDrop(bounds: Bounds, clientX: number, clientY: number): boolean {
  const horizontalInset = bounds.width * 0.24;
  const verticalInset = bounds.height * 0.2;
  return (
    clientX >= bounds.left + horizontalInset &&
    clientX <= bounds.right - horizontalInset &&
    clientY >= bounds.top + verticalInset &&
    clientY <= bounds.bottom - verticalInset
  );
}

/** Finds the row-major insertion slot nearest the pointer. */
export function insertionIndexForPoint(bounds: Bounds[], clientX: number, clientY: number): number {
  if (bounds.length === 0) return 0;

  const rows: { start: number; bottom: number; tiles: Bounds[] }[] = [];
  bounds.forEach((rect, index) => {
    const current = rows[rows.length - 1];
    if (!current || rect.top >= current.bottom) rows.push({ start: index, bottom: rect.bottom, tiles: [rect] });
    else {
      current.bottom = Math.max(current.bottom, rect.bottom);
      current.tiles.push(rect);
    }
  });

  const row = rows.find((candidate) => clientY <= candidate.bottom);
  if (!row) return bounds.length;
  const column = row.tiles.findIndex((rect) => clientX < rect.left + rect.width / 2);
  return row.start + (column < 0 ? row.tiles.length : column);
}

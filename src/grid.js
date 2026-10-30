// Two 8x8 boards laid out on the water, one on each side of the separator (x = 0).
export const GRID = {
  size: 8, // cells per side
  cell: 40, // metres per cell
  gap: 30, // distance from the separator to each board's inner edge
}

export const BOARD_WIDTH = GRID.size * GRID.cell
export const HALF_BOARD = BOARD_WIDTH / 2

// World-space centre of a cell. side: 'left' | 'right', col/row: 0..7
export function cellCenter(side, col, row) {
  const x0 = side === 'left' ? -GRID.gap - BOARD_WIDTH : GRID.gap
  return [x0 + (col + 0.5) * GRID.cell, -HALF_BOARD + (row + 0.5) * GRID.cell]
}

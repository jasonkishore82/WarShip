import { GRID, cellCenter } from './grid'

// Ship types and how many grid spaces each one takes.
export const SHIP_TYPES = {
  carrier: { name: 'Carrier', size: 5 },
  battleship: { name: 'Battleship', size: 4 },
  cruiser: { name: 'Cruiser', size: 3 },
  submarine: { name: 'Submarine', size: 3 },
  destroyer: { name: 'Destroyer', size: 2 },
}

// Player fleet on the left board. col/row = first cell (0..7);
// 'h' runs along +x (columns), 'v' runs along +z (rows).
export const FLEET = [
  { type: 'carrier', col: 1, row: 1, dir: 'h' },
  { type: 'battleship', col: 7, row: 2, dir: 'v' },
  { type: 'cruiser', col: 0, row: 4, dir: 'h' },
  { type: 'submarine', col: 3, row: 6, dir: 'h' },
  { type: 'destroyer', col: 5, row: 3, dir: 'v' },
]

// Cells a ship occupies, e.g. for hit testing later.
export function shipCells({ type, col, row, dir }) {
  const { size } = SHIP_TYPES[type]
  return Array.from({ length: size }, (_, i) =>
    dir === 'h' ? [col + i, row] : [col, row + i]
  )
}

// World position, heading and length (metres) for a ship on a board.
export function shipTransform(ship, side = 'left') {
  const cells = shipCells(ship)
  const a = cellCenter(side, ...cells[0])
  const b = cellCenter(side, ...cells[cells.length - 1])
  return {
    x: (a[0] + b[0]) / 2,
    z: (a[1] + b[1]) / 2,
    heading: ship.dir === 'h' ? 0 : -Math.PI / 2,
    length: SHIP_TYPES[ship.type].size * GRID.cell - 6,
  }
}

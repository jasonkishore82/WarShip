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

// Opponent fleet on the right board, in a different layout.
export const ENEMY_FLEET = [
  { type: 'carrier', col: 2, row: 6, dir: 'h' },
  { type: 'battleship', col: 0, row: 0, dir: 'v' },
  { type: 'cruiser', col: 3, row: 1, dir: 'h' },
  { type: 'submarine', col: 6, row: 2, dir: 'v' },
  { type: 'destroyer', col: 2, row: 3, dir: 'h' },
]

// Cells a ship occupies, e.g. for hit testing later.
export function shipCells({ type, col, row, dir }) {
  const { size } = SHIP_TYPES[type]
  return Array.from({ length: size }, (_, i) =>
    dir === 'h' ? [col + i, row] : [col, row + i]
  )
}

// True when the ship is fully on the board and doesn't overlap any other ship.
export function isValidPlacement(ship, fleet) {
  const cells = shipCells(ship)
  const inside = cells.every(([c, r]) => c >= 0 && r >= 0 && c < GRID.size && r < GRID.size)
  if (!inside) return false
  const taken = new Set(
    fleet.filter((s) => s.type !== ship.type).flatMap((s) => shipCells(s).map(([c, r]) => `${c},${r}`))
  )
  return cells.every(([c, r]) => !taken.has(`${c},${r}`))
}

// Which cell of a board a world point falls in (may be outside 0..7).
export function cellAt(x, z, side = 'left') {
  const x0 = side === 'left' ? -GRID.gap - GRID.size * GRID.cell : GRID.gap
  const z0 = -(GRID.size * GRID.cell) / 2
  return [Math.floor((x - x0) / GRID.cell), Math.floor((z - z0) / GRID.cell)]
}

// World position, heading and length (metres) for a ship on a board.
export function shipTransform(ship, side = 'left') {
  const cells = shipCells(ship)
  const a = cellCenter(side, ...cells[0])
  const b = cellCenter(side, ...cells[cells.length - 1])
  return {
    x: (a[0] + b[0]) / 2,
    z: (a[1] + b[1]) / 2,
    // Ships on the right board face the other way, toward the player's side.
    heading: (ship.dir === 'h' ? 0 : -Math.PI / 2) + (side === 'right' ? Math.PI : 0),
    length: SHIP_TYPES[ship.type].size * GRID.cell - 6,
  }
}

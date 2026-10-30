// Pure game rules: fleet placement, shots, sinking and the computer's targeting.
import { GRID } from '../grid'
import { SHIP_TYPES, isValidPlacement, shipCells } from '../fleetConfig'

export const key = (c, r) => `${c},${r}`
export const inBoard = (c, r) => c >= 0 && r >= 0 && c < GRID.size && r < GRID.size

const pick = (list) => list[Math.floor(Math.random() * list.length)]

// A random legal layout of all five ships.
export function randomFleet() {
  for (let attempt = 0; attempt < 500; attempt++) {
    const fleet = []
    for (const type of Object.keys(SHIP_TYPES)) {
      const size = SHIP_TYPES[type].size
      for (let i = 0; i < 200; i++) {
        const dir = Math.random() < 0.5 ? 'h' : 'v'
        const col = Math.floor(Math.random() * (dir === 'h' ? GRID.size - size + 1 : GRID.size))
        const row = Math.floor(Math.random() * (dir === 'v' ? GRID.size - size + 1 : GRID.size))
        const ship = { type, col, row, dir }
        if (isValidPlacement(ship, fleet)) {
          fleet.push(ship)
          break
        }
      }
    }
    if (fleet.length === Object.keys(SHIP_TYPES).length) return fleet
  }
  throw new Error('Could not place fleet')
}

export function shipAt(ships, c, r) {
  return ships.find((s) => shipCells(s).some(([sc, sr]) => sc === c && sr === r)) || null
}

export function isSunk(ship, shots) {
  return shipCells(ship).every(([c, r]) => shots[key(c, r)] === 'hit')
}

export const sunkShips = (ships, shots) => ships.filter((s) => isSunk(s, shots))
export const fleetDestroyed = (ships, shots) => ships.every((s) => isSunk(s, shots))

// Fire at a cell. Returns the new shot map and what happened.
export function resolveShot(ships, shots, [c, r]) {
  const ship = shipAt(ships, c, r)
  const next = { ...shots, [key(c, r)]: ship ? 'hit' : 'miss' }
  const sunk = ship && isSunk(ship, next) ? ship : null
  return { shots: next, hit: !!ship, ship, sunk }
}

// ---------- computer opponent ----------
//
// Hunt mode: fire on a checkerboard pattern (every ship covers at least one
// of those cells). Target mode: once it has a hit on a ship that isn't sunk,
// try the cells next to it, and once two hits line up, keep going along that line.

export function aiPickTarget(shots, sunkCells) {
  const unshot = []
  for (let c = 0; c < GRID.size; c++) {
    for (let r = 0; r < GRID.size; r++) if (!shots[key(c, r)]) unshot.push([c, r])
  }
  if (unshot.length === 0) return null
  const open = (c, r) => inBoard(c, r) && !shots[key(c, r)]
  const isOpenHit = (c, r) => shots[key(c, r)] === 'hit' && !sunkCells.has(key(c, r))

  const hits = Object.keys(shots)
    .filter((k) => shots[k] === 'hit' && !sunkCells.has(k))
    .map((k) => k.split(',').map(Number))

  if (hits.length) {
    // Lines of two or more hits: extend from either end.
    const lineTargets = []
    for (const [c, r] of hits) {
      for (const [dc, dr] of [[1, 0], [0, 1]]) {
        if (!isOpenHit(c + dc, r + dr)) continue
        let a = [c, r]
        while (isOpenHit(a[0] - dc, a[1] - dr)) a = [a[0] - dc, a[1] - dr]
        let b = [c, r]
        while (isOpenHit(b[0] + dc, b[1] + dr)) b = [b[0] + dc, b[1] + dr]
        if (open(a[0] - dc, a[1] - dr)) lineTargets.push([a[0] - dc, a[1] - dr])
        if (open(b[0] + dc, b[1] + dr)) lineTargets.push([b[0] + dc, b[1] + dr])
      }
    }
    if (lineTargets.length) return pick(lineTargets)

    // Otherwise, any untried neighbour of a hit.
    const neighbours = []
    for (const [c, r] of hits) {
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (open(c + dc, r + dr)) neighbours.push([c + dc, r + dr])
      }
    }
    if (neighbours.length) return pick(neighbours)
  }

  const parity = unshot.filter(([c, r]) => (c + r) % 2 === 0)
  return pick(parity.length ? parity : unshot)
}

export function sunkCellSet(ships, shots) {
  return new Set(sunkShips(ships, shots).flatMap((s) => shipCells(s).map(([c, r]) => key(c, r))))
}

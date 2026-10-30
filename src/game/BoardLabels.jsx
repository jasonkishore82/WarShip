import { useMemo } from 'react'
import * as THREE from 'three'
import { GRID, cellCenter } from '../grid'

export const COLS = 'ABCDEFGH'

const cache = new Map()
function labelTexture(text) {
  if (cache.has(text)) return cache.get(text)
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')
  ctx.font = 'bold 86px system-ui, Segoe UI, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 10
  ctx.strokeStyle = 'rgba(5, 15, 25, 0.75)'
  ctx.strokeText(text, 64, 68)
  ctx.fillStyle = '#f4f1e6'
  ctx.fillText(text, 64, 68)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  cache.set(text, tex)
  return tex
}

// Letters A–H along the far edge and numbers 1–8 down the outer side of each board.
export default function BoardLabels() {
  const items = useMemo(() => {
    const list = []
    const off = GRID.cell * 0.85
    for (const side of ['left', 'right']) {
      for (let i = 0; i < GRID.size; i++) {
        const [lx, lz] = cellCenter(side, i, 0)
        list.push({ key: `${side}-c${i}`, text: COLS[i], pos: [lx, 8, lz - off] })
        const [nx, nz] = cellCenter(side, side === 'left' ? 0 : GRID.size - 1, i)
        list.push({ key: `${side}-r${i}`, text: String(i + 1), pos: [nx + (side === 'left' ? -off : off), 8, nz] })
      }
    }
    return list
  }, [])

  return items.map((it) => (
    <sprite key={it.key} position={it.pos} scale={[20, 20, 1]}>
      <spriteMaterial map={labelTexture(it.text)} transparent depthWrite={false} />
    </sprite>
  ))
}

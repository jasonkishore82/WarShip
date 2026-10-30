import { useMemo } from 'react'
import * as THREE from 'three'
import {
  Anchor,
  ArrayPanel,
  Box,
  CIWS,
  Cyl,
  Dome,
  Helicopter,
  Jet,
  Mast,
  NavLights,
  Radar,
  ShipHull,
  TaperBox,
  Windows,
  makeHullSpec,
  mats,
} from './parts'

const TRACTOR = new THREE.MeshStandardMaterial({ color: '#d8c13c', roughness: 0.6 })
const DECK_W = 48 // texture span across the flight deck (z from -24 to +24)
const FD_Y = 15 // underside of the flight deck
const FD_T = 1.4 // flight deck thickness
const TOP = FD_Y + FD_T // flight deck surface

// Flight deck outline in (x, z): angled-deck sponson to port, island side to starboard.
function outline(L) {
  const h = L / 2
  return [
    [-h, 13],
    [-h, -13],
    [-h + 17, -18],
    [-20, -24],
    [15, -22.5],
    [40, -14],
    [h - 12, -12],
    [h, -6],
    [h, 6],
    [h - 12, 12],
    [20, 17.5],
    [-60, 17.5],
    [-h + 7, 15],
  ]
}

function flightDeckTexture(L) {
  const W = 2048
  const H = 512
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')
  const P = (x, z) => [(x / L + 0.5) * W, ((z + DECK_W / 2) / DECK_W) * H]
  const line = (pts, color, width, dash = []) => {
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.setLineDash(dash)
    ctx.beginPath()
    pts.forEach(([x, z], i) => (i ? ctx.lineTo(...P(x, z)) : ctx.moveTo(...P(x, z))))
    ctx.stroke()
    ctx.setLineDash([])
  }

  // Non-skid surface with wear.
  ctx.fillStyle = '#3c4045'
  ctx.fillRect(0, 0, W, H)
  for (let i = 0; i < 26000; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.08)'
    ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2)
  }
  // Tyre skid marks on the landing area.
  for (let i = 0; i < 70; i++) {
    const x = -88 + Math.random() * 60
    const z = 1 - (x + 95) * 0.16 + (Math.random() - 0.5) * 6
    ctx.strokeStyle = 'rgba(10,10,10,0.18)'
    ctx.lineWidth = 2 + Math.random() * 3
    ctx.beginPath()
    ctx.moveTo(...P(x, z))
    ctx.lineTo(...P(x + 6 + Math.random() * 14, z - 1.5))
    ctx.stroke()
  }

  // Angled landing area: dashed centreline and edge lines (about 9 degrees to port).
  const a0 = [-96, 1.5]
  const a1 = [38, -19.5]
  const dir = [a1[0] - a0[0], a1[1] - a0[1]]
  const len = Math.hypot(...dir)
  const n = [-dir[1] / len, dir[0] / len]
  const off = (p, d) => [p[0] + n[0] * d, p[1] + n[1] * d]
  line([a0, a1], '#f2f2ec', 3, [26, 18])
  line([off(a0, 9.5), off(a1, 9.5)], '#f2f2ec', 3)
  line([off(a0, -9.5), off(a1, -9.5)], '#f2f2ec', 3)
  // Arresting wires across the landing area.
  for (let i = 0; i < 4; i++) {
    const t = 0.12 + i * 0.05
    const p = [a0[0] + dir[0] * t, a0[1] + dir[1] * t]
    line([off(p, -8.5), off(p, 8.5)], '#d9d9d4', 2)
  }
  // Landing aim box.
  const box = (cx, cz, w, d) => {
    ctx.strokeStyle = '#f2f2ec'
    ctx.lineWidth = 3
    const [x0, z0] = P(cx - w / 2, cz - d / 2)
    const [x1, z1] = P(cx + w / 2, cz + d / 2)
    ctx.strokeRect(x0, z0, x1 - x0, z1 - z0)
  }
  box(-58, -5.5, 8, 3)

  // Catapult tracks: two on the bow, two in the waist.
  line([[20, 5], [95, 3.5]], '#1c1e21', 3)
  line([[18, -5], [90, -8]], '#1c1e21', 3)
  line([[-38, -11], [22, -21]], '#1c1e21', 3)
  line([[-30, -6.5], [30, -16.5]], '#1c1e21', 3)
  // Jet blast deflector outlines behind each bow catapult.
  for (const [x, z] of [
    [16, 5],
    [14, -5],
  ]) {
    const [px, pz] = P(x - 3, z - 3)
    const [qx, qz] = P(x, z + 3)
    ctx.fillStyle = 'rgba(160,165,170,0.35)'
    ctx.fillRect(px, pz, qx - px, qz - pz)
  }

  // Foul line (red and white) separating the landing area from the bow.
  line([[-4, 16], [36, -23]], '#c8372d', 3, [12, 10])

  // Yellow taxi lines.
  line([[-70, 9], [-20, 10], [30, 9], [80, 6]], '#e3c34a', 2.5)
  line([[-20, 10], [-10, 2], [10, -4]], '#e3c34a', 2.5)

  // Elevator outlines (yellow dashed).
  const elev = (x0, z0, x1, z1) => {
    ctx.strokeStyle = '#e3c34a'
    ctx.setLineDash([10, 8])
    ctx.lineWidth = 2.5
    const [ax, az] = P(x0, z0)
    const [bx, bz] = P(x1, z1)
    ctx.strokeRect(ax, az, bx - ax, bz - az)
    ctx.setLineDash([])
  }
  elev(-8, 9.5, 8, 17)
  elev(30, 9.5, 46, 16.5)
  elev(-78, 8.5, -62, 15.5)
  elev(-58, -23, -42, -16)

  // Edge safety stripe.
  line(
    outline(L).concat([outline(L)[0]]).map(([x, z]) => [x * 0.985, z * 0.95]),
    'rgba(240,240,236,0.6)',
    2
  )

  // Big deck number near the bow, read from the stern.
  ctx.save()
  const [nx, nz] = P(72, 0)
  ctx.translate(nx, nz)
  ctx.rotate(Math.PI / 2)
  ctx.font = 'bold 120px "Arial Narrow", Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ecece6'
  ctx.fillText('09', 0, 0)
  ctx.restore()

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 16
  tex.repeat.set(1 / L, 1 / DECK_W)
  tex.offset.set(0.5, 0.5)
  return tex
}

function IslandNumber({ position, rotation }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 160
    const ctx = c.getContext('2d')
    ctx.font = 'bold 130px "Arial Narrow", Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#efefe9'
    ctx.fillText('09', 128, 84)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[5.2, 3.3]} />
      <meshBasicMaterial map={tex} transparent toneMapped={false} polygonOffset polygonOffsetFactor={-2} />
    </mesh>
  )
}

export default function Carrier({ length: L }) {
  const m = mats()
  const spec = useMemo(
    () => makeHullSpec({ length: L * 0.97, beam: 26, draft: 8, freeboard: 8, sheer: 0.2, flare: 0.32, bowStart: 0.62, sternWidth: 0.92, rake: 0.05 }),
    [L]
  )

  const flightDeck = useMemo(() => {
    const s = new THREE.Shape(outline(L).map(([x, z]) => new THREE.Vector2(x, -z)))
    const g = new THREE.ExtrudeGeometry(s, { depth: FD_T, bevelEnabled: false })
    g.rotateX(-Math.PI / 2)
    g.translate(0, FD_Y, 0)
    return g
  }, [L])
  const deckTex = useMemo(() => flightDeckTexture(L), [L])
  const deckMats = useMemo(
    () => [new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.92, metalness: 0.05 }), m.hazeDark],
    [deckTex, m.hazeDark]
  )

  // Safety nets around the deck edge (dark mesh just below the flight deck).
  const nets = useMemo(() => {
    const pts = outline(L)
    const pos = []
    for (let i = 0; i < pts.length; i++) {
      const [x0, z0] = pts[i]
      const [x1, z1] = pts[(i + 1) % pts.length]
      const out = (x, z) => {
        const r = Math.hypot(x * 0.02, z) || 1
        return [x + (x * 0.02 * 2.2) / r, z + (z * 2.2) / r]
      }
      const [ox0, oz0] = out(x0, z0)
      const [ox1, oz1] = out(x1, z1)
      pos.push(x0, FD_Y + 0.3, z0, x1, FD_Y + 0.3, z1, ox1, FD_Y + 0.9, oz1)
      pos.push(x0, FD_Y + 0.3, z0, ox1, FD_Y + 0.9, oz1, ox0, FD_Y + 0.9, oz0)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.computeVertexNormals()
    return g
  }, [L])

  const jets = [
    // starboard bow, wings folded, angled out
    [62, 12, -0.6, true],
    [70, 10.5, -0.6, true],
    [78, 8.5, -0.6, true],
    [86, 6.5, -0.6, true],
    // ready on the port bow catapult
    [40, -6.6, 0.04, false],
    // aft parking row, starboard
    [-84, 9, 2.3, true],
    [-76, 10, 2.3, true],
    [-68, 11, 2.3, true],
    // near the island
    [-26, 12.5, Math.PI - 0.3, true],
    [-36, 12.5, Math.PI - 0.3, true],
    // port forward
    [62, -8.5, 0.6, true],
    [72, -7, 0.6, true],
  ]

  return (
    <group>
      <ShipHull spec={spec} rails={false} />

      {/* Hangar: enclosed between hull deck and flight deck, with open elevator bays */}
      <Box size={[L * 0.84, FD_Y - 7.5, 25]} position={[-L * 0.03, (FD_Y + 7.5) / 2, 0]} mat={m.hazeDark} />
      {[
        [0, 12.6],
        [38, 12.6],
        [-70, 12.6],
        [-50, -12.6],
      ].map(([x, z]) => (
        <Box key={`${x}${z}`} size={[15, 5.5, 0.6]} position={[x, FD_Y - 3.3, z]} mat={m.black} />
      ))}
      {/* Deck-edge elevators lowered beside the bays */}
      <Box size={[15, 0.6, 7]} position={[38, FD_Y + 0.3, 16.6]} mat={m.hazeDark} />

      {/* Flight deck */}
      <mesh geometry={flightDeck} material={deckMats} />
      <mesh geometry={nets} material={m.rubber} />

      {/* Corner sponsons with close-in defence */}
      {[
        [-L / 2 + 6, -15, 0],
        [-L / 2 + 8, 15.5, 0],
        [L / 2 - 16, -13.5, Math.PI / 4],
        [L / 2 - 20, 13.5, -Math.PI / 4],
      ].map(([x, z, r]) => (
        <group key={`${x}${z}`}>
          <Box size={[7, 0.8, 6]} position={[x, FD_Y - 2.2, z + Math.sign(z) * 2]} mat={m.hazeDark} />
          <CIWS position={[x, FD_Y - 1.8, z + Math.sign(z) * 2.5]} rotation={r + (z < 0 ? Math.PI / 2 : -Math.PI / 2)} />
        </group>
      ))}

      {/* Island */}
      <group position={[14, TOP, 13.5]}>
        <Box size={[24, 6, 7.5]} position={[0, 3, 0]} />
        <Box size={[20, 4.5, 7]} position={[1, 8.2, 0]} mat={m.hazeLight} />
        {/* Navigation bridge with wraparound windows */}
        <Box size={[13, 3.2, 8]} position={[4, 12, 0]} />
        <Windows size={[13.05, 1.2, 8.05]} position={[4, 12.4, 0]} />
        {/* Primary flight control, sloped glass facing the deck */}
        <TaperBox size={[7, 2.8, 6]} taper={0.75} position={[-6, 11.8, -0.3]} mat={m.glass} />
        <Box size={[7.4, 0.4, 5]} position={[-6, 13.4, -0.3]} />
        {/* Phased-array panels */}
        <ArrayPanel position={[10.6, 8.4, 0]} rotationY={0} size={4} />
        <ArrayPanel position={[1, 8.4, -3.7]} rotationY={Math.PI / 2} size={4} />
        <ArrayPanel position={[1, 8.4, 3.7]} rotationY={-Math.PI / 2} size={4} />
        <ArrayPanel position={[-8.6, 8.4, 0]} rotationY={Math.PI} size={4} />
        {/* Island numbers */}
        <IslandNumber position={[1, 3.4, 3.8]} rotation={[0, 0, 0]} />
        <IslandNumber position={[1, 3.4, -3.8]} rotation={[0, Math.PI, 0]} />
        {/* Satcom domes and a rotating radar */}
        <Dome position={[-7, 13.6, 2]} r={1.3} />
        <Dome position={[-7, 13.6, -2]} r={1.1} />
        <Radar position={[8, 13.6, 0]} width={5} speed={0.9} />
        <Mast position={[2, 13.6, 0]} height={13} yard={8} radar />
        <NavLights x={9} y={13} halfWidth={4.1} />
      </group>

      {/* Air wing */}
      {jets.map(([x, z, r, folded], i) => (
        <Jet key={i} position={[x, TOP + 1.4, z]} rotation={r} folded={folded} />
      ))}
      <Helicopter position={[-6, TOP + 2.2, 6]} rotation={Math.PI} />
      <Helicopter position={[-48, TOP + 2.2, -4]} rotation={2.6} />

      {/* Deck tractors */}
      {[
        [-14, 6],
        [52, 12.5],
      ].map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, TOP + 0.6, z]}>
          <Box size={[3, 1, 1.8]} mat={TRACTOR} />
          <Box size={[1, 0.6, 1.6]} position={[-0.6, 0.8, 0]} mat={m.black} />
        </group>
      ))}

      {/* Bow anchors and a jack staff */}
      <Anchor position={[L * 0.42, 5.5, spec.halfAt(L * 0.42) + 0.1]} side={1} />
      <Anchor position={[L * 0.42, 5.5, -spec.halfAt(L * 0.42) - 0.1]} side={-1} />
      <Cyl r={0.08} h={4} position={[L / 2 - 1, TOP + 2, 0]} mat={m.black} />
    </group>
  )
}

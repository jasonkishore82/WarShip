// Shared building blocks for the ship models.
// Conventions: bow points along +x, starboard is +z, the waterline is y = 0.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const clamp01 = (v) => Math.min(1, Math.max(0, v))
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

// ---------- materials ----------

function canvasTexture(w, h, draw, opts = {}) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  if (opts.repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(...opts.repeat)
  }
  return tex
}

function noise(ctx, w, h, n, light, dark) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? light : dark
    ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2)
  }
}

let matCache
export function mats() {
  if (matCache) return matCache
  const std = (color, rough = 0.6, metal = 0.3, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra })

  const nonSkid = canvasTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#5a6067'
      ctx.fillRect(0, 0, w, h)
      noise(ctx, w, h, 5000, 'rgba(255,255,255,0.05)', 'rgba(0,0,0,0.12)')
    },
    { repeat: [8, 2] }
  )
  const teak = canvasTexture(
    512,
    128,
    (ctx, w, h) => {
      ctx.fillStyle = '#9c7a52'
      ctx.fillRect(0, 0, w, h)
      for (let y = 0; y < h; y += 8) {
        ctx.fillStyle = `rgba(${90 + Math.random() * 40},${60 + Math.random() * 30},${30 + Math.random() * 20},0.35)`
        ctx.fillRect(0, y, w, 7)
        ctx.fillStyle = 'rgba(30,20,10,0.6)' // caulking
        ctx.fillRect(0, y + 7, w, 1)
        for (let x = Math.random() * 60; x < w; x += 60 + Math.random() * 40) ctx.fillRect(x, y, 1, 7) // plank butts
      }
    },
    { repeat: [10, 2] }
  )

  matCache = {
    hull: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.25, side: THREE.DoubleSide }),
    deck: std('#ffffff', 0.9, 0.05, { map: nonSkid }),
    teak: std('#ffffff', 0.85, 0, { map: teak }),
    haze: std('#7f878f', 0.62, 0.3),
    hazeLight: std('#99a1a8', 0.6, 0.25),
    hazeDark: std('#5d646b', 0.65, 0.35),
    gunmetal: std('#3b4146', 0.45, 0.6),
    black: std('#16181b', 0.7, 0.2),
    white: std('#e7eaec', 0.45, 0.1),
    glass: std('#0b1217', 0.08, 0.9, { envMapIntensity: 1.5 }),
    rubber: std('#14171a', 0.92, 0.05),
    orange: std('#e8641c', 0.55, 0.05),
    red: std('#a3271e', 0.6, 0.1),
    brass: std('#b08a3e', 0.35, 0.8),
    radar: std('#c9ced2', 0.5, 0.3),
    arrayFace: std('#4c545b', 0.5, 0.4),
    navRed: std('#ff2a1a', 0.4, 0, { emissive: '#ff2a1a', emissiveIntensity: 2 }),
    navGreen: std('#20ff60', 0.4, 0, { emissive: '#20ff60', emissiveIntensity: 2 }),
    navWhite: std('#ffffff', 0.4, 0, { emissive: '#fff4d6', emissiveIntensity: 2 }),
  }
  return matCache
}

// ---------- the hull ----------

// A lofted hull: stations along the length, each a cross-section from keel to deck edge.
// Bow is fine and V-shaped with flare; midships is full with a round bilge; the stern has a transom.
export function makeHullSpec({
  length: L,
  beam: B,
  draft: D,
  freeboard: F,
  sheer = 0.4, // how much higher the deck is at the bow
  flare = 0.18, // bow flare (upper hull wider than waterline)
  sternWidth = 0.8, // transom width as a fraction of beam
  bowStart = 0.55, // where the bow starts to narrow (0 = stern, 1 = bow)
  rake = 0.05, // forward rake of the stem
  forefoot = 0.85, // how much the keel rises at the bow
}) {
  const half = (t) => {
    let w = 1
    if (t > bowStart) w = Math.max(0, 1 - Math.pow((t - bowStart) / (1 - bowStart), 2.1))
    if (t < 0.16) w *= sternWidth + (1 - sternWidth) * Math.sin((t / 0.16) * (Math.PI / 2))
    return (B / 2) * w
  }
  const deck = (t) => F * (1 + sheer * Math.pow(Math.max(0, (t - 0.45) / 0.55), 2))
  const keel = (t) => {
    let k = -D * (1 - forefoot * smooth(0.8, 1.0, t))
    if (t < 0.12) k *= 0.35 + 0.65 * (t / 0.12) // stern cut-up
    return k
  }
  const xAt = (t, a) => (t - 0.5) * L + rake * L * smooth(0.88, 1, t) * a
  const widthAt = (t, a) => {
    const bilge = a < 0.3 ? Math.pow(Math.sin((a / 0.3) * (Math.PI / 2)), 0.6) : 1
    const vee = smooth(0.65, 1, t)
    const s = bilge * (1 - vee) + a * vee
    const flareAmt = flare * smooth(0.45, 1, t) + 0.04
    return half(t) * s * (1 - flareAmt * (1 - a))
  }
  const tOf = (x) => clamp01(x / L + 0.5)
  return {
    L,
    B,
    D,
    F,
    half,
    deck,
    keel,
    xAt,
    widthAt,
    deckY: (x) => deck(tOf(x)),
    halfAt: (x) => half(tOf(x)),
  }
}

export function buildHullGeometry(spec, { stations = 90, ring = 14 } = {}) {
  const pos = []
  const col = []
  const idx = []
  const red = new THREE.Color('#6b2a22')
  const boot = new THREE.Color('#1a1c1f')
  const gray = new THREE.Color('#646c74')
  const P = ring * 2 + 1
  const c = new THREE.Color()
  for (let i = 0; i <= stations; i++) {
    const t = i / stations
    const k = spec.keel(t)
    const d = spec.deck(t)
    for (let p = 0; p < P; p++) {
      const side = p < ring ? -1 : 1
      const a = Math.abs(p - ring) / ring // 0 at keel, 1 at deck edge
      const y = k + (d - k) * a
      const z = side * spec.widthAt(t, a)
      pos.push(spec.xAt(t, a), y, z)
      if (y < -0.6) c.copy(red)
      else if (y < 0.7) c.copy(boot)
      else c.copy(gray).multiplyScalar(0.92 + 0.08 * a)
      col.push(c.r, c.g, c.b)
    }
  }
  for (let i = 0; i < stations; i++) {
    for (let p = 0; p < P - 1; p++) {
      const a = i * P + p
      const b = a + 1
      const cc = a + P
      const dd = cc + 1
      idx.push(a, cc, b, b, cc, dd)
    }
  }
  // Transom (flat stern plate).
  const base = pos.length / 3
  const tk = spec.keel(0)
  const td = spec.deck(0)
  pos.push(spec.xAt(0, 0.5), (tk + td) / 2, 0)
  col.push(gray.r * 0.85, gray.g * 0.85, gray.b * 0.85)
  for (let p = 0; p < P; p++) {
    pos.push(pos[p * 3], pos[p * 3 + 1], pos[p * 3 + 2])
    const y = pos[p * 3 + 1]
    c.copy(y < -0.6 ? red : y < 0.7 ? boot : gray)
    col.push(c.r, c.g, c.b)
  }
  for (let p = 0; p < P - 1; p++) idx.push(base, base + 1 + p, base + 2 + p)

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

export function buildDeckGeometry(spec, stations = 90, inset = 0.15) {
  const pos = []
  const uv = []
  const idx = []
  for (let i = 0; i <= stations; i++) {
    const t = i / stations
    const x = spec.xAt(t, 1)
    const y = spec.deck(t) + 0.02
    const w = Math.max(0, spec.widthAt(t, 1) - inset)
    pos.push(x, y, -w, x, y, w)
    uv.push(x / spec.L + 0.5, 0.5 - w / spec.B, x / spec.L + 0.5, 0.5 + w / spec.B)
  }
  for (let i = 0; i < stations; i++) {
    const a = i * 2
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

// Guard rails along both deck edges: stanchions plus top and middle rails.
export function buildRailGeometry(spec, { from = 0.02, to = 0.93, spacing = 2.5, height = 1.1 } = {}) {
  const pts = []
  const n = Math.max(2, Math.round(((to - from) * spec.L) / spacing))
  for (const side of [-1, 1]) {
    let prev = null
    for (let i = 0; i <= n; i++) {
      const t = from + ((to - from) * i) / n
      const x = spec.xAt(t, 1)
      const y = spec.deck(t)
      const z = side * Math.max(0, spec.widthAt(t, 1) - 0.25)
      pts.push(x, y, z, x, y + height, z)
      if (prev) {
        pts.push(prev[0], prev[1] + height, prev[2], x, y + height, z)
        pts.push(prev[0], prev[1] + height * 0.5, prev[2], x, y + height * 0.5, z)
      }
      prev = [x, y, z]
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
  return geo
}

const railMat = new THREE.LineBasicMaterial({ color: '#c9cfd4', transparent: true, opacity: 0.85 })

export function ShipHull({ spec, deckMat, rails = true, railOpts }) {
  const m = mats()
  const hull = useMemo(() => buildHullGeometry(spec), [spec])
  const deck = useMemo(() => buildDeckGeometry(spec), [spec])
  const rail = useMemo(() => (rails ? buildRailGeometry(spec, railOpts) : null), [spec, rails, railOpts])
  return (
    <group>
      <mesh geometry={hull} material={m.hull} />
      <mesh geometry={deck} material={deckMat || m.deck} />
      {rail && <lineSegments geometry={rail} material={railMat} />}
    </group>
  )
}

// Painted hull number on both bows.
export function HullNumber({ spec, text, t = 0.83, size = 5 }) {
  const tex = useMemo(
    () =>
      canvasTexture(256, 160, (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h)
        ctx.font = 'bold 120px "Arial Narrow", Arial, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = 'rgba(0,0,0,0.5)'
        ctx.fillText(text, w / 2 + 4, h / 2 + 4)
        ctx.fillStyle = '#f2f2ee'
        ctx.fillText(text, w / 2, h / 2)
      }),
    [text]
  )
  const x = spec.xAt(t, 0.7)
  const y = spec.F * 0.62
  const hw = spec.widthAt(t, 0.75) + 0.12
  const slope = (spec.half(t + 0.01) - spec.half(t - 0.01)) / (0.02 * spec.L)
  return [1, -1].map((side) => (
    <mesh key={side} position={[x, y, side * hw]} rotation={[0, Math.atan2(-slope, side), 0]}>
      <planeGeometry args={[size * 1.6, size]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} polygonOffset polygonOffsetFactor={-2} />
    </mesh>
  ))
}

// ---------- simple shapes ----------

export function Box({ size, position, rotation, mat }) {
  return (
    <mesh position={position} rotation={rotation} material={mat || mats().haze}>
      <boxGeometry args={size} />
    </mesh>
  )
}

export function Cyl({ r = 1, r2, h = 1, seg = 16, position, rotation, mat }) {
  return (
    <mesh position={position} rotation={rotation} material={mat || mats().haze}>
      <cylinderGeometry args={[r, r2 ?? r, h, seg]} />
    </mesh>
  )
}

// A box whose top is pulled in (stealth-style sloped sides).
export function TaperBox({ size: [w, h, d], taper = 0.8, taperX, position, rotation, mat }) {
  const geo = useMemo(() => {
    const g = new THREE.BoxGeometry(w, h, d)
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) {
      if (p.getY(i) > 0) {
        p.setZ(i, p.getZ(i) * taper)
        p.setX(i, p.getX(i) * (taperX ?? 1))
      }
    }
    g.computeVertexNormals()
    return g
  }, [w, h, d, taper, taperX])
  return <mesh geometry={geo} position={position} rotation={rotation} material={mat || mats().haze} />
}

// A strip of bridge windows.
export function Windows({ size, position, rotation }) {
  return <Box size={size} position={position} rotation={rotation} mat={mats().glass} />
}

// ---------- sensors ----------

// Rotating air-search radar.
export function Radar({ position, width = 5, speed = 1.2, bar = false }) {
  const ref = useRef()
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * speed
  })
  const m = mats()
  return (
    <group position={position}>
      <Cyl r={0.35} h={1.2} position={[0, 0.6, 0]} mat={m.hazeDark} />
      <group ref={ref} position={[0, 1.4, 0]}>
        {bar ? (
          <Box size={[0.5, 0.8, width]} mat={m.radar} />
        ) : (
          <>
            <Box size={[0.25, width * 0.45, width]} position={[0.2, 0, 0]} rotation={[0, 0, 0.25]} mat={m.radar} />
            <Box size={[1.2, 0.2, 0.2]} position={[-0.3, 0, 0]} mat={m.hazeDark} />
          </>
        )}
      </group>
    </group>
  )
}

// Fixed phased-array panel (octagon), facing along `rotationY`, tilted back.
export function ArrayPanel({ position, rotationY = 0, size = 4 }) {
  const m = mats()
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh rotation={[0, 0, Math.PI / 2 - 0.26]} material={m.arrayFace}>
        <cylinderGeometry args={[size / 2, size / 2, 0.3, 8]} />
      </mesh>
    </group>
  )
}

export function Dome({ position, r = 1, mat }) {
  return (
    <group position={position}>
      <Cyl r={r * 0.8} h={r * 0.8} position={[0, r * 0.4, 0]} mat={mats().hazeLight} />
      <mesh position={[0, r * 0.8, 0]} material={mat || mats().white}>
        <sphereGeometry args={[r, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
    </group>
  )
}

// Lattice mast with yardarms, antennas and an optional rotating radar on top.
export function Mast({ position, height = 12, yard = 6, radar = true }) {
  const m = mats()
  return (
    <group position={position}>
      <Cyl r={0.25} r2={0.45} h={height} position={[0, height / 2, 0]} mat={m.hazeLight} />
      {[-0.5, 0.5].map((dz) => (
        <Cyl key={dz} r={0.08} h={height * 0.9} position={[0, height * 0.45, dz * 1.6]} rotation={[dz * 0.25, 0, 0]} mat={m.hazeLight} />
      ))}
      <Box size={[0.2, 0.2, yard]} position={[0, height * 0.7, 0]} mat={m.hazeLight} />
      <Box size={[0.2, 0.2, yard * 0.6]} position={[0, height * 0.85, 0]} mat={m.hazeLight} />
      {[-1, 1].map((s) => (
        <Cyl key={s} r={0.05} h={2.5} position={[0, height * 0.7 + 1.2, s * yard * 0.45]} mat={m.black} />
      ))}
      <Cyl r={0.06} h={4} position={[0, height + 2, 0]} mat={m.black} />
      {radar && <Radar position={[0.6, height * 0.85 + 0.2, 0]} width={4} />}
      <mesh position={[0, height + 4.1, 0]} material={m.navWhite}>
        <sphereGeometry args={[0.18, 8, 8]} />
      </mesh>
    </group>
  )
}

// ---------- weapons ----------

// Close-in weapon system: white radome over a gatling gun.
export function CIWS({ position, rotation = 0 }) {
  const m = mats()
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <Cyl r={0.9} h={0.8} position={[0, 0.4, 0]} mat={m.hazeLight} />
      <Box size={[1.4, 1.2, 1.4]} position={[0, 1.4, 0]} mat={m.white} />
      <Cyl r={0.75} h={1.6} position={[0, 2.6, 0]} mat={m.white} />
      <mesh position={[0, 3.4, 0]} material={m.white}>
        <sphereGeometry args={[0.75, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <Cyl r={0.18} h={2.2} position={[1.4, 1.5, 0]} rotation={[0, 0, Math.PI / 2]} mat={m.gunmetal} />
    </group>
  )
}

// Modern naval gun with a faceted shield and a long slim barrel.
export function NavalGun({ position, rotation = 0, scale = 1, stealth = false }) {
  const m = mats()
  return (
    <group position={position} rotation={[0, rotation, 0]} scale={scale}>
      <Cyl r={2.1} h={0.5} position={[0, 0.25, 0]} mat={m.hazeDark} />
      {stealth ? (
        <TaperBox size={[4.6, 2.4, 3.6]} taper={0.55} taperX={0.75} position={[-0.2, 1.7, 0]} />
      ) : (
        <TaperBox size={[4.2, 2.2, 3.2]} taper={0.8} taperX={0.85} position={[-0.2, 1.6, 0]} />
      )}
      <Cyl r={0.18} r2={0.26} h={6.5} position={[4.6, 1.8, 0]} rotation={[0, 0, Math.PI / 2 - 0.05]} mat={m.gunmetal} />
      <Cyl r={0.24} h={0.5} position={[7.8, 1.97, 0]} rotation={[0, 0, Math.PI / 2 - 0.05]} mat={m.gunmetal} />
    </group>
  )
}

// Grid of vertical-launch missile hatches.
export function VLS({ position, cols = 8, rows = 4, cell = 1.2 }) {
  const tex = useMemo(
    () =>
      canvasTexture(256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#4a5157'
        ctx.fillRect(0, 0, w, h)
        const cw = w / 8
        ctx.strokeStyle = '#2a2e32'
        ctx.lineWidth = 3
        for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) ctx.strokeRect(i * cw + 3, j * cw + 3, cw - 6, cw - 6)
        ctx.fillStyle = '#3a4045'
        for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) ctx.fillRect(i * cw + cw / 2 - 4, j * cw + cw / 2 - 4, 8, 8)
      }),
    []
  )
  const W = cols * cell
  const D = rows * cell
  const tex2 = useMemo(() => {
    const t = tex.clone()
    t.needsUpdate = true
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(cols / 8, rows / 8)
    return t
  }, [tex, cols, rows])
  return (
    <group position={position}>
      <Box size={[W + 0.4, 0.4, D + 0.4]} position={[0, 0.2, 0]} mat={mats().hazeDark} />
      <mesh position={[0, 0.42, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial map={tex2} roughness={0.7} metalness={0.3} />
      </mesh>
    </group>
  )
}

// Angled anti-ship missile canisters (four in a rack).
export function CanisterRack({ position, rotation = 0 }) {
  const m = mats()
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <Box size={[0.4, 1.4, 3.2]} position={[-1.6, 0.7, 0]} mat={m.hazeDark} />
      {[0, 1].map((row) =>
        [-0.75, 0.75].map((z) => (
          <Box key={`${row}${z}`} size={[4.6, 0.7, 0.7]} position={[0.2, 1.1 + row * 0.75, z]} rotation={[0, 0, 0.3]} mat={m.hazeLight} />
        ))
      )}
    </group>
  )
}

// ---------- small fittings ----------

export function Boat({ position, rotation = 0, length = 7, rhib = false }) {
  const m = mats()
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh material={rhib ? m.orange : m.white} scale={[1, 0.5, 0.36]}>
        <capsuleGeometry args={[length * 0.18, length * 0.6, 4, 12]} />
      </mesh>
      {rhib ? (
        <Box size={[length * 0.25, 0.7, length * 0.18]} position={[0, 0.6, 0]} mat={m.hazeDark} />
      ) : (
        <Box size={[length * 0.45, 0.6, length * 0.22]} position={[length * 0.05, 0.55, 0]} mat={m.hazeLight} />
      )}
    </group>
  )
}

export function RaftCanisters({ position, count = 4, rotation = 0 }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {Array.from({ length: count }, (_, i) => (
        <Cyl key={i} r={0.45} h={1.4} position={[i * 1.1, 0.5, 0]} rotation={[Math.PI / 2, 0, 0]} mat={mats().white} />
      ))}
    </group>
  )
}

export function NavLights({ x, y, halfWidth }) {
  const m = mats()
  return (
    <>
      <mesh position={[x, y, -halfWidth]} material={m.navRed}>
        <sphereGeometry args={[0.22, 8, 8]} />
      </mesh>
      <mesh position={[x, y, halfWidth]} material={m.navGreen}>
        <sphereGeometry args={[0.22, 8, 8]} />
      </mesh>
    </>
  )
}

export function Helipad({ position, size = 16, rotation = 0 }) {
  const tex = useMemo(
    () =>
      canvasTexture(256, 256, (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h)
        ctx.strokeStyle = '#f0f0ea'
        ctx.lineWidth = 6
        ctx.beginPath()
        ctx.arc(w / 2, h / 2, w * 0.36, 0, Math.PI * 2)
        ctx.stroke()
        ctx.strokeStyle = '#e8c547'
        ctx.lineWidth = 4
        ctx.beginPath()
        ctx.moveTo(w * 0.04, h / 2)
        ctx.lineTo(w * 0.96, h / 2)
        ctx.stroke()
        ctx.fillStyle = '#f0f0ea'
        ctx.font = 'bold 110px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('H', w / 2, h / 2 + 6)
      }),
    []
  )
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, rotation]}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} polygonOffset polygonOffsetFactor={-2} />
    </mesh>
  )
}

export function Flag({ position, height = 6 }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = Math.sin(clock.elapsedTime * 2.2) * 0.25 + Math.PI
  })
  const m = mats()
  return (
    <group position={position}>
      <Cyl r={0.06} h={height} position={[0, height / 2, 0]} mat={m.black} />
      <group ref={ref} position={[0, height - 0.7, 0]}>
        <Box size={[1.8, 1.1, 0.04]} position={[0.95, 0, 0]} mat={m.red} />
      </group>
    </group>
  )
}

export function Anchor({ position, side = 1 }) {
  return <Box size={[1.3, 1.6, 0.3]} position={position} rotation={[0, 0, 0.2 * side]} mat={mats().black} />
}

// ---------- aircraft ----------

export function Jet({ position, rotation = 0, folded = false }) {
  const m = mats()
  const wing = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(0, 0)
    s.lineTo(-3.2, 4.8)
    s.lineTo(-4.6, 4.8)
    s.lineTo(-4.2, 0)
    s.closePath()
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: false })
    g.rotateX(Math.PI / 2)
    return g
  }, [])
  const tail = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(0, 0)
    s.lineTo(-1.6, 2.6)
    s.lineTo(-2.6, 2.6)
    s.lineTo(-2.4, 0)
    s.closePath()
    return new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: false })
  }, [])
  const jetMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8f979e', roughness: 0.45, metalness: 0.4 }), [])
  const span = folded ? 0.45 : 1
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* fuselage + nose */}
      <mesh material={jetMat} rotation={[0, 0, -Math.PI / 2]} scale={[0.75, 1, 0.9]}>
        <capsuleGeometry args={[0.85, 11, 6, 14]} />
      </mesh>
      <mesh material={jetMat} position={[7.2, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.55, 2.2, 12]} />
      </mesh>
      {/* canopy */}
      <mesh material={m.glass} position={[3.6, 0.6, 0]} scale={[1.8, 0.6, 0.6]}>
        <sphereGeometry args={[0.9, 14, 10]} />
      </mesh>
      {/* wings (both sides) */}
      <mesh geometry={wing} material={jetMat} position={[1.6, 0, 0.6]} scale={[1, 1, span]} />
      <mesh geometry={wing} material={jetMat} position={[1.6, 0, -0.6]} scale={[1, 1, -span]} />
      {/* twin canted tails */}
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={tail} material={jetMat} position={[-3.4, 0.5, s * 0.9]} rotation={[s * -0.35, 0, 0]} />
      ))}
      {/* tailplanes */}
      <Box size={[1.8, 0.12, 5]} position={[-5.2, 0, 0]} mat={jetMat} />
      {/* engine nozzles */}
      {[-0.45, 0.45].map((z) => (
        <Cyl key={z} r={0.45} r2={0.5} h={0.8} position={[-6.3, 0, z]} rotation={[0, 0, Math.PI / 2]} mat={m.gunmetal} />
      ))}
      {/* landing gear */}
      {[
        [4.5, 0],
        [-1, 1.4],
        [-1, -1.4],
      ].map(([x, z]) => (
        <Cyl key={`${x}${z}`} r={0.12} h={1} position={[x, -0.9, z]} mat={m.black} />
      ))}
    </group>
  )
}

export function Helicopter({ position, rotation = 0 }) {
  const m = mats()
  const body = useMemo(() => new THREE.MeshStandardMaterial({ color: '#6f777e', roughness: 0.55, metalness: 0.3 }), [])
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh material={body} rotation={[0, 0, -Math.PI / 2]} scale={[1, 1, 0.8]}>
        <capsuleGeometry args={[1.2, 4, 6, 14]} />
      </mesh>
      <mesh material={m.glass} position={[2.6, 0.3, 0]} scale={[0.9, 0.8, 1]}>
        <sphereGeometry args={[1, 14, 10]} />
      </mesh>
      <Cyl r={0.35} r2={0.2} h={7} position={[-5.5, 0.5, 0]} rotation={[0, 0, Math.PI / 2 + 0.05]} mat={body} />
      <Box size={[1.4, 2, 0.15]} position={[-9, 1.2, 0]} mat={body} />
      <Cyl r={0.25} h={1} position={[0, 1.6, 0]} mat={m.gunmetal} />
      {[0, 1, 2, 3].map((i) => (
        <Box key={i} size={[7.5, 0.06, 0.45]} position={[0, 2.15, 0]} rotation={[0, (i * Math.PI) / 2 + 0.4, 0]} mat={m.black} />
      ))}
      {[-1, 1].map((s) => (
        <Box key={s} size={[3.6, 0.2, 0.2]} position={[0, -1.5, s * 1.2]} mat={m.black} />
      ))}
    </group>
  )
}

export { smooth }

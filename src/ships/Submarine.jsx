import { useMemo } from 'react'
import * as THREE from 'three'
import { Box, Cyl, Flag, mats } from './parts'

const R = 5 // hull radius
const CENTER = -1.6 // hull axis below the waterline (surfaced, riding low)

// Anechoic tiles: dark rubbery coating with a faint tile pattern.
function tileMaterial() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#1b1f23'
  ctx.fillRect(0, 0, 256, 256)
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'
  ctx.lineWidth = 2
  for (let i = 0; i <= 256; i += 32) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i, 256)
    ctx.moveTo(0, i)
    ctx.lineTo(256, i)
    ctx.stroke()
  }
  for (let i = 0; i < 4000; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.1)'
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(4, 30)
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.15 })
}

// Teardrop hull: rounded nose, long parallel body, tapering tail.
function hullGeometry(L) {
  const pts = []
  const n = 120
  for (let i = 0; i <= n; i++) {
    const u = i / n
    let r
    if (u > 0.86) r = R * Math.sqrt(Math.max(0, 1 - Math.pow((u - 0.86) / 0.14, 2)))
    else if (u < 0.34) r = R * (0.1 + 0.9 * (1 - Math.pow((0.34 - u) / 0.34, 1.8)))
    else r = R
    pts.push(new THREE.Vector2(Math.max(r, 0.001), (u - 0.5) * L))
  }
  const g = new THREE.LatheGeometry(pts, 48)
  g.rotateZ(-Math.PI / 2) // axis along +x, nose forward
  return g
}

// Streamlined sail outline (top view), extruded upward.
function sailGeometry(len, width, height) {
  const s = new THREE.Shape()
  const n = 24
  const top = []
  for (let i = 0; i <= n; i++) {
    const t = i / n // 0 = leading edge, 1 = trailing edge
    const thick = (width / 2) * (t < 0.3 ? Math.sqrt(t / 0.3) : 1 - Math.pow((t - 0.3) / 0.7, 2) * 0.75)
    top.push([len / 2 - t * len, thick])
  }
  s.moveTo(top[0][0], 0)
  top.forEach(([x, z]) => s.lineTo(x, -z))
  for (let i = top.length - 1; i >= 0; i--) s.lineTo(top[i][0], top[i][1])
  const g = new THREE.ExtrudeGeometry(s, { depth: height, bevelEnabled: true, bevelThickness: 0.4, bevelSize: 0.3, bevelSegments: 3 })
  g.rotateX(-Math.PI / 2)
  return g
}

// Trapezoid control fin.
function finGeometry(root, tip, span, thick = 0.35) {
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  s.lineTo(root, 0)
  s.lineTo(root - (root - tip) * 0.3, span)
  s.lineTo((root - tip) * 0.7 - (root - tip) * 0.3 - 0.5, span)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false })
  g.translate(-root, 0, -thick / 2)
  return g
}

export default function Submarine({ length: L }) {
  const m = mats()
  const tile = useMemo(tileMaterial, [])
  const hull = useMemo(() => hullGeometry(L), [L])
  const sail = useMemo(() => sailGeometry(15, 3.2, 8.5), [])
  const fin = useMemo(() => finGeometry(7, 3.5, 5.2), [])
  const sailX = L * 0.2
  const sailTop = R + 8.5

  return (
    <group position={[0, CENTER, 0]}>
      <mesh geometry={hull} material={tile} />

      {/* Flat deck casing along the top, with hatches and a safety track */}
      <Box size={[L * 0.56, 0.6, 3.6]} position={[L * 0.03, R - 0.15, 0]} mat={tile} />
      <Box size={[L * 0.5, 0.04, 0.12]} position={[L * 0.03, R + 0.17, 0]} mat={m.gunmetal} />
      {[-0.18, -0.1, 0.08, 0.32, 0.36].map((f) => (
        <Cyl key={f} r={0.65} h={0.12} position={[L * f, R + 0.2, f > 0.3 ? 0 : 0.9]} seg={18} mat={m.rubber} />
      ))}

      {/* Sail (conning tower) */}
      <group position={[sailX, R - 0.4, 0]}>
        <mesh geometry={sail} material={tile} />
        {/* fairwater planes */}
        <mesh geometry={finGeometry(3.2, 2.2, 5.2, 0.3)} material={tile} position={[5, 5.4, 1.6]} rotation={[Math.PI / 2, 0, 0]} />
        <mesh geometry={finGeometry(3.2, 2.2, 5.2, 0.3)} material={tile} position={[5, 5.4, -1.6]} rotation={[-Math.PI / 2, 0, 0]} />
        {/* bridge cockpit and windscreen */}
        <Box size={[2, 0.6, 1.8]} position={[5.4, 8.75, 0]} mat={m.black} />
        <Box size={[0.08, 0.6, 1.8]} position={[6.4, 9.3, 0]} rotation={[0, 0, -0.3]} mat={m.glass} />
        {/* masts: two periscopes, radar, comms, snorkel */}
        <Cyl r={0.22} h={4.2} position={[3, sailTop + 1.7 - R + 0.4, 0]} mat={m.gunmetal} />
        <Cyl r={0.32} h={0.8} position={[3, sailTop + 3.6 - R + 0.4, 0]} mat={m.glass} />
        <Cyl r={0.2} h={3} position={[1.4, sailTop + 1.1 - R + 0.4, 0.5]} mat={m.gunmetal} />
        <Box size={[0.4, 1.6, 1.6]} position={[-0.6, sailTop + 0.8 - R + 0.4, -0.4]} mat={m.gunmetal} />
        <Cyl r={0.06} h={5} position={[-2.2, sailTop + 2.1 - R + 0.4, 0]} mat={m.black} />
        <Box size={[1.2, 1.8, 0.7]} position={[-4, sailTop + 0.5 - R + 0.4, 0]} mat={m.gunmetal} />
        {/* navigation lights */}
        <mesh position={[4, 7.5, 1.75]} material={m.navGreen}>
          <sphereGeometry args={[0.16, 8, 8]} />
        </mesh>
        <mesh position={[4, 7.5, -1.75]} material={m.navRed}>
          <sphereGeometry args={[0.16, 8, 8]} />
        </mesh>
        <mesh position={[3.4, sailTop - R + 0.6, 0]} material={m.navWhite}>
          <sphereGeometry args={[0.14, 8, 8]} />
        </mesh>
        <Flag position={[-3, 8.9, 0]} height={3} />
      </group>

      {/* Stern: cross-shaped control fins and a pump-jet shroud */}
      <group position={[-L / 2 + 9.5, 0, 0]}>
        {[0, 1, 2, 3].map((i) => (
          <group key={i} rotation={[(i * Math.PI) / 2, 0, 0]}>
            <mesh geometry={fin} material={tile} position={[0, 1.2, 0]} />
          </group>
        ))}
      </group>
      <group position={[-L / 2 + 1.6, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <mesh material={tile}>
          <cylinderGeometry args={[2.1, 2.3, 3.6, 32, 1, true]} />
        </mesh>
        <mesh material={m.gunmetal} position={[0, -1.4, 0]}>
          <coneGeometry args={[0.9, 2.4, 20]} />
        </mesh>
      </group>

      {/* Draft marks near bow and stern */}
      {[L * 0.42, -L * 0.36].map((x) =>
        [-1, 1].map((s) =>
          [0, 1, 2].map((k) => (
            <Box key={`${x}${s}${k}`} size={[0.5, 0.18, 0.05]} position={[x, -CENTER - 0.4 - k * 0.6, s * (R * 0.98)]} mat={m.white} />
          ))
        )
      )}
    </group>
  )
}

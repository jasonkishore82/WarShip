import { useMemo } from 'react'
import * as THREE from 'three'
import { Anchor, Boat, Box, Cyl, Flag, Mast, NavLights, Radar, ShipHull, TaperBox, Windows, makeHullSpec, mats } from './parts'

const CANVAS = new THREE.MeshStandardMaterial({ color: '#d9d2bd', roughness: 0.95 }) // gun blast bags

// Main battery turret: armoured house, three tapered barrels, rangefinder arms.
function MainTurret({ position, rotation = 0, barbette = 2 }) {
  const m = mats()
  const house = useMemo(() => {
    const s = new THREE.Shape()
    const pts = [
      [-4.6, -4.3],
      [2.8, -3.8],
      [5, -2.6],
      [5, 2.6],
      [2.8, 3.8],
      [-4.6, 4.3],
    ]
    s.moveTo(pts[0][0], -pts[0][1])
    pts.slice(1).forEach(([x, z]) => s.lineTo(x, -z))
    s.closePath()
    const g = new THREE.ExtrudeGeometry(s, { depth: 3, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.25, bevelSegments: 2 })
    g.rotateX(-Math.PI / 2)
    return g
  }, [])
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <Cyl r={4.7} h={barbette} position={[0, -barbette / 2 + 0.2, 0]} seg={28} mat={m.hazeDark} />
      <mesh geometry={house} position={[0, 0.2, 0]} material={m.haze} />
      {/* rangefinder arms out the back corners */}
      <Box size={[1.1, 1, 11.4]} position={[-3.2, 2.9, 0]} mat={m.hazeDark} />
      {[-1, 1].map((s) => (
        <Box key={s} size={[1.4, 1.3, 0.8]} position={[-3.2, 2.9, s * 5.9]} mat={m.hazeDark} />
      ))}
      {/* roof hatches and sights */}
      <Box size={[1.2, 0.5, 1.2]} position={[1.2, 3.6, -2.2]} mat={m.hazeDark} />
      <Box size={[1.2, 0.5, 1.2]} position={[1.2, 3.6, 2.2]} mat={m.hazeDark} />
      {[-1.65, 0, 1.65].map((z) => (
        <group key={z} position={[5, 1.6, z]} rotation={[0, 0, 0.04]}>
          <Cyl r={0.72} r2={0.8} h={1.3} position={[0.6, 0, 0]} rotation={[0, 0, Math.PI / 2]} mat={CANVAS} />
          <Cyl r={0.3} r2={0.48} h={16} position={[8.6, 0, 0]} rotation={[0, 0, Math.PI / 2]} mat={m.gunmetal} />
          <Cyl r={0.36} h={0.5} position={[16.4, 0, 0]} rotation={[0, 0, Math.PI / 2]} mat={m.gunmetal} />
        </group>
      ))}
    </group>
  )
}

// Twin dual-purpose secondary mount.
function SecondaryMount({ position, rotation = 0 }) {
  const m = mats()
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <Cyl r={1.7} h={0.5} position={[0, 0.25, 0]} mat={m.hazeDark} />
      <TaperBox size={[3.8, 2, 3]} taper={0.8} taperX={0.85} position={[-0.2, 1.4, 0]} />
      {[-0.55, 0.55].map((z) => (
        <Cyl key={z} r={0.13} r2={0.17} h={5} position={[3.6, 1.6, z]} rotation={[0, 0, Math.PI / 2 - 0.12]} mat={m.gunmetal} />
      ))}
    </group>
  )
}

// Quad anti-aircraft gun in a circular tub.
function AATub({ position, rotation = 0 }) {
  const m = mats()
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh material={m.haze} position={[0, 0.55, 0]}>
        <cylinderGeometry args={[1.8, 1.8, 1.1, 20, 1, true]} />
      </mesh>
      <Box size={[1.4, 0.9, 1.6]} position={[0, 0.7, 0]} mat={m.hazeDark} />
      {[-0.5, -0.17, 0.17, 0.5].map((z) => (
        <Cyl key={z} r={0.06} h={2.6} position={[1.4, 1.4, z]} rotation={[0, 0, Math.PI / 2 - 0.6]} mat={m.gunmetal} />
      ))}
    </group>
  )
}

function Searchlight({ position, rotation = 0 }) {
  const m = mats()
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <Cyl r={0.12} h={0.8} position={[0, 0.4, 0]} mat={m.hazeDark} />
      <Cyl r={0.5} h={0.9} position={[0.2, 1, 0]} rotation={[0, 0, Math.PI / 2]} mat={m.hazeDark} />
      <Cyl r={0.42} h={0.05} position={[0.66, 1, 0]} rotation={[0, 0, Math.PI / 2]} mat={m.glass} />
    </group>
  )
}

function Funnel({ position, h = 10 }) {
  const m = mats()
  return (
    <group position={position} rotation={[0, 0, 0.09]}>
      <mesh material={m.haze} position={[0, h / 2, 0]} scale={[1, 1, 0.62]}>
        <cylinderGeometry args={[3, 3.3, h, 28]} />
      </mesh>
      {/* black cap with grill */}
      <mesh material={m.black} position={[0, h + 0.35, 0]} scale={[1, 1, 0.62]}>
        <cylinderGeometry args={[3.05, 3, 0.7, 28]} />
      </mesh>
      {[-1.5, 0, 1.5].map((x) => (
        <Box key={x} size={[0.15, 0.3, 3.4]} position={[x, h + 0.75, 0]} mat={m.black} />
      ))}
      {/* steam pipes up the back */}
      <Cyl r={0.25} h={h + 1.5} position={[-3.1, h / 2 + 0.5, 0.7]} mat={m.hazeLight} />
      <Cyl r={0.2} h={h + 1.2} position={[-3.1, h / 2 + 0.4, -0.7]} mat={m.hazeLight} />
      {/* searchlight platform */}
      <Cyl r={4} h={0.25} position={[0, h * 0.62, 0]} seg={24} mat={m.hazeDark} />
      <Searchlight position={[2.6, h * 0.62, 1.8]} rotation={0.5} />
      <Searchlight position={[2.6, h * 0.62, -1.8]} rotation={-0.5} />
    </group>
  )
}

function Floatplane({ position, rotation = 0 }) {
  const m = mats()
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh material={m.hazeLight} rotation={[0, 0, -Math.PI / 2]} scale={[0.8, 1, 0.8]}>
        <capsuleGeometry args={[0.7, 6, 6, 12]} />
      </mesh>
      <Box size={[2, 0.15, 11]} position={[0.8, 0.5, 0]} mat={m.hazeLight} />
      <Box size={[1, 0.12, 3.6]} position={[-3.6, 0.3, 0]} mat={m.hazeLight} />
      <Box size={[1, 1.6, 0.12]} position={[-3.6, 1, 0]} mat={m.hazeLight} />
      <mesh material={m.glass} position={[1, 0.65, 0]} scale={[1.6, 0.5, 0.55]}>
        <sphereGeometry args={[0.8, 12, 8]} />
      </mesh>
      <mesh material={m.hazeLight} position={[0.5, -1.6, 0]} rotation={[0, 0, -Math.PI / 2]} scale={[0.5, 1, 0.5]}>
        <capsuleGeometry args={[0.7, 4.5, 4, 10]} />
      </mesh>
      <Cyl r={0.1} h={1.2} position={[0.8, -0.8, 0]} mat={m.black} />
      <Box size={[0.15, 2.6, 0.12]} position={[3.6, 0, 0]} mat={m.black} />
    </group>
  )
}

export default function Battleship({ length: L }) {
  const m = mats()
  const spec = useMemo(
    () => makeHullSpec({ length: L, beam: 24, draft: 7, freeboard: 6, sheer: 0.55, flare: 0.22, bowStart: 0.5, sternWidth: 0.45, rake: 0.06 }),
    [L]
  )
  const d = spec.deckY
  const ss = d(0) + 3 // superstructure deck level

  return (
    <group>
      <ShipHull spec={spec} deckMat={m.teak} railOpts={{ from: 0.03, to: 0.95, spacing: 2.4 }} />

      {/* Foredeck: breakwater, anchor windlasses and chains */}
      <group position={[L * 0.36, d(L * 0.36), 0]}>
        {[-1, 1].map((s) => (
          <Box key={s} size={[0.3, 1.2, 9]} position={[0, 0.6, s * 3.2]} rotation={[0, s * 0.55, 0]} mat={m.haze} />
        ))}
      </group>
      {[-1, 1].map((s) => (
        <group key={s}>
          <Cyl r={0.8} h={0.9} position={[L * 0.4, d(L * 0.4) + 0.45, s * 2.2]} mat={m.black} />
          <Box size={[L * 0.06, 0.15, 0.3]} position={[L * 0.43, d(L * 0.43) + 0.1, s * 2.6]} rotation={[0, s * -0.12, 0]} mat={m.black} />
          <Anchor position={[L * 0.44, d(L * 0.44) - 2, s * (spec.halfAt(L * 0.44) + 0.1)]} side={s} />
        </group>
      ))}
      <Cyl r={0.07} h={5} position={[L / 2 + 2.5, d(L / 2) + 2.5, 0]} mat={m.black} />

      {/* Main battery: A, B (superfiring) and C (aft) */}
      <MainTurret position={[L * 0.29, d(L * 0.29), 0]} />
      <Cyl r={5} h={3} position={[L * 0.185, d(L * 0.185) + 1.5, 0]} seg={28} mat={m.haze} />
      <MainTurret position={[L * 0.185, d(L * 0.185) + 3, 0]} barbette={0.4} />
      <MainTurret position={[-L * 0.3, d(-L * 0.3), 0]} rotation={Math.PI} />

      {/* Forward superstructure and tower bridge */}
      <group position={[L * 0.06, 0, 0]}>
        <Box size={[30, 3, 15]} position={[0, d(0) + 1.5, 0]} />
        {/* armoured conning tower with vision slits */}
        <Cyl r={2.4} h={4} position={[8, ss + 2, 0]} seg={20} mat={m.hazeDark} />
        <Cyl r={2.42} h={0.35} position={[8, ss + 3.3, 0]} seg={20} mat={m.glass} />
        {/* bridge levels */}
        <Box size={[13, 2.6, 12]} position={[3, ss + 1.3, 0]} />
        <Windows size={[0.1, 0.9, 10]} position={[9.55, ss + 1.7, 0]} />
        <Box size={[10, 2.4, 9.5]} position={[2, ss + 3.8, 0]} mat={m.hazeLight} />
        <Windows size={[10.05, 0.8, 9.55]} position={[2, ss + 4.3, 0]} />
        {/* bridge wings */}
        <Box size={[3, 0.3, 17]} position={[5, ss + 2.7, 0]} mat={m.hazeDark} />
        {/* tower mast with platforms and searchlights */}
        <TaperBox size={[6, 13, 6]} taper={0.55} taperX={0.6} position={[0, ss + 11.5, 0]} />
        {[ss + 8, ss + 12.5].map((y) => (
          <Box key={y} size={[7, 0.3, 8]} position={[0.5, y, 0]} mat={m.hazeDark} />
        ))}
        <Searchlight position={[2.5, ss + 8.2, 3]} rotation={0.4} />
        <Searchlight position={[2.5, ss + 8.2, -3]} rotation={-0.4} />
        <Windows size={[0.1, 0.8, 4]} position={[2.8, ss + 10, 0]} />
        {/* main gun director with long rangefinder and radar mattress */}
        <Box size={[4, 2.2, 3.4]} position={[0.5, ss + 19, 0]} mat={m.hazeDark} />
        <Box size={[1, 0.8, 9]} position={[0.5, ss + 19.2, 0]} mat={m.hazeDark} />
        <Box size={[0.3, 1.6, 3.6]} position={[0.5, ss + 21, 0]} mat={m.radar} />
        <Mast position={[-5, ss + 3, 0]} height={22} yard={10} radar={false} />
        <Radar position={[-5, ss + 22, 0]} width={5.5} bar speed={0.8} />
        <NavLights x={4} y={ss + 2.9} halfWidth={8.6} />
      </group>

      {/* Funnels with boats and a crane between them */}
      <Funnel position={[-L * 0.035, ss, 0]} h={10} />
      <Funnel position={[-L * 0.1, ss, 0]} h={9} />
      <Box size={[26, 3, 13]} position={[-L * 0.07, d(0) + 1.5, 0]} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <Boat position={[-L * 0.07, ss + 0.6, s * 5.2]} length={8} />
          <Boat position={[-L * 0.12, ss + 0.6, s * 5.2]} length={6.5} />
        </group>
      ))}
      <Cyl r={0.3} h={9} position={[-L * 0.067, ss + 4.5, 0]} mat={m.hazeDark} />
      <Box size={[12, 0.4, 0.4]} position={[-L * 0.067 + 4, ss + 8.6, 0]} rotation={[0, 0, -0.35]} mat={m.hazeDark} />

      {/* Aft superstructure, director and mainmast */}
      <Box size={[16, 3, 11]} position={[-L * 0.18, d(0) + 1.5, 0]} />
      <Box size={[9, 2.4, 8]} position={[-L * 0.17, ss + 1.2, 0]} mat={m.hazeLight} />
      <Box size={[3.6, 2, 3]} position={[-L * 0.17 - 1, ss + 3.4, 0]} mat={m.hazeDark} />
      <Box size={[0.9, 0.7, 7]} position={[-L * 0.17 - 1, ss + 3.6, 0]} mat={m.hazeDark} />
      <Mast position={[-L * 0.15, ss + 2.4, 0]} height={14} yard={8} radar />

      {/* Secondary battery: four twin mounts each side */}
      {[L * 0.1, L * 0.02, -L * 0.06, -L * 0.14].map((x) =>
        [-1, 1].map((s) => (
          <SecondaryMount key={`${x}${s}`} position={[x, d(0) + 3, s * 6]} rotation={s * (Math.PI / 2) * 0.55 + (x < 0 ? s * 0.6 : 0)} />
        ))
      )}

      {/* Anti-aircraft tubs along the deck edges */}
      {[L * 0.24, L * 0.13, -L * 0.21, -L * 0.25].map((x) =>
        [-1, 1].map((s) => <AATub key={`${x}${s}`} position={[x, d(x), s * (spec.halfAt(x) - 2.4)]} rotation={s * 1.2} />)
      )}

      {/* Stern catapult, floatplane and aircraft crane */}
      <group position={[-L * 0.42, d(-L * 0.42), 0]}>
        <Cyl r={1.4} h={1} position={[0, 0.5, 0]} mat={m.hazeDark} />
        <Box size={[16, 0.9, 1.2]} position={[3, 1.3, 0]} rotation={[0, 0.6, 0]} mat={m.hazeDark} />
        <Floatplane position={[3, 3.4, 0]} rotation={0.6} />
        <Cyl r={0.35} h={7} position={[-6, 3.5, 0]} mat={m.hazeDark} />
        <Box size={[10, 0.4, 0.4]} position={[-2, 6.6, 0]} rotation={[0, 0, 0.3]} mat={m.hazeDark} />
      </group>
      <Flag position={[-L / 2 - 1.5, d(-L / 2) - 0.2, 0]} height={6} />
    </group>
  )
}

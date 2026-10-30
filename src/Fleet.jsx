import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { waterHeight } from './waves'
import { FLEET, shipTransform } from './fleetConfig'

// ---------- shared materials ----------
const MAT = {
  hull: new THREE.MeshStandardMaterial({ color: '#4a5058', metalness: 0.35, roughness: 0.55 }),
  deck: new THREE.MeshStandardMaterial({ color: '#6f747a', metalness: 0.2, roughness: 0.8 }),
  upper: new THREE.MeshStandardMaterial({ color: '#80868d', metalness: 0.3, roughness: 0.6 }),
  dark: new THREE.MeshStandardMaterial({ color: '#2e3338', metalness: 0.5, roughness: 0.5 }),
  glass: new THREE.MeshStandardMaterial({ color: '#14191e', metalness: 0.8, roughness: 0.15 }),
  flight: new THREE.MeshStandardMaterial({ color: '#3b3f44', metalness: 0.1, roughness: 0.9 }),
  stripe: new THREE.MeshStandardMaterial({ color: '#e8e4d8', roughness: 0.7 }),
  sub: new THREE.MeshStandardMaterial({ color: '#3a434b', metalness: 0.3, roughness: 0.45 }),
  subDeck: new THREE.MeshStandardMaterial({ color: '#4d565e', metalness: 0.2, roughness: 0.7 }),
  plane: new THREE.MeshStandardMaterial({ color: '#9aa1a8', metalness: 0.4, roughness: 0.5 }),
}

// Hull with a pointed bow (+x) and rounded stern. Deck at y = freeboard.
function useHull(length, beam, depth, freeboard, bowFrac = 0.2) {
  return useMemo(() => {
    const L = length / 2
    const B = beam / 2
    const bowStart = L - length * bowFrac
    const s = new THREE.Shape()
    s.moveTo(-L, -B)
    s.lineTo(bowStart, -B)
    s.quadraticCurveTo(L - length * bowFrac * 0.3, -B * 0.9, L, 0)
    s.quadraticCurveTo(L - length * bowFrac * 0.3, B * 0.9, bowStart, B)
    s.lineTo(-L, B)
    s.quadraticCurveTo(-L - beam * 0.25, 0, -L, -B)
    const geo = new THREE.ExtrudeGeometry(s, {
      depth: depth + freeboard,
      bevelEnabled: true,
      bevelThickness: 0.4,
      bevelSize: 0.4,
      bevelSegments: 2,
      curveSegments: 16,
    })
    geo.rotateX(-Math.PI / 2)
    geo.translate(0, -depth, 0)
    geo.computeVertexNormals()
    return geo
  }, [length, beam, depth, freeboard, bowFrac])
}

function Hull({ length, beam, depth, freeboard, bowFrac }) {
  const geo = useHull(length, beam, depth, freeboard, bowFrac)
  return <mesh geometry={geo} material={[MAT.deck, MAT.hull]} />
}

function Box({ size, position, rotation, mat = MAT.upper }) {
  return (
    <mesh position={position} rotation={rotation} material={mat}>
      <boxGeometry args={size} />
    </mesh>
  )
}

function Turret({ position, radius = 2.5, barrelLength = 9, barrels = 2, rotation = 0 }) {
  const spread = radius * 0.35
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh material={MAT.upper}>
        <cylinderGeometry args={[radius * 0.85, radius, radius * 0.7, 20]} />
      </mesh>
      {Array.from({ length: barrels }, (_, i) => {
        const z = (i - (barrels - 1) / 2) * spread
        return (
          <mesh
            key={i}
            material={MAT.dark}
            position={[radius * 0.6 + barrelLength / 2, radius * 0.1, z]}
            rotation={[0, 0, Math.PI / 2 - 0.04]}
          >
            <cylinderGeometry args={[radius * 0.09, radius * 0.12, barrelLength, 8]} />
          </mesh>
        )
      })}
    </group>
  )
}

function Funnel({ position, radius, height }) {
  return (
    <group position={position} rotation={[0, 0, 0.1]}>
      <mesh material={MAT.upper} position={[0, height / 2, 0]}>
        <cylinderGeometry args={[radius * 0.85, radius, height, 20]} />
      </mesh>
      <mesh material={MAT.dark} position={[0, height + 0.15, 0]}>
        <cylinderGeometry args={[radius * 0.87, radius * 0.87, 0.4, 20]} />
      </mesh>
    </group>
  )
}

function Mast({ position, height }) {
  return (
    <group position={position}>
      <mesh material={MAT.dark} position={[0, height / 2, 0]}>
        <cylinderGeometry args={[0.15, 0.3, height, 8]} />
      </mesh>
      <Box size={[0.25, 0.25, height * 0.4]} position={[0, height * 0.8, 0]} mat={MAT.dark} />
    </group>
  )
}

// ---------- ship models (bow along +x, deck at y = freeboard) ----------

function Carrier({ length }) {
  const fb = 6
  const deckW = 30
  const planes = [-0.3, -0.15, 0.0, 0.15]
  return (
    <group>
      <Hull length={length * 0.94} beam={22} depth={8} freeboard={fb} bowFrac={0.15} />
      {/* Flight deck overhangs the hull */}
      <Box size={[length, 1.2, deckW]} position={[0, fb + 1.2, 0]} mat={MAT.flight} />
      <Box size={[length * 0.9, 0.05, 0.6]} position={[0, fb + 1.83, 0]} mat={MAT.stripe} />
      <Box
        size={[length * 0.5, 0.05, 0.6]}
        position={[-length * 0.12, fb + 1.84, -5]}
        rotation={[0, 0.16, 0]}
        mat={MAT.stripe}
      />
      {/* Island on the starboard side */}
      <group position={[length * 0.08, fb + 1.8, deckW / 2 - 4]}>
        <Box size={[22, 10, 6]} position={[0, 5, 0]} />
        <Box size={[12, 4, 5.6]} position={[2, 12, 0]} />
        <Box size={[0.1, 1.2, 4.8]} position={[8.05, 12.4, 0]} mat={MAT.glass} />
        <Mast position={[2, 14, 0]} height={10} />
      </group>
      {/* Parked aircraft */}
      {planes.map((f, i) => (
        <group key={i} position={[length * f, fb + 2.6, -9 + (i % 2) * 5]} rotation={[0, 0.5, 0]}>
          <Box size={[11, 1.4, 1.6]} position={[0, 0, 0]} mat={MAT.plane} />
          <Box size={[3, 0.3, 10]} position={[-0.5, 0, 0]} mat={MAT.plane} />
          <Box size={[1.6, 0.3, 4]} position={[-4.8, 0.3, 0]} mat={MAT.plane} />
        </group>
      ))}
    </group>
  )
}

function Battleship({ length }) {
  const fb = 5
  return (
    <group>
      <Hull length={length} beam={22} depth={7} freeboard={fb} />
      <Box size={[34, 6, 14]} position={[-4, fb + 3, 0]} />
      <Box size={[14, 5, 11]} position={[4, fb + 8.5, 0]} />
      <Box size={[0.1, 1.4, 9]} position={[11.05, fb + 9.5, 0]} mat={MAT.glass} />
      <Funnel position={[-12, fb + 6, 0]} radius={3} height={9} />
      <Mast position={[4, fb + 11, 0]} height={16} />
      <Turret position={[length * 0.3, fb + 1.2, 0]} radius={4} barrelLength={14} barrels={3} />
      <Turret position={[length * 0.18, fb + 3.2, 0]} radius={4} barrelLength={14} barrels={3} />
      <Box size={[8, 2, 8]} position={[length * 0.18, fb + 1, 0]} />
      <Turret position={[-length * 0.3, fb + 1.2, 0]} radius={4} barrelLength={14} barrels={3} rotation={Math.PI} />
    </group>
  )
}

function Cruiser({ length }) {
  const fb = 4.5
  return (
    <group>
      <Hull length={length} beam={14} depth={5} freeboard={fb} />
      <Box size={[30, 4.5, 9]} position={[-2, fb + 2.25, 0]} />
      <Box size={[10, 4, 7.5]} position={[7, fb + 6.5, 0]} />
      <Box size={[0.1, 1.2, 6]} position={[12.05, fb + 7.3, 0]} mat={MAT.glass} />
      <Funnel position={[-6, fb + 4.5, 0]} radius={1.9} height={7} />
      <Funnel position={[-13, fb + 4.5, 0]} radius={1.9} height={6} />
      <Mast position={[6, fb + 8.5, 0]} height={13} />
      <Turret position={[length * 0.3, fb + 1, 0]} radius={3} barrelLength={10} />
      <Turret position={[-length * 0.3, fb + 1, 0]} radius={3} barrelLength={10} rotation={Math.PI} />
    </group>
  )
}

function Submarine({ length }) {
  const r = 4.5
  const sailX = length * 0.18
  return (
    // Surfaced: the top of the hull, deck casing and sail sit above the water.
    <group position={[0, -1.6, 0]}>
      {/* Pressure hull, lying along x */}
      <mesh material={MAT.sub} rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[r, length - r * 2, 8, 32]} />
      </mesh>
      {/* Flat deck casing along the top */}
      <Box size={[length * 0.72, 1.2, 3.2]} position={[length * 0.04, r - 0.2, 0]} mat={MAT.subDeck} />

      {/* Sail (conning tower) with rounded front and dive planes */}
      <group position={[sailX, r + 0.4, 0]}>
        <Box size={[11, 7, 3]} position={[-1.5, 3.5, 0]} mat={MAT.sub} />
        <mesh material={MAT.sub} position={[4, 3.5, 0]} scale={[1.6, 1, 1]}>
          <cylinderGeometry args={[1.5, 1.5, 7, 20]} />
        </mesh>
        <Box size={[2.6, 0.35, 10]} position={[1.5, 4.8, 0]} mat={MAT.sub} />
        <Box size={[9, 0.4, 2.6]} position={[-1, 7.2, 0]} mat={MAT.subDeck} />
        {[-2.5, -0.5, 1.2].map((x, i) => (
          <mesh key={x} material={MAT.dark} position={[x, 8.5 + i * 0.4, 0]}>
            <cylinderGeometry args={[0.22, 0.22, 3 + i * 0.8, 8]} />
          </mesh>
        ))}
      </group>

      {/* Stern cross fins and propeller hub */}
      <group position={[-length / 2 + 6, 0, 0]}>
        <Box size={[5, 0.4, 12]} mat={MAT.sub} />
        <Box size={[5, 10, 0.4]} mat={MAT.sub} />
      </group>
      <mesh material={MAT.dark} position={[-length / 2 - 0.5, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.6, 1.2, 2, 12]} />
      </mesh>
    </group>
  )
}

function Destroyer({ length }) {
  const fb = 3.5
  return (
    <group>
      <Hull length={length} beam={9} depth={3.5} freeboard={fb} bowFrac={0.25} />
      <Box size={[18, 3.5, 6.5]} position={[0, fb + 1.75, 0]} />
      <Box size={[7, 3, 5.5]} position={[5, fb + 5, 0]} />
      <Box size={[0.1, 1, 4.5]} position={[8.55, fb + 5.6, 0]} mat={MAT.glass} />
      <Funnel position={[-4, fb + 3.5, 0]} radius={1.3} height={5} />
      <Mast position={[4, fb + 6.5, 0]} height={10} />
      <Turret position={[length * 0.3, fb + 0.8, 0]} radius={2} barrelLength={7} barrels={1} />
      <Turret position={[-length * 0.32, fb + 0.8, 0]} radius={2} barrelLength={7} barrels={1} rotation={Math.PI} />
    </group>
  )
}

const MODELS = { carrier: Carrier, battleship: Battleship, cruiser: Cruiser, submarine: Submarine, destroyer: Destroyer }

// ---------- buoyancy physics ----------
//
// Each ship is a rigid body that can heave (move up/down), pitch and roll.
// It stays in its grid cell (x/z are fixed), but floats on a set of points
// spread along its hull. Every point that is under water pushes up with a
// force proportional to how deep it is (Archimedes), gravity pulls down,
// and water drag damps the motion. The waves move the points, so the ship
// is pushed around by the sea and carries momentum, overshoot and rocking.

const PHYS = {
  carrier: { beam: 22, draft: 8, freeboard: 7 },
  battleship: { beam: 22, draft: 7, freeboard: 5 },
  cruiser: { beam: 14, draft: 5, freeboard: 4.5 },
  submarine: { beam: 9, draft: 6, freeboard: 3 },
  destroyer: { beam: 9, draft: 3.5, freeboard: 3.5 },
}

const STEP = 1 / 120 // fixed physics step (seconds)

function useBuoyancy(ship, t) {
  return useMemo(() => {
    const p = PHYS[ship.type]
    const c = Math.cos(t.heading)
    const s = Math.sin(t.heading)
    const points = []
    const rows = 7
    for (let i = 0; i < rows; i++) {
      const lx = (i / (rows - 1) - 0.5) * t.length * 0.88
      for (const side of [-1, 1]) {
        const lz = (side * p.beam) / 2
        points.push({ lx, lz, wx: t.x + lx * c + lz * s, wz: t.z - lx * s + lz * c })
      }
    }
    // Natural heave period grows with ship size (small boats bob faster).
    const period = 3 + t.length / 40
    const omega = (2 * Math.PI) / period
    const mean = (f) => points.reduce((a, q) => a + f(q), 0) / points.length
    return {
      ...p,
      points,
      stiffness: omega * omega, // buoyancy per metre of depth, per unit mass
      omega,
      pitchInertia: mean((q) => q.lx * q.lx),
      // Ships are tall and narrow, so they roll slower and more freely than they pitch.
      rollInertia: mean((q) => q.lz * q.lz) * 2.5,
      heading: t.heading,
    }
  }, [ship.type, t])
}

function FloatingShip({ ship }) {
  const t = useMemo(() => shipTransform(ship), [ship])
  const body = useBuoyancy(ship, t)
  const posRef = useRef()
  const tiltRef = useRef()
  const state = useRef({ y: 2, vy: 0, pitch: 0, vp: 0, roll: 0, vr: 0, acc: 0 })
  const heights = useMemo(() => new Float32Array(body.points.length), [body])

  useFrame((_, delta) => {
    const st = state.current
    const { points, stiffness: k, omega, draft, freeboard } = body
    const n = points.length

    // Water under each hull point (waves change slowly next to the physics step).
    for (let i = 0; i < n; i++) heights[i] = waterHeight(points[i].wx, points[i].wz)

    st.acc += Math.min(delta, 0.1)
    while (st.acc >= STEP) {
      st.acc -= STEP
      const sp = Math.sin(st.pitch)
      const sr = Math.sin(st.roll)
      let force = 0
      let pitchTorque = 0
      let rollTorque = 0
      for (let i = 0; i < n; i++) {
        const q = points[i]
        const pointY = st.y + q.lx * sp - q.lz * sr
        // How deep the hull bottom is at this point, capped once fully under.
        const depth = Math.min(Math.max(heights[i] - pointY + draft, 0), draft + freeboard)
        const f = k * depth
        force += f
        pitchTorque += q.lx * f
        rollTorque -= q.lz * f
      }
      force /= n
      pitchTorque /= n
      rollTorque /= n

      // Gravity balances buoyancy when the hull sits at its draft in calm water.
      const ay = force - k * draft - 2 * 0.35 * omega * st.vy
      const ap = pitchTorque / body.pitchInertia - 2 * 0.4 * omega * st.vp
      const rollOmega = omega / Math.sqrt(2.5)
      const ar = rollTorque / body.rollInertia - 2 * 0.12 * rollOmega * st.vr

      st.vy += ay * STEP
      st.vp += ap * STEP
      st.vr += ar * STEP
      st.y += st.vy * STEP
      st.pitch += st.vp * STEP
      st.roll += st.vr * STEP
    }

    posRef.current.position.y = st.y + 0.5
    tiltRef.current.rotation.set(st.roll, 0, st.pitch)
  })

  // Clicking a ship hits it: a downward impulse at the hit point makes it lurch and rock.
  const onHit = (e) => {
    e.stopPropagation()
    const st = state.current
    const dx = e.point.x - t.x
    const dz = e.point.z - t.z
    const c = Math.cos(body.heading)
    const s = Math.sin(body.heading)
    const lx = dx * c - dz * s
    const lz = dx * s + dz * c
    const strength = 4 * Math.sqrt(74 / t.length) // smaller ships get knocked harder
    st.vy -= strength
    st.vp -= (lx * strength) / body.pitchInertia
    st.vr += (lz * strength) / body.rollInertia
  }

  const Model = MODELS[ship.type]
  return (
    <group ref={posRef} position={[t.x, 0, t.z]} rotation={[0, t.heading, 0]}>
      <group
        ref={tiltRef}
        onClick={onHit}
        onPointerOver={() => (document.body.style.cursor = 'crosshair')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <Model length={t.length} />
      </group>
    </group>
  )
}

export default function Fleet({ ships = FLEET }) {
  return ships.map((ship) => <FloatingShip key={ship.type} ship={ship} />)
}

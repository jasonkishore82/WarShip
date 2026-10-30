import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { waterHeight } from './waves'
import { FLEET, SHIP_TYPES, cellAt, isValidPlacement, shipCells, shipTransform } from './fleetConfig'
import { GRID, cellCenter } from './grid'
import { SHIP_MODELS } from './ships'

// ---------- buoyancy physics ----------
//
// Each ship is a rigid body that can heave (move up/down), pitch and roll.
// It floats on a set of points spread along its hull. Every point that is
// under water pushes up with a force proportional to how deep it is
// (Archimedes), gravity pulls down, and water drag damps the motion.

const PHYS = {
  carrier: { beam: 22, draft: 8, freeboard: 7 },
  battleship: { beam: 22, draft: 7, freeboard: 5 },
  cruiser: { beam: 14, draft: 5, freeboard: 4.5 },
  submarine: { beam: 9, draft: 6, freeboard: 3 },
  destroyer: { beam: 9, draft: 3.5, freeboard: 3.5 },
}

const STEP = 1 / 120 // fixed physics step (seconds)
const LIFT = 10 // how high a ship floats while you hold it

function useBuoyancy(type, length) {
  return useMemo(() => {
    const p = PHYS[type]
    const points = []
    const rows = 7
    for (let i = 0; i < rows; i++) {
      const lx = (i / (rows - 1) - 0.5) * length * 0.88
      for (const side of [-1, 1]) points.push({ lx, lz: (side * p.beam) / 2 })
    }
    // Natural heave period grows with ship size (small boats bob faster).
    const omega = (2 * Math.PI) / (3 + length / 40)
    const mean = (f) => points.reduce((a, q) => a + f(q), 0) / points.length
    return {
      ...p,
      points,
      stiffness: omega * omega, // buoyancy per metre of depth, per unit mass
      omega,
      pitchInertia: mean((q) => q.lx * q.lx),
      // Ships are tall and narrow, so they roll slower and more freely than they pitch.
      rollInertia: mean((q) => q.lz * q.lz) * 2.5,
    }
  }, [type, length])
}

// Shortest signed angle from a to b.
function angleDelta(a, b) {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a))
}

function FloatingShip({ ship, side, held, hitters, onGrab, visible = true, sunk = false }) {
  const t = useMemo(() => shipTransform(ship, side), [ship, side])
  const body = useBuoyancy(ship.type, t.length)
  const posRef = useRef()
  const tiltRef = useRef()
  const state = useRef({
    x: t.x, z: t.z, heading: t.heading, lift: 0, sink: 0,
    y: 2, vy: 0, pitch: 0, vp: 0, roll: 0, vr: 0, acc: 0,
  })
  const heights = useMemo(() => new Float32Array(body.points.length), [body])

  useFrame((_, delta) => {
    const st = state.current
    const dt = Math.min(delta, 0.1)

    // Glide toward the target cells / heading, and lift while held.
    const glide = 1 - Math.exp(-dt * 8)
    st.x += (t.x - st.x) * glide
    st.z += (t.z - st.z) * glide
    st.heading += angleDelta(st.heading, t.heading) * glide
    st.lift += ((held ? LIFT : 0) - st.lift) * (1 - Math.exp(-dt * 6))
    // A sunk ship slowly settles until only the top of it is above water, listing over.
    const sinkDepth = body.freeboard + 6
    st.sink += ((sunk ? -sinkDepth : 0) - st.sink) * (1 - Math.exp(-dt * 0.45))
    const sinkFrac = -st.sink / sinkDepth

    // Water under each hull point at the ship's current position.
    const { points, stiffness: k, omega, draft, freeboard } = body
    const n = points.length
    const c = Math.cos(st.heading)
    const s = Math.sin(st.heading)
    for (let i = 0; i < n; i++) {
      const q = points[i]
      heights[i] = waterHeight(st.x + q.lx * c + q.lz * s, st.z - q.lx * s + q.lz * c)
    }

    st.acc += dt
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
      const ar = rollTorque / body.rollInertia - 2 * 0.12 * (omega / Math.sqrt(2.5)) * st.vr

      st.vy += ay * STEP
      st.vp += ap * STEP
      st.vr += ar * STEP
      st.y += st.vy * STEP
      st.pitch += st.vp * STEP
      st.roll += st.vr * STEP
    }

    posRef.current.position.set(st.x, st.y + 0.5 + st.lift + st.sink, st.z)
    posRef.current.rotation.set(0, st.heading, 0)
    tiltRef.current.rotation.set(st.roll + sinkFrac * 0.28, 0, st.pitch + sinkFrac * 0.07)
  })

  // A hit: a downward impulse at the hit point makes the ship lurch and rock.
  hitters.current[ship.type] = (point) => {
    const st = state.current
    const dx = point.x - st.x
    const dz = point.z - st.z
    const c = Math.cos(st.heading)
    const s = Math.sin(st.heading)
    const lx = dx * c - dz * s
    const lz = dx * s + dz * c
    const strength = 4 * Math.sqrt(74 / t.length) // smaller ships get knocked harder
    st.vy -= strength
    st.vp -= (lx * strength) / body.pitchInertia
    st.vr += (lz * strength) / body.rollInertia
  }

  const Model = SHIP_MODELS[ship.type]
  return (
    <group ref={posRef} visible={visible}>
      <group
        ref={tiltRef}
        {...(onGrab && {
          onPointerDown: (e) => onGrab(ship, e),
          onPointerOver: () => (document.body.style.cursor = 'grab'),
          onPointerOut: () => (document.body.style.cursor = ''),
        })}
      >
        <Model length={t.length} />
      </group>
    </group>
  )
}

// Glowing tiles under the cells a held ship would occupy.
const tileGeo = new THREE.PlaneGeometry(GRID.cell * 0.92, GRID.cell * 0.92).rotateX(-Math.PI / 2)
const tileMat = {
  ok: new THREE.MeshBasicMaterial({ color: '#3dff8b', transparent: true, opacity: 0.35, depthTest: false, depthWrite: false }),
  bad: new THREE.MeshBasicMaterial({ color: '#ff3d3d', transparent: true, opacity: 0.4, depthTest: false, depthWrite: false }),
}

function PlacementTiles({ ship, side, valid }) {
  return shipCells(ship).map(([c, r]) => {
    const [x, z] = cellCenter(side, c, r)
    return (
      <mesh
        key={`${c},${r}`}
        geometry={tileGeo}
        material={valid ? tileMat.ok : tileMat.bad}
        position={[x, 1, z]}
        renderOrder={10}
      />
    )
  })
}

// ---------- fleet + drag-and-drop placement ----------

const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

export default function Fleet({
  ships = FLEET,
  side = 'left',
  onChange,
  interactive = true, // drag to move (placement phase)
  hiddenTypes = [], // ships the viewer can't see (the enemy's, until sunk)
  sunkTypes = [],
  hitters: externalHitters, // lets the game knock ships around when shells land
}) {
  const { camera, gl, raycaster, controls } = useThree()
  const ownHitters = useRef({})
  const hitters = externalHitters || ownHitters
  const [drag, setDrag] = useState(null)
  const dragRef = useRef(null)
  dragRef.current = drag

  const onGrab = (ship, e) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const [c, r] = cellAt(e.point.x, e.point.z, side)
    const size = SHIP_TYPES[ship.type].size
    const along = ship.dir === 'h' ? c - ship.col : r - ship.row
    setDrag({
      type: ship.type,
      grab: Math.min(Math.max(along, 0), size - 1), // which cell of the ship you're holding
      cell: [c, r],
      preview: { ...ship },
      hitPoint: e.point.clone(),
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    })
    if (controls) controls.enabled = false
    document.body.style.cursor = 'grabbing'
  }

  const dragging = drag !== null

  useEffect(() => {
    if (!dragging) return undefined
    const el = gl.domElement
    const ndc = new THREE.Vector2()
    const hit = new THREE.Vector3()

    // Place the ship so the grabbed cell sits under the pointer.
    const anchor = (d, [c, r], dir) =>
      dir === 'h'
        ? { ...d.preview, dir, col: c - d.grab, row: r }
        : { ...d.preview, dir, col: c, row: r - d.grab }

    const onMove = (e) => {
      const d = dragRef.current
      if (!d) return
      const moved = d.moved || Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 5
      if (!moved) return
      const rect = el.getBoundingClientRect()
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      if (!raycaster.ray.intersectPlane(groundPlane, hit)) return
      const cell = cellAt(hit.x, hit.z, side)
      setDrag({ ...d, moved, cell, preview: anchor(d, cell, d.preview.dir) })
    }

    const onKey = (e) => {
      const d = dragRef.current
      if (!d || e.key.toLowerCase() !== 'r') return
      const dir = d.preview.dir === 'h' ? 'v' : 'h'
      setDrag({ ...d, moved: true, preview: anchor(d, d.cell, dir) })
    }

    const onUp = () => {
      const d = dragRef.current
      if (d) {
        if (!d.moved) {
          hitters.current[d.type]?.(d.hitPoint) // a plain click is a hit
        } else if (isValidPlacement(d.preview, ships)) {
          onChange?.(ships.map((s) => (s.type === d.type ? d.preview : s)))
        }
      }
      setDrag(null)
      if (controls) controls.enabled = true
      document.body.style.cursor = ''
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('keydown', onKey)
    }
  }, [dragging, ships, side, onChange, controls, camera, gl, raycaster])

  const valid = drag ? isValidPlacement(drag.preview, ships) : true

  return (
    <>
      {ships.map((ship) => {
        const isHeld = drag?.type === ship.type && drag.moved
        return (
          <FloatingShip
            key={ship.type}
            ship={isHeld ? drag.preview : ship}
            side={side}
            held={isHeld}
            hitters={hitters}
            onGrab={interactive ? onGrab : undefined}
            visible={!hiddenTypes.includes(ship.type)}
            sunk={sunkTypes.includes(ship.type)}
          />
        )
      })}
      {drag?.moved && <PlacementTiles ship={drag.preview} side={side} valid={valid} />}
    </>
  )
}

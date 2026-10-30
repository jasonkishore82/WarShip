import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { GRID, BOARD_WIDTH, cellCenter } from '../grid'
import { cellAt } from '../fleetConfig'
import { inBoard, key } from './logic'

const reticleMat = new THREE.MeshBasicMaterial({
  color: '#ffb020',
  transparent: true,
  opacity: 0.35,
  depthTest: false,
  depthWrite: false,
})
const bracketMat = new THREE.MeshBasicMaterial({ color: '#ffd166', depthTest: false, depthWrite: false })

function Reticle({ cell }) {
  const ref = useRef()
  const [x, z] = cellCenter('right', cell[0], cell[1])
  const s = GRID.cell
  useFrame(({ clock }) => {
    if (ref.current) ref.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 6) * 0.04)
  })
  const corner = s * 0.42
  const arm = s * 0.22
  return (
    <group ref={ref} position={[x, 1.5, z]}>
      <mesh rotation-x={-Math.PI / 2} material={reticleMat} renderOrder={20}>
        <planeGeometry args={[s * 0.9, s * 0.9]} />
      </mesh>
      {[[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([sx, sz]) => (
        <group key={`${sx}${sz}`} position={[sx * corner, 0.2, sz * corner]}>
          <mesh material={bracketMat} position={[-sx * arm / 2, 0, 0]} renderOrder={21}>
            <boxGeometry args={[arm, 0.3, 1.2]} />
          </mesh>
          <mesh material={bracketMat} position={[0, 0, -sz * arm / 2]} renderOrder={21}>
            <boxGeometry args={[1.2, 0.3, arm]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// Invisible surface over the enemy board: hover to aim, click to fire.
export default function TargetBoard({ shots, enabled, aim, onFire }) {
  const [hover, setHover] = useState(null)
  const cx = GRID.gap + BOARD_WIDTH / 2

  const cellFrom = (e) => {
    const cell = cellAt(e.point.x, e.point.z, 'right')
    return inBoard(cell[0], cell[1]) ? cell : null
  }

  const canFire = (cell) => enabled && cell && !shots[key(cell[0], cell[1])]

  return (
    <>
      <mesh
        position={[cx, 1.5, 0]}
        rotation-x={-Math.PI / 2}
        onPointerMove={(e) => {
          const cell = cellFrom(e)
          setHover(cell)
          document.body.style.cursor = canFire(cell) ? 'crosshair' : ''
        }}
        onPointerOut={() => {
          setHover(null)
          document.body.style.cursor = ''
        }}
        onClick={(e) => {
          if (e.delta > 6) return // that was a camera drag, not a click
          const cell = cellFrom(e)
          if (canFire(cell)) onFire(cell)
        }}
      >
        <planeGeometry args={[BOARD_WIDTH, BOARD_WIDTH]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {canFire(hover) ? <Reticle cell={hover} /> : canFire(aim) && <Reticle cell={aim} />}
    </>
  )
}

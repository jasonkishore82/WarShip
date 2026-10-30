import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { waterHeight } from './waves'

const HEADING = 0.6
const HALF_LENGTH = 12
const HALF_BEAM = 4

function toWorld(lx, lz) {
  const c = Math.cos(HEADING)
  const s = Math.sin(HEADING)
  return [lx * c + lz * s, -lx * s + lz * c]
}

const SAMPLES = {
  bow: toWorld(HALF_LENGTH, 0),
  stern: toWorld(-HALF_LENGTH, 0),
  port: toWorld(0, HALF_BEAM),
  starboard: toWorld(0, -HALF_BEAM),
}

function Turret({ position, rotation = 0 }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh castShadow>
        <cylinderGeometry args={[1.3, 1.5, 1, 20]} />
        <meshStandardMaterial color="#5c636b" metalness={0.4} roughness={0.6} />
      </mesh>
      {[-0.4, 0.4].map((z) => (
        <mesh key={z} position={[2.8, 0.15, z]} rotation={[0, 0, Math.PI / 2 - 0.05]}>
          <cylinderGeometry args={[0.14, 0.18, 4.5, 10]} />
          <meshStandardMaterial color="#3f454b" metalness={0.5} roughness={0.5} />
        </mesh>
      ))}
    </group>
  )
}

export default function Ship() {
  const yawRef = useRef()
  const tiltRef = useRef()
  const state = useRef({ y: 0, pitch: 0, roll: 0 })

  const hull = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(-14, -3.2)
    shape.lineTo(9, -3.2)
    shape.quadraticCurveTo(14, -3.0, 17, 0)
    shape.quadraticCurveTo(14, 3.0, 9, 3.2)
    shape.lineTo(-14, 3.2)
    shape.quadraticCurveTo(-15.5, 0, -14, -3.2)
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 4.5,
      bevelEnabled: true,
      bevelThickness: 0.3,
      bevelSize: 0.3,
      bevelSegments: 2,
      curveSegments: 16,
    })
    geo.rotateX(-Math.PI / 2)
    geo.translate(0, -3, 0)
    geo.computeVertexNormals()
    return geo
  }, [])

  useFrame((_, delta) => {
    const h = (p) => waterHeight(p[0], p[1])
    const hb = h(SAMPLES.bow)
    const hs = h(SAMPLES.stern)
    const hp = h(SAMPLES.port)
    const hsb = h(SAMPLES.starboard)
    const hc = waterHeight(0, 0)

    const targetY = (hb + hs + hp + hsb + hc * 2) / 6
    const targetPitch = Math.atan2(hb - hs, HALF_LENGTH * 2)
    const targetRoll = -Math.atan2(hp - hsb, HALF_BEAM * 2)

    // Smooth the motion so the ship feels heavy.
    const k = 1 - Math.exp(-Math.min(delta, 0.1) * 3)
    const s = state.current
    s.y += (targetY - s.y) * k
    s.pitch += (targetPitch - s.pitch) * k
    s.roll += (targetRoll - s.roll) * k

    yawRef.current.position.y = s.y + 1.3
    tiltRef.current.rotation.set(s.roll, 0, s.pitch)
  })

  return (
    <group ref={yawRef} rotation={[0, HEADING, 0]}>
      <group ref={tiltRef}>
        <mesh geometry={hull}>
          <meshStandardMaterial attach="material-0" color="#6f747a" metalness={0.2} roughness={0.8} />
          <meshStandardMaterial attach="material-1" color="#454b52" metalness={0.35} roughness={0.55} />
        </mesh>

        {/* Superstructure */}
        <mesh position={[-1, 2.9, 0]}>
          <boxGeometry args={[9, 2.4, 4.2]} />
          <meshStandardMaterial color="#7b8188" metalness={0.3} roughness={0.6} />
        </mesh>
        <mesh position={[0.5, 4.9, 0]}>
          <boxGeometry args={[4.5, 1.6, 3.4]} />
          <meshStandardMaterial color="#858b92" metalness={0.3} roughness={0.6} />
        </mesh>
        <mesh position={[2.76, 5.1, 0]}>
          <boxGeometry args={[0.05, 0.45, 3.0]} />
          <meshStandardMaterial color="#14191e" metalness={0.8} roughness={0.15} />
        </mesh>

        {/* Funnel */}
        <mesh position={[-4, 5.2, 0]} rotation={[0, 0, 0.12]}>
          <cylinderGeometry args={[0.75, 0.95, 3.2, 20]} />
          <meshStandardMaterial color="#5a6067" metalness={0.3} roughness={0.6} />
        </mesh>
        <mesh position={[-4.2, 6.85, 0]} rotation={[0, 0, 0.12]}>
          <cylinderGeometry args={[0.77, 0.77, 0.25, 20]} />
          <meshStandardMaterial color="#1c1f22" />
        </mesh>

        {/* Mast */}
        <mesh position={[0.5, 8.2, 0]}>
          <cylinderGeometry args={[0.1, 0.16, 5, 8]} />
          <meshStandardMaterial color="#3a3f44" />
        </mesh>
        <mesh position={[0.5, 9.4, 0]}>
          <boxGeometry args={[0.12, 0.12, 3]} />
          <meshStandardMaterial color="#3a3f44" />
        </mesh>

        <Turret position={[8.5, 2.0, 0]} />
        <Turret position={[5, 3.0, 0]} />
        <Turret position={[-10, 2.0, 0]} rotation={Math.PI} />
      </group>
    </group>
  )
}

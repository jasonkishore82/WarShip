import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { waterHeight } from './waves'
import { HALF_BOARD } from './grid'

const SPACING = 20

// A line of buoys floating along x = 0, splitting the two boards.
export default function Separator() {
  const zs = useMemo(() => {
    const list = []
    for (let z = -HALF_BOARD - 10; z <= HALF_BOARD + 10; z += SPACING) list.push(z)
    return list
  }, [])
  const refs = useRef([])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    zs.forEach((z, i) => {
      const buoy = refs.current[i]
      if (!buoy) return
      const h = waterHeight(0, z)
      // Small slope estimate for a gentle tilt.
      const hx = waterHeight(1.5, z) - h
      const hz = waterHeight(0, z + 1.5) - h
      buoy.position.y = h - 0.3
      buoy.rotation.set(hz * 0.5, 0, -hx * 0.5)
      // Blink the light, offset per buoy so it ripples down the line.
      const light = buoy.children[2]
      light.material.emissiveIntensity = 2 + 3 * Math.max(0, Math.sin(t * 3 - i * 0.6))
    })
  })

  return (
    <group>
      {zs.map((z, i) => (
        <group key={z} position={[0, 0, z]} ref={(el) => (refs.current[i] = el)}>
          <mesh>
            <cylinderGeometry args={[0.9, 1.1, 2.2, 16]} />
            <meshStandardMaterial color="#ff6a1a" roughness={0.5} />
          </mesh>
          <mesh position={[0, 1.4, 0]}>
            <cylinderGeometry args={[0.25, 0.4, 1.2, 10]} />
            <meshStandardMaterial color="#e8e8e8" roughness={0.6} />
          </mesh>
          <mesh position={[0, 2.2, 0]}>
            <sphereGeometry args={[0.3, 12, 12]} />
            <meshStandardMaterial color="#ffb060" emissive="#ff8a20" emissiveIntensity={3} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

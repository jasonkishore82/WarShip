// Close-up viewer for a single ship model: open the app with ?showroom=carrier
// (or battleship, cruiser, submarine, destroyer). Handy for checking details.
import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Ocean from './Ocean'
import { SHIP_MODELS } from './ships'
import { SHIP_TYPES } from './fleetConfig'
import { GRID } from './grid'

export default function Showroom({ type }) {
  const Model = SHIP_MODELS[type]
  const length = SHIP_TYPES[type] ? SHIP_TYPES[type].size * GRID.cell - 6 : 100
  const sunDir = useMemo(() => new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(70), THREE.MathUtils.degToRad(-140)), [])
  const view = new URLSearchParams(window.location.search).get('view') || 'quarter'
  const cam = {
    quarter: [length * 0.55, length * 0.22, length * 0.55],
    side: [0, length * 0.08, length * 0.75],
    top: [0.01, length * 0.95, 0.01],
    bow: [length * 0.75, length * 0.15, length * 0.12],
  }[view]
  if (!Model) return <div style={{ color: '#fff', padding: 20 }}>No detailed model for “{type}” yet.</div>
  return (
    <Canvas camera={{ position: cam, fov: 45, near: 0.5, far: 30000 }} onCreated={({ gl }) => (gl.toneMappingExposure = 0.55)}>
      <Ocean sunDir={sunDir} chop={0.5} speed={1} foam={0.8} deepColor="#0b2c3d" scatterColor="#1f8f7f" gridOpacity={0} />
      <directionalLight position={sunDir.clone().multiplyScalar(200)} intensity={2.2} color="#fff1dc" />
      <ambientLight intensity={0.2} />
      <group position={[0, 0.5, 0]}>
        <Model length={length} />
      </group>
      <OrbitControls target={[0, 6, 0]} />
    </Canvas>
  )
}

import { useEffect, useMemo } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useControls } from 'leva'
import * as THREE from 'three'
import Ocean from './Ocean'
import Ship from './Ship'

function Exposure({ value }) {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    gl.toneMappingExposure = value
  }, [gl, value])
  return null
}

export default function App() {
  const { elevation, azimuth, exposure } = useControls('Sun', {
    elevation: { value: 6, min: 0, max: 90, step: 0.1 },
    azimuth: { value: -140, min: -180, max: 360, step: 0.1 },
    exposure: { value: 0.5, min: 0.1, max: 1.5, step: 0.01 },
  })
  const { choppiness, speed, foam, deepColor, scatterColor, ship } = useControls('Sea', {
    choppiness: { value: 1, min: 0.1, max: 1.15, step: 0.01 },
    speed: { value: 1, min: 0, max: 3, step: 0.01 },
    foam: { value: 0.8, min: 0.3, max: 1.2, step: 0.01 },
    deepColor: '#0b2c3d',
    scatterColor: '#1f8f7f',
    ship: true,
  })

  const sunDir = useMemo(() => {
    const phi = THREE.MathUtils.degToRad(90 - elevation)
    const theta = THREE.MathUtils.degToRad(azimuth)
    return new THREE.Vector3().setFromSphericalCoords(1, phi, theta)
  }, [elevation, azimuth])

  const sunLight = Math.max(Math.sin(THREE.MathUtils.degToRad(elevation)), 0) * 2 + 0.6

  return (
    <>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [45, 12, 55], fov: 50, near: 0.5, far: 30000 }}
        gl={{ antialias: true }}
      >
        <Exposure value={exposure} />
        <Ocean
          sunDir={sunDir}
          chop={choppiness}
          speed={speed}
          foam={foam}
          deepColor={deepColor}
          scatterColor={scatterColor}
        />
        {ship && <Ship />}
        <directionalLight position={sunDir.clone().multiplyScalar(200)} intensity={sunLight} color="#ffe2c4" />
        <ambientLight intensity={0.15} />
        <OrbitControls
          target={[0, 4, 0]}
          enableDamping
          maxPolarAngle={1.47}
          minDistance={18}
          maxDistance={600}
        />
      </Canvas>
      <div className="hint">Drag to orbit · scroll to zoom</div>
    </>
  )
}

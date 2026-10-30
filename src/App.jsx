import { useEffect, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Leva, useControls } from 'leva'
import * as THREE from 'three'
import Ocean from './Ocean'
import Fleet from './Fleet'
import Separator from './Separator'
import { GRID } from './grid'
import { waterHeight } from './waves'

function Exposure({ value }) {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    gl.toneMappingExposure = value
  }, [gl, value])
  return null
}

// On load, back the camera off until both boards fit the window width.
function FitBoards() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  useEffect(() => {
    const halfWidth = GRID.gap + GRID.size * GRID.cell + 40
    const aspect = size.width / size.height
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2)
    const dist = Math.max(600, halfWidth / (Math.tan(halfFov) * aspect))
    camera.position.copy(new THREE.Vector3(0, 210, 560).setLength(dist))
    camera.lookAt(0, 0, 0)
    // Only on first load, so it never fights the user's orbiting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

// Keep the camera above the waves so it never ends up under the sea.
function CameraAboveWater({ clearance = 6 }) {
  useFrame(({ camera }) => {
    const minY = waterHeight(camera.position.x, camera.position.z) + clearance
    if (camera.position.y < minY) camera.position.y = minY
  })
  return null
}

export default function App() {
  const { elevation, azimuth, exposure } = useControls('Sun', {
    elevation: { value: 6, min: 0, max: 90, step: 0.1 },
    azimuth: { value: -140, min: -180, max: 360, step: 0.1 },
    exposure: { value: 0.5, min: 0.1, max: 1.5, step: 0.01 },
  })
  const { choppiness, speed, foam, deepColor, scatterColor, fleet } = useControls('Sea', {
    choppiness: { value: 1, min: 0.1, max: 1.15, step: 0.01 },
    speed: { value: 1, min: 0, max: 3, step: 0.01 },
    foam: { value: 0.8, min: 0.3, max: 1.2, step: 0.01 },
    deepColor: '#0b2c3d',
    scatterColor: '#1f8f7f',
    fleet: true,
  })
  const { gridOpacity } = useControls('Grid', {
    gridOpacity: { value: 0.6, min: 0, max: 1.5, step: 0.01, label: 'opacity' },
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
        camera={{ position: [0, 210, 560], fov: 50, near: 0.5, far: 30000 }}
        gl={{ antialias: true }}
      >
        <Exposure value={exposure} />
        <FitBoards />
        <CameraAboveWater />
        <Ocean
          sunDir={sunDir}
          chop={choppiness}
          speed={speed}
          foam={foam}
          deepColor={deepColor}
          scatterColor={scatterColor}
          gridOpacity={gridOpacity}
        />
        <Separator />
        {fleet && <Fleet />}
        <directionalLight position={sunDir.clone().multiplyScalar(200)} intensity={sunLight} color="#ffe2c4" />
        <ambientLight intensity={0.15} />
        <OrbitControls
          target={[0, 0, 0]}
          enableDamping
          maxPolarAngle={1.42}
          minDistance={18}
          maxDistance={1400}
        />
      </Canvas>
      <Leva collapsed />
      <div className="hint">Drag to orbit · scroll to zoom · click a ship to hit it</div>
    </>
  )
}

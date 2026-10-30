import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Sky } from 'three/examples/jsm/objects/Sky.js'
import { WAVES, waveState } from './waves'
import { oceanVertex, oceanFragment } from './oceanShader'
import { GRID } from './grid'

// Circular grid: dense near the centre, sparse toward the horizon.
function createRadialGrid(rings = 360, segments = 512, a = 15, b = 0.019) {
  const positions = [0, 0, 0]
  for (let i = 1; i <= rings; i++) {
    const r = a * (Math.exp(b * i) - 1)
    for (let j = 0; j < segments; j++) {
      const t = (j / segments) * Math.PI * 2
      positions.push(Math.cos(t) * r, 0, Math.sin(t) * r)
    }
  }
  const index = []
  for (let j = 0; j < segments; j++) {
    index.push(0, 1 + ((j + 1) % segments), 1 + j)
  }
  for (let i = 0; i < rings - 1; i++) {
    const r0 = 1 + i * segments
    const r1 = r0 + segments
    for (let j = 0; j < segments; j++) {
      const j1 = (j + 1) % segments
      index.push(r0 + j, r0 + j1, r1 + j)
      index.push(r0 + j1, r1 + j1, r1 + j)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setIndex(index)
  return geo
}

export default function Ocean({ sunDir, chop, speed, foam, deepColor, scatterColor, gridOpacity = 1 }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)

  const sky = useMemo(() => {
    const s = new Sky()
    s.scale.setScalar(10000)
    const u = s.material.uniforms
    u.turbidity.value = 6
    u.rayleigh.value = 1.6
    u.mieCoefficient.value = 0.005
    u.mieDirectionalG.value = 0.85
    return s
  }, [])

  // A cube map of the sky, used for water reflections and to light the ship.
  const env = useMemo(() => {
    const rt = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType })
    const cam = new THREE.CubeCamera(1, 30000, rt)
    const envScene = new THREE.Scene()
    const skyCopy = new THREE.Mesh(sky.geometry, sky.material)
    skyCopy.scale.setScalar(10000)
    envScene.add(skyCopy)
    return { rt, cam, envScene }
  }, [sky])

  const geometry = useMemo(() => createRadialGrid(), [])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: oceanVertex,
        fragmentShader: oceanFragment,
        side: THREE.DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uChop: { value: 1 },
          uWaves: {
            value: WAVES.map((w) => new THREE.Vector4(w.dir[0], w.dir[1], w.steepness, w.wavelength)),
          },
          uEnv: { value: env.rt.texture },
          uSunDir: { value: new THREE.Vector3() },
          uDeep: { value: new THREE.Color() },
          uScatter: { value: new THREE.Color() },
          uFoam: { value: 0.8 },
          uGrid: { value: new THREE.Vector3(GRID.size, GRID.cell, GRID.gap) },
          uGridOpacity: { value: 1 },
          uGridColor: { value: new THREE.Color('#bfeeff') },
          uSepColor: { value: new THREE.Color('#ff9a3c') },
        },
        extensions: { derivatives: true },
      }),
    [env]
  )

  useEffect(() => {
    sky.material.uniforms.sunPosition.value.copy(sunDir)
    material.uniforms.uSunDir.value.copy(sunDir)
    env.cam.update(gl, env.envScene)
    env.rt.texture.needsPMREMUpdate = true
    scene.environment = env.rt.texture
  }, [sunDir, sky, env, material, gl, scene])

  useEffect(() => {
    material.uniforms.uDeep.value.set(deepColor)
    material.uniforms.uScatter.value.set(scatterColor)
    material.uniforms.uFoam.value = foam
    material.uniforms.uGridOpacity.value = gridOpacity
  }, [material, deepColor, scatterColor, foam, gridOpacity])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
      env.rt.dispose()
    },
    [geometry, material, env]
  )

  useFrame((_, delta) => {
    waveState.time += Math.min(delta, 0.1) * speed
    waveState.chop = chop
    material.uniforms.uTime.value = waveState.time
    material.uniforms.uChop.value = chop
  })

  return (
    <>
      <primitive object={sky} />
      <mesh geometry={geometry} material={material} frustumCulled={false} />
    </>
  )
}

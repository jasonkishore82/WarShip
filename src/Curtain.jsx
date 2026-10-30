import { useEffect, useMemo, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { HALF_BOARD } from './grid'

const LENGTH = HALF_BOARD * 2 + 40 // runs the full length of the boards plus a margin
export const DEFAULT_HEIGHT = 60 // metres above the water
const BOTTOM = -3 // hem dips into the sea so waves never show a gap
const SEG_L = 140
const SEG_H = 36

// Heavy navy fabric with soft pleats, a woven texture and trim bands.
function makeFabricTexture() {
  const w = 1024
  const h = 256
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#1c2a48'
  ctx.fillRect(0, 0, w, h)

  // Vertical pleat shading.
  for (let x = 0; x < w; x++) {
    const shade = 0.5 + 0.5 * Math.sin((x / w) * Math.PI * 2 * 18)
    ctx.fillStyle = `rgba(0, 0, 0, ${0.18 * shade})`
    ctx.fillRect(x, 0, 1, h)
  }

  // Fine woven grain.
  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * w
    const y = Math.random() * h
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.06)'
    ctx.fillRect(x, y, 2, 1)
  }

  // Trim bands near the top and the hem.
  const band = (y, size, color) => {
    ctx.fillStyle = color
    ctx.fillRect(0, y, w, size)
  }
  band(6, 10, '#c9a24a')
  band(20, 3, '#c9a24a')
  band(h - 16, 10, '#c9a24a')
  band(h - 23, 3, '#c9a24a')

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.repeat.set(3, 1)
  tex.anisotropy = 8
  return tex
}

// A huge fabric wall hung between the two boards, rippling in the wind.
export const MIN_HEIGHT = 10
export const MAX_HEIGHT = 150

export default function Curtain({ height = DEFAULT_HEIGHT, onHeightChange }) {
  const HEIGHT = height
  const { camera, gl, raycaster, controls } = useThree()
  const [dragging, setDragging] = useState(null) // z of the pole being dragged
  const [hover, setHover] = useState(false)

  // Drag a pole top up or down to change the height.
  useEffect(() => {
    if (dragging === null) return undefined
    const el = gl.domElement
    const ndc = new THREE.Vector2()
    const hit = new THREE.Vector3()
    // A vertical plane through the wall line, turned to face the camera.
    const normal = new THREE.Vector3(camera.position.x, 0, camera.position.z).normalize()
    if (normal.lengthSq() < 1e-6) normal.set(0, 0, 1)
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, new THREE.Vector3(0, 0, dragging))

    const onMove = (e) => {
      const rect = el.getBoundingClientRect()
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      if (!raycaster.ray.intersectPlane(plane, hit)) return
      const next = THREE.MathUtils.clamp(Math.round(hit.y - 6), MIN_HEIGHT, MAX_HEIGHT)
      onHeightChange?.(next)
    }
    const onUp = () => {
      setDragging(null)
      if (controls) controls.enabled = true
      document.body.style.cursor = ''
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [dragging, camera, gl, raycaster, controls, onHeightChange])

  const grabTop = (z, e) => {
    if (e.button !== 0) return
    e.stopPropagation()
    if (controls) controls.enabled = false
    document.body.style.cursor = 'ns-resize'
    setDragging(z)
  }
  // Rebuilt whenever the pole height changes.
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(LENGTH, HEIGHT - BOTTOM, SEG_L, SEG_H)
    // Stand it up along z at x = 0.
    geo.rotateY(Math.PI / 2)
    geo.translate(0, (HEIGHT + BOTTOM) / 2, 0)
    geo.userData.rest = Float32Array.from(geo.attributes.position.array)
    return geo
  }, [HEIGHT])

  const texture = useMemo(makeFabricTexture, [])
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: texture,
        side: THREE.DoubleSide,
        roughness: 0.92,
        metalness: 0,
      }),
    [texture]
  )

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(
    () => () => {
      material.dispose()
      texture.dispose()
    },
    [material, texture]
  )

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const pos = geometry.attributes.position
    const rest = geometry.userData.rest
    for (let i = 0; i < pos.count; i++) {
      const y = rest[i * 3 + 1]
      const z = rest[i * 3 + 2]
      // 0 at the top rail (fixed), 1 at the hem (free to swing).
      const free = 1 - (y - BOTTOM) / (HEIGHT - BOTTOM)
      // Taller curtains swing a bit further at the hem.
      const amp = free * (1.2 + free * 3.5) * Math.sqrt(HEIGHT / DEFAULT_HEIGHT)
      const gust = 0.6 + 0.4 * Math.sin(t * 0.35 + z * 0.004)
      const ripple =
        Math.sin(z * 0.045 - t * 1.4) * 1.0 +
        Math.sin(z * 0.11 + t * 2.3 + y * 0.05) * 0.45 +
        Math.sin(z * 0.023 + t * 0.7) * 0.8
      // Billow to one side, plus travelling ripples along the wall.
      pos.array[i * 3] = amp * (ripple * gust + 1.5 * free)
    }
    pos.needsUpdate = true
    geometry.computeVertexNormals()
  })

  const poleZ = LENGTH / 2
  return (
    <group>
      <mesh geometry={geometry} material={material} castShadow />

      {/* Poles at each end and a rail along the top */}
      {[-poleZ, poleZ].map((z) => (
        <group key={z} position={[0, 0, z]}>
          <mesh position={[0, (HEIGHT + 6 - 8) / 2, 0]}>
            <cylinderGeometry args={[0.9, 1.2, HEIGHT + 6 + 8, 16]} />
            <meshStandardMaterial color="#8a8f95" metalness={0.7} roughness={0.35} />
          </mesh>
          {/* Gold top: drag it up or down to change the wall height */}
          <mesh
            position={[0, HEIGHT + 6, 0]}
            scale={hover || dragging === z ? 1.5 : 1}
            onPointerDown={(e) => grabTop(z, e)}
            onPointerOver={() => {
              setHover(true)
              document.body.style.cursor = 'ns-resize'
            }}
            onPointerOut={() => {
              setHover(false)
              if (dragging === null) document.body.style.cursor = ''
            }}
          >
            <sphereGeometry args={[2.4, 20, 20]} />
            <meshStandardMaterial
              color="#c9a24a"
              metalness={0.8}
              roughness={0.3}
              emissive="#c9a24a"
              emissiveIntensity={hover || dragging === z ? 0.6 : 0}
            />
          </mesh>
        </group>
      ))}
      <mesh position={[0, HEIGHT + 0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.6, 0.6, LENGTH + 2, 12]} />
        <meshStandardMaterial color="#8a8f95" metalness={0.7} roughness={0.35} />
      </mesh>
    </group>
  )
}

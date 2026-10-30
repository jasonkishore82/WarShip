import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Trail } from '@react-three/drei'
import * as THREE from 'three'
import { waterHeight } from '../waves'

// ---------- particle system ----------

let softTexture
function getSoftTexture() {
  if (softTexture) return softTexture
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.4, 'rgba(255,255,255,0.6)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  softTexture = new THREE.CanvasTexture(c)
  return softTexture
}

const particleVertex = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  uniform float uScale;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`
const particleFragment = /* glsl */ `
  uniform sampler2D uMap;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    float a = texture2D(uMap, gl_PointCoord).a * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a);
  }
`

// Generic particles. `update(p, dt, time)` writes p.pos / p.size / p.alpha / p.color.
function Particles({ count, additive = false, init, update }) {
  const p = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(count * 3)
    const size = new Float32Array(count)
    const alpha = new Float32Array(count)
    const color = new Float32Array(count * 3)
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1))
    geo.setAttribute('aColor', new THREE.BufferAttribute(color, 3))
    const data = { geo, pos, size, alpha, color, count, age: 0 }
    init?.(data)
    return data
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uMap: { value: getSoftTexture() }, uScale: { value: 500 } },
        vertexShader: particleVertex,
        fragmentShader: particleFragment,
        transparent: true,
        depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      }),
    [additive]
  )

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1)
    p.age += dt
    material.uniforms.uScale.value = (state.size.height * state.gl.getPixelRatio()) / 2
    update(p, dt, state.clock.elapsedTime)
    for (const name of ['position', 'aSize', 'aAlpha', 'aColor']) p.geo.attributes[name].needsUpdate = true
  })

  return <points geometry={p.geo} material={material} frustumCulled={false} />
}

const rand = (a, b) => a + Math.random() * (b - a)

// ---------- shell in flight ----------

export function Shell({ from, to, apex, duration, onImpact }) {
  const ref = useRef()
  const start = useRef(performance.now())
  const done = useRef(false)

  // Driven by the real clock, so a slow frame rate never stalls the game.
  useFrame(() => {
    if (done.current || !ref.current) return
    const u = Math.min((performance.now() - start.current) / 1000 / duration, 1)
    const baseY = from[1] + (to[1] - from[1]) * u
    const lift = apex - (from[1] + to[1]) / 2
    ref.current.position.set(
      from[0] + (to[0] - from[0]) * u,
      baseY + 4 * lift * u * (1 - u),
      from[2] + (to[2] - from[2]) * u
    )
    if (u >= 1) {
      done.current = true
      onImpact()
    }
  })

  return (
    <>
      <Trail width={18} length={7} color="#ffd29a" attenuation={(w) => w * w}>
        <mesh ref={ref} position={from}>
          <sphereGeometry args={[2.4, 12, 12]} />
          <meshBasicMaterial color="#fff3d6" toneMapped={false} />
        </mesh>
      </Trail>
      <MuzzleFlash position={from} />
    </>
  )
}

function MuzzleFlash({ position }) {
  return (
    <group position={position}>
      <Particles
        count={30}
        additive
        init={(p) => {
          p.vel = Array.from({ length: p.count }, () => [rand(-8, 8), rand(4, 18), rand(-8, 8)])
          for (let i = 0; i < p.count; i++) p.size[i] = rand(6, 12)
        }}
        update={(p, dt) => {
          const life = Math.max(0, 1 - p.age / 0.5)
          for (let i = 0; i < p.count; i++) {
            const v = p.vel[i]
            p.pos[i * 3] += v[0] * dt
            p.pos[i * 3 + 1] += v[1] * dt
            p.pos[i * 3 + 2] += v[2] * dt
            p.alpha[i] = life
            p.color.set([1, 0.75 * life + 0.2, 0.3 * life], i * 3)
          }
        }}
      />
    </group>
  )
}

// ---------- splash (miss) ----------

export function Splash({ position, onDone }) {
  const ring = useRef()
  const start = useRef(performance.now())
  useFrame(() => {
    const a = (performance.now() - start.current) / 1000
    if (ring.current) {
      const s = 2 + a * 22
      ring.current.scale.set(s, s, s)
      ring.current.material.opacity = Math.max(0, 0.8 - a * 0.45)
      ring.current.position.y = waterHeight(position[0], position[2]) + 0.4
    }
    if (a > 2.6) onDone?.()
  })

  return (
    <group position={[position[0], 0, position[2]]}>
      <mesh ref={ring} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.8, 1, 48]} />
        <meshBasicMaterial color="#e8f6ff" transparent depthWrite={false} />
      </mesh>
      <group position={[0, position[1], 0]}>
        <Particles
          count={90}
          init={(p) => {
            p.vel = Array.from({ length: p.count }, (_, i) => {
              const ang = Math.random() * Math.PI * 2
              const core = i < 40 // tall central column
              const out = core ? rand(0, 3) : rand(4, 12)
              return [Math.cos(ang) * out, core ? rand(28, 46) : rand(10, 22), Math.sin(ang) * out]
            })
            for (let i = 0; i < p.count; i++) {
              p.size[i] = rand(5, 10)
              p.color.set([0.85, 0.93, 1], i * 3)
            }
          }}
          update={(p, dt) => {
            for (let i = 0; i < p.count; i++) {
              const v = p.vel[i]
              v[1] -= 30 * dt
              p.pos[i * 3] += v[0] * dt
              p.pos[i * 3 + 1] = Math.max(p.pos[i * 3 + 1] + v[1] * dt, -2)
              p.pos[i * 3 + 2] += v[2] * dt
              p.size[i] += dt * 6
              p.alpha[i] = Math.max(0, 0.9 - p.age * 0.4)
            }
          }}
        />
      </group>
    </group>
  )
}

// ---------- explosion (hit) ----------

export function Explosion({ position, onDone }) {
  const flash = useRef()
  const start = useRef(performance.now())
  useFrame(() => {
    const a = (performance.now() - start.current) / 1000
    if (flash.current) {
      const s = 3 + a * 50
      flash.current.scale.set(s, s, s)
      flash.current.material.opacity = Math.max(0, 1 - a * 3)
    }
    if (a > 3.5) onDone?.()
  })

  return (
    <group position={position}>
      <mesh ref={flash}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color="#ffb347" transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* Fireball */}
      <Particles
        count={70}
        additive
        init={(p) => {
          p.vel = Array.from({ length: p.count }, () => {
            const v = new THREE.Vector3(rand(-1, 1), rand(0.2, 1.2), rand(-1, 1)).normalize().multiplyScalar(rand(8, 30))
            return [v.x, v.y, v.z]
          })
          for (let i = 0; i < p.count; i++) p.size[i] = rand(8, 16)
        }}
        update={(p, dt) => {
          const life = Math.max(0, 1 - p.age / 1.3)
          for (let i = 0; i < p.count; i++) {
            const v = p.vel[i]
            v[0] *= 1 - dt * 2.5
            v[1] = v[1] * (1 - dt * 2.5) + dt * 4
            v[2] *= 1 - dt * 2.5
            p.pos[i * 3] += v[0] * dt
            p.pos[i * 3 + 1] += v[1] * dt
            p.pos[i * 3 + 2] += v[2] * dt
            p.alpha[i] = life
            p.color.set([1, 0.35 + 0.6 * life * life, 0.1 * life], i * 3)
          }
        }}
      />
      {/* Smoke */}
      <Particles
        count={45}
        init={(p) => {
          p.vel = Array.from({ length: p.count }, () => [rand(-4, 4), rand(5, 14), rand(-4, 4)])
          for (let i = 0; i < p.count; i++) {
            p.size[i] = rand(10, 18)
            const g = rand(0.08, 0.2)
            p.color.set([g, g, g], i * 3)
          }
        }}
        update={(p, dt) => {
          const fadeIn = Math.min(1, p.age / 0.4)
          const life = Math.max(0, 1 - p.age / 3.4)
          for (let i = 0; i < p.count; i++) {
            const v = p.vel[i]
            p.pos[i * 3] += v[0] * dt
            p.pos[i * 3 + 1] += v[1] * dt
            p.pos[i * 3 + 2] += v[2] * dt
            p.size[i] += dt * 10
            p.alpha[i] = 0.7 * fadeIn * life
          }
        }}
      />
    </group>
  )
}

// ---------- pegs that stay on the board ----------

const PEG = {
  miss: {
    body: new THREE.MeshStandardMaterial({ color: '#f2f4f5', roughness: 0.4 }),
    top: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.4 }),
  },
  hit: {
    body: new THREE.MeshStandardMaterial({ color: '#c0161b', roughness: 0.4 }),
    top: new THREE.MeshStandardMaterial({ color: '#ff3b2f', emissive: '#ff2a1a', emissiveIntensity: 2.5 }),
  },
}

export function Peg({ kind, x, z }) {
  const ref = useRef()
  const tall = kind === 'hit' ? 18 : 7
  useFrame(() => {
    if (ref.current) ref.current.position.y = waterHeight(x, z) - 1
  })
  const m = PEG[kind]
  return (
    <group ref={ref} position={[x, 0, z]}>
      <mesh material={m.body} position={[0, tall / 2, 0]}>
        <cylinderGeometry args={[1.2, 1.5, tall, 12]} />
      </mesh>
      <mesh material={m.top} position={[0, tall + 0.8, 0]}>
        <sphereGeometry args={[2, 16, 16]} />
      </mesh>
      {kind === 'hit' && <Fire y={tall + 2} />}
    </group>
  )
}

// Burning flames and a smoke column that loop forever.
function Fire({ y }) {
  return (
    <group position={[0, y, 0]}>
      <Particles
        count={22}
        additive
        init={(p) => {
          p.seed = Array.from({ length: p.count }, () => Math.random())
        }}
        update={(p, dt, time) => {
          for (let i = 0; i < p.count; i++) {
            const life = (time * 0.9 + p.seed[i]) % 1
            p.pos[i * 3] = Math.sin(p.seed[i] * 40 + time * 3) * 1.4 * (1 - life)
            p.pos[i * 3 + 1] = life * 9
            p.pos[i * 3 + 2] = Math.cos(p.seed[i] * 30 + time * 2.5) * 1.4 * (1 - life)
            p.size[i] = 7 * (1 - life) + 2
            p.alpha[i] = 1 - life
            p.color.set([1, 0.3 + 0.6 * (1 - life), 0.08], i * 3)
          }
        }}
      />
      <Particles
        count={26}
        init={(p) => {
          p.seed = Array.from({ length: p.count }, () => Math.random())
        }}
        update={(p, dt, time) => {
          for (let i = 0; i < p.count; i++) {
            const life = (time * 0.18 + p.seed[i]) % 1
            p.pos[i * 3] = life * 14 + Math.sin(p.seed[i] * 20 + time) * 2
            p.pos[i * 3 + 1] = 6 + life * 40
            p.pos[i * 3 + 2] = life * 5 + Math.cos(p.seed[i] * 17 + time) * 2
            p.size[i] = 6 + life * 22
            p.alpha[i] = Math.min(1, life * 6) * (1 - life) * 0.55
            const g = 0.12 + life * 0.15
            p.color.set([g, g, g], i * 3)
          }
        }}
      />
    </group>
  )
}

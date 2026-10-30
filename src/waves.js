// Wave set shared by the GPU shader and the CPU (so floating objects match the surface).
// Each wave: direction (x, z), steepness (0..1, total should stay under 1), wavelength in metres.
export const WAVES = [
  { dir: [1.0, 0.3], steepness: 0.2, wavelength: 90 },
  { dir: [0.8, 0.6], steepness: 0.16, wavelength: 55 },
  { dir: [0.3, 1.0], steepness: 0.13, wavelength: 34 },
  { dir: [-0.4, 0.9], steepness: 0.1, wavelength: 21 },
  { dir: [0.9, -0.4], steepness: 0.09, wavelength: 14 },
  { dir: [-0.7, 0.5], steepness: 0.07, wavelength: 9 },
  { dir: [0.2, -1.0], steepness: 0.06, wavelength: 6 },
  { dir: [0.6, 0.8], steepness: 0.05, wavelength: 3.7 },
]

const G = 9.81

// Live values written by the ocean every frame and read by floating objects.
export const waveState = { time: 0, chop: 1 }

function displacement(x, z, t, chop, out) {
  let dx = 0
  let dy = 0
  let dz = 0
  for (const w of WAVES) {
    const len = Math.hypot(w.dir[0], w.dir[1])
    const d0 = w.dir[0] / len
    const d1 = w.dir[1] / len
    const k = (2 * Math.PI) / w.wavelength
    const c = Math.sqrt(G / k)
    const f = k * (d0 * x + d1 * z - c * t)
    const a = (w.steepness * chop) / k
    const cf = Math.cos(f)
    dx += d0 * a * cf
    dy += a * Math.sin(f)
    dz += d1 * a * cf
  }
  out.x = dx
  out.y = dy
  out.z = dz
  return out
}

const tmp = { x: 0, y: 0, z: 0 }

// Gerstner waves move points sideways, so find the grid point that lands on (x, z).
export function waterHeight(x, z, t = waveState.time, chop = waveState.chop) {
  let px = x
  let pz = z
  for (let i = 0; i < 4; i++) {
    displacement(px, pz, t, chop, tmp)
    px = x - tmp.x
    pz = z - tmp.z
  }
  return displacement(px, pz, t, chop, tmp).y
}

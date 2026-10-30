import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Leva, useControls } from 'leva'
import * as THREE from 'three'
import Ocean from './Ocean'
import Fleet from './Fleet'
import Curtain, { DEFAULT_HEIGHT, MAX_HEIGHT, MIN_HEIGHT } from './Curtain'
import { GRID, cellCenter } from './grid'
import { waterHeight } from './waves'
import { SHIP_TYPES, shipTransform } from './fleetConfig'
import {
  aiPickTarget,
  fleetDestroyed,
  isSunk,
  randomFleet,
  resolveShot,
  shipAt,
  sunkCellSet,
  sunkShips,
} from './game/logic'
import { Explosion, Peg, Shell, Splash } from './game/Effects'
import TargetBoard from './game/TargetBoard'
import Hud from './game/Hud'
import BoardLabels from './game/BoardLabels'

function Exposure({ value }) {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    gl.toneMappingExposure = value
  }, [gl, value])
  return null
}

// The fixed view: from behind the player's board (left), looking across it
// toward the curtain and the enemy board beyond.
const VIEW_TARGET = new THREE.Vector3(-40, 10, 0)
const VIEW_DIR = new THREE.Vector3(-1, 0.27, 0).normalize() // low angle, looking across the water

function fixedViewPosition(camera, size) {
  const halfDepth = (GRID.size * GRID.cell) / 2 + 50 // board spans z, which is across the screen
  const aspect = size.width / size.height
  const halfFov = THREE.MathUtils.degToRad(camera.fov / 2)
  const dist = Math.max(620, halfDepth / (Math.tan(halfFov) * aspect) + 260)
  return VIEW_TARGET.clone().addScaledVector(VIEW_DIR, dist)
}

// On load, start at the fixed view.
function FitBoards() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const controls = useThree((s) => s.controls)
  useEffect(() => {
    camera.position.copy(fixedViewPosition(camera, size))
    camera.lookAt(VIEW_TARGET)
    if (controls) controls.target.copy(VIEW_TARGET)
    // Only on first load (and once the controls exist).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controls])
  return null
}

// During battle the camera glides to the fixed view and stays there.
function CameraLock({ locked }) {
  const controls = useThree((s) => s.controls)
  // After leaving a battle, keep gliding home for a moment before handing control back.
  const releaseAt = useRef(0)
  useEffect(() => {
    if (!locked) releaseAt.current = performance.now() + 1600
  }, [locked])
  useFrame(({ camera, size }, delta) => {
    if (!locked && performance.now() > releaseAt.current) return
    const k = 1 - Math.exp(-Math.min(delta, 0.1) * 2.5)
    camera.position.lerp(fixedViewPosition(camera, size), k)
    if (controls) {
      controls.target.lerp(VIEW_TARGET, k)
      camera.lookAt(controls.target)
    } else {
      camera.lookAt(VIEW_TARGET)
    }
  })
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

// ---------- game state ----------
//
// Phases: placing → player ⇄ (firing) ⇄ enemy → over
// The player's ships are on the left board, the computer's on the right.

const cellLabel = ([c, r]) => `${'ABCDEFGH'[c]}${r + 1}`
const shipName = (ship) => SHIP_TYPES[ship.type].name

function newGame(playerShips) {
  return {
    phase: 'placing',
    playerShips: playerShips ?? randomFleet(),
    enemyShips: randomFleet(),
    shotsAtEnemy: {},
    shotsAtPlayer: {},
    shell: null,
    effects: [],
    message: 'Position your ships, then start the battle.',
    winner: null,
    lastShot: null,
    nextId: 1,
  }
}

function reducer(state, action) {
  switch (action.type) {
    case 'move':
      return state.phase === 'placing' ? { ...state, playerShips: action.ships } : state
    case 'randomize':
      return state.phase === 'placing' ? { ...state, playerShips: randomFleet() } : state
    case 'start':
      return state.phase === 'placing'
        ? { ...state, phase: 'player', message: 'Battle stations! Fire when ready.' }
        : state
    case 'exit':
      return newGame(state.playerShips)

    case 'fire':
      if (state.phase !== 'player') return state
      return {
        ...state,
        phase: 'firing',
        shell: { id: state.nextId, by: 'player', cell: action.cell },
        nextId: state.nextId + 1,
        message: `Firing at ${cellLabel(action.cell)}…`,
      }

    case 'enemyFire': {
      if (state.phase !== 'enemy' || state.shell) return state
      const cell = aiPickTarget(state.shotsAtPlayer, sunkCellSet(state.playerShips, state.shotsAtPlayer))
      return {
        ...state,
        shell: { id: state.nextId, by: 'enemy', cell },
        nextId: state.nextId + 1,
        message: `Incoming fire at ${cellLabel(cell)}!`,
      }
    }

    case 'impact': {
      const { shell } = state
      if (!shell) return state
      const byPlayer = shell.by === 'player'
      const ships = byPlayer ? state.enemyShips : state.playerShips
      const shots = byPlayer ? state.shotsAtEnemy : state.shotsAtPlayer
      const res = resolveShot(ships, shots, shell.cell)
      const label = cellLabel(shell.cell)

      let message
      if (byPlayer) {
        message = res.sunk ? `You sank the enemy ${shipName(res.sunk)}!` : res.hit ? `Hit at ${label}!` : `Miss at ${label}.`
      } else {
        message = res.sunk
          ? `The enemy sank your ${shipName(res.sunk)}!`
          : res.hit
            ? `Your ${shipName(res.ship)} was hit at ${label}!`
            : `Enemy missed at ${label}.`
      }

      const destroyed = fleetDestroyed(ships, res.shots)
      const effect = { id: state.nextId, kind: res.hit ? 'explosion' : 'splash', point: action.point }
      return {
        ...state,
        [byPlayer ? 'shotsAtEnemy' : 'shotsAtPlayer']: res.shots,
        shell: null,
        effects: [...state.effects, effect],
        nextId: state.nextId + 1,
        message,
        lastShot: { side: byPlayer ? 'right' : 'left', key: `${shell.cell[0]},${shell.cell[1]}` },
        phase: destroyed ? 'over' : byPlayer ? 'enemy' : 'player',
        winner: destroyed ? (byPlayer ? 'player' : 'enemy') : null,
      }
    }

    case 'effectDone':
      return { ...state, effects: state.effects.filter((e) => e.id !== action.id) }
    default:
      return state
  }
}

// Where a shell starts: one of the shooter's ships that is still afloat.
function launchPoint(ships, shots, side, id) {
  const afloat = ships.filter((s) => !isSunk(s, shots))
  const ship = afloat[id % Math.max(afloat.length, 1)] || ships[0]
  const t = shipTransform(ship, side)
  return [t.x, 14, t.z]
}

export default function App() {
  const { elevation, azimuth, exposure } = useControls('Sun', {
    elevation: { value: 6, min: 0, max: 90, step: 0.1 },
    azimuth: { value: -140, min: -180, max: 360, step: 0.1 },
    exposure: { value: 0.5, min: 0.1, max: 1.5, step: 0.01 },
  })
  const { choppiness, speed, foam, deepColor, scatterColor } = useControls('Sea', {
    choppiness: { value: 1, min: 0.1, max: 1.15, step: 0.01 },
    speed: { value: 1, min: 0, max: 3, step: 0.01 },
    foam: { value: 0.8, min: 0.3, max: 1.2, step: 0.01 },
    deepColor: '#0b2c3d',
    scatterColor: '#1f8f7f',
  })
  const { gridOpacity } = useControls('Grid', {
    gridOpacity: { value: 0.6, min: 0, max: 1.5, step: 0.01, label: 'opacity' },
  })
  const [poleHeight, setPoleHeight] = useState(DEFAULT_HEIGHT)
  const [curtainVisible, setCurtainVisible] = useState(true)
  const [spectator, setSpectator] = useState(false) // reveal the enemy fleet on the board for people watching
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [aim, setAim] = useState(null) // cell hovered on the HUD map, mirrored on the 3D board

  const [game, dispatch] = useReducer(reducer, undefined, () => newGame())
  const gameRef = useRef(game)
  gameRef.current = game
  const playerHitters = useRef({})
  const enemyHitters = useRef({})

  // The computer takes its shot a moment after the player's lands.
  useEffect(() => {
    if (game.phase !== 'enemy' || game.shell) return undefined
    const id = setTimeout(() => dispatch({ type: 'enemyFire' }), 1100)
    return () => clearTimeout(id)
  }, [game.phase, game.shell])

  // Shell flight path for the current shot.
  const flight = useMemo(() => {
    const { shell } = game
    if (!shell) return null
    const byPlayer = shell.by === 'player'
    const from = byPlayer
      ? launchPoint(game.playerShips, game.shotsAtPlayer, 'left', shell.id)
      : launchPoint(game.enemyShips, game.shotsAtEnemy, 'right', shell.id)
    const [x, z] = cellCenter(byPlayer ? 'right' : 'left', shell.cell[0], shell.cell[1])
    const to = [x, 0, z]
    const dist = Math.hypot(to[0] - from[0], to[2] - from[2])
    return { id: shell.id, from, to, apex: poleHeight + 35 + dist * 0.08, duration: 1.5 + dist / 650 }
    // Only recompute for a new shell.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.shell])

  const onImpact = useCallback(() => {
    const g = gameRef.current
    if (!g.shell) return
    const byPlayer = g.shell.by === 'player'
    const side = byPlayer ? 'right' : 'left'
    const [x, z] = cellCenter(side, g.shell.cell[0], g.shell.cell[1])
    const point = [x, waterHeight(x, z) + 2, z]
    // Knock the ship that was hit (physics impulse at the impact point).
    const ship = shipAt(byPlayer ? g.enemyShips : g.playerShips, g.shell.cell[0], g.shell.cell[1])
    if (ship) {
      const hitters = byPlayer ? enemyHitters : playerHitters
      hitters.current[ship.type]?.(new THREE.Vector3(x, 0, z))
    }
    dispatch({ type: 'impact', point })
  }, [])

  const enemySunk = sunkShips(game.enemyShips, game.shotsAtEnemy).map((s) => s.type)
  const playerSunk = sunkShips(game.playerShips, game.shotsAtPlayer).map((s) => s.type)
  const hiddenEnemy =
    spectator || game.phase === 'over' ? [] : game.enemyShips.map((s) => s.type).filter((t) => !enemySunk.includes(t))

  const sunDir = useMemo(() => {
    const phi = THREE.MathUtils.degToRad(90 - elevation)
    const theta = THREE.MathUtils.degToRad(azimuth)
    return new THREE.Vector3().setFromSphericalCoords(1, phi, theta)
  }, [elevation, azimuth])

  const sunLight = Math.max(Math.sin(THREE.MathUtils.degToRad(elevation)), 0) * 2 + 0.6
  const battle = game.phase !== 'placing'

  return (
    <>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 210, 560], fov: 50, near: 0.5, far: 30000 }}
        gl={{ antialias: true }}
      >
        <Exposure value={exposure} />
        <FitBoards />
        <CameraLock locked={battle} />
        <CameraAboveWater />
        <BoardLabels />
        <Ocean
          sunDir={sunDir}
          chop={choppiness}
          speed={speed}
          foam={foam}
          deepColor={deepColor}
          scatterColor={scatterColor}
          gridOpacity={gridOpacity}
        />
        {curtainVisible && <Curtain height={poleHeight} onHeightChange={setPoleHeight} />}

        <Fleet
          side="left"
          ships={game.playerShips}
          onChange={(ships) => dispatch({ type: 'move', ships })}
          interactive={game.phase === 'placing'}
          sunkTypes={playerSunk}
          hitters={playerHitters}
        />
        <Fleet
          side="right"
          ships={game.enemyShips}
          interactive={false}
          hiddenTypes={hiddenEnemy}
          sunkTypes={enemySunk}
          hitters={enemyHitters}
        />

        {battle && (
          <TargetBoard
            shots={game.shotsAtEnemy}
            enabled={game.phase === 'player'}
            aim={aim}
            onFire={(cell) => dispatch({ type: 'fire', cell })}
          />
        )}

        {Object.entries(game.shotsAtEnemy).map(([k, v]) => {
          const [c, r] = k.split(',').map(Number)
          const [x, z] = cellCenter('right', c, r)
          return <Peg key={`e${k}`} kind={v} x={x} z={z} />
        })}
        {Object.entries(game.shotsAtPlayer).map(([k, v]) => {
          const [c, r] = k.split(',').map(Number)
          const [x, z] = cellCenter('left', c, r)
          return <Peg key={`p${k}`} kind={v} x={x} z={z} />
        })}

        {flight && <Shell key={flight.id} {...flight} onImpact={onImpact} />}
        {game.effects.map((e) =>
          e.kind === 'splash' ? (
            <Splash key={e.id} position={e.point} onDone={() => dispatch({ type: 'effectDone', id: e.id })} />
          ) : (
            <Explosion key={e.id} position={e.point} onDone={() => dispatch({ type: 'effectDone', id: e.id })} />
          )
        )}

        <directionalLight position={sunDir.clone().multiplyScalar(200)} intensity={sunLight} color="#ffe2c4" />
        <ambientLight intensity={0.15} />
        <OrbitControls
          makeDefault
          enabled={!battle}
          target={[-60, 0, 0]}
          enableDamping
          maxPolarAngle={1.42}
          minDistance={18}
          maxDistance={1400}
        />
      </Canvas>
      <Leva hidden={!settingsOpen} collapsed={false} titleBar={{ title: 'Scene' }} />
      <Hud
        phase={game.phase === 'firing' ? 'firing' : game.phase}
        message={game.message}
        winner={game.winner}
        playerShips={game.playerShips}
        enemyShips={game.enemyShips}
        shotsAtPlayer={game.shotsAtPlayer}
        shotsAtEnemy={game.shotsAtEnemy}
        lastShot={game.lastShot}
        spectator={{ value: spectator, set: setSpectator }}
        curtain={{
          height: poleHeight,
          min: MIN_HEIGHT,
          max: MAX_HEIGHT,
          onHeight: setPoleHeight,
          visible: curtainVisible,
          onVisible: setCurtainVisible,
        }}
        settingsOpen={settingsOpen}
        onSettings={() => setSettingsOpen((v) => !v)}
        onRandomize={() => dispatch({ type: 'randomize' })}
        onStart={() => dispatch({ type: 'start' })}
        onExit={() => dispatch({ type: 'exit' })}
        canFire={game.phase === 'player'}
        onAim={setAim}
        onFire={(cell) => {
          setAim(null)
          dispatch({ type: 'fire', cell })
        }}
      />
    </>
  )
}

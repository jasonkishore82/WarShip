import { useState } from 'react'
import { GRID } from '../grid'
import { SHIP_TYPES, shipCells } from '../fleetConfig'
import { isSunk, key } from './logic'
import { COLS } from './BoardLabels'

// ---------- icons (SF Symbols-style line icons) ----------

const Icon = {
  sliders: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </svg>
  ),
  close: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 7l10 10M17 7L7 17" />
    </svg>
  ),
  shuffle: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h3.5c2 0 3.2 1 4.3 2.7l1.4 2.6c1 1.8 2.3 2.7 4.3 2.7H20M17 12l3 3-3 3M4 17h3.5c1.2 0 2.1-.3 2.9-1M14 8c.7-.7 1.6-1 2.7-1H20M17 4l3 3-3 3" />
    </svg>
  ),
  play: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5.5v13l10-6.5z" fill="currentColor" stroke="none" />
    </svg>
  ),
  curtain: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 4h16M6 4v16M18 4v16M6 8c2 1.5 2 6.5 0 8M18 8c-2 1.5-2 6.5 0 8M12 4v16" />
    </svg>
  ),
  minus: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 12h12" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 6v12M6 12h12" />
    </svg>
  ),
}

// ---------- building blocks ----------

function Switch({ checked, onChange, label }) {
  return (
    <label className="row switch-row">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`switch ${checked ? 'on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="knob" />
      </button>
    </label>
  )
}

function stats(shots) {
  const all = Object.values(shots)
  const hits = all.filter((v) => v === 'hit').length
  return { shots: all.length, hits, acc: all.length ? Math.round((hits / all.length) * 100) : 0 }
}

// 8x8 map of one board: ships, hits, misses, and the last shot ringed.
function HitMap({ ships, shots, showShips, last, canFire, onAim, onFire }) {
  const shipSet = new Set(ships.flatMap((s) => shipCells(s).map(([c, r]) => key(c, r))))
  const sunkSet = new Set(ships.filter((s) => isSunk(s, shots)).flatMap((s) => shipCells(s).map(([c, r]) => key(c, r))))
  const idx = Array.from({ length: GRID.size }, (_, i) => i)
  return (
    <div className={`hitmap ${canFire ? 'armed' : ''}`} role="grid" onMouseLeave={() => onAim?.(null)}>
      <span />
      {idx.map((c) => (
        <span key={`h${c}`} className="hm-label">
          {COLS[c]}
        </span>
      ))}
      {idx.map((r) => (
        <div key={`r${r}`} className="hm-row" role="row">
          <span className="hm-label">{r + 1}</span>
          {idx.map((c) => {
            const k = key(c, r)
            const shot = shots[k]
            const ship = shipSet.has(k) && (showShips || sunkSet.has(k))
            const cls = ['hm-cell', ship && 'ship', sunkSet.has(k) && 'sunk', last === k && 'last'].filter(Boolean).join(' ')
            const name = `${COLS[c]}${r + 1}`
            if (canFire && !shot) {
              return (
                <button
                  key={k}
                  type="button"
                  className={`${cls} target`}
                  aria-label={`Fire at ${name}`}
                  title={`Fire at ${name}`}
                  onMouseEnter={() => onAim?.([c, r])}
                  onFocus={() => onAim?.([c, r])}
                  onClick={() => onFire([c, r])}
                />
              )
            }
            return (
              <span key={k} className={cls} role="gridcell" title={`${name}${shot ? ` — ${shot}` : ''}`}>
                {shot && <i className={`hm-${shot}`} />}
              </span>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function FleetCard({ title, subtitle, ships, shots, showShips, revealDamage = true, last, side, canFire, onAim, onFire }) {
  const afloat = ships.filter((sh) => !isSunk(sh, shots)).length
  const s = stats(shots)
  return (
    <section className={`glass card fleet ${side}`}>
      <header className="card-head">
        <div>
          <h2>{title}</h2>
          <p className="secondary">{subtitle}</p>
        </div>
        <div className="badge">
          {afloat}
          <span>/{ships.length}</span>
        </div>
      </header>
      <HitMap ships={ships} shots={shots} showShips={showShips} last={last} canFire={canFire} onAim={onAim} onFire={onFire} />
      <div className="chips">
        {ships.map((ship) => {
          const sunk = isSunk(ship, shots)
          const hits = shipCells(ship).filter(([c, r]) => shots[key(c, r)] === 'hit').length
          const size = SHIP_TYPES[ship.type].size
          return (
            <span
              key={ship.type}
              className={`chip ${sunk ? 'sunk' : revealDamage && hits ? 'damaged' : ''}`}
              title={sunk ? `${SHIP_TYPES[ship.type].name}: sunk` : revealDamage ? `${SHIP_TYPES[ship.type].name}: ${hits}/${size} hit` : SHIP_TYPES[ship.type].name}
            >
              {SHIP_TYPES[ship.type].name}
              <small>{size}</small>
            </span>
          )
        })}
      </div>
      <footer className="card-foot secondary">
        {s.hits} hits · {s.shots - s.hits} misses
      </footer>
    </section>
  )
}

function CurtainCard({ open, height, min, max, onHeight, visible, onVisible, spectator, onSpectator }) {
  if (!open) return null
  return (
    <section className="glass card curtain">
      <header className="card-head">
        <div>
          <h2>Curtain</h2>
          <p className="secondary">Divider between the boards</p>
        </div>
        <div className="value">
          {height}
          <span> m</span>
        </div>
      </header>
      <div className="stepper-row">
        <button type="button" className="icon-btn small" aria-label="Lower" onClick={() => onHeight(Math.max(min, height - 10))}>
          {Icon.minus}
        </button>
        <input
          className="slider"
          type="range"
          min={min}
          max={max}
          value={height}
          style={{ '--p': `${((height - min) / (max - min)) * 100}%` }}
          onChange={(e) => onHeight(Number(e.target.value))}
          aria-label="Curtain height"
        />
        <button type="button" className="icon-btn small" aria-label="Raise" onClick={() => onHeight(Math.min(max, height + 10))}>
          {Icon.plus}
        </button>
      </div>
      <div className="divider" />
      <Switch label="Show curtain" checked={visible} onChange={onVisible} />
      <Switch label="Spectator view" checked={spectator} onChange={onSpectator} />
      <p className="footnote">Spectator view reveals the enemy fleet on the board for people watching. Your map stays hidden.</p>
    </section>
  )
}

// ---------- HUD ----------

const STATUS = {
  placing: { label: 'Deploy your fleet', tone: 'neutral', help: 'Drag ships to move · R rotates while dragging' },
  player: { label: 'Your turn', tone: 'go', help: 'Tap a square on the Enemy Fleet map to fire' },
  firing: { label: 'Firing', tone: 'go', help: 'Shell in flight' },
  enemy: { label: 'Enemy turn', tone: 'alert', help: 'Incoming fire' },
  over: { label: 'Battle over', tone: 'neutral', help: '' },
}

export default function Hud({
  phase,
  message,
  winner,
  playerShips,
  enemyShips,
  shotsAtPlayer,
  shotsAtEnemy,
  lastShot,
  spectator,
  curtain,
  settingsOpen,
  onSettings,
  onRandomize,
  onStart,
  onExit,
  canFire,
  onAim,
  onFire,
}) {
  const [confirmExit, setConfirmExit] = useState(false)
  // Curtain controls start open on wide screens, tucked away on narrow ones.
  const [curtainOpen, setCurtainOpen] = useState(() => typeof window === 'undefined' || window.innerWidth > 760)
  const status = STATUS[phase]
  const inBattle = phase !== 'placing' && phase !== 'over'

  return (
    <div className="hud">
      {/* Status pill */}
      <div className={`glass island ${status.tone}`} role="status" aria-live="polite">
        <div className="island-top">
          <span className="dot" />
          <span className="island-label">{status.label}</span>
          <span className="brand">WarShip</span>
        </div>
        <div className="island-message">{message}</div>
        {status.help && <div className="island-help">{status.help}</div>}
        {phase === 'placing' && (
          <div className="island-actions">
            <button type="button" className="btn secondary-btn" onClick={onRandomize}>
              {Icon.shuffle}
              Shuffle
            </button>
            <button type="button" className="btn primary" onClick={onStart}>
              {Icon.play}
              Start Battle
            </button>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <button
          type="button"
          className={`glass icon-btn ${curtainOpen ? 'active' : ''}`}
          aria-label="Curtain controls"
          title="Curtain controls"
          aria-expanded={curtainOpen}
          onClick={() => setCurtainOpen((v) => !v)}
        >
          {Icon.curtain}
        </button>
        <button
          type="button"
          className={`glass icon-btn ${settingsOpen ? 'active' : ''}`}
          aria-label="Scene settings"
          title="Scene settings"
          onClick={onSettings}
        >
          {Icon.sliders}
        </button>
        {inBattle && (
          <button type="button" className="glass icon-btn" aria-label="Exit battle" title="Exit battle" onClick={() => setConfirmExit(true)}>
            {Icon.close}
          </button>
        )}
      </div>

      <CurtainCard open={curtainOpen} {...curtain} spectator={spectator.value} onSpectator={spectator.set} />

      <FleetCard
        title="Your Fleet"
        subtitle="Left board"
        ships={playerShips}
        shots={shotsAtPlayer}
        showShips
        last={lastShot?.side === 'left' ? lastShot.key : null}
        side="left"
      />
      <FleetCard
        title="Enemy Fleet"
        subtitle="Right board"
        ships={enemyShips}
        shots={shotsAtEnemy}
        // Your aiming map never gives away where enemy ships are (only hits, misses and sunk ships).
        showShips={phase === 'over'}
        revealDamage={phase === 'over'}
        last={lastShot?.side === 'right' ? lastShot.key : null}
        side="right"
        canFire={canFire}
        onAim={onAim}
        onFire={onFire}
      />

      {/* Exit confirmation */}
      {confirmExit && (
        <div className="scrim" onClick={() => setConfirmExit(false)}>
          <div className="glass alert" role="alertdialog" aria-labelledby="exit-title" onClick={(e) => e.stopPropagation()}>
            <div className="alert-body">
              <h3 id="exit-title">Leave Battle?</h3>
              <p>Your progress in this battle will be lost.</p>
            </div>
            <div className="alert-actions">
              <button type="button" onClick={() => setConfirmExit(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="destructive"
                onClick={() => {
                  setConfirmExit(false)
                  onExit()
                }}
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Result */}
      {phase === 'over' && (
        <div className="scrim">
          <div className={`glass sheet ${winner}`}>
            <div className="sheet-eyebrow">{winner === 'player' ? 'Mission complete' : 'Mission failed'}</div>
            <h1>{winner === 'player' ? 'Victory' : 'Defeat'}</h1>
            <p className="secondary">
              {winner === 'player' ? 'You sank the entire enemy fleet.' : 'Your fleet has been destroyed.'}
            </p>
            <div className="sheet-stats">
              <div>
                <b>{stats(shotsAtEnemy).shots}</b>
                <span>Shots</span>
              </div>
              <div>
                <b>{stats(shotsAtEnemy).acc}%</b>
                <span>Accuracy</span>
              </div>
              <div>
                <b>{playerShips.filter((s) => !isSunk(s, shotsAtPlayer)).length}</b>
                <span>Ships left</span>
              </div>
            </div>
            <div className="sheet-actions">
              <button type="button" className="btn primary wide" onClick={onExit}>
                Play Again
              </button>
              <button type="button" className="btn plain" onClick={onExit}>
                Exit to Deploy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

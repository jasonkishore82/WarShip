import { useMemo } from 'react'
import {
  Anchor,
  Box,
  CIWS,
  CanisterRack,
  Cyl,
  Flag,
  Helipad,
  HullNumber,
  NavLights,
  NavalGun,
  RaftCanisters,
  TaperBox,
  VLS,
  Boat,
  ShipHull,
  makeHullSpec,
  mats,
} from './parts'

// Flat radar panel set into the integrated mast.
function MastPanel({ position, rotationY }) {
  const m = mats()
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <Box size={[0.25, 2.6, 2.6]} rotation={[0, 0, 0.2]} mat={m.arrayFace} />
    </group>
  )
}

export default function Destroyer({ length: L }) {
  const m = mats()
  const spec = useMemo(
    () => makeHullSpec({ length: L, beam: 11, draft: 3.6, freeboard: 5, sheer: 0.3, flare: 0.32, bowStart: 0.5, sternWidth: 0.9, rake: 0.05 }),
    [L]
  )
  const d = spec.deckY
  const base = d(0)

  return (
    <group>
      <ShipHull spec={spec} railOpts={{ from: 0.02, to: 0.6, spacing: 2 }} />
      <HullNumber spec={spec} text="21" t={0.83} size={3.4} />

      {/* Bow: anchors, stealth gun, missile cells */}
      {[-1, 1].map((s) => (
        <Anchor key={s} position={[L * 0.41, d(L * 0.41) - 1.4, s * (spec.halfAt(L * 0.41) + 0.06)]} side={s} />
      ))}
      <NavalGun position={[L * 0.3, d(L * 0.3), 0]} stealth scale={0.8} />
      <VLS position={[L * 0.185, d(L * 0.185), 0]} cols={6} rows={4} cell={1} />

      {/* Faceted superstructure */}
      <TaperBox size={[24, 6, 10.4]} taper={0.78} taperX={0.94} position={[-L * 0.02, base + 3, 0]} />
      {/* Bridge with sloped glass */}
      <TaperBox size={[8, 3, 9]} taper={0.72} taperX={0.82} position={[L * 0.085, base + 7.2, 0]} mat={m.hazeLight} />
      <TaperBox size={[0.6, 1.2, 7.4]} taper={0.8} position={[L * 0.085 + 3.6, base + 7.4, 0]} rotation={[0, 0, 0.45]} mat={m.glass} />
      <NavLights x={L * 0.09} y={base + 6.4} halfWidth={4.4} />

      {/* Integrated mast: radar panels on four faces, radome on top */}
      <group position={[L * 0.02, base + 6, 0]}>
        <TaperBox size={[5.6, 11, 5.6]} taper={0.42} taperX={0.42} position={[0, 5.5, 0]} />
        <MastPanel position={[2.2, 4.5, 0]} rotationY={0} />
        <MastPanel position={[-2.2, 4.5, 0]} rotationY={Math.PI} />
        <MastPanel position={[0, 4.5, 2.2]} rotationY={-Math.PI / 2} />
        <MastPanel position={[0, 4.5, -2.2]} rotationY={Math.PI / 2} />
        <mesh position={[0, 12.2, 0]} material={m.white}>
          <sphereGeometry args={[1.5, 24, 16]} />
        </mesh>
        <Cyl r={0.06} h={3.5} position={[0, 14.5, 0]} mat={m.black} />
        {[-1, 1].map((s) => (
          <Cyl key={s} r={0.05} h={2} position={[0, 11, s * 1.6]} rotation={[s * 0.6, 0, 0]} mat={m.black} />
        ))}
      </group>

      {/* Boat bays recessed into each side, with RHIBs */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Box size={[7.5, 2.6, 0.4]} position={[-L * 0.05, base + 2.2, s * 4.6]} mat={m.black} />
          <Boat position={[-L * 0.05, base + 1.6, s * 4.1]} length={6} rhib />
        </group>
      ))}

      {/* Funnel with grille top */}
      <TaperBox size={[6, 4.6, 5.4]} taper={0.7} taperX={0.82} position={[-L * 0.155, base + 8.1, 0]} />
      <Box size={[3.6, 0.3, 3]} position={[-L * 0.155, base + 10.5, 0]} mat={m.black} />

      {/* Missile racks and life rafts between funnel and hangar */}
      <CanisterRack position={[-L * 0.17, base, 3.2]} rotation={0.2} />
      <CanisterRack position={[-L * 0.17, base, -3.2]} rotation={-0.2} />
      <RaftCanisters position={[-L * 0.08, base + 4, 5]} count={4} />
      <RaftCanisters position={[-L * 0.08, base + 4, -5]} count={4} />

      {/* Hangar and flight deck */}
      <TaperBox size={[12, 5.6, 10.4]} taper={0.82} taperX={0.96} position={[-L * 0.27, base + 2.8, 0]} />
      <Box size={[0.2, 4.4, 6.4]} position={[-L * 0.27 - 6.05, base + 2.4, 0]} mat={m.hazeDark} />
      <CIWS position={[-L * 0.27, base + 5.6, 0]} rotation={Math.PI} />
      <Helipad position={[-L * 0.4, d(-L * 0.4) + 0.08, 0]} size={9} />
      <Flag position={[-L / 2 - 0.3, d(-L / 2), 0]} height={4} />
    </group>
  )
}

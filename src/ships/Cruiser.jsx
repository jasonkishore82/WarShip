import { useMemo } from 'react'
import {
  Anchor,
  ArrayPanel,
  Boat,
  Box,
  CIWS,
  CanisterRack,
  Cyl,
  Dome,
  Flag,
  Helipad,
  HullNumber,
  Mast,
  NavLights,
  NavalGun,
  RaftCanisters,
  ShipHull,
  TaperBox,
  VLS,
  Windows,
  makeHullSpec,
  mats,
} from './parts'

// Twin gas-turbine uptakes with exhaust caps.
function Uptakes({ position }) {
  const m = mats()
  return (
    <group position={position}>
      <TaperBox size={[6, 6.5, 6.5]} taper={0.82} taperX={0.85} position={[0, 3.25, 0]} />
      {[-1.4, 1.4].map((z) => (
        <group key={z}>
          <Box size={[2.4, 0.9, 2]} position={[0, 6.9, z]} mat={m.black} />
          <Cyl r={0.45} h={1.4} position={[-0.6, 7.5, z]} mat={m.hazeDark} />
        </group>
      ))}
      <Box size={[5.2, 0.15, 6]} position={[0, 6.55, 0]} mat={m.hazeDark} />
    </group>
  )
}

export default function Cruiser({ length: L }) {
  const m = mats()
  const spec = useMemo(
    () => makeHullSpec({ length: L, beam: 16, draft: 5, freeboard: 6, sheer: 0.35, flare: 0.26, bowStart: 0.55, sternWidth: 0.88, rake: 0.05 }),
    [L]
  )
  const d = spec.deckY
  const base = d(0)

  return (
    <group>
      <ShipHull spec={spec} />
      <HullNumber spec={spec} text="54" t={0.84} size={4.2} />

      {/* Forecastle: anchors, jack staff, forward gun and missile cells */}
      {[-1, 1].map((s) => (
        <Anchor key={s} position={[L * 0.42, d(L * 0.42) - 1.6, s * (spec.halfAt(L * 0.42) + 0.08)]} side={s} />
      ))}
      <Cyl r={0.06} h={4} position={[L / 2 + 2.2, d(L / 2) + 2, 0]} mat={m.black} />
      <NavalGun position={[L * 0.33, d(L * 0.33), 0]} />
      <VLS position={[L * 0.215, d(L * 0.215), 0]} cols={8} rows={5} cell={1.15} />

      {/* Forward deckhouse with the bridge and radar panels */}
      <group position={[L * 0.08, base, 0]}>
        <Box size={[18, 7, 14]} position={[0, 3.5, 0]} />
        <ArrayPanel position={[6.3, 4.6, -4.8]} rotationY={Math.PI / 4} size={4.6} />
        <ArrayPanel position={[6.3, 4.6, 4.8]} rotationY={-Math.PI / 4} size={4.6} />
        <Box size={[10, 3, 12.5]} position={[3, 8.5, 0]} mat={m.hazeLight} />
        <Windows size={[0.12, 1.1, 11.5]} position={[8.05, 8.9, 0]} />
        <Windows size={[9, 1.1, 12.6]} position={[3, 8.9, 0]} />
        {/* bridge wings with nav lights */}
        <Box size={[3, 0.35, 17]} position={[5.5, 7.4, 0]} mat={m.hazeDark} />
        <NavLights x={5.5} y={7.8} halfWidth={8.4} />
        <CIWS position={[-6, 7, -3.5]} rotation={Math.PI / 2} />
        <Dome position={[-2, 10, 3.2]} r={1} />
        <Mast position={[-1, 10, 0]} height={14} yard={9} radar />
        <RaftCanisters position={[-6, 4.5, 7.4]} count={5} />
        <RaftCanisters position={[-6, 4.5, -7.4]} count={5} />
      </group>

      {/* Midships: deckhouse, two sets of uptakes, boats */}
      <Box size={[L * 0.32, 3.4, 12]} position={[-L * 0.1, base + 1.7, 0]} />
      <Uptakes position={[-L * 0.02, base + 3.4, 0]} />
      <Uptakes position={[-L * 0.16, base + 3.4, 0]} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <Boat position={[-L * 0.09, base + 4.2, s * 5.2]} length={7} rhib={s > 0} />
          <Box size={[0.3, 3, 0.3]} position={[-L * 0.09 + 2.5, base + 4.5, s * 6.2]} mat={m.hazeDark} />
          <Box size={[0.3, 3, 0.3]} position={[-L * 0.09 - 2.5, base + 4.5, s * 6.2]} mat={m.hazeDark} />
        </group>
      ))}

      {/* Aft deckhouse with aft-facing radar panels, aft mast */}
      <group position={[-L * 0.22, base, 0]}>
        <Box size={[10, 6, 12]} position={[0, 3, 0]} />
        <ArrayPanel position={[-5.3, 4, -4.2]} rotationY={(Math.PI * 3) / 4} size={4.4} />
        <ArrayPanel position={[-5.3, 4, 4.2]} rotationY={(-Math.PI * 3) / 4} size={4.4} />
        <Mast position={[1.5, 6, 0]} height={9} yard={6} radar={false} />
        <Dome position={[3, 6, -3]} r={0.9} />
      </group>
      {/* Anti-ship missile racks */}
      <CanisterRack position={[-L * 0.265, base, 5]} rotation={0.15} />
      <CanisterRack position={[-L * 0.265, base, -5]} rotation={-0.15} />

      {/* Hangar and flight deck */}
      <group position={[-L * 0.31, base, 0]}>
        <Box size={[9, 6, 13]} position={[0, 3, 0]} />
        <Box size={[0.2, 4.6, 5.4]} position={[-4.6, 2.4, -3]} mat={m.hazeDark} />
        <Box size={[0.2, 4.6, 5.4]} position={[-4.6, 2.4, 3]} mat={m.hazeDark} />
        <CIWS position={[1, 6, 3.4]} rotation={-Math.PI / 2} />
      </group>
      <Box size={[16, 0.15, 14]} position={[-L * 0.39, d(-L * 0.39) + 0.05, 0]} mat={m.deck} />
      <Helipad position={[-L * 0.39, d(-L * 0.39) + 0.15, 0]} size={13} />

      {/* Aft missile cells and gun at the stern */}
      <VLS position={[-L * 0.445, d(-L * 0.445), 0]} cols={5} rows={5} cell={1.1} />
      <NavalGun position={[-L * 0.48, d(-L * 0.48), 0]} rotation={Math.PI} scale={0.9} />
      <Flag position={[-L / 2 - 0.5, d(-L / 2), 0]} height={5} />
    </group>
  )
}

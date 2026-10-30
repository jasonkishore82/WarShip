// Detailed ship models, keyed by ship type. Each takes { length } and is built
// with the bow along +x, starboard along +z and the waterline at y = 0.
import Carrier from './Carrier'
import Battleship from './Battleship'
import Cruiser from './Cruiser'
import Submarine from './Submarine'
import Destroyer from './Destroyer'

export const SHIP_MODELS = {
  carrier: Carrier,
  battleship: Battleship,
  cruiser: Cruiser,
  submarine: Submarine,
  destroyer: Destroyer,
}

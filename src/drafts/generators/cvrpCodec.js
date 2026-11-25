export const TRIP_COLORS = Array.of(
  '#38bdf8', // sky blue
  '#4ade80', // emerald green
  '#fbbf24', // amber
  '#c084fc', // purple
  '#fb7185', // rose
  '#2dd4bf' // teal
)

export const arcVar = (u, v) => `e_${u}_${v}`

/**
 * Computes rounded integer Euclidean distance between two 2D points.
 */
export function calcDistance(p1, p2) {
  const dx = p1.x - p2.x
  const dy = p1.y - p2.y
  return Math.max(1, Math.round(Math.hypot(dx, dy) / 10))
}

/**
 * Builds shared distance matrix, upper distance bound, and core CVRP constraints
 * using `sumBool(...)` and conditional multiplication (`dist *? e_u_v`).
 */
export function buildBaseCvrpConstraints({ depot, clients, capacity }) {
  const cap = Math.floor(Number(capacity) || 10)
  const n = clients.length
  const totalDemand = clients.reduce((sum, c) => sum + c.demand, 0)
  const minTrips = Math.max(1, Math.ceil(totalDemand / cap))

  const distances = {}
  const allPoints = [depot, ...clients]
  const allEdgeWeights = []

  for (let i = 0; i < allPoints.length; i++) {
    for (let j = 0; j < allPoints.length; j++) {
      if (i === j) continue
      const u = allPoints[i].id
      const v = allPoints[j].id
      const d = calcDistance(allPoints[i], allPoints[j])
      distances[arcVar(u, v)] = d
      allEdgeWeights.push(d)
    }
  }

  allEdgeWeights.sort((a, b) => b - a)
  const maxActiveArcs = Math.min(allEdgeWeights.length, n * 2)
  const upperDistBound = Math.max(
    10,
    allEdgeWeights.slice(0, maxActiveArcs).reduce((sum, w) => sum + w, 0)
  )

  const depotOutArcs = clients.map((c) => arcVar(depot.id, c.id))
  const depotInArcs = clients.map((c) => arcVar(c.id, depot.id))

  let body = '// Depot trip count constraints\n'
  body += `tripsOut = sumBool( ${depotOutArcs.join(', ')} )\n`
  body += `tripsIn = sumBool( ${depotInArcs.join(', ')} )\n`
  body += `tripsOut >= ${minTrips}\n`
  body += `tripsOut <= ${n}\n`
  body += `tripsOut = tripsIn\n\n`

  body += '// Each client visited exactly once\n'
  for (const c of clients) {
    const outArcs = [arcVar(c.id, depot.id)]
    const inArcs = [arcVar(depot.id, c.id)]
    for (const other of clients) {
      if (other.id === c.id) continue
      outArcs.push(arcVar(c.id, other.id))
      inArcs.push(arcVar(other.id, c.id))
    }
    body += `1 = sumBool( ${outArcs.join(', ')} )\n`
    body += `1 = sumBool( ${inArcs.join(', ')} )\n`
  }
  body += '\n'

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = clients[i].id
      const b = clients[j].id
      body += `${arcVar(a, b)} && ${arcVar(b, a)} == false\n`
    }
  }
  body += '\n'

  body += '// Cumulative load constraints\n'
  for (const c of clients) {
    body += `load_${c.id} >= ${c.demand}\n`
    body += `load_${c.id} <= ${cap}\n`
    body += `${arcVar(depot.id, c.id)} ? load_${c.id} = ${c.demand}\n`
    for (const prev of clients) {
      if (prev.id === c.id) continue
      body += `${arcVar(prev.id, c.id)} ? (load_${prev.id} + ${c.demand}) = load_${c.id}\n`
    }
    body += '\n'
  }

  const distTerms = Object.entries(distances).map(([varName, dist]) => `${dist} *? ${varName}`)
  body += '// Objective: total distance across all trips\n'
  body += `totalDist = ${distTerms.join(' + ')}\n`

  return { cap, n, distances, upperDistBound, body }
}

/**
 * Generates E0 code for Capacitated Vehicle Routing Problem (CVRP).
 */
export function generateCvrpCode({ depot, clients, capacity }) {
  const { cap, n, distances, upperDistBound, body } = buildBaseCvrpConstraints({
    depot,
    clients,
    capacity
  })

  const maxVal = Math.max(upperDistBound, cap, n)
  const intSize = Math.max(2, maxVal.toString(2).length)

  let code = `// Capacitated Vehicle Routing Problem (${n} clients, capacity = ${cap})\n\n`
  code += `size + ${intSize} 0\n`
  code += `binarySearch min totalDist 0 ${upperDistBound}\n\n`
  code += body

  return { code, distances }
}

/**
 * Decodes solver variables into individual round-trips.
 */
export function decodeCvrpSolution({ depot, clients, capacity }, distances, inputVarsResults) {
  if (!inputVarsResults || inputVarsResults === false) {
    return null
  }

  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c]))
  const allIds = [depot.id, ...clients.map((c) => c.id)]

  const nextByNode = {}
  const tripStarts = []

  for (const u of allIds) {
    for (const v of allIds) {
      if (u === v) continue
      const raw = inputVarsResults[arcVar(u, v)]
      if (raw === true || raw === 'true' || raw === 1 || raw === '1') {
        if (u === depot.id) {
          tripStarts.push(v)
        } else {
          nextByNode[u] = v
        }
      }
    }
  }

  const trips = []
  tripStarts.forEach((firstClientId, idx) => {
    const path = [depot.id]
    const stops = []
    let curr = firstClientId
    let tripDist = distances[arcVar(depot.id, firstClientId)] || 0
    let tripLoad = 0
    const guard = new Set()

    while (curr && curr !== depot.id && !guard.has(curr)) {
      guard.add(curr)
      path.push(curr)
      const clientObj = clientMap[curr]
      if (clientObj) {
        stops.push(clientObj)
        tripLoad += clientObj.demand
      }

      const nxt = nextByNode[curr]
      if (!nxt) break
      tripDist += distances[arcVar(curr, nxt)] || 0
      curr = nxt
    }

    path.push(depot.id)

    trips.push({
      tripNumber: idx + 1,
      path,
      stops,
      load: tripLoad,
      capacity,
      distance: tripDist
    })
  })

  if (trips.length === 0) return null

  return {
    totalDistance: String(inputVarsResults.totalDist ?? trips.reduce((s, t) => s + t.distance, 0)),
    tripsCount: trips.length,
    trips
  }
}

/**
 * Computes SVG line coordinates, arrow padding, and midpoint badges for solved trips.
 */
export function buildRouteArcs(depot, clients, trips) {
  if (!trips?.length) return Array.of()
  const pointMap = {
    [depot.id]: depot,
    ...Object.fromEntries(clients.map((c) => [c.id, c]))
  }

  const arcs = Array.of()
  trips.forEach((trip, tIdx) => {
    const colorIndex = tIdx % TRIP_COLORS.length
    const color = TRIP_COLORS[colorIndex]
    for (let i = 1; i < trip.path.length; i++) {
      const uId = trip.path[i - 1]
      const vId = trip.path[i]
      const p1 = pointMap[uId]
      const p2 = pointMap[vId]
      if (!p1 || !p2) continue

      const dx = p2.x - p1.x
      const dy = p2.y - p1.y
      const len = Math.hypot(dx, dy) || 1
      const ux = dx / len
      const uy = dy / len

      const padStart = uId === depot.id ? 18 : 17
      const padEnd = vId === depot.id ? 21 : 20

      arcs.push({
        key: `t${trip.tripNumber}-${uId}->${vId}`,
        color,
        colorIndex,
        x1: p1.x + ux * padStart,
        y1: p1.y + uy * padStart,
        x2: p2.x - ux * padEnd,
        y2: p2.y - uy * padEnd,
        mx: (p1.x + p2.x) / 2,
        my: (p1.y + p2.y) / 2,
        dist: calcDistance(p1, p2)
      })
    }
  })

  return arcs
}

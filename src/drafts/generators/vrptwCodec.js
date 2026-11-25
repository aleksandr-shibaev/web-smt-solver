import { arcVar, buildBaseCvrpConstraints } from './cvrpCodec.js'

/**
 * Generates .eproto code for Capacitated Vehicle Routing Problem with Time Windows (VRPTW).
 */
export function generateVrptwCode({ depot, clients, capacity, horizon }) {
  const maxHorizon = Math.floor(Number(horizon) || 120)
  const { cap, n, distances, upperDistBound, body } = buildBaseCvrpConstraints({
    depot,
    clients,
    capacity
  })

  // Tight power-of-two upper bound for slack variables (free bit-fixing in E0)
  const slackPow2Bound = 1 << maxHorizon.toString(2).length
  const maxVal = Math.max(upperDistBound, maxHorizon + slackPow2Bound, cap, n)
  const intSize = Math.max(2, maxVal.toString(2).length)

  let code = `// VRPTW (${n} clients, capacity = ${cap}, shift horizon = ${maxHorizon})\n\n`
  code += `size + ${intSize} 0\n`
  code += `binarySearch min totalDist 0 ${upperDistBound}\n\n`
  code += body + '\n'

  // Time windows & service schedule progression with power-of-two bounded slack variables
  code += `// Time windows & schedule constraints (slack < ${slackPow2Bound} fixes upper bits for free)\n`
  let slackIdx = 1
  for (const c of clients) {
    const tVar = `t_${c.id}`
    const distFromDepot = distances[arcVar(depot.id, c.id)]
    const distToDepot = distances[arcVar(c.id, depot.id)]

    code += `${tVar} >= ${c.winStart}\n`
    code += `${tVar} <= ${c.winEnd}\n`

    const sStart = `tw_s_${slackIdx++}`
    code += `${sStart} >= 0; ${sStart} < ${slackPow2Bound}; ${arcVar(depot.id, c.id)} ? (${distFromDepot} + ${sStart}) = ${tVar}\n`

    const sEnd = `tw_e_${slackIdx++}`
    code += `${sEnd} >= 0; ${sEnd} < ${slackPow2Bound}; ${arcVar(c.id, depot.id)} ? (${tVar} + ${c.service + distToDepot} + ${sEnd}) = ${maxHorizon}\n`

    for (const prev of clients) {
      if (prev.id === c.id) continue
      const travel = distances[arcVar(prev.id, c.id)]
      const offset = prev.service + travel
      const sLeg = `tw_l_${slackIdx++}`
      code += `${sLeg} >= 0; ${sLeg} < ${slackPow2Bound}; ${arcVar(prev.id, c.id)} ? (t_${prev.id} + ${offset} + ${sLeg}) = ${tVar}\n`
    }
    code += '\n'
  }

  return { code, distances }
}

/**
 * Decodes solver variables into time-stamped delivery trips.
 */
export function decodeVrptwSolution({ depot, clients, capacity }, distances, inputVarsResults) {
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
    const timeline = []
    let curr = firstClientId
    let tripDist = distances[arcVar(depot.id, firstClientId)] || 0
    let tripLoad = 0
    let prevDepartTime = 0
    const guard = new Set()

    while (curr && curr !== depot.id && !guard.has(curr)) {
      guard.add(curr)
      path.push(curr)
      const cObj = clientMap[curr]
      const serviceStart = Number(inputVarsResults[`t_${curr}`] ?? 0)
      const prevNodeId = path[path.length - 2]
      const travelTime = distances[arcVar(prevNodeId, curr)] || 0
      const rawArrival = prevDepartTime + travelTime
      const waitTime = Math.max(0, serviceStart - rawArrival)

      if (cObj) {
        tripLoad += cObj.demand
        timeline.push({
          id: cObj.id,
          demand: cObj.demand,
          arrival: rawArrival,
          waitTime,
          serviceStart,
          serviceEnd: serviceStart + cObj.service,
          winStart: cObj.winStart,
          winEnd: cObj.winEnd
        })
        prevDepartTime = serviceStart + cObj.service
      }

      const nxt = nextByNode[curr]
      if (!nxt) break
      tripDist += distances[arcVar(curr, nxt)] || 0
      curr = nxt
    }

    const lastClient = timeline[timeline.length - 1]
    const returnTravel = lastClient ? distances[arcVar(lastClient.id, depot.id)] || 0 : 0
    const depotReturnTime = prevDepartTime + returnTravel

    path.push(depot.id)

    trips.push({
      tripNumber: idx + 1,
      path,
      timeline,
      depotReturnTime,
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

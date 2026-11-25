const getEdgeName = (v1, v2) => `e_${v1}_${v2}`

/**
 * Parses edge list text into directed weighted arcs.
 * Supports:
 *  - Undirected edge: "v1 v2 10" (creates both v1->v2 and v2->v1 with weight 10)
 *  - Directed arc:    "v1 -> v2 10" (creates only v1->v2 with weight 10)
 */
export function parseWeightedEdges(rawText) {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/(\/\/|#).*$/, '').trim())
    .filter(Boolean)

  if (lines.length === 0) {
    return {
      edges: [],
      error: 'Enter at least 3 edges (format: "v1 v2 weight" or "v1 -> v2 weight").'
    }
  }

  const edges = []
  const seenArcs = new Set()

  const addArc = (from, to, weight, lineNum) => {
    const key = `${from}->${to}`
    if (seenArcs.has(key)) {
      return `Line ${lineNum}: duplicate arc "${from} -> ${to}".`
    }
    seenArcs.add(key)
    edges.push({ u: from, v: to, weight })
    return null
  }

  for (let idx = 0; idx < lines.length; idx++) {
    const lineNum = idx + 1
    let line = lines[idx]
    let isDirected = false

    if (line.includes('->')) {
      isDirected = true
      line = line.replace('->', ' ')
    }

    const parts = line.split(/[\s,]+/).filter(Boolean)
    if (parts.length !== 3) {
      return {
        edges: [],
        error: `Line ${lineNum}: expected "v1 v2 weight" or "v1 -> v2 weight", got "${lines[idx]}".`
      }
    }

    const [u, v, rawW] = parts
    if (!/^[a-zA-Z0-9_]+$/.test(u) || !/^[a-zA-Z0-9_]+$/.test(v)) {
      return {
        edges: [],
        error: `Line ${lineNum}: vertex names must contain only letters, digits, or "_".`
      }
    }

    if (u === v) {
      return {
        edges: [],
        error: `Line ${lineNum}: self-loops (${u} -> ${v}) are not allowed in TSP.`
      }
    }

    if (!/^\d+$/.test(rawW)) {
      return {
        edges: [],
        error: `Line ${lineNum}: weight "${rawW}" must be a non-negative integer.`
      }
    }

    const w = BigInt(rawW)
    const err1 = addArc(u, v, w, lineNum)
    if (err1) return { edges: [], error: err1 }

    if (!isDirected) {
      const err2 = addArc(v, u, w, lineNum)
      if (err2) return { edges: [], error: err2 }
    }
  }

  return { edges }
}

/**
 * Parses any NxN distance matrix (symmetric or asymmetric) into directed weighted arcs.
 */
export function parseDistanceMatrix(rawText) {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/(\/\/|#).*$/, '')
        .replace(/[[\]]/g, '')
        .trim()
    )
    .filter(Boolean)

  if (lines.length < 3) {
    return { edges: [], size: 0, error: 'Matrix must have at least 3 rows (N >= 3).' }
  }

  const n = lines.length
  const edges = []

  for (let r = 0; r < n; r++) {
    const tokens = lines[r].split(/[\s,]+/).filter(Boolean)
    if (tokens.length !== n) {
      return {
        edges: [],
        size: n,
        error: `Row ${r + 1}: expected ${n} columns to form an ${n}×${n} matrix, got ${tokens.length}.`
      }
    }

    for (let c = 0; c < n; c++) {
      if (r === c) continue
      const tok = tokens[c]
      if (tok === '_' || tok === '-') continue

      if (!/^\d+$/.test(tok)) {
        return {
          edges: [],
          size: n,
          error: `Row ${r + 1}, Col ${c + 1}: invalid token "${tok}" (use non-negative integers or "_").`
        }
      }

      const val = BigInt(tok)
      if (val > 0n) {
        edges.push({
          u: `v${r + 1}`,
          v: `v${c + 1}`,
          weight: val
        })
      }
    }
  }

  if (edges.length < n) {
    return {
      edges: [],
      size: n,
      error: 'Graph has too few edges to form a Hamiltonian cycle.'
    }
  }

  return { edges, size: n }
}

/**
 * Generates E0 code for Symmetric or Asymmetric TSP from directed weighted arcs
 * using conditional multiplication (`w *? e_u_v`) and `sumBool(...)`.
 */
export function generateTspEdgesCode(arcList) {
  const vertices = []
  const outAdj = {}
  const inAdj = {}
  const edgeWeights = {}
  let totalWeightSum = 0n

  for (const { u, v, weight } of arcList) {
    if (!outAdj[u]) {
      outAdj[u] = []
      inAdj[u] = []
      vertices.push(u)
    }
    if (!outAdj[v]) {
      outAdj[v] = []
      inAdj[v] = []
      vertices.push(v)
    }

    outAdj[u].push(v)
    inAdj[v].push(u)

    const arcName = getEdgeName(u, v)
    edgeWeights[arcName] = weight
    totalWeightSum += weight
  }

  if (vertices.length < 3) {
    throw new Error('TSP requires at least 3 distinct vertices.')
  }

  const maxNumber = totalWeightSum > 1n ? totalWeightSum : 1n
  const intSize = maxNumber.toString(2).length

  let code = `// Traveling Salesman Problem (${vertices.length} vertices, ${arcList.length} directed arcs)\n\n`
  code += `size ${intSize} 0\n`
  code += `binarySearch min r 0 ${maxNumber}\n\n`

  const sumTerms = []
  const handledPairs = new Set()

  for (const { u, v, weight } of arcList) {
    const arcName = getEdgeName(u, v)
    const revName = getEdgeName(v, u)
    sumTerms.push(`${weight} *? ${arcName}`)

    if (edgeWeights[revName] !== undefined) {
      const pairKey = u < v ? `${u}::${v}` : `${v}::${u}`
      if (!handledPairs.has(pairKey)) {
        handledPairs.add(pairKey)
        code += `${arcName} && ${revName} == false\n`
      }
    }
  }

  code += `\nr = ${sumTerms.join(' + ')}\n\n`

  const startVertex = vertices[0]
  code += `// Vertex visit order indices (1 .. ${vertices.length})\n`
  code += `${startVertex}_i = ${vertices.length}\n`
  code += `${startVertex}_p = ${vertices.length - 1}\n`
  code += `${startVertex}_n = 1\n\n`

  for (let i = 1; i < vertices.length; i++) {
    const vName = vertices[i]
    code += `${vName}_i >= 0\n`
    code += `${vName}_p = ${vName}_i - 1\n`
    code += `${vName}_n = ${vName}_i + 1\n\n`
  }

  code += '// Degree & Hamiltonian cycle continuity constraints\n'
  for (let i = 0; i < vertices.length; i++) {
    const curr = vertices[i]
    const outNeighbors = outAdj[curr]
    const inNeighbors = inAdj[curr]

    if (outNeighbors.length === 0 || inNeighbors.length === 0) {
      throw new Error(`Vertex "${curr}" has no incoming or outgoing edges.`)
    }

    const outEdges = []
    for (const next of outNeighbors) {
      const arcName = getEdgeName(curr, next)
      outEdges.push(arcName)
      code += `${arcName} ? ${curr}_n = ${next}_i\n`
    }

    const inEdges = []
    for (const prev of inNeighbors) {
      const revName = getEdgeName(prev, curr)
      inEdges.push(revName)
      if (prev === startVertex) {
        code += `${revName} ? ${curr}_p = 0\n`
      } else {
        code += `${revName} ? ${curr}_p = ${prev}_i\n`
      }
    }

    code += `1 = sumBool( ${outEdges.join(', ')} )\n`
    code += `1 = sumBool( ${inEdges.join(', ')} )\n\n`
  }

  return {
    code,
    vertices,
    edgeWeights
  }
}

export function decodeTspEdgesSolution(vertices, edgeWeights, inputVarsResults) {
  if (!inputVarsResults || inputVarsResults === false) {
    return null
  }

  const n = vertices.length
  const path = new Array(n + 1).fill(null)
  path[0] = vertices[0]

  for (let i = 0; i < n; i++) {
    const vName = vertices[i]
    const rawIdx = inputVarsResults[`${vName}_i`]
    const pos = Number(rawIdx)

    if (!Number.isInteger(pos) || pos < 1 || pos > n || path[pos] !== null) {
      return null
    }
    path[pos] = vName
  }

  const steps = []
  let checkSum = 0n

  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1]
    const to = path[i]
    const w = edgeWeights[getEdgeName(from, to)]
    if (w === undefined) return null

    checkSum += BigInt(w)
    steps.push({
      from,
      to,
      weight: w.toString()
    })
  }

  if (inputVarsResults.r !== undefined && checkSum !== BigInt(inputVarsResults.r)) {
    return null
  }

  return {
    minCost: checkSum.toString(),
    path,
    steps
  }
}

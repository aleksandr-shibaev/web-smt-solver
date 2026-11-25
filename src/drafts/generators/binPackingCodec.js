/**
 * Parses raw user text into named items with integer sizes.
 * Supports:
 *  - "AuthService: 4, Worker: 6, Cache: 3" or newline-separated "AuthService 4"
 *  - Plain numbers list: "[4, 8, 5, 1, 7, 6, 1, 4, 2, 2]" or "4 8 5 1 7"
 */
export function parseBinPackingItems(rawText) {
  const cleaned = String(rawText || '')
    .replace(/(\/\/|#).*$/gm, '')
    .replace(/[[\]]/g, '')
    .trim()

  if (!cleaned) {
    return { items: [], error: 'Enter at least one item with a positive integer size.' }
  }

  const entries = cleaned
    .split(/[\r\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)

  const items = []

  if (entries.length === 1 && /^[\d\s]+$/.test(entries.at(0))) {
    const nums = entries.at(0).split(/\s+/).filter(Boolean)
    nums.forEach((tok, idx) => {
      items.push({
        id: `item_${idx + 1}`,
        name: `Item ${idx + 1}`,
        size: Number(tok)
      })
    })
    return { items }
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    if (/^\d+$/.test(entry)) {
      const val = Number(entry)
      if (val <= 0) {
        return { items: [], error: `Entry ${i + 1}: size must be a positive integer.` }
      }
      items.push({
        id: `item_${i + 1}`,
        name: `Item ${i + 1}`,
        size: val
      })
      continue
    }

    const match = entry.match(/^(.+?)[:\s]+(\d+)$/)
    if (!match) {
      return {
        items: [],
        error: `Entry ${i + 1}: expected "Name: size" or integer size, got "${entry}".`
      }
    }

    const name = match.at(1).trim()
    const size = Number(match.at(2))
    if (size <= 0) {
      return { items: [], error: `Entry ${i + 1} ("${name}"): size must be > 0.` }
    }

    items.push({
      id: `item_${i + 1}`,
      name,
      size
    })
  }

  return { items }
}

/**
 * Generates E0 code for 1D Bin Packing (minimizing number of bins used)
 * using `sumBool(...)` and conditional multiplication (`size *? x_i_b`).
 */
export function generateBinPackingCode(capacity, items) {
  const cap = Math.floor(Number(capacity) || 10)
  const n = items.length

  const totalSize = items.reduce((sum, it) => sum + it.size, 0)
  const minBins = Math.max(1, Math.ceil(totalSize / cap))
  const maxBins = n

  const maxVal = Math.max(cap, n, 2)
  const intSize = Math.max(2, maxVal.toString(2).length)

  let code = `// 1D Bin Packing / Server Allocation (${n} items, bin capacity = ${cap})\n\n`
  code += `size + ${intSize} 0\n`
  code += `binarySearch min k ${minBins} ${maxBins}\n\n`

  code += '// Symmetry breaking: place first item in bin 0 and pack bins sequentially\n'
  code += 'x_0_0 == true\n'
  for (let b = 0; b < maxBins - 1; b++) {
    code += `!used_${b + 1} || used_${b}\n`
  }
  code += '\n'

  code += '// Each item assigned to exactly 1 bin\n'
  for (let i = 0; i < n; i++) {
    const vars = []
    for (let b = 0; b < maxBins; b++) {
      vars.push(`x_${i}_${b}`)
    }
    code += `1 = sumBool( ${vars.join(', ')} )\n`
  }
  code += '\n'

  code += '// Bin capacity & usage constraints\n'
  const usedVars = []
  for (let b = 0; b < maxBins; b++) {
    const terms = items.map((it, i) => `${it.size} *? x_${i}_${b}`)
    code += `load_${b} = ${terms.join(' + ')}\n`
    code += `load_${b} <= ${cap}\n`
    code += `used_${b} == load_${b} > 0\n\n`
    usedVars.push(`used_${b}`)
  }

  code += '// Total active bins\n'
  code += `k = sumBool( ${usedVars.join(', ')} )\n`

  return code
}

/**
 * Decodes solver output variables into packed bins with utilization metrics.
 */
export function decodeBinPackingSolution(capacity, items, inputVarsResults) {
  if (!inputVarsResults || inputVarsResults === false) {
    return null
  }

  const n = items.length
  const bins = []

  for (let b = 0; b < n; b++) {
    const assigned = []
    let usedLoad = 0

    for (let i = 0; i < n; i++) {
      const raw = inputVarsResults[`x_${i}_${b}`]
      if (raw === true || raw === 'true' || raw === 1 || raw === '1') {
        assigned.push({
          ...items[i],
          itemIndex: i
        })
        usedLoad += items[i].size
      }
    }

    if (assigned.length > 0) {
      bins.push({
        binIndex: b + 1,
        items: assigned,
        usedLoad,
        freeSpace: capacity - usedLoad,
        utilizationPct: Math.round((usedLoad / capacity) * 100)
      })
    }
  }

  const totalLoad = items.reduce((s, it) => s + it.size, 0)
  const totalCapacity = bins.length * capacity

  return {
    binsCount: bins.length,
    capacity,
    totalLoad,
    totalUtilizationPct: totalCapacity > 0 ? Math.round((totalLoad / totalCapacity) * 100) : 0,
    bins
  }
}

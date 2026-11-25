export function generateItemName() {
  const hash = Math.floor(100000 + Math.random() * 900000)
  return `item-${hash}`
}

export function createKnapsackItem(weight, value, customName = '') {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: customName || generateItemName(),
    weight,
    value
  }
}

export function itemsToFormattedText(itemList) {
  if (itemList.length === 0) return '[]'
  const lines = itemList.map((it, idx) => {
    const comma = idx < itemList.length - 1 ? ',' : ''
    const w = Number(it.weight) || 0
    const v = Number(it.value) || 0
    const safeName = String(it.name || generateItemName()).replace(/"/g, '\\"')
    return `  {w: ${w}, v: ${v}, name: "${safeName}"}${comma}`
  })
  return `[\n${lines.join('\n')}\n]`
}

export function parseRawTextToItems(rawText) {
  const objectMatches = String(rawText || '').match(/\{[^}]+\}/g)
  if (!objectMatches || objectMatches.length === 0) {
    return null
  }

  const parsed = []
  for (const block of objectMatches) {
    const wMatch = block.match(/(?:^|[,{\s])"?w"?\s*:\s*(\d+)/i)
    const vMatch = block.match(/(?:^|[,{\s])"?v"?\s*:\s*(\d+)/i)

    if (!wMatch || !vMatch) {
      return null
    }

    const nameMatch = block.match(/(?:^|[,{\s])"?name"?\s*:\s*(?:"([^"]*)"|'([^']*)')/i)
    const extractedName = nameMatch ? (nameMatch[1] ?? nameMatch[2] ?? '').trim() : ''

    parsed.push(createKnapsackItem(Number(wMatch[1]), Number(vMatch[1]), extractedName))
  }

  return parsed
}

/**
 * Generates E0 code for the 0-1 Knapsack optimization problem
 * using conditional multiplication (`weight *? x_i`) and `binarySearch max v`.
 */
export function generateKnapsackCode(maxCapacity, items) {
  const cap = BigInt(Math.max(0, Math.floor(Number(maxCapacity) || 0)))

  const normalized = items.map((item, idx) => ({
    varName: `x${idx + 1}`,
    name: item.name || `Item ${idx + 1}`,
    weight: BigInt(Math.max(0, Math.floor(Number(item.weight) || 0))),
    value: BigInt(Math.max(0, Math.floor(Number(item.value) || 0)))
  }))

  let totalWeight = 0n
  let totalValue = 0n
  for (const it of normalized) {
    totalWeight += it.weight
    totalValue += it.value
  }

  let maxNumber = cap > totalWeight ? cap : totalWeight
  if (totalValue > maxNumber) maxNumber = totalValue
  if (maxNumber < 1n) maxNumber = 1n

  const intSize = maxNumber.toString(2).length

  let code = `// 0-1 Knapsack Problem (${normalized.length} items, max capacity = ${cap})\n\n`
  code += `size ${intSize} 0\n`
  code += `binarySearch max v 0 ${totalValue}\n\n`

  const wTerms = normalized.map((it) => `${it.weight} *? ${it.varName}`)
  const vTerms = normalized.map((it) => `${it.value} *? ${it.varName}`)

  code += `${cap} >= ${wTerms.join(' + ')}\n`
  code += `v = ${vTerms.join(' + ')}\n`

  return code
}

/**
 * Decodes and verifies solver output variables into picked items and totals
 */
export function decodeKnapsackSolution(items, inputVarsResults) {
  if (!inputVarsResults || inputVarsResults === false) {
    return null
  }

  const pickedItems = []
  let totalWeight = 0n
  let totalValue = 0n

  items.forEach((item, idx) => {
    const varName = `x${idx + 1}`
    const rawVal = inputVarsResults[varName]
    const isPicked = rawVal === true || rawVal === 'true' || rawVal === 1 || rawVal === '1'

    if (isPicked) {
      const wNum = Math.max(0, Math.floor(Number(item.weight) || 0))
      const vNum = Math.max(0, Math.floor(Number(item.value) || 0))
      totalWeight += BigInt(wNum)
      totalValue += BigInt(vNum)
      pickedItems.push({
        id: item.id,
        varName,
        name: item.name || `Item ${idx + 1}`,
        weight: wNum,
        value: vNum
      })
    }
  })

  if (inputVarsResults.v !== undefined && String(inputVarsResults.v) !== totalValue.toString()) {
    return null
  }

  return {
    maxValue: totalValue.toString(),
    totalWeight: totalWeight.toString(),
    pickedItems
  }
}

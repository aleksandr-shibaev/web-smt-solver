/**
 * Parses raw user string into an array of BigInt numbers.
 * Accepts formats like: "[3, -7, 12, 5]" or "3 -7 12 5" or "3, -7, 12, 5"
 *
 * @param {string} rawText
 * @returns {bigint[] | null}
 */
export function parseNumbersList(rawText) {
  const matches = String(rawText || '').match(/-?\d+/g)
  if (!matches || matches.length === 0) {
    return null
  }
  return matches.map((token) => BigInt(token))
}

/**
 * Generates E0 code for Subset Sum (supports both positive-only and negative numbers).
 *
 * @param {bigint} targetSum - Target sum S
 * @param {bigint[]} numbers - Input numbers array
 * @returns {string} Generated E0 code
 */
export function generateSubsetSumCode(targetSum, numbers) {
  const s = BigInt(targetSum)
  const hasNegative = s < 0n || numbers.some((n) => n < 0n)

  if (!hasNegative) {
    const maxVal = s > 0n ? s : 1n
    const intSize = maxVal.toString(2).length

    const terms = []
    let removed = 0

    numbers.forEach((num, idx) => {
      if (num <= s) {
        terms.push(`${num} *? x${idx + 1}`)
      } else {
        removed++
      }
    })

    let code = `// Subset Sum (positive integers): target = ${s}\n`
    code += `size ${intSize} 0\n\n`

    if (removed > 0) {
      code += `// removed elements: ${removed}; max sum = ${s}\n`
    }

    if (terms.length === 0) {
      code += `${s} = 0\n`
    } else {
      code += `${s} = ${terms.join(' + ')}\n`
    }

    return code
  }

  // General mode with negative integers
  let maxPositive = 0n
  let maxNegative = 0n

  for (const num of numbers) {
    if (num < 0n) {
      maxNegative += num
    } else {
      maxPositive += num
    }
  }

  if (s >= 0n) {
    maxNegative -= s
  } else {
    maxPositive -= s
  }

  const diff = maxNegative + maxPositive
  let maxSum = diff > 0n ? -maxNegative : maxPositive
  if (maxSum < 1n) maxSum = 1n

  let intSize = maxSum.toString(2).length
  const absS = s < 0n ? -s : s
  if (absS > maxSum) {
    intSize = absS.toString(2).length
  }

  const terms = []
  let removed = 0

  numbers.forEach((num, idx) => {
    if (num >= -maxSum && num <= maxSum) {
      terms.push(`${num} *? x${idx + 1}`)
    } else {
      removed++
    }
  })

  let code = `// Subset Sum (with negative integers): target = ${s}\n`
  code += `size ${intSize} 0\n\n`

  if (removed > 0) {
    code += `// Pruned ${removed} element(s) outside reachable bound ±${maxSum}\n`
  }

  if (terms.length === 0) {
    code += `${s} = 0\n`
  } else {
    code += `${s} = ${terms.join(' + ')}\n`
  }

  return code
}

/**
 * Decodes and verifies solver output variables into picked indices and values.
 *
 * @param {bigint[]} numbers
 * @param {Record<string, any> | false} inputVarsResults
 * @param {bigint} [expectedTarget]
 * @returns {{ pickedItems: Array<{ index: number, varName: string, value: string }>, bitVector: string } | null}
 */
export function decodeSubsetSumSolution(numbers, inputVarsResults, expectedTarget) {
  if (!inputVarsResults || inputVarsResults === false) {
    return null
  }

  const pickedItems = []
  const bits = []
  let sum = 0n

  numbers.forEach((num, idx) => {
    const varName = `x${idx + 1}`
    const rawVal = inputVarsResults[varName]
    const isPicked = rawVal === true || rawVal === 'true' || rawVal === 1 || rawVal === '1'

    bits.push(isPicked ? '1' : '0')
    if (isPicked) {
      sum += BigInt(num)
      pickedItems.push({
        index: idx + 1,
        varName,
        value: num.toString()
      })
    }
  })

  if (expectedTarget !== undefined && sum !== BigInt(expectedTarget)) {
    return null
  }

  return {
    pickedItems,
    bitVector: bits.join(' ')
  }
}

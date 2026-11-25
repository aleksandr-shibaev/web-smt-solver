function modPowBigInt(base, exp, mod) {
  let result = 1n % mod
  let b = ((base % mod) + mod) % mod
  let e = exp

  while (e > 0n) {
    if ((e & 1n) === 1n) {
      result = (result * b) % mod
    }
    b = (b * b) % mod
    e >>= 1n
  }

  return result
}

/**
 * Generates E0 code for the Discrete Logarithm problem: a^x = b (mod m)
 * using binary exponentiation over bits of x bounded by `period`.
 *
 * @param {string | number | bigint} rawA - Base a
 * @param {string | number | bigint} rawB - Target b
 * @param {string | number | bigint} rawM - Modulus m (m >= 2)
 * @param {string | number | bigint} [rawPeriod] - Upper bound / subgroup order (defaults to m - 1)
 * @returns {string} Generated E0 code
 */
export function generateDLogCode(rawA, rawB, rawM, rawPeriod) {
  const m = BigInt(rawM)
  if (m < 2n) {
    throw new Error('Modulus m must be an integer >= 2.')
  }

  const a = ((BigInt(rawA) % m) + m) % m
  const b = ((BigInt(rawB) % m) + m) % m

  const period =
    rawPeriod !== undefined && rawPeriod !== null && String(rawPeriod).trim() !== ''
      ? BigInt(rawPeriod)
      : m - 1n

  if (period < 1n) {
    throw new Error('Period must be an integer >= 1.')
  }

  const intSize = 2 * m.toString(2).length

  let steps = 1
  let check = 2n
  while (check < period) {
    steps++
    check *= 2n
  }

  let code = `// Discrete Logarithm: ${a}^x = ${b} (mod ${m}), period = ${period}\n\n`
  code += `size + ${intSize} 0\n`
  code += `x >= 0\n`
  code += `x < ${period}\n\n`

  if (steps === 1) {
    code += `x:0 ? ${a} : 1 = ${b}\n`
    return code
  }

  code += `x:0 ? ${a} : 1 = v1\n`

  let v = a
  for (let i = 1; i < steps - 1; i++) {
    v = (v * v) % m
    code += `x:${i} ? (v${i} * ${v} % ${m}) : v${i} = v${i + 1}\n`
  }

  v = (v * v) % m
  code += `x:${steps - 1} ? (v${steps - 1} * ${v} % ${m}) : v${steps - 1} = ${b}\n`

  return code
}

/**
 * Decodes and verifies solver output for Discrete Logarithm
 *
 * @param {Record<string, any> | false} inputVarsResults
 * @param {{ a: string, b: string, m: string }} [params]
 * @returns {{ x: string } | null}
 */
export function decodeDLogSolution(inputVarsResults, params) {
  if (!inputVarsResults || inputVarsResults === false) {
    return null
  }

  if (inputVarsResults.x === undefined || inputVarsResults.x === null) {
    return null
  }

  const xStr = String(inputVarsResults.x)

  if (params) {
    try {
      const xBig = BigInt(xStr)
      const aBig = BigInt(params.a)
      const bBig = BigInt(params.b)
      const mBig = BigInt(params.m)

      if (modPowBigInt(aBig, xBig, mBig) !== bBig) {
        return null
      }
    } catch {
      return null
    }
  }

  return { x: xStr }
}

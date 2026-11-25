const cellVar = (n, r, c) => (n <= 10 ? `x${r}${c}` : `x_${r}_${c}`)

/**
 * Generates E0 code for the N-Queens problem with optional pre-placed queens
 * using `sumBool(...)` over rows, columns, and diagonals.
 *
 * @param {number} boardSize - Board dimension N (N >= 1)
 * @param {Array<{ r: number, c: number }>} pinnedQueens - Fixed queen positions
 * @returns {string} Generated E0 code
 */
export function generateNQueensCode(boardSize, pinnedQueens = []) {
  const n = Math.max(1, Math.floor(Number(boardSize) || 8))
  const intSize = Math.max(4, n.toString(2).length)

  let code = `// ${n}-Queens Puzzle (${n}x${n} board)\n\n`
  code += `size + ${intSize} 0\n\n`

  if (pinnedQueens.length > 0) {
    code += '// Pinned queens\n'
    for (const { r, c } of pinnedQueens) {
      if (r >= 0 && r < n && c >= 0 && c < n) {
        code += `${cellVar(n, r, c)} == true\n`
      }
    }
    code += '\n'
  }

  code += '// Rows Constraints\n\n'
  for (let r = 0; r < n; r++) {
    const rowVars = []
    for (let c = 0; c < n; c++) {
      rowVars.push(cellVar(n, r, c))
    }
    code += `1 = sumBool( ${rowVars.join(', ')} )\n`
  }

  code += '\n// Columns Constraints\n\n'
  for (let c = 0; c < n; c++) {
    const colVars = []
    for (let r = 0; r < n; r++) {
      colVars.push(cellVar(n, r, c))
    }
    code += `1 = sumBool( ${colVars.join(', ')} )\n`
  }

  let diagIdx = 1
  const padWidth = Math.max(2, String(4 * n).length)
  const nextDiagVar = () => `v${String(diagIdx++).padStart(padWidth, '0')}`

  code += '\n// Diagonal Constraints, Top-left to Bottom-right\n\n'
  const mainStarts = []
  for (let r = n - 2; r >= 0; r--) mainStarts.push([r, 0])
  for (let c = 1; c <= n - 2; c++) mainStarts.push([0, c])

  for (const [startR, startC] of mainStarts) {
    const diagVars = []
    let r = startR
    let c = startC
    while (r < n && c < n) {
      diagVars.push(cellVar(n, r, c))
      r++
      c++
    }
    if (diagVars.length >= 2) {
      const vName = nextDiagVar()
      code += `${vName} <= 1; ${vName} = sumBool( ${diagVars.join(', ')} )\n`
    }
  }

  code += '\n// Diagonal Constraints, Top-right to Bottom-left\n\n'
  const antiStarts = []
  for (let r = n - 2; r >= 0; r--) antiStarts.push([r, n - 1])
  for (let c = n - 2; c >= 1; c--) antiStarts.push([0, c])

  for (const [startR, startC] of antiStarts) {
    const diagVars = []
    let r = startR
    let c = startC
    while (r < n && c >= 0) {
      diagVars.push(cellVar(n, r, c))
      r++
      c--
    }
    if (diagVars.length >= 2) {
      const vName = nextDiagVar()
      code += `${vName} <= 1; ${vName} = sumBool( ${diagVars.join(', ')} )\n`
    }
  }

  return code
}

/**
 * Decodes and verifies solver variables into an NxN placement of non-attacking queens.
 *
 * @param {number} boardSize
 * @param {Record<string, any> | false} inputVarsResults
 * @returns {{ size: number, queens: Array<{ r: number, c: number }> } | null}
 */
export function decodeNQueensSolution(boardSize, inputVarsResults) {
  if (!inputVarsResults || inputVarsResults === false) {
    return null
  }

  const queens = []
  for (let r = 0; r < boardSize; r++) {
    for (let c = 0; c < boardSize; c++) {
      const raw = inputVarsResults[cellVar(boardSize, r, c)]
      if (raw === true || raw === 'true' || raw === 1 || raw === '1') {
        queens.push({ r, c })
      }
    }
  }

  if (queens.length !== boardSize) {
    return null
  }

  const rows = new Set()
  const cols = new Set()
  const diagMain = new Set()
  const diagAnti = new Set()

  for (const { r, c } of queens) {
    if (rows.has(r) || cols.has(c) || diagMain.has(r - c) || diagAnti.has(r + c)) {
      return null
    }
    rows.add(r)
    cols.add(c)
    diagMain.add(r - c)
    diagAnti.add(r + c)
  }

  return {
    size: boardSize,
    queens
  }
}

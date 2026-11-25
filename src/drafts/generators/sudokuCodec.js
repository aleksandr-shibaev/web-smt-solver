/**
 * Generates E0 one-hot bit-vector constraints from a 9x9 Sudoku grid
 * using domain pre-filtering (`= from (...)`) and `exactlyOne(...)`
 *
 * @param {number[][]} grid - 9x9 matrix of integers (0 for empty cells, 1-9 for clues)
 * @returns {string} Generated E0 code
 */
export function generateSudokuCode(grid) {
  const squares = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => []))
  const cols = Array.from({ length: 9 }, () => [])

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const value = grid[r][c]
      if (value !== 0) {
        squares[Math.floor(r / 3)][Math.floor(c / 3)].push(value)
        cols[c].push(value)
      }
    }
  }

  const getPossibleValues = (row, col) => {
    const used = new Set([
      ...squares[Math.floor(row / 3)][Math.floor(col / 3)],
      ...grid[row],
      ...cols[col]
    ])
    return [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((digit) => !used.has(digit))
  }

  const getCellAssignment = (row, col) => {
    const v = grid[row][col]
    if (v !== 0) {
      return `= v${v}`
    }
    const candidates = getPossibleValues(row, col)
    return `= from (${candidates.map((el) => `v${el}`).join(',')})`
  }

  let result = '// Sudoku\n\n/*\n\nPuzzle:\n\n'

  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      const v = grid[i][j]
      result += `${v === 0 ? '_' : v} `
      if (j % 3 === 2) result += ' '
    }
    result += '\n'
    if (i % 3 === 2) result += '\n'
  }

  result += '*/\n\n// Values are powers of two\n\n'

  for (let i = 0; i < 9; i++) {
    const bv = Array(9).fill(0)
    bv[i] = 1
    result += `v${i + 1} = 0b${bv.reverse().join('')}\n`
  }

  result += '\nsize + 9 0\n\n// Set values\n'

  for (let i = 0; i < 9; i++) {
    result += `\n// Row ${i + 1}\n\n`
    for (let j = 0; j < 9; j++) {
      result += `x${i}${j} ${getCellAssignment(i, j)}\n`
    }
  }

  const appendGroupConstraints = (cellsList) => {
    const missingDigits = Array(9).fill(1)
    const emptyVars = []

    for (const { row, col } of cellsList) {
      const v = grid[row][col]
      if (v === 0) {
        emptyVars.push(`x${row}${col}`)
      } else {
        missingDigits[v - 1] = 0
      }
    }

    if (emptyVars.length === 0) return

    const maskPreview = [...missingDigits].reverse().join('')
    result += `// 0b${maskPreview} = ${emptyVars.join(' | ')}\n`

    for (let bit = 0; bit < 9; bit++) {
      if (missingDigits[bit] === 1) {
        result += `exactlyOne(${emptyVars.map((x) => `${x}:${bit}`).join(', ')});\n`
      }
    }

    result += '\n'
  }

  result += '\n// Rows Constraints\n\n'
  for (let r = 0; r < 9; r++) {
    const rowCells = Array.from({ length: 9 }, (_, c) => ({ row: r, col: c }))
    appendGroupConstraints(rowCells)
  }

  result += '\n// Columns Constraints\n\n'
  for (let c = 0; c < 9; c++) {
    const colCells = Array.from({ length: 9 }, (_, r) => ({ row: r, col: c }))
    appendGroupConstraints(colCells)
  }

  result += '\n// Squares Constraints\n\n'
  for (let box = 0; box < 9; box++) {
    const rowStart = Math.floor(box / 3) * 3
    const colStart = (box % 3) * 3
    const boxCells = []

    for (let dr = 0; dr < 3; dr++) {
      for (let dc = 0; dc < 3; dc++) {
        boxCells.push({ row: rowStart + dr, col: colStart + dc })
      }
    }
    appendGroupConstraints(boxCells)
  }

  return result
}

function isCompleteDigitSet(values) {
  const seen = new Set(values)
  if (seen.size !== 9) return false
  for (let d = 1; d <= 9; d++) {
    if (!seen.has(d)) return false
  }
  return true
}

function verifySudokuSolution(solution) {
  for (let i = 0; i < 9; i++) {
    if (!isCompleteDigitSet(solution[i])) return false
    const colValues = Array.from({ length: 9 }, (_, r) => solution[r][i])
    if (!isCompleteDigitSet(colValues)) return false
  }

  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      const boxValues = []
      for (let dr = 0; dr < 3; dr++) {
        for (let dc = 0; dc < 3; dc++) {
          boxValues.push(solution[br * 3 + dr][bc * 3 + dc])
        }
      }
      if (!isCompleteDigitSet(boxValues)) return false
    }
  }

  return true
}

/**
 * Decodes solver output variables back into a 9x9 matrix of digits and verifies validity
 * @param {number[][]} initialGrid - 9x9 initial grid (0 for empty cells)
 * @param {Record<string, any> | false} inputVarsResults - Solver variable map
 * @returns {number[][] | null} Solved 9x9 grid, or null if UNSAT / invalid
 */
export function decodeSudokuSolution(initialGrid, inputVarsResults) {
  if (!inputVarsResults || inputVarsResults === false) {
    return null
  }

  const solution = []

  for (let i = 0; i < 9; i++) {
    const row = []
    for (let j = 0; j < 9; j++) {
      if (initialGrid[i][j] !== 0) {
        row.push(initialGrid[i][j])
      } else {
        const rawVal = Number(inputVarsResults[`x${i}${j}`])
        const digit = rawVal > 0 ? 32 - Math.clz32(rawVal) : 0
        row.push(digit)
      }
    }
    solution.push(row)
  }

  return verifySudokuSolution(solution) ? solution : null
}

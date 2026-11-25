<script setup>
import { ref, onMounted } from 'vue'
import { useDraftSolver } from '../useDraftSolver.js'
import { generateSudokuCode, decodeSudokuSolution } from './sudokuCodec.js'

const emit = defineEmits(['copy-code'])

const _ = null

const DEFAULT_SUDOKU_GRID = Array.of(
  Array.of(5, 3, _, _, 7, _, _, _, _),
  Array.of(6, _, _, 1, 9, 5, _, _, _),
  Array.of(_, 9, 8, _, _, _, _, 6, _),
  Array.of(8, _, _, _, 6, _, _, _, 3),
  Array.of(4, _, _, 8, _, 3, _, _, 1),
  Array.of(7, _, _, _, 2, _, _, _, 6),
  Array.of(_, 6, _, _, _, _, 2, 8, _),
  Array.of(_, _, _, 4, 1, 9, _, _, 5),
  Array.of(_, _, _, _, 8, _, _, 7, 9)
)

const TEXT_FORMAT_PLACEHOLDER = `[
  [5, 3, _,  _, 7, _,  _, _, _],
  [6, _, _,  1, 9, 5,  _, _, _],
  [_, 9, 8,  _, _, _,  _, 6, _],
  [8, _, _,  _, 6, _,  _, _, 3],
  [4, _, _,  8, _, 3,  _, _, 1],
  [7, _, _,  _, 2, _,  _, _, 6],
  [_, 6, _,  _, _, _,  2, 8, _],
  [_, _, _,  4, 1, 9,  _, _, 5],
  [_, _, _,  _, 8, _,  _, 7, 9]
]`

function gridToCells(grid) {
  return grid
    .flat()
    .slice(0, 81)
    .map((val) => {
      const num = Number(val)
      return Number.isInteger(num) && num >= 1 && num <= 9
        ? { value: num, isGiven: true }
        : { value: null, isGiven: false }
    })
}

function cellsToFormattedText(cellList) {
  const lines = []
  for (let r = 0; r < 9; r++) {
    const rowTokens = []
    for (let c = 0; c < 9; c++) {
      const val = cellList[r * 9 + c]?.value
      const ch = val >= 1 && val <= 9 ? String(val) : '_'
      rowTokens.push(c === 2 || c === 5 ? `${ch}, ` : `${ch},`)
    }
    const commaSuffix = r < 8 ? ',' : ''
    lines.push(`  [${rowTokens.join(' ').replace(/,\s*$/, '')}]${commaSuffix}`)
  }
  return `[\n${lines.join('\n')}\n]`
}

function parseRawTextToMatrix(rawText) {
  const tokens = String(rawText || '').match(/[1-9_0]/g)
  if (!tokens || tokens.length !== 81) {
    return null
  }

  const matrix = []
  for (let r = 0; r < 9; r++) {
    const row = []
    for (let c = 0; c < 9; c++) {
      const ch = tokens[r * 9 + c]
      const num = Number(ch)
      row.push(num >= 1 && num <= 9 ? num : 0)
    }
    matrix.push(row)
  }
  return matrix
}

const inputMode = ref('grid')
const cells = ref(gridToCells(DEFAULT_SUDOKU_GRID))
const rawTextInput = ref(cellsToFormattedText(cells.value))
const textParseError = ref('')

const selectedIndex = ref(0)
const cellRefs = ref(Array.of())
let lastInputSnapshot = null

const {
  isCalculating,
  progressMsg,
  solution: solvedBoard,
  status: solveStatus,
  stats: solveStats,
  clearResult,
  runGeneratedCode,
  stop
} = useDraftSolver({
  emit,
  unsatMessage: 'UNSAT — No valid Sudoku solution exists for these clues.',
  onDecode: (inputVarsResults) => {
    const decoded = decodeSudokuSolution(lastInputSnapshot, inputVarsResults)
    if (!decoded) return null

    return decoded.map((row, rIdx) =>
      row.map((val, cIdx) => ({
        value: val,
        isGiven: lastInputSnapshot[rIdx][cIdx] !== 0
      }))
    )
  }
})

function switchInputMode(nextMode) {
  if (inputMode.value === nextMode) return
  textParseError.value = ''

  if (nextMode === 'text') {
    rawTextInput.value = cellsToFormattedText(cells.value)
    inputMode.value = 'text'
    return
  }

  const parsedMatrix = parseRawTextToMatrix(rawTextInput.value)
  if (!parsedMatrix) {
    textParseError.value = 'Expected exactly 81 cells (digits 1–9 or "_" / "0" for empty).'
    return
  }

  cells.value = gridToCells(parsedMatrix)
  inputMode.value = 'grid'
}

function setCellRef(el, idx) {
  if (el) cellRefs.value[idx] = el
}

function focusCell(idx) {
  const clamped = Math.max(0, Math.min(80, idx))
  selectedIndex.value = clamped
  cellRefs.value[clamped]?.focus()
}

function setCellValue(idx, digit) {
  if (idx < 0 || idx > 80) return
  cells.value[idx] = { value: digit, isGiven: digit !== null }
}

function handleCellKeydown(event, idx) {
  const { key } = event
  const row = Math.floor(idx / 9)
  const col = idx % 9

  if (key >= '1' && key <= '9') {
    event.preventDefault()
    setCellValue(idx, Number(key))
    return
  }

  if (key === 'Backspace' || key === 'Delete' || key === '0' || key === ' ') {
    event.preventDefault()
    setCellValue(idx, null)
    return
  }

  if (key === 'ArrowRight') {
    event.preventDefault()
    focusCell(row * 9 + ((col + 1) % 9))
  } else if (key === 'ArrowLeft') {
    event.preventDefault()
    focusCell(row * 9 + ((col + 8) % 9))
  } else if (key === 'ArrowDown') {
    event.preventDefault()
    focusCell(((row + 1) % 9) * 9 + col)
  } else if (key === 'ArrowUp') {
    event.preventDefault()
    focusCell(((row + 8) % 9) * 9 + col)
  }
}

function handlePadClick(digit) {
  setCellValue(selectedIndex.value, digit)
  cellRefs.value[selectedIndex.value]?.focus()
}

function loadDefaultPuzzle() {
  cells.value = gridToCells(DEFAULT_SUDOKU_GRID)
  rawTextInput.value = cellsToFormattedText(cells.value)
  textParseError.value = ''
  clearResult()
  if (inputMode.value === 'grid') focusCell(0)
}

function clearBoard() {
  cells.value = Array.from({ length: 81 }, () => ({ value: null, isGiven: false }))
  rawTextInput.value = cellsToFormattedText(cells.value)
  textParseError.value = ''
  clearResult()
  if (inputMode.value === 'grid') focusCell(0)
}

function handleSolveSudoku() {
  textParseError.value = ''
  let matrix

  if (inputMode.value === 'text') {
    matrix = parseRawTextToMatrix(rawTextInput.value)
    if (!matrix) {
      textParseError.value =
        'Invalid text format: expected 81 digits (1–9) or "_" / "0" placeholders.'
      return
    }
    cells.value = gridToCells(matrix)
  } else {
    matrix = Array.from({ length: 9 }, (_, r) =>
      Array.from({ length: 9 }, (_, c) => cells.value[r * 9 + c].value ?? 0)
    )
    rawTextInput.value = cellsToFormattedText(cells.value)
  }

  lastInputSnapshot = matrix
  runGeneratedCode(generateSudokuCode(matrix))
}

function isPeerCell(idx) {
  const sel = selectedIndex.value
  if (sel === null || sel === idx) return false

  const r1 = Math.floor(sel / 9)
  const c1 = sel % 9
  const r2 = Math.floor(idx / 9)
  const c2 = idx % 9

  return (
    r1 === r2 ||
    c1 === c2 ||
    (Math.floor(r1 / 3) === Math.floor(r2 / 3) && Math.floor(c1 / 3) === Math.floor(c2 / 3))
  )
}

function isSameNumber(idx) {
  const selVal = cells.value[selectedIndex.value]?.value
  return Boolean(selVal && idx !== selectedIndex.value && cells.value[idx]?.value === selVal)
}

onMounted(() => {
  selectedIndex.value = 0
})
</script>

<template>
  <div class="sudoku-draft">
    <div class="mode-toolbar">
      <div class="mode-switch" role="group" aria-label="Sudoku input format">
        <button
          type="button"
          :class="['mode-btn', { 'is-active': inputMode === 'grid' }]"
          :disabled="isCalculating"
          @click="switchInputMode('grid')"
        >
          Interactive Grid
        </button>
        <button
          type="button"
          :class="['mode-btn', { 'is-active': inputMode === 'text' }]"
          :disabled="isCalculating"
          @click="switchInputMode('text')"
        >
          Text / 2D Array
        </button>
      </div>

      <span class="mode-hint">
        {{
          inputMode === 'grid'
            ? 'Click a cell and type 1–9, use Arrow keys to navigate, Backspace/0 to clear.'
            : 'Paste a 9×9 array or plain text using 1–9 for clues and "_" or "0" for empty cells.'
        }}
      </span>
    </div>

    <div class="sudoku-workspace">
      <!-- Mode 1: Interactive 9x9 Grid -->
      <div
        v-if="inputMode === 'grid'"
        class="sudoku-board"
        role="grid"
        aria-label="Sudoku input 9 by 9 grid"
      >
        <button
          v-for="(cell, idx) in cells"
          :key="idx"
          :ref="(el) => setCellRef(el, idx)"
          type="button"
          role="gridcell"
          :aria-selected="selectedIndex === idx"
          :class="[
            'sudoku-cell',
            {
              'is-selected': selectedIndex === idx,
              'is-peer': isPeerCell(idx),
              'is-same-number': isSameNumber(idx),
              'is-given': cell.isGiven,
              'border-right-thick': idx % 9 === 2 || idx % 9 === 5,
              'border-bottom-thick': Math.floor(idx / 9) === 2 || Math.floor(idx / 9) === 5
            }
          ]"
          @focus="selectedIndex = idx"
          @click="focusCell(idx)"
          @keydown="handleCellKeydown($event, idx)"
        >
          {{ cell.value ?? '' }}
        </button>
      </div>

      <!-- Mode 2: Text / 2D Array Input -->
      <div v-else class="text-input-pane">
        <div class="format-badge">
          Format: 81 tokens (<code>1–9</code> = clue, <code>_</code> or <code>0</code> = empty;
          brackets &amp; commas optional)
        </div>
        <textarea
          v-model="rawTextInput"
          class="sudoku-textarea"
          :placeholder="TEXT_FORMAT_PLACEHOLDER"
          :disabled="isCalculating"
          spellcheck="false"
        ></textarea>
      </div>

      <!-- Right Controls -->
      <div class="sudoku-controls">
        <button v-if="isCalculating" type="button" class="solve-btn is-stop" @click="stop">
          Stop Solving
        </button>
        <button v-else type="button" class="solve-btn" @click="handleSolveSudoku">
          Solve Sudoku
        </button>

        <template v-if="inputMode === 'grid'">
          <div class="pad-label">Quick Input Pad</div>
          <div class="number-pad">
            <button
              v-for="n in 9"
              :key="n"
              type="button"
              class="pad-btn"
              :disabled="isCalculating"
              @click="handlePadClick(n)"
            >
              {{ n }}
            </button>
            <button
              type="button"
              class="pad-btn is-erase"
              :disabled="isCalculating"
              @click="handlePadClick(null)"
            >
              Clear Cell
            </button>
          </div>
        </template>

        <div class="preset-actions">
          <button
            type="button"
            class="action-btn"
            :disabled="isCalculating"
            @click="loadDefaultPuzzle"
          >
            Load Default
          </button>
          <button type="button" class="action-btn" :disabled="isCalculating" @click="clearBoard">
            Clear All
          </button>
        </div>
      </div>
    </div>

    <div v-if="textParseError" class="status-banner is-error">
      {{ textParseError }}
    </div>

    <div v-if="isCalculating" class="status-banner is-info">
      {{ progressMsg || 'Compiling Sudoku constraints and solving...' }}
    </div>

    <div v-else-if="solveStatus && solveStatus !== 'SAT'" class="status-banner is-error">
      {{ solveStatus }}
    </div>

    <div v-if="solvedBoard" class="solution-section">
      <div class="solution-header">
        <span class="solution-title">Solved Sudoku</span>
        <span v-if="solveStats" class="solution-meta"> {{ solveStats.duration }} ms </span>
      </div>

      <div class="sudoku-board is-readonly" aria-label="Solved Sudoku 9 by 9 grid">
        <template v-for="(row, rIdx) in solvedBoard" :key="rIdx">
          <div
            v-for="(cell, cIdx) in row"
            :key="`${rIdx}-${cIdx}`"
            :class="[
              'sudoku-cell',
              'is-static',
              cell.isGiven ? 'is-given' : 'is-solved',
              {
                'border-right-thick': cIdx === 2 || cIdx === 5,
                'border-bottom-thick': rIdx === 2 || rIdx === 5
              }
            ]"
          >
            {{ cell.value }}
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sudoku-draft {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.mode-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
}

.mode-hint {
  font-size: 0.86rem;
  color: var(--text-secondary);
  line-height: 1.45;
  flex-basis: 100%;
}

.sudoku-workspace {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 24px;
}

.sudoku-board {
  display: grid;
  grid-template-columns: repeat(9, 42px);
  grid-template-rows: repeat(9, 42px);
  border: 2px solid var(--border-strong);
  background-color: var(--bg-editor);
}

.sudoku-cell {
  width: 42px;
  height: 42px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: 1.15rem;
  color: var(--text-main);
  background-color: var(--bg-editor);
  border: none;
  border-right: 1px solid var(--border-color);
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  outline: none;
  transition: background-color 0.1s ease;
}

.sudoku-cell.is-static {
  cursor: default;
}

.sudoku-cell:nth-child(9n) {
  border-right: none;
}

.sudoku-cell:nth-child(n + 73) {
  border-bottom: none;
}

.sudoku-cell.border-right-thick {
  border-right: 2px solid var(--border-strong);
}

.sudoku-cell.border-bottom-thick {
  border-bottom: 2px solid var(--border-strong);
}

.sudoku-cell.is-given {
  font-weight: 700;
  color: var(--text-main);
}

.sudoku-cell.is-solved {
  font-weight: 700;
  color: var(--accent-primary);
  background-color: rgba(56, 189, 248, 0.08);
}

.sudoku-cell.is-peer {
  background-color: var(--bg-secondary);
}

.sudoku-cell.is-same-number {
  background-color: rgba(56, 189, 248, 0.16);
}

.sudoku-cell.is-selected {
  background-color: rgba(56, 189, 248, 0.25);
  box-shadow: inset 0 0 0 2px var(--accent-primary);
}

.text-input-pane {
  display: flex;
  flex-direction: column;
  width: 382px;
  max-width: 100%;
  border: 1px solid var(--border-color);
  background-color: var(--bg-editor);
}

.format-badge {
  padding: 8px 12px;
  font-family: var(--font-mono);
  font-size: 0.74rem;
  line-height: 1.4;
  color: var(--text-secondary);
  background-color: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
}

.sudoku-textarea {
  width: 100%;
  height: 310px;
  padding: 14px;
  border: none;
  outline: none;
  resize: vertical;
  font-family: var(--font-mono);
  font-size: 0.86rem;
  line-height: 1.65;
  color: var(--text-main);
  background-color: var(--bg-editor);
  box-sizing: border-box;
}

.sudoku-controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 196px;
}

.pad-label {
  margin-top: 4px;
  font-family: var(--font-mono);
  font-size: 0.76rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}

.number-pad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.pad-btn {
  height: 40px;
  font-family: var(--font-mono);
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-main);
  background-color: var(--bg-editor);
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: all 0.15s ease;
}

.pad-btn:hover:not(:disabled) {
  border-color: var(--accent-primary);
  background-color: var(--bg-tertiary);
}

.pad-btn:disabled,
.action-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.pad-btn.is-erase {
  grid-column: span 3;
  height: 36px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.preset-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 4px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}

.action-btn {
  padding: 7px 12px;
  font-family: var(--font-mono);
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-main);
  background-color: var(--bg-editor);
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-btn:hover:not(:disabled) {
  border-color: var(--accent-primary);
  background-color: var(--bg-tertiary);
}

.solution-section {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 14px;
  padding-top: 20px;
  border-top: 1px solid var(--border-color);
}

.solution-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.solution-title {
  font-family: var(--font-sans);
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-main);
}

@media (max-width: 520px) {
  .sudoku-board {
    grid-template-columns: repeat(9, 34px);
    grid-template-rows: repeat(9, 34px);
  }
  .sudoku-cell {
    width: 34px;
    height: 34px;
    font-size: 1rem;
  }
}
</style>

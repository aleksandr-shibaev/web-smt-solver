<script setup>
import { ref, computed } from 'vue'
import { useDraftSolver } from '../useDraftSolver.js'
import { generateNQueensCode, decodeNQueensSolution } from './nQueensCodec.js'

const emit = defineEmits(['copy-code'])

const MIN_BOARD_SIZE = 4
const MAX_BOARD_SIZE = 20
const PRESET_SIZES = Array.of(4, 8, 12, 16, 20)

const boardSize = ref(8)
const pinnedSet = ref(new Set())
const validationError = ref('')
let solvedSizeSnapshot = 8

const {
  isCalculating,
  progressMsg,
  solution: solutionResult,
  status: solveStatus,
  stats: solveStats,
  isOutdated,
  clearResult,
  markOutdated,
  runGeneratedCode,
  stop
} = useDraftSolver({
  emit,
  unsatMessage: 'UNSAT — No valid N-Queens arrangement exists with these pinned queens.',
  onDecode: (inputVarsResults) => decodeNQueensSolution(solvedSizeSnapshot, inputVarsResults)
})

const solvedQueensSet = computed(() => {
  if (!solutionResult.value || solutionResult.value.size !== boardSize.value) {
    return new Set()
  }
  return new Set(solutionResult.value.queens.map((q) => `${q.r},${q.c}`))
})

const boardCells = computed(() => {
  const n = boardSize.value
  const list = Array.of()
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const key = `${r},${c}`
      const isPinned = pinnedSet.value.has(key)
      const isSolvedQueen = solvedQueensSet.value.has(key)
      list.push({
        key,
        r,
        c,
        isDark: (r + c) % 2 === 1,
        isPinned,
        isSolvedQueen,
        hasQueen: isPinned || isSolvedQueen
      })
    }
  }
  return list
})

function clampSize(val) {
  const num = Math.floor(Number(val) || 8)
  return Math.max(MIN_BOARD_SIZE, Math.min(MAX_BOARD_SIZE, num))
}

function setBoardSize(newSize) {
  boardSize.value = clampSize(newSize)
  pinnedSet.value = new Set()
  validationError.value = ''
  clearResult()
}

function handleSizeInput(event) {
  const raw = Number(event.target.value)
  if (!Number.isFinite(raw)) {
    event.target.value = String(boardSize.value)
    return
  }
  const clamped = clampSize(raw)
  event.target.value = String(clamped)
  setBoardSize(clamped)
}

function toggleCellPin(r, c) {
  if (isCalculating.value) return
  validationError.value = ''
  const key = `${r},${c}`
  const next = new Set(pinnedSet.value)

  if (next.has(key)) {
    next.delete(key)
  } else {
    for (const existing of next) {
      if (existing.startsWith(`${r},`)) {
        next.delete(existing)
      }
    }
    next.add(key)
  }

  pinnedSet.value = next
  if (solutionResult.value) {
    markOutdated()
  }
}

function clearPins() {
  if (isCalculating.value) return
  pinnedSet.value = new Set()
  validationError.value = ''
  if (solutionResult.value) {
    markOutdated()
  }
}

function handleSolveQueens() {
  validationError.value = ''
  const n = clampSize(boardSize.value)
  boardSize.value = n
  solvedSizeSnapshot = n

  const pinnedList = Array.from(pinnedSet.value).map((key) => {
    const parts = key.split(',')
    return { r: Number(parts.at(0)), c: Number(parts.at(1)) }
  })

  runGeneratedCode(generateNQueensCode(n, pinnedList))
}
</script>

<template>
  <div class="nqueens-draft">
    <p class="draft-description">
      Place <strong>N queens</strong> on an <strong>N×N</strong> chessboard (4 to 20) so that no two
      queens attack each other. Click any square to pin/unpin a queen before solving.
    </p>

    <div class="draft-card">
      <div class="card-header">
        <div class="controls-left">
          <label class="size-field">
            <span>Board Size (N):</span>
            <input
              :value="boardSize"
              type="text"
              inputmode="numeric"
              class="size-input"
              :disabled="isCalculating"
              @change="handleSizeInput"
            />
          </label>

          <div class="size-pills">
            <button
              v-for="sz in PRESET_SIZES"
              :key="sz"
              type="button"
              :class="['size-pill-btn', { 'is-active': boardSize === sz }]"
              :disabled="isCalculating"
              @click="setBoardSize(sz)"
            >
              {{ sz }}×{{ sz }}
            </button>
          </div>
        </div>

        <div class="controls-right">
          <button
            v-if="pinnedSet.size > 0"
            type="button"
            class="secondary-btn"
            :disabled="isCalculating"
            @click="clearPins"
          >
            Clear Pins ({{ pinnedSet.size }})
          </button>

          <button v-if="isCalculating" type="button" class="solve-btn is-stop" @click="stop">
            Stop Solving
          </button>
          <button v-else type="button" class="solve-btn" @click="handleSolveQueens">
            Solve {{ boardSize }}-Queens
          </button>
        </div>
      </div>

      <div class="board-stage">
        <div
          class="chess-board"
          :style="{
            gridTemplateColumns: `repeat(${boardSize}, 1fr)`,
            maxWidth: `${Math.min(500, boardSize * 44)}px`
          }"
          role="grid"
          :aria-label="`${boardSize} by ${boardSize} chessboard`"
        >
          <button
            v-for="cell in boardCells"
            :key="cell.key"
            type="button"
            :class="[
              'chess-cell',
              cell.isDark ? 'is-dark' : 'is-light',
              {
                'is-pinned': cell.isPinned,
                'is-solved': cell.isSolvedQueen && !cell.isPinned,
                'is-outdated': isOutdated && cell.isSolvedQueen && !cell.isPinned
              }
            ]"
            :title="`Row ${cell.r + 1}, Col ${cell.c + 1}`"
            @click="toggleCellPin(cell.r, cell.c)"
          >
            {{ cell.hasQueen ? '♛' : '' }}
          </button>
        </div>

        <div class="board-legend">
          <span class="legend-item">
            <span class="legend-dot is-pinned"></span> Pinned by you
          </span>
          <span class="legend-item">
            <span class="legend-dot is-solved"></span> Found by SAT solver
          </span>
        </div>
      </div>
    </div>

    <div v-if="validationError" class="status-banner is-error">
      {{ validationError }}
    </div>

    <div v-if="isCalculating" class="status-banner is-info">
      {{ progressMsg || `Compiling ${boardSize}-Queens constraints and solving...` }}
    </div>

    <div v-else-if="solveStatus && solveStatus !== 'SAT'" class="status-banner is-error">
      {{ solveStatus }}
    </div>

    <div v-if="solutionResult" :class="['result-card', { 'is-outdated': isOutdated }]">
      <div class="result-header">
        <div class="result-headline">
          <span :class="['result-badge', { 'is-outdated': isOutdated }]">
            {{ isOutdated ? 'OUTDATED' : 'SAT' }}
          </span>
          <span class="result-main">
            Valid <strong>{{ solutionResult.size }}-Queens</strong> placement found
          </span>
        </div>

        <span v-if="solveStats && !isOutdated" class="solution-meta">
          {{ solveStats.duration }} ms
        </span>
      </div>

      <div class="coords-line">
        <strong>Coordinates (row, col):</strong>
        <code>
          {{ solutionResult.queens.map((q) => `(${q.r + 1}, ${q.c + 1})`).join(' · ') }}
        </code>
      </div>
    </div>
  </div>
</template>

<style scoped>
.nqueens-draft {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.controls-left,
.controls-right {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.size-field {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-main);
}

.size-input {
  width: 54px;
  padding: 4px 7px;
  font-family: var(--font-mono);
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-main);
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  outline: none;
}

.size-input:focus {
  border-color: var(--accent-primary);
  background-color: var(--bg-editor);
}

.size-pills {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
}

.size-pill-btn {
  padding: 4px 8px;
  font-family: var(--font-mono);
  font-size: 0.74rem;
  font-weight: 600;
  color: var(--text-secondary);
  background-color: var(--bg-editor);
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: all 0.15s ease;
}

.size-pill-btn:hover:not(:disabled) {
  border-color: var(--accent-primary);
  color: var(--text-main);
  background-color: var(--bg-tertiary);
}

.size-pill-btn.is-active {
  color: var(--accent-primary);
  background-color: var(--accent-soft);
  border-color: rgba(56, 189, 248, 0.45);
}

.secondary-btn {
  padding: 6px 10px;
  font-family: var(--font-mono);
  font-size: 0.76rem;
  font-weight: 600;
  color: var(--text-main);
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: all 0.15s ease;
}

.secondary-btn:hover:not(:disabled) {
  border-color: var(--accent-primary);
  background-color: var(--bg-tertiary);
}

.board-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 18px 14px;
  background-color: var(--bg-editor);
}

.chess-board {
  display: grid;
  width: 100%;
  border: 2px solid var(--border-strong);
  user-select: none;
}

.chess-cell {
  aspect-ratio: 1 / 1;
  padding: 0;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: clamp(0.9rem, 2.4vw, 1.55rem);
  line-height: 1;
  cursor: pointer;
  outline: none;
  transition: background-color 0.1s ease;
}

.chess-cell.is-light {
  background-color: #26314a;
}

.chess-cell.is-dark {
  background-color: #161d2e;
}

.chess-cell:hover {
  box-shadow: inset 0 0 0 2px var(--accent-primary);
}

.chess-cell.is-pinned {
  background-color: rgba(251, 191, 36, 0.24);
  box-shadow: inset 0 0 0 2px #fbbf24;
  color: #fbbf24;
}

.chess-cell.is-solved {
  color: var(--accent-primary);
}

.chess-cell.is-outdated {
  color: var(--text-muted);
  opacity: 0.65;
}

.board-legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  font-family: var(--font-mono);
  font-size: 0.74rem;
  color: var(--text-secondary);
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.legend-dot {
  width: 10px;
  height: 10px;
  display: inline-block;
  border: 1px solid var(--border-strong);
}

.legend-dot.is-pinned {
  background-color: rgba(251, 191, 36, 0.25);
  border-color: #fbbf24;
}

.legend-dot.is-solved {
  background-color: var(--accent-soft);
  border-color: var(--accent-primary);
}

.result-card.is-outdated {
  background-color: var(--bg-tertiary);
  border-color: rgba(251, 191, 36, 0.4);
  border-left-color: #fbbf24;
}

.result-badge.is-outdated {
  color: #fbbf24;
  background-color: rgba(251, 191, 36, 0.14);
  border-color: rgba(251, 191, 36, 0.4);
}

.coords-line {
  font-family: var(--font-mono);
  font-size: 0.78rem;
  color: var(--text-secondary);
  line-height: 1.5;
}
</style>

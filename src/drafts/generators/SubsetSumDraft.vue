<script setup>
import { ref, computed } from 'vue'
import { useDraftSolver } from '../useDraftSolver.js'
import {
  parseNumbersList,
  generateSubsetSumCode,
  decodeSubsetSumSolution
} from './subsetSumCodec.js'

const emit = defineEmits(['copy-code'])

const PRESETS = Array.of(
  {
    label: 'Positive Set (target = 9)',
    target: '9',
    numbersText: `[${Array.of(3, 34, 4, 12, 5, 2).join(', ')}]`
  },
  {
    label: 'With Negatives (target = 0)',
    target: '0',
    numbersText: `[${Array.of(-7, -3, -2, 5, 8).join(', ')}]`
  },
  {
    label: '10 elements (target = 100)',
    target: '100',
    numbersText: `[${Array.of(15, 22, 14, 26, 32, 9, 16, 8, 41, 19).join(', ')}]`
  }
)

const targetSumInput = ref(PRESETS[0].target)
const numbersInput = ref(PRESETS[0].numbersText)
const validationError = ref('')

let lastNumbersSnapshot = Array.of()
let lastTargetSnapshot = '0'

const parsedPreviewNumbers = computed(() => parseNumbersList(numbersInput.value) || Array.of())

const {
  isCalculating,
  progressMsg,
  solution: solutionResult,
  status: solveStatus,
  stats: solveStats,
  clearResult,
  runGeneratedCode,
  stop
} = useDraftSolver({
  emit,
  onDecode: (inputVarsResults) => {
    const decoded = decodeSubsetSumSolution(
      lastNumbersSnapshot,
      inputVarsResults,
      BigInt(lastTargetSnapshot)
    )
    if (!decoded) return null
    return {
      target: lastTargetSnapshot,
      pickedItems: decoded.pickedItems,
      bitVector: decoded.bitVector
    }
  }
})

const displayStatus = computed(() => {
  if (solveStatus.value === 'UNSAT — No valid solution exists.') {
    return `UNSAT — No subset sums to ${lastTargetSnapshot}.`
  }
  return solveStatus.value
})

function clearState() {
  validationError.value = ''
  clearResult()
}

function applyPreset(preset) {
  targetSumInput.value = preset.target
  numbersInput.value = preset.numbersText
  clearState()
}

function handleSolveSubsetSum() {
  clearState()

  const trimmedTarget = String(targetSumInput.value ?? '').trim()
  if (!/^-?\d+$/.test(trimmedTarget)) {
    validationError.value = 'Target sum must be a valid integer.'
    return
  }

  const parsedNums = parseNumbersList(numbersInput.value)
  if (!parsedNums || parsedNums.length === 0) {
    validationError.value = 'Enter at least one integer in the set.'
    return
  }

  const targetBig = BigInt(trimmedTarget)
  lastNumbersSnapshot = parsedNums
  lastTargetSnapshot = targetBig.toString()

  runGeneratedCode(generateSubsetSumCode(targetBig, parsedNums))
}
</script>

<template>
  <div class="subset-draft">
    <p class="draft-description">
      Find a subset of integers whose sum equals <strong>Target Sum</strong>. Supports both positive
      and negative numbers.
    </p>

    <div class="presets-bar">
      <span class="presets-label">Presets:</span>
      <div class="presets-list">
        <button
          v-for="preset in PRESETS"
          :key="preset.label"
          type="button"
          class="preset-btn"
          :disabled="isCalculating"
          @click="applyPreset(preset)"
        >
          {{ preset.label }}
        </button>
      </div>
    </div>

    <div class="input-card">
      <div class="top-row">
        <label class="target-field">
          <span class="field-label">Target Sum (S)</span>
          <input
            v-model="targetSumInput"
            type="text"
            inputmode="numeric"
            class="target-input"
            :disabled="isCalculating"
          />
        </label>

        <div class="card-actions">
          <button v-if="isCalculating" type="button" class="solve-btn is-stop" @click="stop">
            Stop Solving
          </button>
          <button v-else type="button" class="solve-btn" @click="handleSolveSubsetSum">
            Find Subset
          </button>
        </div>
      </div>

      <div class="numbers-section">
        <div class="numbers-header">
          <span>Numbers Set ({{ parsedPreviewNumbers.length }} elements)</span>
          <span class="format-hint">Format: [3, -7, 12, 5] or space/comma separated</span>
        </div>
        <textarea
          v-model="numbersInput"
          class="numbers-textarea"
          rows="3"
          placeholder="[3, 34, 4, 12, 5, 2]"
          :disabled="isCalculating"
          spellcheck="false"
        ></textarea>
      </div>
    </div>

    <div v-if="validationError" class="status-banner is-error">
      {{ validationError }}
    </div>

    <div v-if="isCalculating" class="status-banner is-info">
      {{ progressMsg || 'Compiling Subset Sum constraints and solving...' }}
    </div>

    <div v-else-if="displayStatus && displayStatus !== 'SAT'" class="status-banner is-error">
      {{ displayStatus }}
    </div>

    <div v-if="solutionResult" class="result-card">
      <div class="result-header">
        <div class="result-headline">
          <span class="result-badge">SAT</span>
          <span class="result-main">
            Subset found ({{ solutionResult.pickedItems.length }} elements)
          </span>
        </div>

        <span v-if="solveStats" class="solution-meta">
          {{ solveStats.duration }} ms · {{ solveStats.vars }} vars ·
          {{ solveStats.clauses }} clauses
        </span>
      </div>

      <div class="picked-rows">
        <div v-for="item in solutionResult.pickedItems" :key="item.varName" class="picked-row-item">
          <code>{{ item.varName }}</code>
          <span class="picked-val">{{ item.value }}</span>
        </div>
      </div>

      <div class="summary-footer">
        <div>
          <strong>Sum:</strong>
          {{ solutionResult.target }} =
          {{
            solutionResult.pickedItems.length > 0
              ? solutionResult.pickedItems.map((it) => it.value).join(' + ')
              : '0 (empty subset)'
          }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.subset-draft {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.input-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color);
  background-color: var(--bg-editor);
}

.top-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
}

.target-field {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: var(--font-mono);
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-main);
}

.target-input {
  width: 110px;
  padding: 5px 8px;
  font-family: var(--font-mono);
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-main);
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  outline: none;
}

.target-input:focus {
  border-color: var(--accent-primary);
  background-color: var(--bg-editor);
}

.card-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.numbers-section {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--border-color);
}

.numbers-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 14px;
  background-color: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.format-hint {
  font-weight: 400;
  color: var(--text-muted);
}

.numbers-textarea {
  width: 100%;
  padding: 10px 14px;
  border: none;
  outline: none;
  resize: vertical;
  font-family: var(--font-mono);
  font-size: 0.85rem;
  line-height: 1.5;
  color: var(--text-main);
  background-color: var(--bg-editor);
  box-sizing: border-box;
}

.picked-rows {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.picked-row-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 10px;
  font-family: var(--font-mono);
  font-size: 0.78rem;
  color: var(--text-main);
  background-color: var(--bg-editor);
  border: 1px solid var(--border-color);
}

.picked-row-item code {
  color: var(--accent-primary);
  font-weight: 700;
}

.picked-val {
  font-weight: 700;
}

.summary-footer {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 8px;
  border-top: 1px solid var(--border-color);
  font-family: var(--font-mono);
  font-size: 0.76rem;
  color: var(--text-secondary);
}
</style>

<script setup>
import { ref, computed } from 'vue'
import { useDraftSolver } from '../useDraftSolver.js'
import {
  createKnapsackItem,
  itemsToFormattedText,
  parseRawTextToItems,
  generateKnapsackCode,
  decodeKnapsackSolution
} from './knapsackCodec.js'

const emit = defineEmits(['copy-code'])

const DEFAULT_CAPACITY = 15
const MAX_RANDOM_WEIGHT = 15
const MAX_RANDOM_VALUE = 30

function createDefaultItems() {
  const weights = Array.of(4, 3, 7, 2, 5, 6)
  const values = Array.of(10, 7, 14, 4, 11, 12)

  return weights.map((weight, idx) => createKnapsackItem(weight, values[idx]))
}

const inputMode = ref('table')
const capacity = ref(DEFAULT_CAPACITY)
const items = ref(createDefaultItems())
const rawTextInput = ref(itemsToFormattedText(items.value))
const textParseError = ref('')

const selectedIds = ref(new Set())
let lastItemsSnapshot = Array.of()

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
  unsatMessage: 'UNSAT — No valid combination fits within the capacity.',
  onDecode: (inputVarsResults) => {
    const decoded = decodeKnapsackSolution(lastItemsSnapshot, inputVarsResults)
    if (!decoded) return null
    selectedIds.value = new Set(decoded.pickedItems.map((it) => it.id))
    return decoded
  }
})

const totalAvailableWeight = computed(() =>
  items.value.reduce((sum, item) => sum + (Number(item.weight) || 0), 0)
)

const totalAvailableValue = computed(() =>
  items.value.reduce((sum, item) => sum + (Number(item.value) || 0), 0)
)

function clearResultState() {
  selectedIds.value = new Set()
  textParseError.value = ''
  clearResult()
}

function switchInputMode(nextMode) {
  if (inputMode.value === nextMode) return
  textParseError.value = ''

  if (nextMode === 'text') {
    rawTextInput.value = itemsToFormattedText(items.value)
    inputMode.value = 'text'
    return
  }

  const parsed = parseRawTextToItems(rawTextInput.value)
  if (!parsed) {
    textParseError.value =
      'Expected array of objects like [{w: 3, v: 53, name: "item-123456"}, {w: 7, v: 41}].'
    return
  }

  items.value = parsed
  clearResultState()
  inputMode.value = 'table'
}

function addItem() {
  items.value.push(
    createKnapsackItem(
      Math.floor(Math.random() * MAX_RANDOM_WEIGHT) + 1,
      Math.floor(Math.random() * MAX_RANDOM_VALUE) + 1
    )
  )
  if (inputMode.value === 'text') {
    rawTextInput.value = itemsToFormattedText(items.value)
  }
  clearResultState()
}

function removeItem(id) {
  items.value = items.value.filter((item) => item.id !== id)
  clearResultState()
}

function handleSolveKnapsack() {
  clearResultState()

  if (inputMode.value === 'text') {
    const parsed = parseRawTextToItems(rawTextInput.value)
    if (!parsed) {
      textParseError.value =
        'Invalid format: expected [{w: 3, v: 53, name: "item-123456"}, {w: 7, v: 41}].'
      return
    }
    items.value = parsed
  } else {
    rawTextInput.value = itemsToFormattedText(items.value)
  }

  if (items.value.length === 0) return

  const capNum = Math.max(0, Math.floor(Number(capacity.value) || 0))
  capacity.value = capNum

  lastItemsSnapshot = items.value.map((item) => ({ ...item }))
  runGeneratedCode(generateKnapsackCode(capNum, lastItemsSnapshot))
}
</script>

<template>
  <div class="knapsack-draft">
    <div class="control-header">
      <div class="header-top">
        <div class="header-left-group">
          <div class="mode-switch" role="group" aria-label="Knapsack input format">
            <button
              type="button"
              :class="['mode-btn', { 'is-active': inputMode === 'table' }]"
              :disabled="isCalculating"
              @click="switchInputMode('table')"
            >
              Table
            </button>
            <button
              type="button"
              :class="['mode-btn', { 'is-active': inputMode === 'text' }]"
              :disabled="isCalculating"
              @click="switchInputMode('text')"
            >
              Text / Array
            </button>
          </div>

          <label class="capacity-field">
            <span class="field-label">Max Capacity</span>
            <input
              v-model.number="capacity"
              type="text"
              inputmode="numeric"
              class="num-input is-capacity"
              :disabled="isCalculating"
            />
          </label>
        </div>

        <div class="header-actions">
          <button type="button" class="secondary-btn" :disabled="isCalculating" @click="addItem">
            + Add random item
          </button>

          <button v-if="isCalculating" type="button" class="solve-btn is-stop" @click="stop">
            Stop Solving
          </button>
          <button
            v-else
            type="button"
            class="solve-btn"
            :disabled="inputMode === 'table' && items.length === 0"
            @click="handleSolveKnapsack"
          >
            Maximize Value
          </button>
        </div>
      </div>

      <div class="header-stats">
        <span class="stat-item"
          ><strong>{{ items.length }}</strong> items</span
        >
        <span class="stat-sep">·</span>
        <span class="stat-item"
          >Weight sum: <strong>{{ totalAvailableWeight }}</strong></span
        >
        <span class="stat-sep">·</span>
        <span class="stat-item"
          >Value sum: <strong>{{ totalAvailableValue }}</strong></span
        >
      </div>
    </div>

    <!-- Parse Error Banner -->
    <div v-if="textParseError" class="status-banner is-error">
      {{ textParseError }}
    </div>

    <!-- Progress Banner -->
    <div v-if="isCalculating" class="status-banner is-info">
      {{ progressMsg || 'Running binary search optimization...' }}
    </div>

    <!-- Error / UNSAT Banner -->
    <div v-else-if="solveStatus && solveStatus !== 'SAT'" class="status-banner is-error">
      {{ solveStatus }}
    </div>

    <!-- Optimal Solution Card -->
    <div v-if="solutionResult" class="result-card">
      <div class="result-header">
        <div class="result-headline">
          <span class="result-badge">OPTIMAL</span>
          <span class="result-main-metric">
            Max Value: <strong>{{ solutionResult.maxValue }}</strong>
          </span>
          <span class="result-sub-metric">
            (Weight: <strong>{{ solutionResult.totalWeight }}</strong> / {{ capacity }})
          </span>
        </div>

        <span v-if="solveStats" class="solution-meta">
          {{ solveStats.duration }} ms · {{ solveStats.vars }} vars ·
          {{ solveStats.clauses }} clauses
        </span>
      </div>

      <div v-if="solutionResult.pickedItems.length > 0" class="picked-summary">
        <div class="picked-rows">
          <div
            v-for="picked in solutionResult.pickedItems"
            :key="picked.id"
            class="picked-row-item"
          >
            <code>{{ picked.varName }}</code>
            <span class="picked-name">{{ picked.name }}</span>
            <span class="picked-metrics"
              >— weight: <strong>{{ picked.weight }}</strong>, value:
              <strong>{{ picked.value }}</strong></span
            >
          </div>
        </div>

        <div class="equations-breakdown">
          <div>
            <strong>Weight:</strong>
            {{ solutionResult.totalWeight }} =
            {{ solutionResult.pickedItems.map((it) => it.weight).join(' + ') }}
          </div>
          <div>
            <strong>Value:</strong>
            {{ solutionResult.maxValue }} =
            {{ solutionResult.pickedItems.map((it) => it.value).join(' + ') }}
          </div>
        </div>
      </div>

      <div v-else class="empty-picked">
        No items fit within capacity {{ capacity }} (optimal value = 0).
      </div>
    </div>

    <!-- Mode 1: Interactive Table -->
    <div v-if="inputMode === 'table'" class="table-wrapper">
      <table class="items-table">
        <thead>
          <tr>
            <th class="col-var">Var</th>
            <th class="col-name">Name</th>
            <th class="col-num">Weight</th>
            <th class="col-num">Value</th>
            <th class="col-action"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="items.length === 0">
            <td colspan="5" class="empty-row">
              No items in the list. Click <strong>+ Add random item</strong> to add one.
            </td>
          </tr>
          <tr
            v-for="(item, idx) in items"
            :key="item.id"
            :class="{ 'is-picked': selectedIds.has(item.id) }"
          >
            <td class="col-var">
              <code>x{{ idx + 1 }}</code>
            </td>
            <td class="col-name">
              <input
                v-model="item.name"
                type="text"
                class="text-input"
                :placeholder="`Item ${idx + 1}`"
                :disabled="isCalculating"
              />
            </td>
            <td class="col-num">
              <input
                v-model.number="item.weight"
                type="text"
                inputmode="numeric"
                class="num-input"
                :disabled="isCalculating"
              />
            </td>
            <td class="col-num">
              <input
                v-model.number="item.value"
                type="text"
                inputmode="numeric"
                class="num-input"
                :disabled="isCalculating"
              />
            </td>
            <td class="col-action">
              <button
                type="button"
                class="remove-btn"
                title="Remove item"
                :disabled="isCalculating"
                @click="removeItem(item.id)"
              >
                ×
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Mode 2: Text / Array Input -->
    <div v-else class="text-input-pane">
      <div class="format-badge">
        Format: <code>[{w: 3, v: 53, name: "Item 1"}, {w: 7, v: 41}, ...]</code> (<code>name</code>
        is optional)
      </div>
      <textarea
        v-model="rawTextInput"
        class="knapsack-textarea"
        placeholder='[&#10;  {w: 3, v: 53, name: "Item 1"},&#10;  {w: 7, v: 41}&#10;]'
        :disabled="isCalculating"
        spellcheck="false"
      ></textarea>
    </div>
  </div>
</template>

<style scoped>
.knapsack-draft {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.control-header {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color);
  background-color: var(--bg-editor);
}

.header-top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
}

.header-left-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
}

.capacity-field {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-main);
}

.field-label {
  white-space: nowrap;
}

.header-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.header-stats {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  background-color: var(--bg-tertiary);
  border-top: 1px solid var(--border-color);
  font-family: var(--font-mono);
  font-size: 0.76rem;
  color: var(--text-secondary);
}

.stat-item strong {
  color: var(--text-main);
  font-weight: 700;
}

.stat-sep {
  color: var(--text-muted);
}

.secondary-btn {
  padding: 6px 12px;
  font-family: var(--font-mono);
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-main);
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;
}

.secondary-btn:hover:not(:disabled) {
  border-color: var(--accent-primary);
  background-color: var(--bg-tertiary);
}

.secondary-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.result-sub-metric {
  color: var(--text-secondary);
  font-size: 0.82rem;
}

.picked-summary {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.picked-rows {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.picked-row-item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
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

.picked-name {
  font-weight: 600;
}

.picked-metrics {
  color: var(--text-secondary);
}

.equations-breakdown {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding-top: 8px;
  border-top: 1px solid var(--border-color);
  font-family: var(--font-mono);
  font-size: 0.76rem;
  color: var(--text-secondary);
}

.empty-picked {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.table-wrapper {
  border: 1px solid var(--border-color);
  background-color: var(--bg-editor);
  overflow-x: auto;
}

.items-table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--font-mono);
  font-size: 0.8rem;
}

.items-table th {
  padding: 6px 10px;
  text-align: left;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
  background-color: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
}

.items-table td {
  padding: 4px 10px;
  border-bottom: 1px solid var(--border-color);
}

.items-table tbody tr:last-child td {
  border-bottom: none;
}

.items-table tbody tr.is-picked {
  background-color: rgba(56, 189, 248, 0.14);
}

.empty-row {
  padding: 18px 12px;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.8rem;
}

.col-var {
  width: 48px;
  color: var(--accent-primary);
  font-weight: 700;
}

.col-name {
  min-width: 130px;
}

.col-num {
  width: 96px;
}

.col-action {
  width: 34px;
  text-align: right;
}

.text-input,
.num-input {
  width: 100%;
  padding: 4px 7px;
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--text-main);
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  box-sizing: border-box;
  outline: none;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;
}

.num-input::-webkit-outer-spin-button,
.num-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.num-input.is-capacity {
  width: 84px;
  background-color: var(--bg-secondary);
  font-weight: 700;
}

.text-input:focus,
.num-input:focus {
  border-color: var(--accent-primary);
  background-color: var(--bg-editor);
}

.remove-btn {
  width: 24px;
  height: 24px;
  padding: 0;
  font-family: var(--font-mono);
  font-size: 0.95rem;
  line-height: 1;
  color: var(--text-secondary);
  background-color: transparent;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease;
}

.remove-btn:hover:not(:disabled) {
  color: var(--status-error);
  border-color: var(--status-error-border);
  background-color: var(--status-error-bg);
}

.remove-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.text-input-pane {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color);
  background-color: var(--bg-editor);
}

.format-badge {
  padding: 7px 12px;
  font-family: var(--font-mono);
  font-size: 0.74rem;
  color: var(--text-secondary);
  background-color: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
}

.knapsack-textarea {
  width: 100%;
  min-height: 220px;
  padding: 12px 14px;
  border: none;
  outline: none;
  resize: vertical;
  font-family: var(--font-mono);
  font-size: 0.84rem;
  line-height: 1.55;
  color: var(--text-main);
  background-color: var(--bg-editor);
  box-sizing: border-box;
}
</style>

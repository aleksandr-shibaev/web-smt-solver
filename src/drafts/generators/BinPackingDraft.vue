<script setup>
import { ref, computed } from 'vue'
import { useDraftSolver } from '../useDraftSolver.js'
import {
  parseBinPackingItems,
  generateBinPackingCode,
  decodeBinPackingSolution
} from './binPackingCodec.js'

const emit = defineEmits(['copy-code'])

const ITEM_COLORS = Array.of(
  { bg: 'rgba(56, 189, 248, 0.2)', border: '#38bdf8', text: '#e0f2fe' },
  { bg: 'rgba(74, 222, 128, 0.2)', border: '#4ade80', text: '#dcfce7' },
  { bg: 'rgba(251, 191, 36, 0.2)', border: '#fbbf24', text: '#fef3c7' },
  { bg: 'rgba(192, 132, 252, 0.2)', border: '#c084fc', text: '#f3e8ff' },
  { bg: 'rgba(251, 113, 133, 0.2)', border: '#fb7185', text: '#ffe4e6' },
  { bg: 'rgba(45, 212, 191, 0.2)', border: '#2dd4bf', text: '#ccfbf1' },
  { bg: 'rgba(244, 114, 182, 0.2)', border: '#f472b6', text: '#fce7f3' },
  { bg: 'rgba(251, 146, 60, 0.2)', border: '#fb923c', text: '#ffedd5' }
)

const PRESETS = Array.of(
  {
    label: 'Cloud Pod Allocation (16 GB RAM nodes, optimal = 3 servers)',
    capacity: '16',
    itemsText: [
      'Service-1: 4',
      'Service-2: 3',
      'Service-3: 8',
      'Service-4: 5',
      'Service-5: 7',
      'Service-6: 2',
      'Service-7: 6',
      'Service-8: 4'
    ].join('\n')
  },
  {
    label: 'Classic 1D Bin Packing (Capacity = 10, optimal = 4 bins)',
    capacity: '10',
    itemsText: '[4, 8, 5, 1, 7, 6, 1, 4, 2, 2]'
  },
  {
    label: 'Pipe Cutting Stock (600 cm stock bars, optimal = 3 bars)',
    capacity: '600',
    itemsText: [
      'Beam-A: 250',
      'Beam-B: 210',
      'Beam-C: 190',
      'Brace-1: 180',
      'Brace-2: 170',
      'Brace-3: 150',
      'Strut-1: 140',
      'Strut-2: 120',
      'Strut-3: 110'
    ].join('\n')
  }
)

const capacityInput = ref(PRESETS.at(0).capacity)
const itemsInput = ref(PRESETS.at(0).itemsText)
const validationError = ref('')

let lastCapacitySnapshot = 16
let lastItemsSnapshot = Array.of()

const parsedPreview = computed(() => parseBinPackingItems(itemsInput.value))

const totalItemsSize = computed(() =>
  parsedPreview.value.items.reduce((sum, it) => sum + it.size, 0)
)

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
  unsatMessage: 'UNSAT — Items cannot fit into the given bin capacity.',
  onDecode: (inputVarsResults) =>
    decodeBinPackingSolution(lastCapacitySnapshot, lastItemsSnapshot, inputVarsResults)
})

function getItemColor(idx) {
  return ITEM_COLORS[idx % ITEM_COLORS.length]
}

function clearState() {
  validationError.value = ''
  clearResult()
}

function applyPreset(preset) {
  capacityInput.value = preset.capacity
  itemsInput.value = preset.itemsText
  clearState()
}

function handleSolvePacking() {
  clearState()

  const trimmedCap = String(capacityInput.value ?? '').trim()
  if (!/^\d+$/.test(trimmedCap) || Number(trimmedCap) <= 0) {
    validationError.value = 'Bin capacity must be a positive integer.'
    return
  }

  const cap = Number(trimmedCap)
  const { items, error } = parseBinPackingItems(itemsInput.value)
  if (error) {
    validationError.value = error
    return
  }

  if (items.length > 14) {
    validationError.value = 'Please use at most 14 items to keep SAT bin-packing fast.'
    return
  }

  const oversized = items.find((it) => it.size > cap)
  if (oversized) {
    validationError.value = `"${oversized.name}" (size ${oversized.size}) exceeds bin capacity (${cap}).`
    return
  }

  lastCapacitySnapshot = cap
  lastItemsSnapshot = items

  runGeneratedCode(generateBinPackingCode(cap, items))
}
</script>

<template>
  <div class="binpacking-draft">
    <p class="draft-description">
      Pack items or cloud containers of varying sizes into the
      <strong>minimum number of bins/servers</strong> of fixed capacity.
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

    <div class="draft-card">
      <div class="card-header">
        <div class="controls-left">
          <label class="cap-field">
            <span>Bin / Server Capacity:</span>
            <input
              v-model="capacityInput"
              type="text"
              inputmode="numeric"
              class="cap-input"
              :disabled="isCalculating"
            />
          </label>

          <div class="header-stats">
            <span
              ><strong>{{ parsedPreview.items.length }}</strong> items</span
            >
            <span class="sep">·</span>
            <span
              >Total size: <strong>{{ totalItemsSize }}</strong></span
            >
          </div>
        </div>

        <button v-if="isCalculating" type="button" class="solve-btn is-stop" @click="stop">
          Stop Solving
        </button>
        <button v-else type="button" class="solve-btn" @click="handleSolvePacking">
          Minimize Bins
        </button>
      </div>

      <div class="items-section">
        <div class="items-subheader">
          <span>Items List</span>
          <span class="format-hint">Format: "ServiceName: 4" per line, or "[4, 8, 5, 1]"</span>
        </div>
        <textarea
          v-model="itemsInput"
          class="items-textarea"
          rows="6"
          placeholder="API-Gateway: 4&#10;Auth-Service: 3&#10;Postgres: 8"
          :disabled="isCalculating"
          spellcheck="false"
        ></textarea>
      </div>
    </div>

    <div v-if="validationError" class="status-banner is-error">
      {{ validationError }}
    </div>

    <div v-if="isCalculating" class="status-banner is-info">
      {{ progressMsg || 'Searching for minimum number of bins...' }}
    </div>

    <div v-else-if="solveStatus && solveStatus !== 'SAT'" class="status-banner is-error">
      {{ solveStatus }}
    </div>

    <div v-if="solutionResult" class="result-card">
      <div class="result-header">
        <div class="result-headline">
          <span class="result-badge">OPTIMAL</span>
          <span class="result-main">
            Minimum Bins Used: <strong>{{ solutionResult.binsCount }}</strong>
          </span>
          <span class="util-summary">
            (avg utilization: <strong>{{ solutionResult.totalUtilizationPct }}%</strong>)
          </span>
        </div>

        <span v-if="solveStats" class="solution-meta"> {{ solveStats.duration }} ms </span>
      </div>

      <div class="bins-list">
        <div v-for="bin in solutionResult.bins" :key="bin.binIndex" class="bin-row">
          <div class="bin-meta">
            <span class="bin-title">Bin #{{ bin.binIndex }}</span>
            <span class="bin-load">
              {{ bin.usedLoad }} / {{ solutionResult.capacity }} ({{ bin.utilizationPct }}%)
            </span>
          </div>

          <div class="bin-bar-track">
            <div
              v-for="it in bin.items"
              :key="it.id"
              class="bin-segment"
              :title="`${it.name}: ${it.size}`"
              :style="{
                width: `${(it.size / solutionResult.capacity) * 100}%`,
                backgroundColor: getItemColor(it.itemIndex).bg,
                borderColor: getItemColor(it.itemIndex).border,
                color: getItemColor(it.itemIndex).text
              }"
            >
              <span class="seg-name">{{ it.name }}</span>
              <span class="seg-size">({{ it.size }})</span>
            </div>

            <div
              v-if="bin.freeSpace > 0"
              class="bin-free-space"
              :style="{ width: `${(bin.freeSpace / solutionResult.capacity) * 100}%` }"
              :title="`Free space: ${bin.freeSpace}`"
            >
              free: {{ bin.freeSpace }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.binpacking-draft {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.controls-left {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
}

.cap-field {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-main);
}

.cap-input {
  width: 78px;
  padding: 4px 8px;
  font-family: var(--font-mono);
  font-size: 0.84rem;
  font-weight: 700;
  color: var(--text-main);
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  outline: none;
}

.cap-input:focus {
  border-color: var(--accent-primary);
  background-color: var(--bg-editor);
}

.items-section {
  display: flex;
  flex-direction: column;
}

.items-subheader {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 14px;
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  font-family: var(--font-mono);
  font-size: 0.74rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.format-hint {
  font-weight: 400;
  color: var(--text-muted);
}

.items-textarea {
  width: 100%;
  padding: 10px 14px;
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

.util-summary {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.bins-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.bin-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  background-color: var(--bg-editor);
  border: 1px solid var(--border-color);
}

.bin-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-family: var(--font-mono);
  font-size: 0.76rem;
}

.bin-title {
  font-weight: 700;
  color: var(--text-main);
}

.bin-load {
  color: var(--text-secondary);
}

.bin-bar-track {
  display: flex;
  width: 100%;
  height: 30px;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  overflow: hidden;
}

.bin-segment {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0 6px;
  border-right: 1.5px solid;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  font-weight: 700;
  overflow: hidden;
  white-space: nowrap;
  box-sizing: border-box;
}

.bin-segment:last-child {
  border-right: none;
}

.seg-size {
  font-weight: 500;
  opacity: 0.9;
}

.bin-free-space {
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--text-muted);
  overflow: hidden;
  white-space: nowrap;
}
</style>

<script setup>
import { ref, computed } from 'vue'
import { useDraftSolver } from '../useDraftSolver.js'
import TspResultCard from './TspResultCard.vue'
import {
  parseDistanceMatrix,
  generateTspEdgesCode,
  decodeTspEdgesSolution
} from './tspEdgesCodec.js'

const emit = defineEmits(['copy-code'])

const PRESETS = Array.of(
  {
    label: '4×4 Symmetric Matrix (optimal = 80)',
    matrixText: ['0  10 15 20', '10 0  35 25', '15 35 0  30', '20 25 30 0'].join('\n')
  },
  {
    label: '4×4 Asymmetric TSP — Textbook Example (optimal = 35)',
    matrixText: ['0  10 15 20', '5  0  9  10', '6  13 0  12', '8  8  9  0'].join('\n')
  },
  {
    label: '5×5 Sparse Asymmetric Matrix with "_" (optimal = 19)',
    matrixText: ['0 3 _ 8 _', '_ 0 4 2 7', '6 _ 0 _ 3', '5 _ 9 0 4', '2 6 _ _ 0'].join('\n')
  }
)

const matrixInput = ref(PRESETS.at(0).matrixText)
const validationError = ref('')

let lastVerticesSnapshot = Array.of()
let lastWeightsSnapshot = {}

const parsedPreview = computed(() => parseDistanceMatrix(matrixInput.value))

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
  unsatMessage: 'UNSAT — No Hamiltonian cycle exists in this distance matrix.',
  onDecode: (inputVarsResults) =>
    decodeTspEdgesSolution(lastVerticesSnapshot, lastWeightsSnapshot, inputVarsResults)
})

function clearState() {
  validationError.value = ''
  clearResult()
}

function applyPreset(preset) {
  matrixInput.value = preset.matrixText
  clearState()
}

function handleSolveTsp() {
  clearState()

  const { edges, error } = parseDistanceMatrix(matrixInput.value)
  if (error) {
    validationError.value = error
    return
  }

  try {
    const generated = generateTspEdgesCode(edges)
    lastVerticesSnapshot = generated.vertices
    lastWeightsSnapshot = generated.edgeWeights

    runGeneratedCode(generated.code)
  } catch (err) {
    validationError.value = err.message
  }
}
</script>

<template>
  <div class="tsp-matrix-draft">
    <p class="draft-description">
      Find the shortest Hamiltonian tour from a symmetric or asymmetric
      <strong>N×N distance matrix</strong> (use <code>_</code> or <code>0</code> off-diagonal for
      missing arcs).
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
        <div class="header-stats">
          <span
            ><strong>{{ parsedPreview.size }}×{{ parsedPreview.size }}</strong> matrix</span
          >
          <span class="sep">·</span>
          <span
            ><strong>{{ parsedPreview.edges.length }}</strong> directed arcs</span
          >
        </div>

        <button v-if="isCalculating" type="button" class="solve-btn is-stop" @click="stop">
          Stop Solving
        </button>
        <button v-else type="button" class="solve-btn" @click="handleSolveTsp">
          Find Shortest Tour
        </button>
      </div>

      <textarea
        v-model="matrixInput"
        class="matrix-textarea"
        rows="7"
        placeholder="0  10 15 20&#10;5  0  9  10&#10;6  13 0  12&#10;8  8  9  0"
        :disabled="isCalculating"
        spellcheck="false"
      ></textarea>
    </div>

    <div v-if="validationError" class="status-banner is-error">
      {{ validationError }}
    </div>

    <div v-if="isCalculating" class="status-banner is-info">
      {{ progressMsg || 'Converting matrix to directed arc constraints and solving...' }}
    </div>

    <div v-else-if="solveStatus && solveStatus !== 'SAT'" class="status-banner is-error">
      {{ solveStatus }}
    </div>

    <TspResultCard v-if="solutionResult" :solution="solutionResult" :stats="solveStats" />
  </div>
</template>

<style scoped>
.tsp-matrix-draft {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.matrix-textarea {
  width: 100%;
  padding: 12px 14px;
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
</style>

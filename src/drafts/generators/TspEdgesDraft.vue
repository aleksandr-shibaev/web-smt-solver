<script setup>
import { ref, computed } from 'vue'
import { useDraftSolver } from '../useDraftSolver.js'
import TspResultCard from './TspResultCard.vue'
import {
  parseWeightedEdges,
  generateTspEdgesCode,
  decodeTspEdgesSolution
} from './tspEdgesCodec.js'

const emit = defineEmits(['copy-code'])

const PRESETS = Array.of(
  {
    label: '4 Cities (Undirected Complete Graph, optimal = 80)',
    edgesText: ['v1 v2 10', 'v1 v3 15', 'v1 v4 20', 'v2 v3 35', 'v2 v4 25', 'v3 v4 30'].join('\n')
  },
  {
    label: '4 Cities (Asymmetric Directed Arcs, optimal = 35)',
    edgesText: [
      'v1 -> v2 10',
      'v1 -> v3 15',
      'v1 -> v4 20',
      'v2 -> v1 5',
      'v2 -> v3 9',
      'v2 -> v4 10',
      'v3 -> v1 6',
      'v3 -> v2 13',
      'v3 -> v4 12',
      'v4 -> v1 8',
      'v4 -> v2 8',
      'v4 -> v3 9'
    ].join('\n')
  },
  {
    label: '6 Cities (Sparse Undirected Graph, optimal = 23)',
    edgesText: [
      'c1 c2 4',
      'c1 c3 2',
      'c1 c6 7',
      'c2 c3 5',
      'c2 c4 3',
      'c3 c5 4',
      'c4 c5 2',
      'c4 c6 6',
      'c5 c6 4'
    ].join('\n')
  }
)

const edgesInput = ref(PRESETS.at(0).edgesText)
const validationError = ref('')

let lastVerticesSnapshot = Array.of()
let lastWeightsSnapshot = {}

const parsedPreview = computed(() => parseWeightedEdges(edgesInput.value))

const vertexCountPreview = computed(() => {
  const set = new Set()
  for (const e of parsedPreview.value.edges) {
    set.add(e.u)
    set.add(e.v)
  }
  return set.size
})

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
  unsatMessage: 'UNSAT — No Hamiltonian cycle exists in this graph.',
  onDecode: (inputVarsResults) =>
    decodeTspEdgesSolution(lastVerticesSnapshot, lastWeightsSnapshot, inputVarsResults)
})

function clearState() {
  validationError.value = ''
  clearResult()
}

function applyPreset(preset) {
  edgesInput.value = preset.edgesText
  clearState()
}

function handleSolveTsp() {
  clearState()

  const { edges, error } = parseWeightedEdges(edgesInput.value)
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
  <div class="tsp-draft">
    <p class="draft-description">
      Find the shortest Hamiltonian cycle using undirected edges (<code>v1 v2 w</code>) or directed
      asymmetric arcs (<code>v1 -> v2 w</code>).
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
            ><strong>{{ vertexCountPreview }}</strong> vertices</span
          >
          <span class="sep">·</span>
          <span
            ><strong>{{ parsedPreview.edges.length }}</strong> directed arcs</span
          >
          <span class="format-hint">(<code>v1 v2 w</code> or <code>v1 -> v2 w</code>)</span>
        </div>

        <button v-if="isCalculating" type="button" class="solve-btn is-stop" @click="stop">
          Stop Solving
        </button>
        <button v-else type="button" class="solve-btn" @click="handleSolveTsp">
          Find Shortest Tour
        </button>
      </div>

      <textarea
        v-model="edgesInput"
        class="edges-textarea"
        rows="9"
        placeholder="v1 v2 10&#10;v1 -> v3 15&#10;v3 -> v1 6"
        :disabled="isCalculating"
        spellcheck="false"
      ></textarea>
    </div>

    <div v-if="validationError" class="status-banner is-error">
      {{ validationError }}
    </div>

    <div v-if="isCalculating" class="status-banner is-info">
      {{ progressMsg || 'Running binary search over Hamiltonian cycles...' }}
    </div>

    <div v-else-if="solveStatus && solveStatus !== 'SAT'" class="status-banner is-error">
      {{ solveStatus }}
    </div>

    <TspResultCard v-if="solutionResult" :solution="solutionResult" :stats="solveStats" />
  </div>
</template>

<style scoped>
.tsp-draft {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.format-hint {
  color: var(--text-muted);
  font-size: 0.74rem;
}

.edges-textarea {
  width: 100%;
  padding: 12px 14px;
  border: none;
  outline: none;
  resize: vertical;
  font-family: var(--font-mono);
  font-size: 0.85rem;
  line-height: 1.55;
  color: var(--text-main);
  background-color: var(--bg-editor);
  box-sizing: border-box;
}
</style>

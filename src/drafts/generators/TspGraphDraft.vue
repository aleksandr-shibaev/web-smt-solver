<script setup>
import { ref, computed } from 'vue'
import { useDraftSolver } from '../useDraftSolver.js'
import { useSvgCanvas } from '../useSvgCanvas.js'
import TspResultCard from './TspResultCard.vue'
import { generateTspEdgesCode, decodeTspEdgesSolution } from './tspEdgesCodec.js'

const emit = defineEmits(['copy-code'])

const SVG_WIDTH = 560
const SVG_HEIGHT = 320
const NODE_RADIUS = 17

const PRESETS = Array.of(
  {
    label: '5 Cities (Pentagon)',
    nodes: Array.of(
      { id: 'v1', x: 280, y: 48 },
      { id: 'v2', x: 455, y: 145 },
      { id: 'v3', x: 390, y: 272 },
      { id: 'v4', x: 170, y: 272 },
      { id: 'v5', x: 105, y: 145 }
    )
  },
  {
    label: '6 Cities (Clustered)',
    nodes: Array.of(
      { id: 'v1', x: 110, y: 80 },
      { id: 'v2', x: 190, y: 65 },
      { id: 'v3', x: 145, y: 235 },
      { id: 'v4', x: 410, y: 75 },
      { id: 'v5', x: 465, y: 195 },
      { id: 'v6', x: 365, y: 255 }
    )
  }
)

const initialPreset = PRESETS.at(0)
const nodes = ref(initialPreset.nodes.map((n) => ({ ...n })))
const validationError = ref('')

let nextNodeCounter = initialPreset.nodes.length + 1
let lastVerticesSnapshot = Array.of()
let lastWeightsSnapshot = {}

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
  unsatMessage: 'UNSAT — No Hamiltonian tour found.',
  onDecode: (inputVarsResults) =>
    decodeTspEdgesSolution(lastVerticesSnapshot, lastWeightsSnapshot, inputVarsResults)
})

const {
  svgRef,
  startDrag: startNodeDrag,
  handlePointerMove: handleSvgPointerMove,
  stopDrag: stopNodeDrag,
  handleSvgClick
} = useSvgCanvas({
  width: SVG_WIDTH,
  height: SVG_HEIGHT,
  padding: 24,
  isLocked: () => isCalculating.value,
  onCanvasClick: (pt) => {
    if (nodes.value.length >= 10) {
      validationError.value =
        'Maximum 10 cities on the interactive canvas to keep SAT solving fast.'
      return
    }
    nodes.value.push({
      id: `v${nextNodeCounter++}`,
      x: pt.x,
      y: pt.y
    })
    markGraphModified()
  },
  onNodeMove: (idx, pt) => {
    nodes.value[idx].x = pt.x
    nodes.value[idx].y = pt.y
    markGraphModified()
  }
})

const allEdges = computed(() => {
  const list = Array.of()
  const arr = nodes.value
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      const dx = arr[i].x - arr[j].x
      const dy = arr[i].y - arr[j].y
      const dist = Math.max(1, Math.round(Math.hypot(dx, dy) / 10))
      list.push({
        u: arr[i].id,
        v: arr[j].id,
        x1: arr[i].x,
        y1: arr[i].y,
        x2: arr[j].x,
        y2: arr[j].y,
        mx: (arr[i].x + arr[j].x) / 2,
        my: (arr[i].y + arr[j].y) / 2,
        weight: dist
      })
    }
  }
  return list
})

const tourSegments = computed(() => {
  if (!solutionResult.value) return Array.of()
  const nodeMap = Object.fromEntries(nodes.value.map((n) => [n.id, n]))
  const segs = Array.of()

  for (const step of solutionResult.value.steps) {
    const a = nodeMap[step.from]
    const b = nodeMap[step.to]
    if (!a || !b) return Array.of()

    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy) || 1
    const ux = dx / len
    const uy = dy / len
    const liveWeight = Math.max(1, Math.round(len / 10))

    segs.push({
      key: `${step.from}->${step.to}`,
      from: step.from,
      to: step.to,
      weight: isOutdated.value ? String(liveWeight) : step.weight,
      x1: a.x + ux * (NODE_RADIUS + 2),
      y1: a.y + uy * (NODE_RADIUS + 2),
      x2: b.x - ux * (NODE_RADIUS + 6),
      y2: b.y - uy * (NODE_RADIUS + 6),
      mx: (a.x + b.x) / 2,
      my: (a.y + b.y) / 2
    })
  }
  return segs
})

const currentTourCost = computed(() => {
  if (!solutionResult.value) return '0'
  if (!isOutdated.value) return solutionResult.value.minCost
  return String(tourSegments.value.reduce((sum, seg) => sum + Number(seg.weight), 0))
})

function resetAll() {
  validationError.value = ''
  clearResult()
}

function markGraphModified() {
  validationError.value = ''
  if (solutionResult.value) {
    const existingIds = new Set(nodes.value.map((n) => n.id))
    const stillValid = solutionResult.value.path.every((id) => existingIds.has(id))
    if (!stillValid) {
      clearResult()
    } else {
      markOutdated()
    }
  }
}

function applyPreset(preset) {
  nodes.value = preset.nodes.map((n) => ({ ...n }))
  nextNodeCounter = nodes.value.length + 1
  resetAll()
}

function removeNode(idx) {
  if (isCalculating.value) return
  nodes.value.splice(idx, 1)
  markGraphModified()
}

function handleSolveGraph() {
  resetAll()
  if (nodes.value.length < 3) {
    validationError.value = 'Place at least 3 cities on the canvas.'
    return
  }

  const directedArcs = Array.of()
  for (const edge of allEdges.value) {
    const w = BigInt(edge.weight)
    directedArcs.push({ u: edge.u, v: edge.v, weight: w })
    directedArcs.push({ u: edge.v, v: edge.u, weight: w })
  }

  try {
    const generated = generateTspEdgesCode(directedArcs)
    lastVerticesSnapshot = generated.vertices
    lastWeightsSnapshot = generated.edgeWeights
    runGeneratedCode(generated.code)
  } catch (err) {
    validationError.value = err.message
  }
}
</script>

<template>
  <div class="tsp-graph-draft">
    <p class="draft-description">
      <strong>Click</strong> empty space to add a city, <strong>drag</strong> cities to move them
      (edge weights update automatically), or <strong>double-click</strong> a city to remove it.
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
            ><strong>{{ nodes.length }}</strong> cities</span
          >
          <span class="sep">·</span>
          <span
            ><strong>{{ allEdges.length }}</strong> undirected edges</span
          >
        </div>

        <button v-if="isCalculating" type="button" class="solve-btn is-stop" @click="stop">
          Stop Solving
        </button>
        <button
          v-else
          type="button"
          class="solve-btn"
          :disabled="nodes.length < 3"
          @click="handleSolveGraph"
        >
          Find Shortest Tour
        </button>
      </div>

      <svg
        ref="svgRef"
        :viewBox="`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`"
        class="interactive-svg"
        @click="handleSvgClick"
        @pointermove="handleSvgPointerMove"
        @pointerup="stopNodeDrag"
        @pointerleave="stopNodeDrag"
      >
        <defs>
          <marker
            id="tsp-arrow"
            viewBox="0 0 10 10"
            refX="7"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 9 5 L 0 8.5 z" :fill="isOutdated ? '#fbbf24' : '#38bdf8'" />
          </marker>
        </defs>

        <!-- All background edges -->
        <g v-if="!solutionResult" class="edges-layer">
          <template v-for="edge in allEdges" :key="`${edge.u}-${edge.v}`">
            <line :x1="edge.x1" :y1="edge.y1" :x2="edge.x2" :y2="edge.y2" class="bg-edge" />
            <text :x="edge.mx" :y="edge.my - 3" class="edge-label">
              {{ edge.weight }}
            </text>
          </template>
        </g>

        <!-- Faint edges + highlighted tour -->
        <g v-else class="solution-layer">
          <line
            v-for="edge in allEdges"
            :key="`faint-${edge.u}-${edge.v}`"
            :x1="edge.x1"
            :y1="edge.y1"
            :x2="edge.x2"
            :y2="edge.y2"
            class="faint-edge"
          />

          <template v-for="seg in tourSegments" :key="seg.key">
            <line
              :x1="seg.x1"
              :y1="seg.y1"
              :x2="seg.x2"
              :y2="seg.y2"
              :class="['tour-edge', { 'is-outdated': isOutdated }]"
              marker-end="url(#tsp-arrow)"
            />
            <rect
              :x="seg.mx - 12"
              :y="seg.my - 9"
              width="24"
              height="16"
              rx="3"
              :class="['tour-weight-bg', { 'is-outdated': isOutdated }]"
            />
            <text
              :x="seg.mx"
              :y="seg.my + 3"
              :class="['tour-weight-text', { 'is-outdated': isOutdated }]"
            >
              {{ seg.weight }}
            </text>
          </template>
        </g>

        <!-- City nodes -->
        <g
          v-for="(node, idx) in nodes"
          :key="node.id"
          class="svg-draggable"
          @pointerdown.stop="startNodeDrag(idx)"
          @dblclick.stop="removeNode(idx)"
        >
          <circle
            :cx="node.x"
            :cy="node.y"
            :r="NODE_RADIUS"
            :class="['city-circle', { 'is-start': idx === 0 }]"
          />
          <text :x="node.x" :y="node.y + 4" class="city-label">
            {{ node.id }}
          </text>
        </g>
      </svg>
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

    <TspResultCard
      v-if="solutionResult"
      :solution="solutionResult"
      :stats="solveStats"
      :is-outdated="isOutdated"
      :live-cost="currentTourCost"
      :live-steps="tourSegments"
      :show-steps="false"
    />
  </div>
</template>
<style scoped>
.tsp-graph-draft {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.bg-edge {
  stroke: var(--border-strong);
  stroke-width: 1.25;
}

.faint-edge {
  stroke: var(--border-color);
  stroke-width: 1;
  stroke-dasharray: 3 3;
}

.edge-label {
  font-family: var(--font-mono);
  font-size: 10px;
  fill: var(--text-muted);
  text-anchor: middle;
  pointer-events: none;
}

.tour-edge {
  stroke: var(--accent-primary);
  stroke-width: 2.5;
}

.tour-edge.is-outdated {
  stroke: #fbbf24;
  stroke-dasharray: 5 3;
}

.tour-weight-bg {
  fill: #10253e;
  stroke: rgba(56, 189, 248, 0.55);
  stroke-width: 1;
}

.tour-weight-bg.is-outdated {
  fill: #2a2112;
  stroke: rgba(251, 191, 36, 0.55);
}

.tour-weight-text {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  fill: var(--accent-primary);
  text-anchor: middle;
  pointer-events: none;
}

.tour-weight-text.is-outdated {
  fill: #fbbf24;
}

.city-circle {
  fill: var(--bg-tertiary);
  stroke: var(--border-strong);
  stroke-width: 2;
}

.city-circle.is-start {
  fill: #132c4a;
  stroke: var(--accent-primary);
  stroke-width: 2.5;
}

.city-label {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  fill: var(--text-main);
  text-anchor: middle;
  pointer-events: none;
}
</style>

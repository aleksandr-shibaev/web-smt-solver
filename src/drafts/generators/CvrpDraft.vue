<script setup>
import { ref, computed } from 'vue'
import { useDraftSolver } from '../useDraftSolver.js'
import { useSvgCanvas } from '../useSvgCanvas.js'
import { TRIP_COLORS, buildRouteArcs, generateCvrpCode, decodeCvrpSolution } from './cvrpCodec.js'

const emit = defineEmits(['copy-code'])

const SVG_WIDTH = 560
const SVG_HEIGHT = 330

const PRESETS = Array.of(
  {
    label: '5 Clients · Truck Capacity 10 t',
    capacity: '10',
    depot: { id: 'D', x: 280, y: 165 },
    clients: Array.of(
      { id: 'C1', name: 'Store 1', x: 150, y: 75, demand: 4 },
      { id: 'C2', name: 'Store 2', x: 120, y: 235, demand: 3 },
      { id: 'C3', name: 'Store 3', x: 255, y: 280, demand: 3 },
      { id: 'C4', name: 'Store 4', x: 430, y: 95, demand: 5 },
      { id: 'C5', name: 'Store 5', x: 425, y: 245, demand: 4 }
    )
  },
  {
    label: '6 Clients · Truck Capacity 12 t (3 Trips)',
    capacity: '12',
    depot: { id: 'D', x: 280, y: 165 },
    clients: Array.of(
      { id: 'C1', name: 'Hub A', x: 115, y: 70, demand: 6 },
      { id: 'C2', name: 'Hub B', x: 195, y: 55, demand: 5 },
      { id: 'C3', name: 'Hub C', x: 110, y: 250, demand: 7 },
      { id: 'C4', name: 'Hub D', x: 440, y: 65, demand: 6 },
      { id: 'C5', name: 'Hub E', x: 470, y: 195, demand: 5 },
      { id: 'C6', name: 'Hub F', x: 375, y: 275, demand: 5 }
    )
  }
)

const initialPreset = PRESETS.at(0)
const capacityInput = ref(initialPreset.capacity)
const depot = ref({ ...initialPreset.depot })
const clients = ref(initialPreset.clients.map((c) => ({ ...c })))
const validationError = ref('')

let nextClientCounter = initialPreset.clients.length + 1
let lastSnapshot = null

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
  unsatMessage: 'UNSAT — No valid delivery routes exist with these constraints.',
  onDecode: (inputVarsResults) =>
    decodeCvrpSolution(lastSnapshot.meta, lastSnapshot.distances, inputVarsResults)
})

const {
  svgRef,
  startDrag,
  handlePointerMove: handleSvgPointerMove,
  stopDrag,
  handleSvgClick
} = useSvgCanvas({
  width: SVG_WIDTH,
  height: SVG_HEIGHT,
  padding: 26,
  isLocked: () => isCalculating.value,
  onCanvasClick: (pt) => {
    if (clients.value.length >= 9) {
      validationError.value =
        'Maximum 9 delivery points on the interactive map to keep SAT solving fast.'
      return
    }
    const num = nextClientCounter++
    clients.value.push({
      id: `C${num}`,
      name: `Store ${num}`,
      x: pt.x,
      y: pt.y,
      demand: 3
    })
    markModified()
  },
  onNodeMove: (target, pt) => {
    if (target.type === 'depot') {
      depot.value.x = pt.x
      depot.value.y = pt.y
    } else {
      clients.value[target.index].x = pt.x
      clients.value[target.index].y = pt.y
    }
    markModified()
  }
})

const totalDemand = computed(() =>
  clients.value.reduce((sum, c) => sum + (Number(c.demand) || 0), 0)
)

const visualTripArcs = computed(() =>
  buildRouteArcs(depot.value, clients.value, solutionResult.value?.trips)
)

function getTripColor(idx) {
  return TRIP_COLORS[idx % TRIP_COLORS.length]
}

function resetAll() {
  validationError.value = ''
  clearResult()
}

function markModified() {
  validationError.value = ''
  if (solutionResult.value) {
    const existingIds = new Set([depot.value.id, ...clients.value.map((c) => c.id)])
    const valid = solutionResult.value.trips.every((t) => t.path.every((id) => existingIds.has(id)))
    if (!valid) {
      clearResult()
    } else {
      markOutdated()
    }
  }
}

function applyPreset(preset) {
  capacityInput.value = preset.capacity
  depot.value = { ...preset.depot }
  clients.value = preset.clients.map((c) => ({ ...c }))
  nextClientCounter = clients.value.length + 1
  resetAll()
}

function removeClient(idx) {
  if (isCalculating.value) return
  clients.value.splice(idx, 1)
  markModified()
}

function handleSolveCvrp() {
  resetAll()

  const cap = Math.floor(Number(capacityInput.value) || 0)
  if (cap <= 0) {
    validationError.value = 'Truck Capacity must be a positive integer.'
    return
  }

  if (clients.value.length === 0) {
    validationError.value = 'Add at least 1 client on the map.'
    return
  }

  for (const c of clients.value) {
    const d = Math.floor(Number(c.demand) || 0)
    if (d <= 0) {
      validationError.value = `Client ${c.id} demand must be >= 1.`
      return
    }
    if (d > cap) {
      validationError.value = `Client ${c.id} demand (${d}) exceeds truck capacity (${cap}).`
      return
    }
    c.demand = d
  }

  try {
    const { code, distances } = generateCvrpCode({
      depot: depot.value,
      clients: clients.value,
      capacity: cap
    })

    lastSnapshot = {
      meta: {
        depot: { ...depot.value },
        clients: clients.value.map((c) => ({ ...c })),
        capacity: cap
      },
      distances
    }

    runGeneratedCode(code)
  } catch (err) {
    validationError.value = err.message
  }
}
</script>

<template>
  <div class="cvrp-draft">
    <p class="draft-description">
      Plan multi-stop delivery trips from central <strong>Depot (D)</strong> with limited
      <strong>Truck Capacity</strong>. Click empty map space to add a client, drag points to move,
      or double-click a client to remove.
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
        <div class="fleet-controls">
          <label class="num-field">
            <span>Truck Capacity:</span>
            <input
              v-model="capacityInput"
              type="text"
              inputmode="numeric"
              class="mini-input"
              :disabled="isCalculating"
              @input="markModified"
            />
          </label>
          <span class="demand-pill">
            <strong>{{ clients.length }}</strong> clients · Total demand:
            <strong>{{ totalDemand }}</strong>
          </span>
        </div>

        <button v-if="isCalculating" type="button" class="solve-btn is-stop" @click="stop">
          Stop Solving
        </button>
        <button v-else type="button" class="solve-btn" @click="handleSolveCvrp">
          Optimize Routes
        </button>
      </div>

      <svg
        ref="svgRef"
        :viewBox="`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`"
        class="interactive-svg"
        @click="handleSvgClick"
        @pointermove="handleSvgPointerMove"
        @pointerup="stopDrag"
        @pointerleave="stopDrag"
      >
        <defs>
          <marker
            v-for="(color, idx) in TRIP_COLORS"
            :id="`cvrp-arrow-${idx}`"
            :key="color"
            viewBox="0 0 10 10"
            refX="7"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 9 5 L 0 8.5 z" :fill="isOutdated ? '#fbbf24' : color" />
          </marker>
        </defs>

        <!-- Faint spokes from depot when not yet solved -->
        <g v-if="!solutionResult">
          <line
            v-for="c in clients"
            :key="`spoke-${c.id}`"
            :x1="depot.x"
            :y1="depot.y"
            :x2="c.x"
            :y2="c.y"
            class="spoke-line"
          />
        </g>

        <!-- Solved colored trip routes -->
        <g v-else>
          <template v-for="arc in visualTripArcs" :key="arc.key">
            <line
              :x1="arc.x1"
              :y1="arc.y1"
              :x2="arc.x2"
              :y2="arc.y2"
              :stroke="isOutdated ? '#fbbf24' : arc.color"
              :stroke-dasharray="isOutdated ? '5 3' : undefined"
              stroke-width="2.5"
              :marker-end="`url(#cvrp-arrow-${arc.colorIndex})`"
            />
            <rect
              :x="arc.mx - 11"
              :y="arc.my - 8"
              width="22"
              height="15"
              rx="3"
              class="svg-weight-bg"
            />
            <text :x="arc.mx" :y="arc.my + 3" class="svg-weight-text">
              {{ arc.dist }}
            </text>
          </template>
        </g>

        <!-- Central Depot (Square) -->
        <g class="svg-draggable" @pointerdown.stop="startDrag({ type: 'depot' })">
          <rect
            :x="depot.x - 16"
            :y="depot.y - 16"
            width="32"
            height="32"
            rx="4"
            class="depot-rect"
          />
          <text :x="depot.x" :y="depot.y + 4" class="depot-label">
            {{ depot.id }}
          </text>
        </g>

        <!-- Client Nodes (Circles with demand badge) -->
        <g
          v-for="(c, idx) in clients"
          :key="c.id"
          class="svg-draggable"
          @pointerdown.stop="startDrag({ type: 'client', index: idx })"
          @dblclick.stop="removeClient(idx)"
        >
          <circle :cx="c.x" :cy="c.y" r="16" class="client-circle" />
          <text :x="c.x" :y="c.y + 4" class="client-label">
            {{ c.id }}
          </text>
          <rect :x="c.x + 8" :y="c.y - 21" width="22" height="14" rx="3" class="demand-tag-bg" />
          <text :x="c.x + 19" :y="c.y - 11" class="demand-tag-text">{{ c.demand }}t</text>
        </g>
      </svg>

      <!-- Compact Demand Editor Bar -->
      <div class="demands-bar">
        <span class="demands-title">Client Demands:</span>
        <div class="demands-chips">
          <label v-for="c in clients" :key="`dem-${c.id}`" class="demand-chip">
            <span>{{ c.id }}:</span>
            <input
              v-model.number="c.demand"
              type="text"
              inputmode="numeric"
              class="chip-input"
              :disabled="isCalculating"
              @input="markModified"
            />
          </label>
        </div>
      </div>
    </div>

    <div v-if="validationError" class="status-banner is-error">
      {{ validationError }}
    </div>

    <div v-if="isCalculating" class="status-banner is-info">
      {{ progressMsg || 'Optimizing multi-trip vehicle routes...' }}
    </div>

    <div v-else-if="solveStatus && solveStatus !== 'SAT'" class="status-banner is-error">
      {{ solveStatus }}
    </div>

    <div v-if="solutionResult" :class="['result-card', { 'is-outdated': isOutdated }]">
      <div class="result-header">
        <div class="result-headline">
          <span :class="['result-badge', { 'is-outdated': isOutdated }]">
            {{ isOutdated ? 'OUTDATED' : 'OPTIMAL' }}
          </span>
          <span class="result-main">
            Total Fleet Distance: <strong>{{ solutionResult.totalDistance }}</strong> ({{
              solutionResult.tripsCount
            }}
            trips)
          </span>
        </div>

        <span v-if="solveStats && !isOutdated" class="solution-meta">
          {{ solveStats.duration }} ms
        </span>
      </div>

      <div class="trips-list">
        <div
          v-for="(trip, idx) in solutionResult.trips"
          :key="trip.tripNumber"
          class="trip-row"
          :style="{ borderLeftColor: getTripColor(idx) }"
        >
          <div class="trip-top">
            <span class="trip-badge" :style="{ color: getTripColor(idx) }">
              Trip #{{ trip.tripNumber }}
            </span>
            <span class="trip-metrics">
              Load: <strong>{{ trip.load }} / {{ trip.capacity }}</strong> · Dist:
              <strong>{{ trip.distance }}</strong>
            </span>
          </div>
          <div class="trip-route">
            <code>{{ trip.path.join(' → ') }}</code>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cvrp-draft {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.fleet-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.num-field {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-main);
}

.mini-input {
  width: 44px;
  padding: 4px 6px;
  font-family: var(--font-mono);
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-main);
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  outline: none;
}

.mini-input:focus {
  border-color: var(--accent-primary);
  background-color: var(--bg-editor);
}

.demand-pill {
  font-family: var(--font-mono);
  font-size: 0.76rem;
  color: var(--text-secondary);
}

.spoke-line {
  stroke: var(--border-strong);
  stroke-width: 1.25;
  stroke-dasharray: 4 4;
}

.depot-rect {
  fill: #132c4a;
  stroke: var(--accent-primary);
  stroke-width: 2.2;
}

.depot-label {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 800;
  fill: var(--text-main);
  text-anchor: middle;
  pointer-events: none;
}

.client-circle {
  fill: var(--bg-tertiary);
  stroke: var(--border-strong);
  stroke-width: 2;
}

.client-label {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  fill: var(--text-main);
  text-anchor: middle;
  pointer-events: none;
}

.demand-tag-bg {
  fill: #10253e;
  stroke: rgba(56, 189, 248, 0.5);
  stroke-width: 1;
}

.demand-tag-text {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  fill: var(--accent-primary);
  text-anchor: middle;
  pointer-events: none;
}

.demands-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background-color: var(--bg-tertiary);
  border-top: 1px solid var(--border-color);
}

.demands-title {
  font-family: var(--font-mono);
  font-size: 0.74rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.demands-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.demand-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  background-color: var(--bg-editor);
  border: 1px solid var(--border-color);
  font-family: var(--font-mono);
  font-size: 0.74rem;
  font-weight: 600;
  color: var(--text-main);
}

.chip-input {
  width: 28px;
  padding: 1px 3px;
  border: none;
  border-bottom: 1px solid var(--border-strong);
  font-family: var(--font-mono);
  font-size: 0.74rem;
  font-weight: 700;
  text-align: center;
  color: var(--accent-primary);
  background: transparent;
  outline: none;
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

.trips-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.trip-row {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 6px 10px;
  background-color: var(--bg-editor);
  border: 1px solid var(--border-color);
  border-left-width: 4px;
}

.trip-top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 0.76rem;
}

.trip-badge {
  font-weight: 700;
}

.trip-metrics {
  color: var(--text-secondary);
}

.trip-route {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--text-main);
}
</style>

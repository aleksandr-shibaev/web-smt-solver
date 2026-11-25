<script setup>
import { ref, computed } from 'vue'
import { useDraftSolver } from '../useDraftSolver.js'
import { useSvgCanvas } from '../useSvgCanvas.js'
import { TRIP_COLORS, buildRouteArcs } from './cvrpCodec.js'
import { generateVrptwCode, decodeVrptwSolution } from './vrptwCodec.js'

const emit = defineEmits(['copy-code'])

const SVG_WIDTH = 560
const SVG_HEIGHT = 330

const PRESETS = Array.of(
  {
    label: 'Morning & Afternoon Windows (5 Clients, Cap 10 t)',
    capacity: '10',
    horizon: '120',
    depot: { id: 'D', x: 280, y: 165 },
    clients: Array.of(
      { id: 'C1', x: 145, y: 75, demand: 4, winStart: 10, winEnd: 30, service: 4 },
      { id: 'C2', x: 125, y: 240, demand: 3, winStart: 45, winEnd: 75, service: 4 },
      { id: 'C3', x: 265, y: 280, demand: 3, winStart: 20, winEnd: 45, service: 4 },
      { id: 'C4', x: 430, y: 90, demand: 5, winStart: 15, winEnd: 40, service: 5 },
      { id: 'C5', x: 425, y: 245, demand: 4, winStart: 50, winEnd: 85, service: 4 }
    )
  },
  {
    label: 'Strict Priority Slots (6 Clients, Cap 12 t)',
    capacity: '12',
    horizon: '150',
    depot: { id: 'D', x: 280, y: 165 },
    clients: Array.of(
      { id: 'C1', x: 115, y: 70, demand: 4, winStart: 15, winEnd: 35, service: 5 },
      { id: 'C2', x: 195, y: 55, demand: 4, winStart: 60, winEnd: 95, service: 5 },
      { id: 'C3', x: 110, y: 250, demand: 4, winStart: 35, winEnd: 65, service: 5 },
      { id: 'C4', x: 440, y: 65, demand: 5, winStart: 15, winEnd: 40, service: 5 },
      { id: 'C5', x: 470, y: 195, demand: 4, winStart: 45, winEnd: 75, service: 5 },
      { id: 'C6', x: 375, y: 275, demand: 3, winStart: 75, winEnd: 115, service: 5 }
    )
  }
)

const initialPreset = PRESETS.at(0)
const capacityInput = ref(initialPreset.capacity)
const horizonInput = ref(initialPreset.horizon)
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
  unsatMessage: 'UNSAT — Impossible to satisfy all time windows and truck capacity.',
  onDecode: (inputVarsResults) =>
    decodeVrptwSolution(lastSnapshot.meta, lastSnapshot.distances, inputVarsResults)
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
  padding: 28,
  isLocked: () => isCalculating.value,
  onCanvasClick: (pt) => {
    if (clients.value.length >= 8) {
      validationError.value = 'Maximum 8 delivery points on the VRPTW map to keep SAT solving fast.'
      return
    }
    const num = nextClientCounter++
    clients.value.push({
      id: `C${num}`,
      x: pt.x,
      y: pt.y,
      demand: 3,
      winStart: 15,
      winEnd: 90,
      service: 4
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
  horizonInput.value = preset.horizon
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

function handleSolveVrptw() {
  resetAll()

  const cap = Math.floor(Number(capacityInput.value) || 0)
  const hor = Math.floor(Number(horizonInput.value) || 0)

  if (cap <= 0 || hor <= 0) {
    validationError.value = 'Truck Capacity and Shift Horizon must be positive integers.'
    return
  }

  if (clients.value.length === 0) {
    validationError.value = 'Add at least 1 client on the map.'
    return
  }

  for (const c of clients.value) {
    const d = Math.floor(Number(c.demand) || 0)
    const ws = Math.floor(Number(c.winStart) || 0)
    const we = Math.floor(Number(c.winEnd) || 0)
    const srv = Math.floor(Number(c.service) || 0)

    if (d <= 0 || d > cap) {
      validationError.value = `Client ${c.id}: demand (${d}) must be between 1 and ${cap}.`
      return
    }
    if (ws < 0 || we < ws || we + srv > hor) {
      validationError.value = `Client ${c.id}: invalid time window [${ws}..${we}] + service (${srv}) within shift horizon ${hor}.`
      return
    }

    c.demand = d
    c.winStart = ws
    c.winEnd = we
    c.service = srv
  }

  try {
    const { code, distances } = generateVrptwCode({
      depot: depot.value,
      clients: clients.value,
      capacity: cap,
      horizon: hor
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
  <div class="vrptw-draft">
    <p class="draft-description">
      Vehicle Routing with <strong>Time Windows (VRPTW)</strong>: optimize multi-stop delivery
      routes respecting both <strong>Truck Capacity</strong> and each client's acceptance window
      <code>[start..end]</code>.
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
            <span>Truck Cap:</span>
            <input
              v-model="capacityInput"
              type="text"
              inputmode="numeric"
              class="mini-input"
              :disabled="isCalculating"
              @input="markModified"
            />
          </label>
          <label class="num-field">
            <span>Shift Horizon:</span>
            <input
              v-model="horizonInput"
              type="text"
              inputmode="numeric"
              class="mini-input"
              :disabled="isCalculating"
              @input="markModified"
            />
          </label>
          <span class="demand-pill">
            <strong>{{ clients.length }}</strong> clients · Demand:
            <strong>{{ totalDemand }}</strong>
          </span>
        </div>

        <button v-if="isCalculating" type="button" class="solve-btn is-stop" @click="stop">
          Stop Solving
        </button>
        <button v-else type="button" class="solve-btn" @click="handleSolveVrptw">
          Optimize VRPTW
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
            :id="`vrptw-arrow-${idx}`"
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

        <!-- Faint spokes when unsolved -->
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
              :marker-end="`url(#vrptw-arrow-${arc.colorIndex})`"
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

        <!-- Central Depot -->
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

        <!-- Client Nodes with Demand & Time Window badges -->
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
          <rect :x="c.x - 28" :y="c.y + 18" width="56" height="14" rx="3" class="win-tag-bg" />
          <text :x="c.x" :y="c.y + 28" class="win-tag-text">
            {{ c.demand }}t [{{ c.winStart }}..{{ c.winEnd }}]
          </text>
        </g>
      </svg>

      <!-- Compact Client Constraints Table -->
      <div class="clients-table-wrap">
        <table class="clients-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Demand</th>
              <th>Window Start</th>
              <th>Window End</th>
              <th>Unload Time</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in clients" :key="`row-${c.id}`">
              <td class="col-id">{{ c.id }}</td>
              <td>
                <input
                  v-model.number="c.demand"
                  type="text"
                  inputmode="numeric"
                  class="cell-input"
                  :disabled="isCalculating"
                  @input="markModified"
                />
              </td>
              <td>
                <input
                  v-model.number="c.winStart"
                  type="text"
                  inputmode="numeric"
                  class="cell-input"
                  :disabled="isCalculating"
                  @input="markModified"
                />
              </td>
              <td>
                <input
                  v-model.number="c.winEnd"
                  type="text"
                  inputmode="numeric"
                  class="cell-input"
                  :disabled="isCalculating"
                  @input="markModified"
                />
              </td>
              <td>
                <input
                  v-model.number="c.service"
                  type="text"
                  inputmode="numeric"
                  class="cell-input"
                  :disabled="isCalculating"
                  @input="markModified"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="validationError" class="status-banner is-error">
      {{ validationError }}
    </div>

    <div v-if="isCalculating" class="status-banner is-info">
      {{ progressMsg || 'Solving VRPTW routes and time schedules...' }}
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
              <strong>{{ trip.distance }}</strong> · Return at:
              <strong>t={{ trip.depotReturnTime }}</strong>
            </span>
          </div>

          <div class="timeline-chips">
            <span class="t-chip is-depot">D (t=0)</span>
            <template v-for="stop in trip.timeline" :key="stop.id">
              <span class="t-arrow">→</span>
              <span class="t-chip">
                <strong>{{ stop.id }}</strong>
                [{{ stop.winStart }}..{{ stop.winEnd }}] · start
                <strong>t={{ stop.serviceStart }}</strong>
                <span v-if="stop.waitTime > 0" class="wait-note">(wait {{ stop.waitTime }})</span>
              </span>
            </template>
            <span class="t-arrow">→</span>
            <span class="t-chip is-depot">D (t={{ trip.depotReturnTime }})</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vrptw-draft {
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
  width: 48px;
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

.win-tag-bg {
  fill: var(--bg-tertiary);
  stroke: var(--border-strong);
  stroke-width: 1;
}

.win-tag-text {
  font-family: var(--font-mono);
  font-size: 8.5px;
  font-weight: 700;
  fill: var(--text-secondary);
  text-anchor: middle;
  pointer-events: none;
}

.clients-table-wrap {
  border-top: 1px solid var(--border-color);
  overflow-x: auto;
}

.clients-table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--font-mono);
  font-size: 0.76rem;
}

.clients-table th,
.clients-table td {
  padding: 5px 10px;
  border-bottom: 1px solid var(--border-color);
  text-align: center;
}

.clients-table th {
  background-color: var(--bg-tertiary);
  color: var(--text-secondary);
  font-weight: 700;
}

.clients-table tr:last-child td {
  border-bottom: none;
}

.col-id {
  font-weight: 700;
  color: var(--text-main);
}

.cell-input {
  width: 48px;
  padding: 2px 4px;
  border: 1px solid var(--border-color);
  background-color: var(--bg-secondary);
  font-family: var(--font-mono);
  font-size: 0.76rem;
  font-weight: 700;
  text-align: center;
  color: var(--text-main);
  outline: none;
}

.cell-input:focus {
  border-color: var(--accent-primary);
  background-color: var(--bg-editor);
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
  gap: 8px;
}

.trip-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
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

.timeline-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
  font-family: var(--font-mono);
  font-size: 0.74rem;
}

.t-chip {
  padding: 2px 6px;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-main);
}

.t-chip.is-depot {
  background-color: var(--bg-tertiary);
  border-color: var(--border-strong);
  font-weight: 700;
}

.t-arrow {
  color: var(--text-muted);
}

.wait-note {
  color: #fbbf24;
  font-weight: 600;
}
</style>

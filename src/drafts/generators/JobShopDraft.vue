<script setup>
import { ref, computed } from 'vue'
import { useDraftSolver } from '../useDraftSolver.js'
import { parseJobShopText, generateJobShopCode, decodeJobShopSolution } from './jobShopCodec.js'

const emit = defineEmits(['copy-code'])

const JOB_COLORS = Array.of(
  { bg: 'rgba(56, 189, 248, 0.2)', border: '#38bdf8', text: '#e0f2fe' },
  { bg: 'rgba(74, 222, 128, 0.2)', border: '#4ade80', text: '#dcfce7' },
  { bg: 'rgba(251, 191, 36, 0.2)', border: '#fbbf24', text: '#fef3c7' },
  { bg: 'rgba(192, 132, 252, 0.2)', border: '#c084fc', text: '#f3e8ff' },
  { bg: 'rgba(251, 113, 133, 0.2)', border: '#fb7185', text: '#ffe4e6' },
  { bg: 'rgba(45, 212, 191, 0.2)', border: '#2dd4bf', text: '#ccfbf1' }
)

const PRESETS = Array.of(
  {
    label: '3 Jobs × 3 Machines (Classic Example, optimal = 12)',
    scheduleText: [
      'j0: (m0 4) (m1 2) (m2 2)',
      'j1: (m0 2) (m2 1) (m1 5)',
      'j2: (m1 5) (m2 2)'
    ].join('\n')
  },
  {
    label: '4 Jobs × 3 Machines (Production Line, optimal = 13)',
    scheduleText: [
      'Job1: (M0 3) (M1 4) (M2 2)',
      'Job2: (M1 3) (M0 2) (M2 4)',
      'Job3: (M2 3) (M1 2) (M0 3)',
      'Job4: (M0 2) (M2 3) (M1 2)'
    ].join('\n')
  },
  {
    label: 'CI/CD Pipeline (Build → Test → Deploy, optimal = 12)',
    scheduleText: [
      'ServiceA: (Build 3) (Test 2) (Deploy 1)',
      'ServiceB: (Build 2) (Test 4) (Deploy 2)',
      'ServiceC: (Build 4) (Test 1) (Deploy 2)'
    ].join('\n')
  },
  {
    label: '6 Jobs × 6 Machines (36 Operations)',
    scheduleText: [
      'Job1: (M0 3) (M1 6) (M2 5) (M3 7) (M4 4) (M5 6)',
      'Job2: (M1 5) (M2 4) (M4 6) (M0 4) (M5 5) (M3 3)',
      'Job3: (M2 6) (M3 5) (M5 4) (M1 6) (M0 5) (M4 3)',
      'Job4: (M3 4) (M0 6) (M1 5) (M5 7) (M2 4) (M4 5)',
      'Job5: (M4 7) (M5 4) (M0 5) (M2 6) (M3 4) (M1 5)',
      'Job6: (M5 5) (M4 6) (M3 4) (M1 5) (M0 6) (M2 4)'
    ].join('\n')
  }
)

const scheduleInput = ref(PRESETS.at(0).scheduleText)
const validationError = ref('')

let lastJobsSnapshot = Array.of()
let lastMachinesSnapshot = Array.of()

const parsedPreview = computed(() => parseJobShopText(scheduleInput.value))

const totalOperationsCount = computed(() =>
  parsedPreview.value.jobs.reduce((sum, job) => sum + job.ops.length, 0)
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
  unsatMessage: 'UNSAT — No valid schedule found.',
  onDecode: (inputVarsResults) =>
    decodeJobShopSolution(lastJobsSnapshot, lastMachinesSnapshot, inputVarsResults)
})

const timeTicks = computed(() => {
  if (!solutionResult.value) return Array.of()
  const maxT = solutionResult.value.makespan
  return Array.from({ length: maxT + 1 }, (_, i) => i)
})

function getJobColor(jobIdx) {
  return JOB_COLORS[jobIdx % JOB_COLORS.length]
}

function clearState() {
  validationError.value = ''
  clearResult()
}

function applyPreset(preset) {
  scheduleInput.value = preset.scheduleText
  clearState()
}

function handleSolveJobShop() {
  clearState()

  const { jobs, machines, totalDuration, error } = parseJobShopText(scheduleInput.value)
  if (error) {
    validationError.value = error
    return
  }

  lastJobsSnapshot = jobs
  lastMachinesSnapshot = machines

  runGeneratedCode(generateJobShopCode(jobs, totalDuration))
}
</script>

<template>
  <div class="jobshop-draft">
    <p class="draft-description">
      Schedule sequences of operations across shared machines to minimize total completion time
      (<strong>Makespan</strong>). Format per line: <code>jobName: (machine duration) ...</code>
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
            ><strong>{{ parsedPreview.jobs.length }}</strong> jobs</span
          >
          <span class="sep">·</span>
          <span
            ><strong>{{ parsedPreview.machines.length }}</strong> machines</span
          >
          <span class="sep">·</span>
          <span
            ><strong>{{ totalOperationsCount }}</strong> operations</span
          >
        </div>

        <button v-if="isCalculating" type="button" class="solve-btn is-stop" @click="stop">
          Stop Solving
        </button>
        <button v-else type="button" class="solve-btn" @click="handleSolveJobShop">
          Optimize Schedule
        </button>
      </div>

      <textarea
        v-model="scheduleInput"
        class="schedule-textarea"
        rows="5"
        placeholder="j0: (m0 4) (m1 2) (m2 2)&#10;j1: (m0 2) (m2 1) (m1 5)"
        :disabled="isCalculating"
        spellcheck="false"
      ></textarea>
    </div>

    <div v-if="validationError" class="status-banner is-error">
      {{ validationError }}
    </div>

    <div v-if="isCalculating" class="status-banner is-info">
      {{ progressMsg || 'Searching for minimum makespan schedule...' }}
    </div>

    <div v-else-if="solveStatus && solveStatus !== 'SAT'" class="status-banner is-error">
      {{ solveStatus }}
    </div>

    <div v-if="solutionResult" class="result-card">
      <div class="result-header">
        <div class="result-headline">
          <span class="result-badge">OPTIMAL</span>
          <span class="result-main">
            Min Makespan: <strong>{{ solutionResult.makespan }}</strong> time units
          </span>
        </div>

        <span v-if="solveStats" class="solution-meta"> {{ solveStats.duration }} ms </span>
      </div>

      <!-- Gantt Chart -->
      <div class="gantt-wrapper">
        <div class="gantt-axis-row">
          <div class="gantt-machine-col">Machine</div>
          <div class="gantt-timeline-axis">
            <span
              v-for="t in timeTicks"
              :key="t"
              class="tick-mark"
              :style="{ left: `${(t / solutionResult.makespan) * 100}%` }"
            >
              {{ t }}
            </span>
          </div>
        </div>

        <div v-for="mRow in solutionResult.machines" :key="mRow.name" class="gantt-row">
          <div class="gantt-machine-col is-name">{{ mRow.name }}</div>
          <div class="gantt-track">
            <div
              v-for="t in timeTicks"
              :key="`grid-${t}`"
              class="grid-line"
              :style="{ left: `${(t / solutionResult.makespan) * 100}%` }"
            ></div>

            <div
              v-for="task in mRow.tasks"
              :key="task.id"
              class="gantt-bar"
              :title="`${task.jobName} (step ${task.stepNumber}): ${task.start} → ${task.end}`"
              :style="{
                left: `${(task.start / solutionResult.makespan) * 100}%`,
                width: `${(task.duration / solutionResult.makespan) * 100}%`,
                backgroundColor: getJobColor(task.jobIndex).bg,
                borderColor: getJobColor(task.jobIndex).border,
                color: getJobColor(task.jobIndex).text
              }"
            >
              <span class="bar-label">{{ task.jobName }}</span>
              <span class="bar-time">[{{ task.start }}..{{ task.end }}]</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.jobshop-draft {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.schedule-textarea {
  width: 100%;
  padding: 12px 14px;
  border: none;
  outline: none;
  resize: vertical;
  font-family: var(--font-mono);
  font-size: 0.85rem;
  line-height: 1.6;
  color: var(--text-main);
  background-color: var(--bg-editor);
  box-sizing: border-box;
}

.gantt-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 18px 12px 14px;
  background-color: var(--bg-editor);
  border: 1px solid var(--border-color);
  overflow-x: auto;
}

.gantt-axis-row,
.gantt-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 440px;
}

.gantt-machine-col {
  width: 72px;
  flex-shrink: 0;
  font-family: var(--font-mono);
  font-size: 0.74rem;
  font-weight: 700;
  color: var(--text-muted);
}

.gantt-machine-col.is-name {
  color: var(--text-main);
  font-size: 0.8rem;
}

.gantt-timeline-axis {
  position: relative;
  flex: 1;
  height: 18px;
}

.tick-mark {
  position: absolute;
  transform: translateX(-50%);
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--text-muted);
}

.gantt-track {
  position: relative;
  flex: 1;
  height: 36px;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
}

.grid-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background-color: var(--border-color);
  pointer-events: none;
}

.gantt-bar {
  position: absolute;
  top: 2px;
  bottom: 2px;
  border: 1.5px solid;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  line-height: 1.1;
  padding: 0 3px;
  overflow: hidden;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 700;
  box-sizing: border-box;
  white-space: nowrap;
}

.bar-time {
  font-weight: 500;
  font-size: 0.62rem;
  opacity: 0.9;
}
</style>

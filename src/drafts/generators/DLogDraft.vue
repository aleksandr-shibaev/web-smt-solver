<script setup>
import { ref } from 'vue'
import { useDraftSolver } from '../useDraftSolver.js'
import { generateDLogCode, decodeDLogSolution } from './dlogCodec.js'

const emit = defineEmits(['copy-code'])

const PRESETS = Array.of(
  { label: '5-bit Prime (3^x ≡ 13 mod 17)', a: '3', b: '13', m: '17', period: '16' },
  { label: '8-bit Prime (6^x ≡ 104 mod 251)', a: '6', b: '104', m: '251', period: '250' },
  { label: '10-bit Prime (2^x ≡ 1015 mod 1021)', a: '2', b: '1015', m: '1021', period: '340' }
)

const baseA = ref(PRESETS[0].a)
const targetB = ref(PRESETS[0].b)
const modulusM = ref(PRESETS[0].m)
const periodBound = ref(PRESETS[0].period)

const validationError = ref('')
let lastParamsSnapshot = null

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
  unsatMessage: 'UNSAT — No discrete logarithm x exists in [0, period).',
  onDecode: (inputVarsResults) => {
    const decoded = decodeDLogSolution(inputVarsResults, lastParamsSnapshot)
    if (!decoded) return null
    return {
      x: decoded.x,
      a: lastParamsSnapshot.a,
      b: lastParamsSnapshot.b,
      m: lastParamsSnapshot.m,
      period: lastParamsSnapshot.period
    }
  }
})

function clearState() {
  validationError.value = ''
  clearResult()
}

function applyPreset(preset) {
  baseA.value = preset.a
  targetB.value = preset.b
  modulusM.value = preset.m
  periodBound.value = preset.period
  clearState()
}

function parseBigIntField(raw, label) {
  const trimmed = String(raw ?? '').trim()
  if (!/^-?\d+$/.test(trimmed)) {
    throw new Error(`Invalid integer for "${label}".`)
  }
  return BigInt(trimmed)
}

function handleSolveDLog() {
  clearState()

  let aBig
  let bBig
  let mBig
  let periodBig

  try {
    aBig = parseBigIntField(baseA.value, 'a (base)')
    bBig = parseBigIntField(targetB.value, 'b (target)')
    mBig = parseBigIntField(modulusM.value, 'm (modulus)')

    if (mBig < 2n) {
      throw new Error('Modulus m must be >= 2.')
    }

    const rawPeriodTrimmed = String(periodBound.value ?? '').trim()
    if (rawPeriodTrimmed === '') {
      periodBig = mBig - 1n
      periodBound.value = periodBig.toString()
    } else {
      periodBig = parseBigIntField(rawPeriodTrimmed, 'period')
      if (periodBig < 1n) {
        throw new Error('Period must be >= 1.')
      }
    }
  } catch (err) {
    validationError.value = err.message
    return
  }

  const normalizedA = ((aBig % mBig) + mBig) % mBig
  const normalizedB = ((bBig % mBig) + mBig) % mBig

  lastParamsSnapshot = {
    a: normalizedA.toString(),
    b: normalizedB.toString(),
    m: mBig.toString(),
    period: periodBig.toString()
  }

  runGeneratedCode(generateDLogCode(normalizedA, normalizedB, mBig, periodBig))
}
</script>

<template>
  <div class="dlog-draft">
    <p class="draft-description">
      Solve the discrete logarithm problem <strong>a<sup>x</sup> ≡ b (mod m)</strong> by encoding
      binary modular exponentiation over the bits of <code>x</code> in <code>[0, period)</code>.
    </p>

    <div class="complexity-note">
      <strong>Note on Solver Hardness:</strong> Discrete logarithm is a classic one-way function —
      repeated modular multiplications widen interval bounds quickly and require heavy branching, so
      moduli above 10–12 bits can take significant time.
    </div>

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

    <div class="equation-card">
      <div class="inputs-grid">
        <label class="param-field">
          <span class="param-label">a (Base)</span>
          <input
            v-model="baseA"
            type="text"
            inputmode="numeric"
            class="param-input"
            :disabled="isCalculating"
          />
        </label>

        <label class="param-field">
          <span class="param-label">b (Target)</span>
          <input
            v-model="targetB"
            type="text"
            inputmode="numeric"
            class="param-input"
            :disabled="isCalculating"
          />
        </label>

        <label class="param-field">
          <span class="param-label">m (Modulus)</span>
          <input
            v-model="modulusM"
            type="text"
            inputmode="numeric"
            class="param-input"
            :disabled="isCalculating"
          />
        </label>

        <label class="param-field">
          <span class="param-label">period (Order bound)</span>
          <input
            v-model="periodBound"
            type="text"
            inputmode="numeric"
            class="param-input"
            placeholder="m - 1"
            :disabled="isCalculating"
          />
        </label>
      </div>

      <div class="card-footer">
        <div class="formula-preview">
          <code
            >{{ baseA || 'a' }}^x ≡ {{ targetB || 'b' }} (mod {{ modulusM || 'm' }}), 0 ≤ x &lt;
            {{ periodBound || 'm - 1' }}</code
          >
        </div>

        <button v-if="isCalculating" type="button" class="solve-btn is-stop" @click="stop">
          Stop Solving
        </button>
        <button v-else type="button" class="solve-btn" @click="handleSolveDLog">Find x</button>
      </div>
    </div>

    <div v-if="validationError" class="status-banner is-error">
      {{ validationError }}
    </div>

    <div v-if="isCalculating" class="status-banner is-info">
      {{ progressMsg || 'Compiling modular exponentiation constraints and solving...' }}
    </div>

    <div v-else-if="solveStatus && solveStatus !== 'SAT'" class="status-banner is-error">
      {{ solveStatus }}
    </div>

    <div v-if="solutionResult" class="result-card">
      <div class="result-header">
        <div class="result-headline">
          <span class="result-badge">SAT</span>
          <span class="result-x"
            >x = <strong>{{ solutionResult.x }}</strong></span
          >
        </div>

        <span v-if="solveStats" class="solution-meta"> {{ solveStats.duration }} ms </span>
      </div>

      <div class="result-equation">
        <code
          >{{ solutionResult.a }}^{{ solutionResult.x }} ≡ {{ solutionResult.b }} (mod
          {{ solutionResult.m }})</code
        >
      </div>
    </div>
  </div>
</template>

<style scoped>
.dlog-draft {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.complexity-note {
  padding: 10px 13px;
  font-size: 0.83rem;
  line-height: 1.55;
  color: var(--text-secondary);
  background-color: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-left: 3px solid #fbbf24;
}

.complexity-note strong {
  color: #fbbf24;
}

.equation-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color);
  background-color: var(--bg-editor);
}

.inputs-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  padding: 14px;
}

.param-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.param-label {
  font-family: var(--font-mono);
  font-size: 0.74rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.param-input {
  width: 100%;
  padding: 6px 9px;
  font-family: var(--font-mono);
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--text-main);
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  box-sizing: border-box;
  outline: none;
  transition: border-color 0.15s ease;
}

.param-input:focus {
  border-color: var(--accent-primary);
  background-color: var(--bg-editor);
}

.card-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 14px;
  background-color: var(--bg-tertiary);
  border-top: 1px solid var(--border-color);
}

.formula-preview {
  font-family: var(--font-mono);
  font-size: 0.82rem;
  color: var(--text-main);
}

.result-equation {
  font-family: var(--font-mono);
  font-size: 0.82rem;
  color: var(--text-secondary);
}

@media (max-width: 720px) {
  .inputs-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 480px) {
  .inputs-grid {
    grid-template-columns: 1fr;
  }
}
</style>

import { ref } from 'vue'
import { useSolver } from '../composables/useSolver.js'

function extractStats(payload) {
  const stats = payload?.sat3Stats || payload?.details?.sat3Stats || {}
  const varsRaw = stats.vars ?? stats.varsNumber ?? stats.varsCount ?? 0
  const clausesRaw = stats.clauses ?? stats.clausesNumber ?? stats.clausesCount ?? 0

  return {
    duration: payload?._timing?.duration ?? 0,
    vars: Array.isArray(varsRaw) ? varsRaw.length : varsRaw,
    clauses: Array.isArray(clausesRaw) ? clausesRaw.length : clausesRaw
  }
}

export function useDraftSolver({
  emit,
  onDecode,
  unsatMessage = 'UNSAT — No valid solution exists.'
}) {
  const solution = ref(null)
  const status = ref('')
  const stats = ref(null)
  const isOutdated = ref(false)

  const { isCalculating, progressMsg, solve, stop } = useSolver({
    onFinish: (payload) => {
      if (payload.isCrashError) {
        status.value = payload.message || 'Solver error'
        solution.value = null
        isOutdated.value = false
        return
      }

      stats.value = extractStats(payload)

      if (payload.isSat === false || !payload.inputVarsResults) {
        status.value = unsatMessage
        solution.value = null
        isOutdated.value = false
        return
      }

      const decoded = onDecode(payload.inputVarsResults, payload)
      if (!decoded) {
        status.value = 'Failed to decode solver variables.'
        solution.value = null
        isOutdated.value = false
        return
      }

      status.value = 'SAT'
      solution.value = decoded
      isOutdated.value = false
    }
  })

  function clearResult() {
    solution.value = null
    status.value = ''
    stats.value = null
    isOutdated.value = false
  }

  function markOutdated() {
    if (solution.value) {
      isOutdated.value = true
    }
  }

  function runGeneratedCode(generatedCode, solverType = '') {
    clearResult()
    emit?.('copy-code', generatedCode)
    solve(generatedCode, { solverType })
  }

  return {
    isCalculating,
    progressMsg,
    solution,
    status,
    stats,
    isOutdated,
    clearResult,
    markOutdated,
    runGeneratedCode,
    stop
  }
}

/**
 * Parses Job Shop text specification into structured jobs & operations.
 * Format per line:
 *   j0: (m0 4) (m1 2) (m2 2)
 * Also accepts commas or "=":
 *   Job1: (M0, 4), (M1, 2)
 *
 * @param {string} rawText
 * @returns {{ jobs: Array<{ id: string, name: string, ops: Array<{ machine: string, duration: number }> }>, machines: string[], totalDuration: number, error?: string }}
 */
export function parseJobShopText(rawText) {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/(\/\/|#).*$/, '').trim())
    .filter(Boolean)

  if (lines.length === 0) {
    return { jobs: [], machines: [], totalDuration: 0, error: 'Enter at least one job.' }
  }

  const jobs = []
  const machineSet = new Set()
  const usedJobIds = new Set()
  let totalDuration = 0

  for (let idx = 0; idx < lines.length; idx++) {
    const lineNum = idx + 1
    const colonIdx = lines[idx].indexOf(':')
    if (colonIdx === -1) {
      return {
        jobs: [],
        machines: [],
        totalDuration: 0,
        error: `Line ${lineNum}: expected "jobName: (machine duration) ...", missing ":".`
      }
    }

    const rawJobName = lines[idx].slice(0, colonIdx).trim()
    const rest = lines[idx].slice(colonIdx + 1).trim()

    if (!rawJobName) {
      return {
        jobs: [],
        machines: [],
        totalDuration: 0,
        error: `Line ${lineNum}: job name before ":" cannot be empty.`
      }
    }

    const safeJobId = rawJobName.replace(/[^a-zA-Z0-9_]/g, '_') || `j${idx}`
    if (usedJobIds.has(safeJobId)) {
      return {
        jobs: [],
        machines: [],
        totalDuration: 0,
        error: `Line ${lineNum}: duplicate job name "${rawJobName}".`
      }
    }
    usedJobIds.add(safeJobId)

    const opMatches = Array.from(rest.matchAll(/\(\s*([a-zA-Z0-9_-]+)\s*[,:\s]\s*(\d+)\s*\)/g))
    if (opMatches.length === 0) {
      return {
        jobs: [],
        machines: [],
        totalDuration: 0,
        error: `Line ${lineNum}: no valid "(machine duration)" operations found.`
      }
    }

    const ops = []
    for (const m of opMatches) {
      const machine = m.at(1)
      const dur = Number(m.at(2))
      if (!Number.isInteger(dur) || dur <= 0) {
        return {
          jobs: [],
          machines: [],
          totalDuration: 0,
          error: `Line ${lineNum}: duration for "${machine}" must be a positive integer.`
        }
      }
      machineSet.add(machine)
      totalDuration += dur
      ops.push({ machine, duration: dur })
    }

    jobs.push({
      id: safeJobId,
      name: rawJobName,
      ops
    })
  }

  const machines = Array.from(machineSet).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  )

  return {
    jobs,
    machines,
    totalDuration
  }
}

/**
 * Generates .eproto code for Job Shop Scheduling (minimizing Makespan k).
 *
 * @param {Array<{ id: string, name: string, ops: Array<{ machine: string, duration: number }> }>} jobs
 * @param {number} totalDuration
 * @returns {string}
 */
export function generateJobShopCode(jobs, totalDuration) {
  const bound = Math.max(1, Math.floor(Number(totalDuration) || 1))
  const intSize = Math.max(2, bound.toString(2).length)

  let code = `// Job Shop Scheduling (${jobs.length} jobs, upper bound = ${bound})\n\n`
  code += `size + ${intSize} 0\n`
  code += `binarySearch min k 0 ${bound}\n\n`

  // Makespan constraints: k = max(job_end)
  const endFlags = []
  jobs.forEach((job, jIdx) => {
    const bVar = `b${jIdx + 1}`
    endFlags.push(bVar)
    code += `k >= ${job.id}_end; ${bVar} ? k = ${job.id}_end\n`
  })
  code += `\n${endFlags.join(' || ')}\n\n`

  // Intra-job operation sequence constraints
  const byMachine = {}

  for (const job of jobs) {
    job.ops.forEach((op, tIdx) => {
      const prefix = `${job.id}_t${tIdx}`
      const isLast = tIdx === job.ops.length - 1
      const nextStep = isLast
        ? `${job.id}_end = ${prefix}_end`
        : `${job.id}_t${tIdx + 1}_start >= ${prefix}_end`

      code += `${prefix}_start + ${op.duration} = ${prefix}_end; ${nextStep}\n`

      if (!byMachine[op.machine]) {
        byMachine[op.machine] = []
      }
      byMachine[op.machine].push({
        varPrefix: prefix,
        jobId: job.id,
        jobName: job.name,
        opIndex: tIdx,
        duration: op.duration
      })
    })
    code += '\n'
  }

  // Mutual exclusion on each machine
  for (const [machine, tasks] of Object.entries(byMachine)) {
    if (tasks.length < 2) continue
    code += `// Machine ${machine}: ${tasks.map((t) => t.varPrefix).join(', ')}\n`
    for (let i = 0; i < tasks.length; i++) {
      for (let j = i + 1; j < tasks.length; j++) {
        const a = tasks[i].varPrefix
        const b = tasks[j].varPrefix
        const orderVar = `${a}_before_${b}`
        code += `${orderVar} == ${a}_end <= ${b}_start\n`
        code += `!${orderVar} == ${a}_start >= ${b}_end\n`
      }
    }
    code += '\n'
  }

  return code
}

/**
 * Decodes solver output variables into a machine-grouped Gantt schedule.
 */
export function decodeJobShopSolution(jobs, machines, inputVarsResults) {
  if (!inputVarsResults || inputVarsResults === false) {
    return null
  }

  const makespan = Number(inputVarsResults.k ?? 0)
  if (!Number.isFinite(makespan) || makespan <= 0) {
    return null
  }

  const machineRows = Object.fromEntries(machines.map((m) => [m, []]))

  jobs.forEach((job, jIdx) => {
    job.ops.forEach((op, tIdx) => {
      const prefix = `${job.id}_t${tIdx}`
      const start = Number(inputVarsResults[`${prefix}_start`] ?? 0)
      const end = Number(inputVarsResults[`${prefix}_end`] ?? start + op.duration)

      machineRows[op.machine].push({
        id: prefix,
        jobIndex: jIdx,
        jobId: job.id,
        jobName: job.name,
        stepNumber: tIdx + 1,
        machine: op.machine,
        start,
        end,
        duration: op.duration
      })
    })
  })

  for (const m of machines) {
    machineRows[m].sort((a, b) => a.start - b.start)
  }

  return {
    makespan,
    machines: machines.map((m) => ({
      name: m,
      tasks: machineRows[m]
    }))
  }
}

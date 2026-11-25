import { WORKER_EVENTS } from './workerEvents.js'

let EquationSolverClass = null

function resolveBundleUrl(baseUrl) {
  const origin = baseUrl ? new URL(baseUrl).origin : self.location.origin
  const appBase = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '')
  return `${origin}${appBase}/libs/mainBundle.min.js`
}

self.addEventListener('message', async (e) => {
  const { code, baseUrl } = e.data || {}

  try {
    if (!EquationSolverClass) {
      const bundleUrl = resolveBundleUrl(baseUrl)
      const module = await import(/* @vite-ignore */ bundleUrl)
      EquationSolverClass = module.EquationSolver || module.default
    }

    const solver = new EquationSolverClass()

    solver.addOnProgress((msg) => {
      postMessage({
        type: WORKER_EVENTS.PROGRESS,
        payload: msg
      })
    })

    const readyResult = solver.solve(code)

    postMessage({
      type: WORKER_EVENTS.SUCCESS,
      payload: readyResult
    })
  } catch (err) {
    postMessage({
      type: WORKER_EVENTS.FAILURE,
      payload: err
    })
  }
})

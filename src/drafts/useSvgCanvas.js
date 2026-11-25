import { ref } from 'vue'

/**
 * Shared composable for interactive SVG graph/map canvases:
 * handles coordinate scaling, click-to-add, and smooth pointer dragging.
 */
export function useSvgCanvas({
  width = 560,
  height = 320,
  padding = 24,
  isLocked = () => false,
  onCanvasClick = null,
  onNodeMove = null
} = {}) {
  const svgRef = ref(null)
  const draggingTarget = ref(null)
  const didDragMove = ref(false)

  function getSvgPoint(event) {
    const svg = svgRef.value
    if (!svg) return { x: 0, y: 0 }

    const rect = svg.getBoundingClientRect()
    const scaleX = width / rect.width
    const scaleY = height / rect.height

    return {
      x: Math.round(
        Math.max(padding, Math.min(width - padding, (event.clientX - rect.left) * scaleX))
      ),
      y: Math.round(
        Math.max(padding, Math.min(height - padding, (event.clientY - rect.top) * scaleY))
      )
    }
  }

  function startDrag(target) {
    if (isLocked()) return
    draggingTarget.value = target
    didDragMove.value = false
  }

  function handlePointerMove(event) {
    if (draggingTarget.value === null) return
    didDragMove.value = true
    const pt = getSvgPoint(event)
    onNodeMove?.(draggingTarget.value, pt)
  }

  function stopDrag() {
    draggingTarget.value = null
  }

  function handleSvgClick(event) {
    if (isLocked() || didDragMove.value) {
      didDragMove.value = false
      return
    }
    if (event.target !== svgRef.value) return
    onCanvasClick?.(getSvgPoint(event))
  }

  return {
    svgRef,
    draggingTarget,
    getSvgPoint,
    startDrag,
    handlePointerMove,
    stopDrag,
    handleSvgClick
  }
}

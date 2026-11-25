<script setup>
import { ref, computed, nextTick } from 'vue'
import ContentView from './views/ContentView.vue'
import CodeEditor from './components/CodeEditor.vue'
import SolverResults from './components/SolverResults.vue'
import { useSplitPane } from './composables/useSplitPane.js'
import { useAppRouting } from './composables/useAppRouting.js'
import { APP_PAGES, DEFAULT_SOURCE_CODE, EXTERNAL_DOCS } from './config/appConfig.js'

const isEditorHidden = computed(() => currentTabId.value === 'smt-lib-solver')

const { currentTabId, currentSectionId, currentChunks, handleTabChange, handleSectionChange } =
  useAppRouting()

const sourceCode = ref(DEFAULT_SOURCE_CODE)
const solverData = ref(null)

const resultsRef = ref(null)
const editorPaneRef = ref(null)

const {
  containerRef: workspaceRef,
  leftWidthPercent,
  isResizing,
  startResize,
  resetSplit
} = useSplitPane({ initialPercent: 60, minPercent: 20, maxPercent: 80 })

function handleSolvingStart() {
  resultsRef.value?.setExpanded(false)
}

async function handleSolverResult(result) {
  solverData.value = result
  await nextTick()

  setTimeout(() => {
    const targetEl =
      resultsRef.value?.$el?.nodeType === 1
        ? resultsRef.value.$el
        : document.getElementById('results')

    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, 120)
}

function handleCopyCode(newCode) {
  sourceCode.value = newCode
  solverData.value = null
  if (editorPaneRef.value) {
    editorPaneRef.value.scrollTo({ top: 0, behavior: 'smooth' })
  }
}
</script>

<template>
  <div class="app-shell">
    <!-- Top Bar -->
    <header class="topbar">
      <div class="topbar-left">
        <span class="brand-badge">SMT</span>
        <span class="brand-title">E0 Equation Language</span>
        <span class="brand-version">v0.2</span>
        <span class="brand-disclaimer">
          Educational playground &middot; Provided &ldquo;as is&rdquo; under
          <a
            :href="EXTERNAL_DOCS.license.url"
            target="_blank"
            rel="noopener noreferrer"
            class="disclaimer-link"
          >
            {{ EXTERNAL_DOCS.license.title }}
          </a>
        </span>
      </div>

      <div class="topbar-right">
        <a
          :href="EXTERNAL_DOCS.source.url"
          target="_blank"
          rel="noopener noreferrer"
          class="top-link"
        >
          {{ EXTERNAL_DOCS.source.title }}
        </a>
        <a
          :href="EXTERNAL_DOCS.docs.url"
          target="_blank"
          rel="noopener noreferrer"
          class="top-link"
        >
          {{ EXTERNAL_DOCS.docs.title }}
        </a>
      </div>
    </header>

    <!-- Main Split-Screen Workspace -->
    <div
      ref="workspaceRef"
      :class="['split-workspace', { 'is-single-pane': isEditorHidden }]"
      :style="!isEditorHidden ? { '--left-pane-width': `${leftWidthPercent}%` } : undefined"
    >
      <!-- Left Pane: Navigation + Documentation / DIMACS Solver -->
      <div class="pane-docs">
        <ContentView
          :active-tab="currentTabId"
          :active-section="currentSectionId"
          :tabs="APP_PAGES"
          :chunks="currentChunks"
          @update:active-tab="handleTabChange"
          @update:active-section="handleSectionChange"
          @copy-code="handleCopyCode"
        />
      </div>

      <!-- Draggable Divider -->
      <div
        v-if="!isEditorHidden"
        :class="['split-resizer', { 'is-active': isResizing }]"
        title="Drag to resize (double-click to reset 60/40)"
        @mousedown.prevent="startResize"
        @dblclick="resetSplit"
      >
        <div class="resizer-handle" aria-hidden="true">
          <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
            <circle cx="3" cy="3" r="1.1" />
            <circle cx="7" cy="3" r="1.1" />
            <circle cx="3" cy="7" r="1.1" />
            <circle cx="7" cy="7" r="1.1" />
            <circle cx="3" cy="11" r="1.1" />
            <circle cx="7" cy="11" r="1.1" />
          </svg>
        </div>
      </div>

      <!-- Right Pane: Editor + Solver Results -->
      <div v-if="!isEditorHidden" ref="editorPaneRef" class="pane-editor">
        <CodeEditor
          v-model:code="sourceCode"
          file-name=""
          @solving="handleSolvingStart"
          @solved="handleSolverResult"
        />

        <SolverResults v-if="solverData" ref="resultsRef" :data="solverData" />
      </div>
    </div>
  </div>
</template>
<style scoped>
.app-shell {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.topbar {
  height: var(--topbar-height);
  background-color: var(--bg-toolbar);
  border-bottom: 1px solid var(--border-color);
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.brand-badge {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--accent-primary);
  background-color: var(--accent-soft);
  border: 1px solid rgba(56, 189, 248, 0.35);
  padding: 2px 7px;
  letter-spacing: 0.04em;
  flex-shrink: 0;
}

.brand-title {
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--text-main);
  white-space: nowrap;
}

.brand-version {
  font-family: var(--font-mono);
  font-size: 0.78rem;
  color: var(--text-muted);
  background-color: var(--bg-secondary);
  padding: 1px 6px;
  border: 1px solid var(--border-color);
  flex-shrink: 0;
}

.brand-disclaimer {
  font-size: 0.76rem;
  color: var(--text-muted);
  padding-left: 10px;
  border-left: 1px solid var(--border-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.disclaimer-link {
  color: var(--text-secondary);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.disclaimer-link:hover {
  color: var(--accent-primary);
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.top-link {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--text-secondary);
  text-decoration: none;
  padding: 5px 12px;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  transition: all 0.15s ease;
}

.top-link:hover {
  color: var(--text-main);
  border-color: var(--accent-primary);
  background-color: var(--bg-tertiary);
}

.split-workspace {
  flex: 1;
  display: grid;
  grid-template-columns: var(--left-pane-width, 60%) 1px minmax(0, 1fr);
  min-height: 0;
}

.pane-docs {
  display: flex;
  background-color: var(--bg-secondary);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.split-resizer {
  width: 1px;
  background-color: var(--border-color);
  cursor: col-resize;
  position: relative;
  transition: background-color 0.15s ease;
  z-index: 20;
}

.split-resizer::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: -4px;
  right: -4px;
}

.split-resizer:hover,
.split-resizer.is-active {
  background-color: var(--accent-primary);
}

.resizer-handle {
  position: absolute;
  top: calc(var(--subbar-height) / 2);
  left: 50%;
  transform: translate(-50%, -50%);
  width: 14px;
  height: 24px;
  border-radius: 3px;
  background-color: var(--bg-editor);
  border: 1px solid var(--border-color);
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
  transition: all 0.15s ease;
}

.split-resizer:hover .resizer-handle,
.split-resizer.is-active .resizer-handle {
  border-color: var(--accent-primary);
  color: var(--text-main);
  background-color: var(--bg-tertiary);
}

.pane-editor {
  display: flex;
  flex-direction: column;
  background-color: var(--bg-editor);
  overflow-y: auto;
  scrollbar-gutter: stable;
  min-width: 0;
  min-height: 0;
}

@media (max-width: 1100px) {
  .brand-disclaimer {
    display: none;
  }
}

@media (max-width: 960px) {
  .app-shell {
    height: auto;
    overflow: auto;
  }
  .split-workspace {
    grid-template-columns: 1fr;
  }
  .split-resizer {
    display: none;
  }
  .pane-docs {
    border-bottom: 1px solid var(--border-strong);
  }
}

.split-workspace.is-single-pane {
  grid-template-columns: 1fr;
}
</style>

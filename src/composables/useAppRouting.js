import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { APP_PAGES, PAGE_CONTENT_MAP, DEFAULT_PAGE_ID } from '../config/appConfig.js'

const BASE_PATH = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '')

function parseLocationRoute() {
  let pathname = window.location.pathname
  if (BASE_PATH && pathname.startsWith(BASE_PATH)) {
    pathname = pathname.slice(BASE_PATH.length)
  }
  const segments = pathname.split('/').filter(Boolean)
  const rawTab = segments.at(0)
  const rawSection = segments.at(1)

  const validTab = APP_PAGES.some((t) => t.id === rawTab) ? rawTab : DEFAULT_PAGE_ID
  const chunks = PAGE_CONTENT_MAP[validTab] || []
  const validSection = chunks.some((c) => c.id === rawSection) ? rawSection : chunks.at(0)?.id || ''

  return { tabId: validTab, sectionId: validSection }
}

function buildRoutePath(tabId, sectionId) {
  const chunks = PAGE_CONTENT_MAP[tabId] || []
  const isSinglePage = chunks.length === 1 && Boolean(chunks.at(0)?.component)
  const prefix = BASE_PATH || ''

  if (tabId === DEFAULT_PAGE_ID && sectionId === chunks.at(0)?.id) {
    return `${prefix}/`
  }
  if (isSinglePage || !sectionId) {
    return `${prefix}/${tabId}`
  }
  return `${prefix}/${tabId}/${sectionId}`
}

function updateDocumentMeta(tabId, sectionId) {
  const tabObj = APP_PAGES.find((t) => t.id === tabId)
  const chunks = PAGE_CONTENT_MAP[tabId] || []
  const sectionObj = chunks.find((c) => c.id === sectionId) || chunks.at(0)

  const sectionTitle = sectionObj?.title || ''
  const tabTitle = tabObj?.title || 'Documentation'
  document.title = sectionTitle
    ? `${sectionTitle} — ${tabTitle} | E0 Equation Language`
    : `${tabTitle} | E0 Equation Language`
}

export function useAppRouting() {
  const initialRoute = parseLocationRoute()
  const currentTabId = ref(initialRoute.tabId)
  const currentSectionId = ref(initialRoute.sectionId)

  const currentChunks = computed(() => PAGE_CONTENT_MAP[currentTabId.value] || [])

  function syncBrowserUrl(tabId, sectionId, replace = false) {
    const targetPath = buildRoutePath(tabId, sectionId)
    updateDocumentMeta(tabId, sectionId)

    if (window.location.pathname !== targetPath) {
      if (replace) {
        window.history.replaceState({ tabId, sectionId }, '', targetPath)
      } else {
        window.history.pushState({ tabId, sectionId }, '', targetPath)
      }
    }
  }

  function handleTabChange(newTabId) {
    currentTabId.value = newTabId
    const chunks = PAGE_CONTENT_MAP[newTabId] || []
    const nextSectionId = chunks.at(0)?.id || ''
    currentSectionId.value = nextSectionId
    syncBrowserUrl(newTabId, nextSectionId, false)
  }

  function handleSectionChange(newSectionId) {
    currentSectionId.value = newSectionId
    syncBrowserUrl(currentTabId.value, newSectionId, false)
  }

  function handlePopState() {
    const route = parseLocationRoute()
    currentTabId.value = route.tabId
    currentSectionId.value = route.sectionId
    updateDocumentMeta(route.tabId, route.sectionId)
  }

  watch(
    [currentTabId, currentSectionId],
    ([tab, sec]) => {
      updateDocumentMeta(tab, sec)
    },
    { immediate: true }
  )

  onMounted(() => {
    syncBrowserUrl(currentTabId.value, currentSectionId.value, true)
    window.addEventListener('popstate', handlePopState)
  })

  onUnmounted(() => {
    window.removeEventListener('popstate', handlePopState)
  })

  return {
    currentTabId,
    currentSectionId,
    currentChunks,
    handleTabChange,
    handleSectionChange
  }
}

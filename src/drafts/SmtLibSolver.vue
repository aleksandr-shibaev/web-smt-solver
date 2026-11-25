<template>
  <div class="smtlib-placeholder">
    <div class="placeholder-card">
      <div class="placeholder-header">
        <span class="status-pill">NOT IMPLEMENTED YET</span>
        <span class="spec-tag">SMT-LIB v2 · QF_NIA / QF_BV</span>
      </div>

      <h2 class="placeholder-title">SMT-LIB Solver</h2>

      <p class="placeholder-text">NOT IMPLEMENTED YET</p>
    </div>
  </div>
</template>

<style scoped>
.smtlib-placeholder {
  display: flex;
  flex-direction: column;
  max-width: 760px;
}

.placeholder-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px 22px;
  background-color: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-left: 3px solid #fbbf24;
}

.placeholder-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.status-pill {
  font-family: var(--font-mono);
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #fbbf24;
  background-color: rgba(251, 191, 36, 0.14);
  border: 1px solid rgba(251, 191, 36, 0.4);
  padding: 3px 9px;
}

.spec-tag {
  font-family: var(--font-mono);
  font-size: 0.76rem;
  color: var(--text-muted);
}

.placeholder-title {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--text-main);
}

.placeholder-text {
  margin: 0;
  font-size: 0.94rem;
  line-height: 1.65;
  color: var(--text-secondary);
}

.placeholder-text strong {
  color: var(--text-main);
}

.preview-snippet {
  margin-top: 4px;
  border: 1px solid var(--border-color);
  background-color: var(--bg-editor);
}

.snippet-header {
  padding: 6px 12px;
  font-family: var(--font-mono);
  font-size: 0.74rem;
  font-weight: 600;
  color: var(--text-muted);
  background-color: var(--bg-main);
  border-bottom: 1px solid var(--border-color);
}

.preview-snippet pre {
  margin: 0;
  padding: 12px 14px;
  overflow-x: auto;
}

.preview-snippet code {
  font-family: var(--font-mono);
  font-size: 0.84rem;
  line-height: 1.55;
  color: var(--text-secondary);
}
</style>

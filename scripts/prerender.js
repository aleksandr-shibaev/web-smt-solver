import fs from 'node:fs'
import path from 'node:path'
import { createServer } from 'vite'

const SITE_ORIGIN = 'https://aleksandr-shibaev.github.io/web-smt-solver'
const DIST_DIR = path.resolve('dist')

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function stripTagsToSummary(html, fallback) {
  const clean = String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!clean) return fallback
  return clean.length > 160 ? `${clean.slice(0, 157)}...` : clean
}

function renderRouteHtml(templateHtml, route, canonicalUrl) {
  const pageTitle = `${route.title} — ${route.tabTitle} | E0 Equation Language`
  const fallbackDesc = `${route.title} (${route.tabTitle}) — Interactive interval-arithmetic and SMT equation solver playground in your browser.`
  const description = stripTagsToSummary(route.rawHtml, fallbackDesc)

  let pageHtml = templateHtml.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeHtml(pageTitle)}</title>`
  )

  const seoTags = [
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`,
    `<meta property="og:title" content="${escapeHtml(pageTitle)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`
  ].join('\n    ')

  pageHtml = pageHtml.replace('</head>', `    ${seoTags}\n  </head>`)

  if (route.rawHtml) {
    const noscriptContent = `<noscript><main><h1>${escapeHtml(route.title)}</h1>${route.rawHtml}</main></noscript>`
    pageHtml = pageHtml.replace('</body>', `  ${noscriptContent}\n  </body>`)
  }

  return pageHtml
}

async function runPrerender() {
  const baseHtmlPath = path.join(DIST_DIR, 'index.html')
  if (!fs.existsSync(baseHtmlPath)) {
    throw new Error('dist/index.html not found. Run vite build first.')
  }

  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom'
  })

  try {
    const { APP_PAGES, PAGE_CONTENT_MAP } = await vite.ssrLoadModule('/src/config/appConfig.js')
    const templateHtml = fs.readFileSync(baseHtmlPath, 'utf-8')
    const allRoutes = []

    for (const tab of APP_PAGES) {
      const chunks = PAGE_CONTENT_MAP[tab.id] || []
      const isSingleTool = chunks.length === 1 && Boolean(chunks[0]?.component)

      if (isSingleTool) {
        allRoutes.push({
          routePath: tab.id,
          tabTitle: tab.title,
          title: chunks[0].title || tab.title,
          rawHtml:
            tab.id === 'smt-lib-solver'
              ? '<p>Planned SMT-LIB v2 solver frontend for E0 Equation Language supporting quantifier-free integer and bit-vector constraints directly in your browser.</p>'
              : ''
        })
        continue
      }

      for (const chunk of chunks) {
        allRoutes.push({
          routePath: `${tab.id}/${chunk.id}`,
          tabTitle: tab.title,
          title: chunk.title,
          rawHtml: chunk.contentHtml || ''
        })
      }
    }

    const sitemapUrls = [`${SITE_ORIGIN}/`]

    for (const route of allRoutes) {
      const canonicalUrl = `${SITE_ORIGIN}/${route.routePath}`
      const pageHtml = renderRouteHtml(templateHtml, route, canonicalUrl)

      const outDir = path.join(DIST_DIR, ...route.routePath.split('/'))
      fs.mkdirSync(outDir, { recursive: true })
      fs.writeFileSync(path.join(outDir, 'index.html'), pageHtml, 'utf-8')

      sitemapUrls.push(canonicalUrl)
    }

    fs.writeFileSync(path.join(DIST_DIR, '404.html'), templateHtml, 'utf-8')

    const homeRoute = allRoutes.find((r) => r.routePath === 'doc/intro') || allRoutes[0]
    if (homeRoute) {
      const rootHtml = renderRouteHtml(templateHtml, homeRoute, `${SITE_ORIGIN}/`)
      fs.writeFileSync(baseHtmlPath, rootHtml, 'utf-8')
    }

    const today = new Date().toISOString().split('T')[0]
    const sitemapXml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://sitemaps.org">',
      ...sitemapUrls.map(
        (url) =>
          `  <url>\n    <loc>${escapeHtml(url)}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`
      ),
      '</urlset>'
    ].join('\n')
    fs.writeFileSync(path.join(DIST_DIR, 'sitemap.xml'), sitemapXml, 'utf-8')

    const robotsTxt = `User-agent: *\nAllow: /\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`
    fs.writeFileSync(path.join(DIST_DIR, 'robots.txt'), robotsTxt, 'utf-8')

    console.log(
      `Prerendered root index.html + ${allRoutes.length} static routes + sitemap.xml + robots.txt`
    )
  } finally {
    await vite.close()
  }
}

runPrerender()

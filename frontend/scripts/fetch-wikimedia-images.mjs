import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import ts from 'typescript'

const tmpDir = resolve('scripts/.tmp-image-data')
const outputPath = resolve('src/data/wikimediaHeritageImages.ts')
const execFileAsync = promisify(execFile)
const apiDelayMs = 1400
let lastRequestAt = 0

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms))

async function transpileDataModule(sourcePath, outputName) {
  const source = await readFile(sourcePath, 'utf8')
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
  }).outputText
    .replaceAll("from './building3dAssets'", "from './building3dAssets.mjs'")
    .replaceAll("from './nationalSeed'", "from './nationalSeed.mjs'")
    .replaceAll("from './heritageImages'", "from './heritageImages.mjs'")
    .replaceAll("from './wikimediaHeritageImages'", "from './wikimediaHeritageImages.mjs'")
    .replaceAll("from '../types/building'", "from './types.mjs'")
  await writeFile(resolve(tmpDir, outputName), transpiled)
}

async function loadBuildings() {
  await rm(tmpDir, { recursive: true, force: true })
  await mkdir(tmpDir, { recursive: true })
  await writeFile(resolve(tmpDir, 'types.mjs'), 'export {}\n')
  await transpileDataModule('src/data/heritageImages.ts', 'heritageImages.mjs')
  await transpileDataModule('src/data/wikimediaHeritageImages.ts', 'wikimediaHeritageImages.mjs')
  await transpileDataModule('src/data/building3dAssets.ts', 'building3dAssets.mjs')
  await transpileDataModule('src/data/nationalSeed.ts', 'nationalSeed.mjs')
  await transpileDataModule('src/data/buildings.ts', 'buildings.mjs')
  const module = await import(pathToFileURL(resolve(tmpDir, 'buildings.mjs')).href + `?t=${Date.now()}`)
  const imageModule = await import(pathToFileURL(resolve(tmpDir, 'wikimediaHeritageImages.mjs')).href + `?t=${Date.now()}`)
  return {
    buildings: module.buildings,
    existingImages: imageModule.wikimediaHeritageImages ?? {},
  }
}

async function getJson(url) {
  const elapsed = Date.now() - lastRequestAt
  if (elapsed < apiDelayMs) await sleep(apiDelayMs - elapsed)

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      lastRequestAt = Date.now()
      const script = [
        "$ProgressPreference = 'SilentlyContinue'",
        "$headers = @{ 'User-Agent' = 'ARCHIVA demo image curation script (local development)' }",
        `(Invoke-WebRequest -Uri ${JSON.stringify(url)} -Headers $headers -UseBasicParsing -TimeoutSec 30).Content`,
      ].join('; ')
      const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', script], {
        maxBuffer: 20 * 1024 * 1024,
      })
      return JSON.parse(stdout)
    } catch (error) {
      if (!String(error.message).includes('too many requests') || attempt === 3) throw error
      await sleep(12_000 * (attempt + 1))
    }
  }
}

function stripHtml(value) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .trim()
}

async function wikidataSearch(term) {
  const url = new URL('https://www.wikidata.org/w/api.php')
  url.search = new URLSearchParams({
    action: 'wbsearchentities',
    format: 'json',
    language: 'zh',
    uselang: 'zh',
    limit: '8',
    search: term,
    origin: '*',
  }).toString()
  return (await getJson(url)).search ?? []
}

async function entityImage(entityId) {
  const url = new URL('https://www.wikidata.org/wiki/Special:EntityData/' + entityId + '.json')
  const entity = (await getJson(url)).entities?.[entityId]
  return entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value
}

async function commonsMetadata(filename) {
  const url = new URL('https://commons.wikimedia.org/w/api.php')
  url.search = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    prop: 'imageinfo',
    iiprop: 'extmetadata',
    titles: `File:${filename}`,
  }).toString()
  const pages = (await getJson(url)).query?.pages ?? {}
  const page = Object.values(pages)[0]
  return page?.imageinfo?.[0]?.extmetadata ?? {}
}

async function commonsSearchImage(term) {
  const url = new URL('https://commons.wikimedia.org/w/api.php')
  url.search = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrsearch: term,
    gsrnamespace: '6',
    gsrlimit: '8',
    prop: 'imageinfo',
    iiprop: 'extmetadata',
  }).toString()
  const pages = Object.values((await getJson(url)).query?.pages ?? {})
  const page = pages
    .sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
    .find((candidate) => /\.(jpe?g|png|webp)$/i.test(candidate.title ?? ''))
  if (!page?.title || !page?.imageinfo?.[0]) return undefined
  const filename = page.title.replace(/^File:/, '')
  const metadata = page.imageinfo[0].extmetadata ?? {}
  const artist = stripHtml(metadata.Artist?.value)
  const license = stripHtml(metadata.LicenseShortName?.value || metadata.UsageTerms?.value || '以 Wikimedia Commons 原页面为准')
  return {
    filename,
    entityId: undefined,
    entityLabel: page.title,
    src: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=800`,
    sourceUrl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(filename.replaceAll(' ', '_'))}`,
    credit: artist ? `${artist} / Wikimedia Commons` : 'Wikimedia Commons',
    license,
  }
}

async function findImage(building) {
  const terms = [
    building.name,
    `${building.name} ${building.location.split(' · ')[0]}`,
    building.pinyin?.split('·')[0]?.trim(),
  ].filter(Boolean)
  for (const term of terms) {
    const hits = await wikidataSearch(term)
    for (const hit of hits) {
      const filename = await entityImage(hit.id)
      if (!filename) continue
      const metadata = await commonsMetadata(filename)
      const artist = stripHtml(metadata.Artist?.value)
      const license = stripHtml(metadata.LicenseShortName?.value || metadata.UsageTerms?.value || '以 Wikimedia Commons 原页面为准')
      return {
        filename,
        entityId: hit.id,
        entityLabel: hit.label,
        src: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=800`,
        sourceUrl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(filename.replaceAll(' ', '_'))}`,
        credit: artist ? `${artist} / Wikimedia Commons` : 'Wikidata P18 / Wikimedia Commons',
        license,
      }
    }
  }
  for (const term of terms) {
    const image = await commonsSearchImage(term)
    if (image) return image
  }
  return undefined
}

function tsString(value) {
  return JSON.stringify(value).replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029')
}

function imageEntry(id, image) {
  return `  ${tsString(id)}: {
    src: ${tsString(image.src)},
    alt: ${tsString(image.alt)},
    credit: ${tsString(image.credit)},
    license: ${tsString(image.license)},
    sourceUrl: ${tsString(image.sourceUrl)},
    position: ${tsString(image.position ?? '50% 50%')},
    kind: ${tsString(image.kind ?? 'photo')},
  },`
}

function compactError(error) {
  const message = String(error.message ?? error)
  if (message.includes('too many requests')) return 'rate-limited'
  return message.split('\n')[0]
}

const { buildings, existingImages } = await loadBuildings()
const missing = buildings.filter((building) => !building.image)
const entries = []
const unresolved = []

for (const building of missing) {
  try {
    const image = await findImage(building)
    if (!image) {
      unresolved.push({ id: building.id, name: building.name })
      continue
    }
    entries.push({ building, image })
    console.log(`✓ ${building.id} <- ${image.filename}`)
  } catch (error) {
    unresolved.push({ id: building.id, name: building.name, error: compactError(error) })
    console.warn(`! ${building.id}: ${error.message}`)
  }
}

const imageMap = new Map(Object.entries(existingImages))
for (const { building, image } of entries) {
  imageMap.set(building.id, {
    src: image.src,
    alt: `${building.name}真实建筑影像`,
    credit: image.credit,
    license: image.license,
    sourceUrl: image.sourceUrl,
    position: '50% 50%',
    kind: 'photo',
  })
}

const body = Array.from(imageMap.entries()).map(([id, image]) => imageEntry(id, image)).join('\n')

await writeFile(outputPath, `import type { BuildingImage } from '../types/building'\n\n// Curated from Wikidata P18 images and Wikimedia Commons metadata.\n// Regenerate with: npm run fetch:wikimedia-images\nexport const wikimediaHeritageImages: Record<string, BuildingImage> = {\n${body}\n}\n\nexport const unresolvedWikimediaImages = ${JSON.stringify(unresolved, null, 2)} as const\n`)
await rm(tmpDir, { recursive: true, force: true })

console.log(JSON.stringify({
  missing: missing.length,
  resolved: entries.length,
  unresolved,
}, null, 2))

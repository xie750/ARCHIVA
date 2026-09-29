import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import ts from 'typescript'

const tmpDir = resolve('scripts/.tmp-data-audit')

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
  return module.buildings
}

const buildings = await loadBuildings()
const buildingPending = buildings.filter((building) => building.model.provider === 'pending' || building.model.assetStatus === 'pending')
const pointPending = buildings.flatMap((building) => (building.scenic?.points ?? []).map((point) => ({ building: building.id, ...point })))
  .filter((point) => point.provider === 'pending' || point.assetStatus === 'pending')
const localAssets = buildings.filter((building) => building.model.provider === 'local-glb')
const externalAssets = buildings.filter((building) => building.model.provider === 'sketchfab')

console.log(JSON.stringify({
  totalBuildings: buildings.length,
  localBuildings: localAssets.length,
  externalBuildings: externalAssets.length,
  pendingBuildings: buildingPending.length,
  pendingScenicPoints: pointPending.length,
  pendingBuildingIds: buildingPending.map((building) => building.id),
  pendingPointIds: pointPending.map((point) => `${point.building}/${point.id}`),
}, null, 2))

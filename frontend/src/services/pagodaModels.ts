import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** Architectural studies, not survey-derived scans. Each identity owns its geometry. */
type PagodaId = 'kaifeng-iron-pagoda' | 'yingxian-wooden-pagoda' | 'xian-big-wild-goose-pagoda'
type Point = [number, number, number]
const OCTAGON = Math.PI / 4

function material(name: string, color: string, roughness = 0.8, metalness = 0.02) {
  const value = new THREE.MeshStandardMaterial({ color, roughness, metalness })
  value.name = name
  return value
}

function mesh(group: THREE.Group, geometry: THREE.BufferGeometry, surface: THREE.Material, position: Point = [0, 0, 0], rotation: Point = [0, 0, 0]) {
  const value = new THREE.Mesh(geometry, surface)
  value.position.set(...position)
  value.rotation.set(...rotation)
  value.castShadow = true
  value.receiveShadow = true
  group.add(value)
  return value
}

function box(group: THREE.Group, size: Point, position: Point, surface: THREE.Material, rotation: Point = [0, 0, 0]) {
  return mesh(group, new THREE.BoxGeometry(...size), surface, position, rotation)
}

function octagon(group: THREE.Group, bottomRadius: number, topRadius: number, height: number, y: number, surface: THREE.Material) {
  return mesh(group, new THREE.CylinderGeometry(topRadius, bottomRadius, height, 8), surface, [0, y + height / 2, 0], [0, Math.PI / 8, 0])
}

function beam(group: THREE.Group, start: Point, end: Point, radius: number, surface: THREE.Material, sides = 6) {
  const a = new THREE.Vector3(...start)
  const b = new THREE.Vector3(...end)
  const direction = b.clone().sub(a)
  const value = mesh(group, new THREE.CylinderGeometry(radius, radius, direction.length(), sides), surface)
  value.position.copy(a.add(b).multiplyScalar(0.5))
  value.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
}

function perimeter(radius: number, y: number, index: number): Point {
  const angle = Math.PI / 8 + index * OCTAGON
  return [Math.sin(angle) * radius, y, Math.cos(angle) * radius]
}

function story(parent: THREE.Group, index: number) {
  const group = new THREE.Group()
  group.name = `floor-${String(index).padStart(2, '0')}`
  group.userData = { floor: index, isArchitecturalStorey: true }
  parent.add(group)
  return group
}

/** A curved octagonal roof profile, including the turned-up outer eave. */
function roof(group: THREE.Group, radius: number, y: number, height: number, surface: THREE.Material, ridge: THREE.Material, ribRadius = 0.016) {
  const profile = [[0.10, 1], [0.35, 0.75], [0.66, 0.28], [0.92, 0.02], [1, 0.12], [1, 0.065], [0.91, -0.04]] as const
  const positions: number[] = []
  const indices: number[] = []
  for (const [r, h] of profile) for (let corner = 0; corner < 8; corner += 1) positions.push(...perimeter(radius * r, y + h * height, corner))
  for (let ring = 0; ring < profile.length - 1; ring += 1) for (let corner = 0; corner < 8; corner += 1) {
    const a = ring * 8 + corner
    const b = ring * 8 + (corner + 1) % 8
    const c = a + 8
    const d = b + 8
    indices.push(a, c, b, b, c, d)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  mesh(group, geometry, surface)
  // Eight hip ridges make the octagonal construction legible from above.
  for (let corner = 0; corner < 8; corner += 1) {
    for (let ring = 0; ring < 4; ring += 1) {
      const a = profile[ring]!
      const b = profile[ring + 1]!
      beam(group, perimeter(radius * a[0], y + a[1] * height + 0.012, corner), perimeter(radius * b[0], y + b[1] * height + 0.012, corner), ribRadius, ridge)
    }
    beam(group, perimeter(radius, y + height * 0.11, corner), perimeter(radius, y + height * 0.11, (corner + 1) % 8), ribRadius * 1.25, ridge)
  }
}

function spire(group: THREE.Group, y: number, height: number, surface: THREE.Material) {
  octagon(group, height * 0.17, height * 0.12, height * 0.15, y, surface)
  mesh(group, new THREE.CylinderGeometry(height * 0.025, height * 0.09, height * 0.8, 12), surface, [0, y + height * 0.55, 0])
  for (let ring = 0; ring < 5; ring += 1) {
    const radius = height * (0.12 - ring * 0.014)
    mesh(group, new THREE.TorusGeometry(radius, height * 0.014, 6, 16), surface, [0, y + height * (0.25 + ring * 0.10), 0], [Math.PI / 2, 0, 0])
  }
  mesh(group, new THREE.SphereGeometry(height * 0.042, 10, 8), surface, [0, y + height * 0.98, 0])
}

function archShape(width: number, height: number, bottom = 0) {
  const shape = new THREE.Shape()
  const half = width / 2
  const spring = bottom + height - half
  shape.moveTo(-half, bottom)
  shape.lineTo(half, bottom)
  shape.lineTo(half, spring)
  shape.absarc(0, spring, half, 0, Math.PI, false)
  shape.lineTo(-half, bottom)
  return shape
}

function kaifeng() {
  const root = new THREE.Group()
  const glazed = material('iron-pagoda-glazed-brown', '#71432b', 0.36, 0.10)
  const glazedLight = material('iron-pagoda-glazed-relief', '#ac764a', 0.43, 0.06)
  const eave = material('iron-pagoda-ochre-eaves', '#886038', 0.48, 0.07)
  const recess = material('iron-pagoda-opening-shadow', '#201b17', 0.95)
  const stone = material('iron-pagoda-stone-plinth', '#9b907b')
  const finial = material('iron-pagoda-copper-finial', '#8c7948', 0.55, 0.35)
  octagon(root, 0.96, 0.96, 0.15, 0, stone)
  octagon(root, 0.87, 0.84, 0.14, 0.15, eave)
  let y = 0.29
  for (let level = 0; level < 13; level += 1) {
    const floor = story(root, level + 1)
    const radius = 0.74 - level * 0.023
    const h = level === 0 ? 0.76 : 0.44
    octagon(floor, radius, radius * 0.983, h, y, level % 3 === 1 ? glazedLight : glazed)
    octagon(floor, radius + 0.045, radius + 0.045, 0.055, y + 0.025, eave)
    for (let side = 0; side < 8; side += 1) {
      const angle = side * OCTAGON
      const apothem = radius * Math.cos(Math.PI / 8)
      const opening = new THREE.ExtrudeGeometry(archShape(radius * 0.26, h * 0.62), { depth: 0.012, bevelEnabled: false, curveSegments: 6 })
      mesh(floor, opening, recess, [Math.sin(angle) * (apothem + 0.008), y + 0.07, Math.cos(angle) * (apothem + 0.008)], [0, angle, 0])
      const corner = perimeter(radius, y, side)
      box(floor, [0.043, h * 0.88, 0.043], [corner[0], y + h * 0.5, corner[2]], glazedLight, [0, angle + Math.PI / 8, 0])
      // Small corbel blocks and inset relief panels, cast in glazed masonry.
      for (const offset of [-0.23, 0.23]) {
        const x = Math.sin(angle) * (apothem + 0.025) + Math.cos(angle) * radius * offset
        const z = Math.cos(angle) * (apothem + 0.025) - Math.sin(angle) * radius * offset
        box(floor, [radius * 0.17, h * 0.31, 0.023], [x, y + h * 0.45, z], glazedLight, [0, angle, 0])
        box(floor, [0.10, 0.055, 0.10], [x, y + h - 0.075, z], eave, [0, angle, 0])
      }
    }
    octagon(floor, radius + 0.07, radius + 0.10, 0.065, y + h - 0.055, eave)
    roof(floor, radius + 0.17, y + h - 0.015, 0.19, glazed, eave, 0.009)
    y += h + 0.095
  }
  spire(root, y + 0.11, 0.68, finial)
  root.userData = { buildingId: 'kaifeng-iron-pagoda', identity: '开封铁塔', storyCount: 13, plan: 'octagonal', structure: 'glazed-brick', architecturalFeatures: ['十三层', '八角密集出檐', '褐色琉璃砖', '细高塔身'] }
  return root
}

function yingxian() {
  const root = new THREE.Group()
  const wood = material('yingxian-timber-columns', '#74452d', 0.88)
  const bracket = material('yingxian-dougong-timber', '#a1764e', 0.87)
  const wall = material('yingxian-earth-plaster', '#ae8b60', 0.96)
  const dark = material('yingxian-open-colonnade-shadow', '#2b241f', 0.98)
  const tile = material('yingxian-dark-grey-roof-tiles', '#393b36', 0.85)
  const ridge = material('yingxian-roof-ridge', '#686858', 0.89)
  const stone = material('yingxian-stone-terrace', '#a6a08e', 0.96)
  const finial = material('yingxian-weathered-metal-spire', '#716744', 0.65, 0.25)
  octagon(root, 2.34, 2.34, 0.16, 0, stone)
  octagon(root, 2.18, 2.18, 0.18, 0.16, stone)
  let y = 0.34
  const heights = [1.66, 1.25, 1.20, 1.14, 1.04]
  for (let level = 0; level < 5; level += 1) {
    const floor = story(root, level + 1)
    const h = heights[level]!
    const radius = 1.77 - level * 0.13
    const outerRadius = radius + 0.33
    octagon(floor, radius * 0.79, radius * 0.79, h - 0.06, y, level === 0 ? wall : dark)
    octagon(floor, outerRadius, outerRadius, 0.10, y, wood)
    octagon(floor, outerRadius + 0.045, outerRadius + 0.045, 0.055, y + 0.09, bracket)
    for (let corner = 0; corner < 8; corner += 1) {
      const a = perimeter(radius + 0.12, y + 0.10, corner)
      const b = perimeter(radius + 0.12, y + 0.10, (corner + 1) % 8)
      const midway: Point = [(a[0] + b[0]) / 2, a[1], (a[2] + b[2]) / 2]
      for (const p of [a, midway]) {
        beam(floor, p, [p[0], y + h - 0.10, p[2]], level === 0 ? 0.065 : 0.05, wood, 8)
        const angle = Math.atan2(p[0], p[2])
        // Three stacked arms project in alternating directions below the roof.
        for (let tier = 0; tier < 3; tier += 1) {
          const spread = 0.19 + tier * 0.11
          box(floor, [spread, 0.055, 0.12], [p[0], y + h - 0.29 + tier * 0.072, p[2]], bracket, [0, angle, 0])
          box(floor, [0.075, 0.065, spread * 0.90], [p[0], y + h - 0.26 + tier * 0.072, p[2]], wood, [0, angle, 0])
        }
      }
      beam(floor, [a[0], y + h - 0.20, a[2]], [b[0], y + h - 0.20, b[2]], 0.05, wood)
      const railA = perimeter(outerRadius, y + 0.12, corner)
      const railB = perimeter(outerRadius, y + 0.12, (corner + 1) % 8)
      if (level > 0) {
        for (const railY of [y + 0.21, y + 0.45]) beam(floor, [railA[0], railY, railA[2]], [railB[0], railY, railB[2]], 0.022, bracket)
        for (let post = 0; post < 5; post += 1) {
          const ratio = post / 4
          const x = THREE.MathUtils.lerp(railA[0], railB[0], ratio)
          const z = THREE.MathUtils.lerp(railA[2], railB[2], ratio)
          beam(floor, [x, y + 0.13, z], [x, y + 0.47, z], 0.017, wood)
        }
      }
      // Light infill is recessed behind the exposed perimeter frame.
      const angle = corner * OCTAGON
      const panelRadius = radius * 0.74
      box(floor, [radius * 0.48, h * 0.40, 0.035], [Math.sin(angle) * panelRadius, y + h * 0.47, Math.cos(angle) * panelRadius], wall, [0, angle, 0])
    }
    const roofY = y + h - 0.18
    roof(floor, outerRadius + 0.35, roofY, level === 4 ? 0.67 : 0.47, tile, ridge)
    // The broad first storey has a second, lower eave: six roof tiers, five storeys.
    if (level === 0) roof(floor, outerRadius + 0.44, y + 0.76, 0.44, tile, ridge)
    y += h + 0.18
  }
  spire(root, y + 0.29, 0.77, finial)
  root.userData = { buildingId: 'yingxian-wooden-pagoda', identity: '应县木塔', storyCount: 5, eaveTierCount: 6, plan: 'octagonal', structure: 'timber', architecturalFeatures: ['五层明层', '首层重檐', '外檐柱廊', '斗拱与平座栏杆'] }
  return root
}

/** A tapered masonry wall with an actual arched void through its thickness. */
function masonryWall(bottomWidth: number, topWidth: number, h: number, thickness: number, openingWidth: number, openingHeight: number) {
  const shape = new THREE.Shape()
  shape.moveTo(-bottomWidth / 2, 0)
  shape.lineTo(bottomWidth / 2, 0)
  shape.lineTo(topWidth / 2, h)
  shape.lineTo(-topWidth / 2, h)
  shape.closePath()
  shape.holes.push(archShape(openingWidth, openingHeight, h * 0.13))
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 10 })
  const positions = geometry.getAttribute('position')
  const inset = (bottomWidth - topWidth) / 2
  for (let i = 0; i < positions.count; i += 1) positions.setZ(i, bottomWidth / 2 - inset * positions.getY(i) / h - positions.getZ(i))
  // Reversing the extrusion's Z axis changes its handedness.
  const index = geometry.getIndex()
  if (index) {
    for (let i = 0; i < index.count; i += 3) { const b = index.getX(i + 1); index.setX(i + 1, index.getX(i + 2)); index.setX(i + 2, b) }
  } else {
    for (const attribute of Object.values(geometry.attributes)) {
      const attr = attribute as THREE.BufferAttribute
      for (let i = 0; i < attr.count; i += 3) for (let component = 0; component < attr.itemSize; component += 1) {
        const a = (i + 1) * attr.itemSize + component
        const b = (i + 2) * attr.itemSize + component
        const value = attr.array[a]!
        attr.array[a] = attr.array[b]!
        attr.array[b] = value
      }
    }
  }
  geometry.computeVertexNormals()
  return geometry
}

function dayan() {
  const root = new THREE.Group()
  const brick = material('dayan-ochre-masonry', '#ae8b62', 0.98)
  const brickLight = material('dayan-sunlit-brick', '#b99971', 0.97)
  const cornice = material('dayan-projecting-brick-cornice', '#8f7250', 0.94)
  const mortar = material('dayan-mortar-courses', '#967d5e', 1)
  const interior = material('dayan-inner-masonry', '#51483b', 1)
  const base = material('dayan-stone-base', '#a99b81', 0.95)
  box(root, [4.16, 0.18, 4.16], [0, 0.09, 0], base)
  box(root, [3.96, 0.13, 3.96], [0, 0.245, 0], cornice)
  let y = 0.31
  const heights = [1.33, 1.15, 1.09, 1.02, 0.95, 0.88, 0.78]
  for (let level = 0; level < 7; level += 1) {
    const floor = story(root, level + 1)
    const width = 3.80 - level * 0.295
    const topWidth = width - 0.13
    const h = heights[level]!
    const openingWidth = level === 0 ? 0.55 : 0.42 - level * 0.012
    const openingHeight = h * 0.68
    floor.userData.openingCount = 4
    for (let side = 0; side < 4; side += 1) {
      const angle = side * Math.PI / 2
      mesh(floor, masonryWall(width, topWidth, h, 0.22, openingWidth, openingHeight), side % 2 ? brickLight : brick, [0, y, 0], [0, angle, 0])
      // Brick courses follow the taper, leaving the arched void unobstructed.
      const courseCount = Math.round(h / 0.095)
      for (let course = 1; course < courseCount; course += 1) {
        const localY = h * course / courseCount
        const sideWidth = THREE.MathUtils.lerp(width, topWidth, localY / h)
        const sill = h * 0.13
        const spring = sill + openingHeight - openingWidth / 2
        let gap = 0
        if (localY > sill && localY < sill + openingHeight) gap = localY <= spring ? openingWidth / 2 + 0.018 : Math.sqrt(Math.max(0, (openingWidth / 2) ** 2 - (localY - spring) ** 2)) + 0.018
        const segment = sideWidth / 2 - gap
        for (const sign of [-1, 1]) {
          const x = sign * (sideWidth / 4 + gap / 2)
          const z = sideWidth / 2 + 0.004
          box(floor, [segment, 0.008, 0.008], [x * Math.cos(angle) + z * Math.sin(angle), y + localY, z * Math.cos(angle) - x * Math.sin(angle)], mortar, [0, angle, 0])
        }
      }
      const openingSill = y + h * 0.13
      const springY = openingSill + openingHeight - openingWidth / 2
      const frontAtSpring = THREE.MathUtils.lerp(width, topWidth, (springY - y) / h) / 2 + 0.008
      const arch = new THREE.TorusGeometry(openingWidth / 2 + 0.035, 0.034, 4, 14, Math.PI)
      mesh(floor, arch, cornice, [Math.sin(angle) * frontAtSpring, springY, Math.cos(angle) * frontAtSpring], [0, angle, 0])
    }
    // Recessed floors provide depth and shadow when looking into the four openings.
    box(floor, [width - 0.40, 0.045, width - 0.40], [0, y + 0.055, 0], interior)
    box(floor, [topWidth + 0.07, 0.07, topWidth + 0.07], [0, y + h + 0.035, 0], cornice)
    box(floor, [topWidth + 0.15, 0.065, topWidth + 0.15], [0, y + h + 0.095, 0], brickLight)
    y += h + 0.13
  }
  // A low square masonry cap preserves the tower's flat, stepped skyline.
  box(root, [1.92, 0.12, 1.92], [0, y + 0.035, 0], cornice)
  box(root, [1.76, 0.16, 1.76], [0, y + 0.16, 0], brick)
  box(root, [1.55, 0.10, 1.55], [0, y + 0.29, 0], brickLight)
  root.userData = { buildingId: 'xian-big-wild-goose-pagoda', identity: '大雁塔', storyCount: 7, openingCount: 28, plan: 'square', structure: 'brick', architecturalFeatures: ['七层方形塔身', '逐层收分', '四面券门', '砖砌叠涩檐口'] }
  return root
}

/** Merge by storey and material so rich timber details do not cost hundreds of draw calls. */
function compact(group: THREE.Group) {
  for (const child of [...group.children]) if (child instanceof THREE.Group) compact(child)
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>()
  for (const child of [...group.children]) {
    if (!(child instanceof THREE.Mesh) || Array.isArray(child.material)) continue
    child.updateMatrix()
    const geometry = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone()
    geometry.applyMatrix4(child.matrix)
    for (const name of Object.keys(geometry.attributes)) if (name !== 'position' && name !== 'normal') geometry.deleteAttribute(name)
    if (!geometry.getAttribute('normal')) geometry.computeVertexNormals()
    const batch = batches.get(child.material) ?? []
    batch.push(geometry)
    batches.set(child.material, batch)
    child.geometry.dispose()
    group.remove(child)
  }
  for (const [surface, parts] of batches) {
    const geometry = mergeGeometries(parts, false)
    parts.forEach((part) => part.dispose())
    if (!geometry) throw new Error(`Cannot merge pagoda geometry: ${surface.name}`)
    const value = mesh(group, geometry, surface)
    value.name = `${group.name || 'base'}-${surface.name}`
  }
}

/** Unknown buildings deliberately have no substitute tower. Height is normalized to 9 units. */
export function createPagodaModel(id: string): THREE.Group | undefined {
  const constructors: Record<PagodaId, () => THREE.Group> = {
    'kaifeng-iron-pagoda': kaifeng,
    'yingxian-wooden-pagoda': yingxian,
    'xian-big-wild-goose-pagoda': dayan,
  }
  if (!Object.prototype.hasOwnProperty.call(constructors, id)) return undefined
  const root = constructors[id as PagodaId]()
  root.name = id
  compact(root)
  root.updateMatrixWorld(true)
  const bounds = new THREE.Box3().setFromObject(root)
  const height = bounds.max.y - bounds.min.y
  const scale = 9 / height
  root.scale.setScalar(scale)
  root.position.y = -bounds.min.y * scale
  root.userData.representation = 'architectural-study'
  root.userData.normalizedHeight = 9
  root.updateMatrixWorld(true)
  return root
}

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ArrowRight, MousePointer2, SkipForward } from 'lucide-vue-next'

const emit = defineEmits<{
  complete: []
}>()

const stage = ref(0)
const isFinishing = ref(false)
let stageTimer: number | undefined
let handleKeydown: ((event: KeyboardEvent) => void) | undefined

const stages = [
  { index: '01', label: '观测', copy: '读取全国建筑样本', signal: 'MAP / INGEST' },
  { index: '02', label: '定位', copy: '建立建筑空间索引', signal: 'ARCHIVE / LOCATE' },
  { index: '03', label: '入场', copy: '图谱已展开，点击进入', signal: 'SPACE / READY' },
]

const currentStage = computed(() => stages[stage.value])
const isReady = computed(() => stage.value === stages.length - 1)

function finish() {
  if (!isReady.value || isFinishing.value) return
  isFinishing.value = true
  window.setTimeout(() => emit('complete'), 520)
}

function skip() {
  if (isFinishing.value) return
  isFinishing.value = true
  window.setTimeout(() => emit('complete'), 180)
}

onMounted(() => {
  document.documentElement.classList.add('intro-lock')
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) stage.value = stages.length - 1
  handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') skip()
  }
  window.addEventListener('keydown', handleKeydown)
  stageTimer = window.setInterval(() => {
    if (stage.value < stages.length - 1) {
      stage.value += 1
    } else {
      // Once the gate is ready, keep the rings and particles alive while waiting.
      stage.value = stages.length - 1
    }
  }, 1900)
})

onBeforeUnmount(() => {
  if (stageTimer) window.clearInterval(stageTimer)
  if (handleKeydown) window.removeEventListener('keydown', handleKeydown)
  document.documentElement.classList.remove('intro-lock')
})
</script>

<template>
  <Transition name="intro-exit">
    <section v-if="!isFinishing" class="intro-experience" role="dialog" aria-modal="true" aria-label="进入中国建筑数字志">
      <div class="intro-grain" aria-hidden="true" />
      <div class="intro-grid" aria-hidden="true" />

      <header class="intro-header">
        <div class="intro-brand">
          <span class="intro-brand-mark"><i /><i /><i /></span>
          <span><strong>中国建筑数字志</strong><small>NATIONAL ARCHITECTURE ATLAS</small></span>
        </div>
        <button class="intro-skip" type="button" @click="skip">
          跳过前奏 <SkipForward :size="14" />
        </button>
      </header>

      <div class="intro-main">
        <div class="intro-stage-count" aria-live="polite">
          <span>{{ currentStage.index }}</span><i /><small>{{ currentStage.label }}</small><b>{{ currentStage.signal }}</b>
        </div>

        <div class="intro-coordinate" aria-hidden="true">
          <span>35° N — 18° N</span><span>124° E — 97° E</span><span>NATIONWIDE / 001</span>
        </div>

        <div class="intro-layout">
          <div class="intro-copy">
            <span class="intro-kicker">NATIONAL ARCHIVE / 全国总览</span>
            <h1>从全国图谱<br /><em>进入建筑。</em></h1>
            <p class="intro-copy-lead">跨越地域与年代，<br />把中国建筑读成一张可以游览的图谱。</p>
            <div class="intro-copy-rule" />
            <p class="intro-status"><span class="status-dot" />{{ currentStage.copy }}<span class="typing-cursor" aria-hidden="true" /></p>
            <button class="intro-enter" :class="{ ready: isReady }" type="button" :disabled="!isReady" :aria-label="isReady ? '进入建筑图谱' : '建筑空间索引准备中'" @click="finish">
              <span class="intro-enter-icon"><MousePointer2 :size="16" /></span>
              <span><small>{{ isReady ? 'NEXT / 开始浏览' : 'SYSTEM / 读取中' }}</small><strong>{{ isReady ? '进入全国图谱' : '空间索引中' }}</strong></span>
              <ArrowRight :size="18" />
            </button>
          </div>

          <div class="intro-plate" :class="`is-stage-${stage}`" aria-hidden="true">
            <div class="plate-topline"><span>全国建筑谱系</span><span>FIG. 01 / NATION</span></div>
            <div class="plate-grid" />
            <div class="plate-map-lines" />
            <div class="plate-scan" />
            <div class="building-drawing">
              <span class="building-halo" />
              <svg viewBox="0 0 300 360" role="presentation">
                <path class="draw-line draw-fine" d="M150 183L58 86M150 183L88 53M150 183L149 35M150 183L218 56M150 183L244 92M150 183L255 184M150 183L225 281M150 183L183 318M150 183L83 285M150 183L45 194" />
                <path class="draw-line draw-main" d="M150 91c-35 0-63 28-63 63 0 25 15 45 35 55l10 52h36l10-52c20-10 35-30 35-55 0-35-28-63-63-63Z" />
                <path class="draw-line draw-roof" d="M119 153l31-31 31 31M128 143h44M135 133h30M142 123h16" />
                <path class="draw-line draw-ghost" d="M102 184h96M110 201h80M126 219h48M139 237h22" />
                <path class="draw-accent" d="M64 304h172M104 272h92M123 256h54" />
                <circle class="atlas-node node-north" cx="150" cy="35" r="5" /><circle class="atlas-node node-west" cx="58" cy="86" r="5" /><circle class="atlas-node node-east" cx="244" cy="92" r="5" /><circle class="atlas-node node-south" cx="183" cy="318" r="5" /><circle class="atlas-node node-center" cx="150" cy="183" r="9" />
                <path class="atlas-cross" d="M150 168v30M135 183h30" />
              </svg>
              <span class="scan-point point-a" /><span class="scan-point point-b" /><span class="scan-point point-c" />
            </div>
            <div class="plate-caption"><span>全国建筑谱系</span><small>34 省级入口 · 多类型样本</small></div>
            <div class="plate-seal">图<br /><small>ATLAS</small></div>
            <div class="plate-coordinates"><span>35° N — 18° N</span><span>124° E — 97° E</span><span>CHINA / NATIONWIDE</span></div>
          </div>

          <aside class="intro-record">
            <div class="record-heading"><span>NATIONAL RECORD</span><i>LIVE</i></div>
            <div class="record-index">CN·ATLAS</div>
            <h2>全国建筑图谱</h2>
            <p>跨地域、多年代的建筑样本库</p>
            <dl><div><dt>范围</dt><dd>全国 · 34 省级入口</dd></div><div><dt>类型</dt><dd>古塔 · 城门 · 石窟…</dd></div><div><dt>跨度</dt><dd>先秦 — 近现代</dd></div></dl>
            <div class="record-footer"><span><i class="record-dot" />持续接入样本</span><span>24+ / NATION</span></div>
          </aside>
        </div>
      </div>

      <footer class="intro-footer">
        <div class="intro-timeline" aria-label="前奏进度">
          <div v-for="(item, index) in stages" :key="item.index" class="intro-timeline-item" :class="{ active: index <= stage, current: index === stage }">
            <span>{{ item.index }}</span><i /><strong>{{ item.label }}</strong>
          </div>
        </div>
        <span class="intro-hint">{{ isReady ? '点击中心按钮继续' : '请稍候，正在展开全国图谱' }}</span>
      </footer>
    </section>
  </Transition>
</template>

<style scoped>
.intro-experience {
  --intro-ink: #eef4ef;
  --intro-muted: rgba(207, 224, 218, .62);
  --intro-jade: #7cc8bb;
  --intro-gold: #d3a66c;
  position: fixed;
  inset: 0;
  z-index: 100;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  color: var(--intro-ink);
  background: #081b24;
  isolation: isolate;
}
.intro-experience::before {
  content: '';
  position: absolute;
  inset: -15%;
  z-index: -3;
  background: radial-gradient(circle at 50% 49%, rgba(43, 112, 106, .31), transparent 23%), radial-gradient(circle at 18% 15%, rgba(198, 145, 76, .16), transparent 27%), linear-gradient(135deg, #091a22, #0c2c35 52%, #07151d);
  animation: intro-breathe 7s ease-in-out infinite alternate;
}
.intro-grain { position: absolute; inset: 0; z-index: -1; opacity: .16; pointer-events: none; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.22'/%3E%3C/svg%3E"); mix-blend-mode: screen; }
.intro-grid { position: absolute; inset: 0; z-index: -2; opacity: .18; pointer-events: none; background-image: linear-gradient(rgba(132, 187, 176, .14) 1px, transparent 1px), linear-gradient(90deg, rgba(132, 187, 176, .14) 1px, transparent 1px); background-size: 72px 72px; mask-image: linear-gradient(90deg, transparent, black 17%, black 83%, transparent); }
.intro-header { position: relative; z-index: 2; display: flex; align-items: center; justify-content: space-between; padding: 28px clamp(22px, 5vw, 74px); }
.intro-brand { display: flex; align-items: center; gap: 12px; }
.intro-brand > span:last-child { display: grid; gap: 3px; }
.intro-brand strong { font: 600 16px 'Noto Serif SC', serif; letter-spacing: .12em; }
.intro-brand small { color: var(--intro-jade); font-size: 8px; letter-spacing: .27em; }
.intro-brand-mark { display: inline-grid; grid-template-columns: repeat(3, 5px); align-items: end; gap: 3px; width: 19px; height: 22px; color: var(--intro-gold); }
.intro-brand-mark i { display: block; height: 100%; background: currentColor; }
.intro-brand-mark i:nth-child(2) { height: 76%; }
.intro-brand-mark i:nth-child(3) { height: 50%; }
.intro-skip { display: inline-flex; align-items: center; gap: 7px; padding: 8px 0; border: 0; color: var(--intro-muted); background: transparent; font-size: 11px; letter-spacing: .1em; transition: color .2s ease; }
.intro-skip:hover { color: var(--intro-ink); }
.intro-main { position: relative; flex: 1; display: grid; place-items: center; min-height: 0; }
.intro-coordinate { position: absolute; top: 9%; right: clamp(23px, 8vw, 120px); display: grid; gap: 7px; color: rgba(207, 224, 218, .43); font: 9px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .18em; writing-mode: vertical-rl; }
.intro-stage-count { position: absolute; top: 8%; left: clamp(23px, 8vw, 120px); display: inline-flex; align-items: center; gap: 10px; color: var(--intro-gold); font: 11px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .18em; }
.intro-stage-count i { display: block; width: 28px; height: 1px; background: currentColor; opacity: .65; }
.intro-stage-count small { color: var(--intro-muted); font: inherit; font-size: 9px; }
.intro-orbit { position: absolute; width: min(58vw, 680px); aspect-ratio: 1; border-radius: 50%; transform: translate(20%, -2%); opacity: .9; transition: transform 1.4s cubic-bezier(.22, .61, .36, 1); }
.intro-orbit.is-stage-1 { transform: translate(13%, -2%) rotate(17deg) scale(.91); }
.intro-orbit.is-stage-2 { transform: translate(5%, -2%) rotate(35deg) scale(.84); }
.orbit { position: absolute; inset: 5%; border: 1px solid rgba(124, 200, 187, .26); border-radius: 50%; transform: rotate(-22deg) skewX(-15deg); }
.orbit-two { inset: 15%; border-color: rgba(211, 166, 108, .29); transform: rotate(57deg) skewX(-19deg); }
.orbit-three { inset: 27%; border-color: rgba(124, 200, 187, .32); transform: rotate(111deg) skewX(-18deg); }
.orbit-core { position: absolute; inset: 39%; border-radius: 50%; background: radial-gradient(circle at 38% 35%, rgba(226, 188, 126, .9), rgba(66, 131, 123, .47) 26%, rgba(11, 39, 46, .16) 67%); box-shadow: 0 0 65px rgba(95, 197, 177, .24), inset 0 0 35px rgba(233, 199, 139, .25); animation: intro-core 4.5s ease-in-out infinite; }
.core-pulse { position: absolute; inset: 17%; border: 1px solid rgba(220, 192, 137, .8); border-radius: 50%; animation: intro-pulse 2.2s ease-out infinite; }
.core-cross::before, .core-cross::after { content: ''; position: absolute; left: 50%; top: 25%; width: 1px; height: 50%; background: rgba(244, 221, 174, .62); }
.core-cross::after { top: 50%; left: 25%; width: 50%; height: 1px; }
.intro-particle { position: absolute; left: 50%; top: 50%; width: 3px; height: 3px; border-radius: 50%; background: var(--intro-gold); box-shadow: 0 0 12px var(--intro-gold); transform: rotate(calc(var(--particle) * 20deg)) translateY(calc(min(24vw, 280px) * -1)); animation: intro-particle 5.5s linear infinite; animation-delay: calc(var(--particle) * -0.27s); }
.intro-particle:nth-child(3n) { background: var(--intro-jade); box-shadow: 0 0 12px var(--intro-jade); }
.intro-copy { position: relative; z-index: 1; width: min(430px, 75vw); transform: translateX(-26%); margin-top: -2%; text-align: center; }
.intro-kicker { color: var(--intro-gold); font-size: 9px; letter-spacing: .32em; }
.intro-copy h1 { margin: 18px 0 15px; font: 600 clamp(35px, 5vw, 64px)/1.18 'Noto Serif SC', serif; letter-spacing: -.08em; text-shadow: 0 8px 36px rgba(0, 0, 0, .26); }
.intro-copy h1 em { color: var(--intro-jade); font-style: normal; }
.intro-copy p { display: inline-flex; align-items: center; min-height: 19px; margin: 0; color: var(--intro-muted); font-size: 12px; letter-spacing: .1em; }
.typing-cursor { width: 1px; height: 14px; margin-left: 7px; background: var(--intro-gold); animation: intro-blink 1s steps(2) infinite; }
.intro-enter { position: absolute; z-index: 3; right: clamp(24px, 9vw, 130px); bottom: 11%; display: inline-flex; align-items: center; gap: 12px; padding: 13px 16px; min-width: 170px; border: 1px solid rgba(124, 200, 187, .22); color: rgba(207, 224, 218, .35); background: rgba(8, 28, 35, .5); text-align: left; cursor: default; transition: border-color .35s ease, color .35s ease, background .35s ease, transform .35s ease; }
.intro-enter.ready { color: var(--intro-ink); border-color: rgba(124, 200, 187, .76); background: rgba(27, 79, 79, .42); cursor: pointer; animation: intro-cta 2.4s ease-in-out infinite; }
.intro-enter.ready:hover { transform: translateY(-3px); border-color: var(--intro-gold); background: rgba(42, 104, 98, .55); }
.intro-enter:disabled { opacity: .82; }
.intro-enter-icon { display: grid; place-items: center; width: 27px; height: 27px; color: var(--intro-gold); border: 1px solid currentColor; border-radius: 50%; }
.intro-enter > span:nth-child(2) { display: grid; gap: 2px; flex: 1; }
.intro-enter small { color: var(--intro-muted); font-size: 9px; letter-spacing: .1em; }
.intro-enter strong { font-size: 13px; font-weight: 500; letter-spacing: .08em; }
.intro-footer { position: relative; z-index: 2; display: flex; align-items: end; justify-content: space-between; gap: 30px; padding: 20px clamp(22px, 5vw, 74px) 28px; }
.intro-timeline { display: flex; align-items: center; gap: 18px; }
.intro-timeline-item { display: flex; align-items: center; gap: 8px; color: rgba(207, 224, 218, .33); font-size: 10px; transition: color .35s ease; }
.intro-timeline-item i { display: block; width: 32px; height: 1px; background: currentColor; opacity: .5; }
.intro-timeline-item span { font: 10px ui-monospace, monospace; }
.intro-timeline-item strong { font-weight: 400; letter-spacing: .1em; }
.intro-timeline-item.active { color: var(--intro-jade); }
.intro-timeline-item.current { color: var(--intro-gold); }
.intro-hint { color: rgba(207, 224, 218, .42); font-size: 10px; letter-spacing: .08em; }

@keyframes intro-breathe { from { transform: scale(1) translate3d(0, 0, 0); } to { transform: scale(1.08) translate3d(-1%, 1%, 0); } }
@keyframes intro-core { 0%, 100% { transform: scale(.96); } 50% { transform: scale(1.05); } }
@keyframes intro-pulse { 0% { transform: scale(.6); opacity: .9; } 80%, 100% { transform: scale(1.35); opacity: 0; } }
@keyframes intro-particle { from { opacity: 0; } 14%, 72% { opacity: .9; } to { opacity: 0; transform: rotate(calc(var(--particle) * 20deg + 360deg)) translateY(calc(min(24vw, 280px) * -1)); } }
@keyframes intro-blink { 50% { opacity: 0; } }
@keyframes intro-cta { 0%, 100% { box-shadow: 0 0 0 rgba(124, 200, 187, 0); } 50% { box-shadow: 0 0 0 7px rgba(124, 200, 187, .08); } }

@media (max-width: 760px) {
  .intro-header { padding-top: 21px; }
  .intro-brand strong { font-size: 13px; }
  .intro-brand small { font-size: 7px; }
  .intro-coordinate { top: 11%; right: 22px; }
  .intro-stage-count { top: 11%; left: 22px; }
  .intro-orbit { width: min(92vw, 510px); transform: translateY(-10%); }
  .intro-orbit.is-stage-1 { transform: translateY(-10%) rotate(17deg) scale(.91); }
  .intro-orbit.is-stage-2 { transform: translateY(-10%) rotate(35deg) scale(.84); }
  .intro-copy { transform: translateY(-17%); }
  .intro-enter { right: 50%; bottom: 14%; transform: translateX(50%); }
  .intro-enter.ready:hover { transform: translateX(50%) translateY(-3px); }
  .intro-footer { display: grid; gap: 10px; padding-bottom: 21px; }
  .intro-hint { justify-self: end; }
  .intro-timeline { gap: 9px; }
  .intro-timeline-item i { width: 17px; }
  .intro-timeline-item strong { font-size: 9px; }
}
@media (prefers-reduced-motion: reduce) {
  .intro-experience *, .intro-experience::before { animation-duration: .001ms !important; animation-iteration-count: 1 !important; transition-duration: .001ms !important; }
}
:global(html.intro-lock) { overflow: hidden; }

/* Archive interface layer: tactile paper plate + catalogue metadata + live survey pass. */
.intro-main { display: block; padding: 0 clamp(22px, 5vw, 74px); }
.intro-stage-count { top: 7%; left: clamp(22px, 5vw, 74px); }
.intro-stage-count b { margin-left: 12px; color: rgba(207, 224, 218, .38); font: 9px ui-monospace, monospace; letter-spacing: .16em; font-weight: 400; }
.intro-coordinate { top: 7%; right: clamp(22px, 5vw, 74px); gap: 9px; writing-mode: initial; text-align: right; }
.intro-coordinate span:last-child { color: var(--intro-gold); }
.intro-layout { display: grid; grid-template-columns: minmax(230px, .78fr) minmax(350px, 1.2fr) minmax(170px, .5fr); align-items: center; gap: clamp(25px, 4vw, 68px); width: min(1220px, 100%); height: 100%; margin: 0 auto; padding-top: 3%; }
.intro-copy { width: auto; margin: 0; transform: none; text-align: left; }
.intro-kicker { display: block; color: var(--intro-gold); font-size: 9px; line-height: 1.6; letter-spacing: .2em; }
.intro-copy h1 { margin: 20px 0 18px; font-size: clamp(35px, 4.4vw, 62px); line-height: 1.15; }
.intro-copy-lead { display: block; min-height: 0; margin: 0; color: rgba(231, 239, 233, .72); font: 400 14px/1.95 'Noto Serif SC', serif; letter-spacing: .04em; }
.intro-copy-rule { width: 68px; height: 1px; margin: 25px 0 18px; background: linear-gradient(90deg, var(--intro-gold), transparent); }
.intro-status { display: flex; align-items: center; min-height: 20px; margin: 0; color: rgba(207, 224, 218, .6); font-size: 11px; letter-spacing: .08em; }
.status-dot, .record-dot { display: inline-block; width: 5px; height: 5px; margin-right: 9px; border-radius: 50%; background: var(--intro-jade); box-shadow: 0 0 0 4px rgba(124, 200, 187, .12); }
.intro-enter { position: static; display: inline-flex; min-width: 222px; min-height: 52px; margin-top: 31px; padding: 11px 15px; }
.intro-enter-icon { width: 31px; height: 31px; }
.intro-enter strong { font-size: 12px; }
.intro-plate { position: relative; width: min(100%, 510px); aspect-ratio: .88; justify-self: center; overflow: hidden; border: 1px solid rgba(211, 166, 108, .46); background: linear-gradient(145deg, rgba(231, 221, 199, .96), rgba(180, 194, 181, .91)); box-shadow: 0 24px 80px rgba(0, 0, 0, .28), 0 0 0 8px rgba(211, 166, 108, .04); transform: rotate(-1.6deg); transition: transform 1s cubic-bezier(.22, .61, .36, 1); }
.intro-plate::before, .intro-plate::after { content: ''; position: absolute; inset: 13px; border: 1px solid rgba(27, 58, 60, .2); pointer-events: none; }
.intro-plate::after { inset: 19px; border-color: rgba(27, 58, 60, .09); }
.intro-plate.is-stage-1 { transform: rotate(0deg) translateY(-4px); }
.intro-plate.is-stage-2 { transform: rotate(1.2deg) translateY(-5px); }
.plate-topline { position: absolute; z-index: 2; top: 29px; left: 32px; right: 32px; display: flex; justify-content: space-between; color: rgba(26, 59, 61, .68); font-size: 8px; letter-spacing: .16em; }
.plate-topline span:last-child { color: #a15c3c; }
.plate-grid { position: absolute; inset: 27px; opacity: .3; background-image: linear-gradient(rgba(26, 71, 72, .16) 1px, transparent 1px), linear-gradient(90deg, rgba(26, 71, 72, .16) 1px, transparent 1px); background-size: 24px 24px; mask-image: linear-gradient(180deg, transparent 3%, black 24%, black 79%, transparent 97%); }
.plate-map-lines { position: absolute; inset: 13%; opacity: .26; border: 1px solid #467f78; border-radius: 48% 42% 55% 43%; transform: rotate(-26deg) skewX(-12deg); box-shadow: 18px -14px 0 -17px #467f78, -23px 23px 0 -21px #467f78, 12px 34px 0 -20px #467f78; }
.plate-scan { position: absolute; z-index: 3; left: 22px; right: 22px; top: 41%; height: 1px; background: linear-gradient(90deg, transparent, rgba(161, 92, 60, .1), rgba(161, 92, 60, .84), rgba(161, 92, 60, .1), transparent); box-shadow: 0 0 12px rgba(161, 92, 60, .45); animation: plate-scan 4.4s ease-in-out infinite; }
.building-drawing { position: absolute; inset: 17% 15% 14%; display: grid; place-items: center; }
.building-drawing svg { width: 88%; height: 100%; overflow: visible; }
.draw-line { fill: none; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 760; stroke-dashoffset: 760; animation: draw-building 4.6s cubic-bezier(.22, .61, .36, 1) forwards; }
.draw-main { stroke: #1b4e4f; stroke-width: 1.7; }
.draw-fine { stroke: rgba(47, 111, 104, .55); stroke-width: .85; animation-delay: .35s; }
.draw-roof { stroke: #a15c3c; stroke-width: 1.25; animation-delay: .8s; }
.draw-ghost { stroke: rgba(27, 78, 79, .48); stroke-width: .8; stroke-dasharray: 3 4; animation-delay: 1.2s; }
.draw-accent { fill: none; stroke: #a15c3c; stroke-width: 1.2; stroke-dasharray: 210; stroke-dashoffset: 210; animation: draw-building 2.8s 1.35s ease forwards; }
.atlas-node { fill: #a15c3c; stroke: #f1e2c1; stroke-width: 2; animation: atlas-node-pulse 2.8s ease-in-out infinite; }
.node-west { animation-delay: .2s; }.node-east { animation-delay: .65s; }.node-south { animation-delay: 1s; }.node-center { fill: #2f8983; animation-delay: 1.3s; }
.atlas-cross { fill: none; stroke: rgba(27, 78, 79, .55); stroke-width: .8; }
.building-halo { position: absolute; width: 64%; aspect-ratio: 1; border: 1px solid rgba(47, 137, 131, .25); border-radius: 50%; box-shadow: 0 0 0 21px rgba(47, 137, 131, .035), 0 0 0 47px rgba(47, 137, 131, .025); animation: halo-breathe 4.5s ease-in-out infinite; }
.scan-point { position: absolute; width: 6px; height: 6px; border: 1px solid #a15c3c; border-radius: 50%; background: #f1e2c1; box-shadow: 0 0 0 4px rgba(161, 92, 60, .11); animation: point-pulse 2.8s ease-in-out infinite; }
.point-a { left: 17%; top: 38%; }.point-b { right: 14%; top: 48%; animation-delay: .8s; }.point-c { left: 34%; bottom: 12%; animation-delay: 1.4s; }
.plate-caption { position: absolute; z-index: 2; left: 33px; bottom: 34px; display: grid; gap: 5px; color: #173d3f; }
.plate-caption span { font: 600 22px 'Noto Serif SC', serif; letter-spacing: .05em; }
.plate-caption small { color: #52706c; font-size: 9px; letter-spacing: .12em; }
.plate-seal { position: absolute; right: 31px; bottom: 30px; display: grid; place-items: center; width: 44px; height: 44px; border: 1px solid #a15c3c; color: #a15c3c; font: 600 18px/1.1 'Noto Serif SC', serif; transform: rotate(-8deg); }
.plate-seal small { font: 6px ui-monospace, monospace; letter-spacing: .12em; }
.plate-coordinates { position: absolute; right: 28px; top: 66px; display: grid; gap: 4px; color: rgba(27, 78, 79, .57); font: 7px ui-monospace, monospace; text-align: right; letter-spacing: .12em; }
.intro-record { align-self: center; padding: 17px 0 15px; border-top: 1px solid rgba(124, 200, 187, .42); border-bottom: 1px solid rgba(124, 200, 187, .24); color: rgba(231, 239, 233, .72); }
.record-heading { display: flex; justify-content: space-between; align-items: center; color: var(--intro-jade); font: 8px ui-monospace, monospace; letter-spacing: .15em; }
.record-heading i { color: var(--intro-gold); font-style: normal; }
.record-index { margin-top: 25px; color: rgba(207, 224, 218, .4); font: 9px ui-monospace, monospace; letter-spacing: .2em; }
.intro-record h2 { margin: 11px 0 4px; color: var(--intro-ink); font: 600 25px 'Noto Serif SC', serif; letter-spacing: .04em; }
.intro-record > p { margin: 0 0 22px; color: rgba(207, 224, 218, .56); font-size: 10px; line-height: 1.6; }
.intro-record dl { display: grid; gap: 12px; margin: 0; }
.intro-record dl div { display: flex; justify-content: space-between; gap: 12px; padding-bottom: 9px; border-bottom: 1px solid rgba(207, 224, 218, .11); }
.intro-record dt { color: rgba(207, 224, 218, .38); font-size: 9px; }.intro-record dd { margin: 0; color: rgba(231, 239, 233, .78); font-size: 9px; text-align: right; }
.record-footer { display: flex; justify-content: space-between; margin-top: 17px; color: rgba(207, 224, 218, .42); font: 8px ui-monospace, monospace; }
.record-footer .record-dot { width: 4px; height: 4px; margin-right: 5px; }
.intro-hint { color: rgba(207, 224, 218, .42); }
@keyframes plate-scan { 0%, 14% { transform: translateY(-130px); opacity: 0; } 25% { opacity: 1; } 78% { opacity: 1; } 90%, 100% { transform: translateY(180px); opacity: 0; } }
@keyframes draw-building { to { stroke-dashoffset: 0; } }
@keyframes halo-breathe { 0%, 100% { transform: scale(.96); opacity: .56; } 50% { transform: scale(1.05); opacity: .95; } }
@keyframes point-pulse { 0%, 100% { box-shadow: 0 0 0 3px rgba(161, 92, 60, .09); } 50% { box-shadow: 0 0 0 7px rgba(161, 92, 60, .02); } }
@keyframes atlas-node-pulse { 0%, 100% { opacity: .66; transform: scale(.85); transform-origin: center; } 50% { opacity: 1; transform: scale(1.18); transform-origin: center; } }

@media (max-width: 980px) {
  .intro-layout { grid-template-columns: minmax(210px, .78fr) minmax(300px, 1.1fr); gap: 28px; }
  .intro-record { display: none; }
  .intro-plate { width: min(100%, 460px); }
}

@media (max-width: 760px) {
  .intro-main { padding: 0 22px; }
  .intro-coordinate { top: 11%; right: 22px; font-size: 7px; }
  .intro-stage-count { top: 11%; left: 22px; }
  .intro-stage-count b { display: none; }
  .intro-layout { display: flex; flex-direction: column; align-items: stretch; justify-content: center; gap: 17px; padding-top: 12%; }
  .intro-copy { order: 2; }
  .intro-copy h1 { margin: 8px 0 10px; font-size: clamp(30px, 9vw, 47px); }
  .intro-copy-lead { font-size: 12px; line-height: 1.65; }
  .intro-copy-rule { margin: 13px 0 11px; }
  .intro-status { font-size: 10px; }
  .intro-plate { order: 1; width: min(68vw, 285px); align-self: center; }
  .intro-enter { min-height: 48px; margin-top: 17px; }
}
</style>

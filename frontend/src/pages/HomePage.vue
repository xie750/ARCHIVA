<script setup lang="ts">
import { ArrowRight, Compass, MapPin } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'
import { featuredBuilding, buildings } from '../data/buildings'
</script>

<template>
  <div>
    <section class="hero container">
      <div class="hero-copy">
        <span class="eyebrow">HENAN / ARCHITECTURE ATLAS</span>
        <h1>在中原<br><span>重新阅读建筑。</span></h1>
        <p class="lead">一份从历史、材料与空间出发的数字建筑图录。先从河南开始，沿着塔、寺、石窟与城门，阅读一片土地如何保存时间。</p>
        <div class="hero-actions"><RouterLink to="/explore" class="button-primary">开始探索 <ArrowRight :size="16" /></RouterLink><a href="#featured" class="button-ghost">查看策展精选</a></div>
        <div class="hero-meta"><div><strong>05</strong>河南建筑样本</div><div><strong>01</strong>出版 Demo</div><div><strong>3D</strong>空间阅读</div></div>
      </div>
      <div class="hero-art"><div class="hero-sculpture" /><div style="position:absolute;right:26px;top:24px;color:rgba(255,245,225,.7);font-size:10px;letter-spacing:.18em;writing-mode:vertical-rl">伊阙 · 洛阳 · 唐</div></div>
    </section>

    <section id="featured" class="container">
      <div class="section-head"><div><span class="eyebrow">CURATED SELECTION</span><h2>一座建筑，一段可进入的历史</h2></div><RouterLink to="/explore" class="link-arrow">浏览全部样本 <ArrowRight :size="15" /></RouterLink></div>
      <div class="featured-grid">
        <RouterLink :to="`/buildings/${featuredBuilding.id}`" class="feature-card"><div class="feature-content"><span class="tagline">01 / 洛阳 · 世界遗产</span><h3>{{ featuredBuilding.name }}</h3><p>{{ featuredBuilding.summary }}</p></div></RouterLink>
        <div class="mini-card"><div><span class="mini-index">02</span><h3>从地图进入河南</h3><p>五座建筑，四座城市。用一张地图看见中原建筑的地理与时间层次。</p></div><RouterLink to="/explore" class="link-arrow">打开建筑地图 <MapPin :size="15" /></RouterLink></div>
      </div>
    </section>

    <section class="quote-band"><span class="eyebrow">THE IDEA</span><blockquote>建筑不是静止的遗存，<br>它是历史仍在发生的空间。</blockquote><cite>河南建筑数字志 · 出版 Demo</cite></section>

    <section class="container"><div class="section-head"><div><span class="eyebrow">START READING</span><h2>按你的方式进入</h2></div></div><div class="featured-grid">
      <RouterLink to="/explore" class="mini-card"><div><Compass :size="23" color="#a73e32" /><h3>按建筑探索</h3><p>从石窟、寺观、古塔、城门和园林开始，找到你想深入了解的空间。</p></div><span class="link-arrow">进入探索 <ArrowRight :size="15" /></span></RouterLink>
      <div class="mini-card"><div><span class="mini-index">{{ String(buildings.length).padStart(2,'0') }}</span><h3>河南篇 · 01</h3><p>首版收录五座建筑样本。每一座都配有历史章节、模型版本与资料来源。</p></div><span class="muted" style="font-size:11px">持续研究与数字复原</span></div>
    </div></section>
  </div>
</template>

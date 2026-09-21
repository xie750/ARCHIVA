<script setup lang="ts">
import { computed, ref } from 'vue'
import { BookOpen, Menu, Search, X } from 'lucide-vue-next'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import BrandMark from '../components/site/BrandMark.vue'

const route = useRoute()
const isMenuOpen = ref(false)
const navItems = [
  { label: '首页', to: '/' },
  { label: '探索建筑', to: '/explore' },
]
const currentLabel = computed(() => route.name === 'building-detail' ? '建筑详情' : navItems.find((item) => item.to === route.path)?.label ?? '建筑数字志')
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="container topbar-inner">
        <RouterLink to="/" class="brand-link" aria-label="返回首页">
          <BrandMark />
          <span class="brand-copy"><strong>建筑数字志</strong><small>HENAN / 01</small></span>
        </RouterLink>
        <nav class="desktop-nav" aria-label="主导航">
          <RouterLink v-for="item in navItems" :key="item.to" :to="item.to" class="nav-link" :class="{ active: route.path === item.to }">{{ item.label }}</RouterLink>
          <span class="nav-divider" />
          <span class="edition"><BookOpen :size="15" /> 出版 Demo</span>
        </nav>
        <div class="topbar-actions">
          <RouterLink to="/explore" class="icon-button" aria-label="探索建筑"><Search :size="19" /></RouterLink>
          <button class="mobile-menu-button" type="button" aria-label="打开菜单" @click="isMenuOpen = !isMenuOpen"><X v-if="isMenuOpen" :size="21" /><Menu v-else :size="21" /></button>
        </div>
      </div>
      <div v-if="isMenuOpen" class="mobile-nav container">
        <RouterLink v-for="item in navItems" :key="item.to" :to="item.to" @click="isMenuOpen = false">{{ item.label }}</RouterLink>
      </div>
    </header>
    <div class="page-context container"><span>河南 · 中原建筑地理</span><span class="context-current">{{ currentLabel }}</span></div>
    <main><RouterView /></main>
    <footer class="site-footer">
      <div class="container footer-grid">
        <div><BrandMark /><p class="footer-title">河南建筑数字志</p><p class="muted">从一块石头、一根木梁开始，重新阅读中原。</p></div>
        <div><p class="footer-label">展览计划</p><p>河南篇 · 01 / 2025</p><p class="muted">持续研究与数字复原</p></div>
        <div><p class="footer-label">资料与模型</p><p>来源可追溯 · 版本可审阅</p><p class="muted">本 Demo 用于出版方案演示</p></div>
      </div>
      <div class="container footer-bottom"><span>© 2025 Architecture Atlas</span><span>Designing memory in place.</span></div>
    </footer>
  </div>
</template>

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
const currentLabel = computed(() => route.name === 'building-detail' ? '建筑详情' : navItems.find((item) => item.to === route.path)?.label ?? '中国建筑数字志')
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="container topbar-inner">
        <RouterLink to="/" class="brand-link" aria-label="返回首页">
          <BrandMark />
          <span class="brand-copy"><strong>中国建筑数字志</strong><small>NATIONAL ARCHITECTURE ATLAS</small></span>
        </RouterLink>
        <nav class="desktop-nav" aria-label="主导航">
          <RouterLink v-for="item in navItems" :key="item.to" :to="item.to" class="nav-link" :class="{ active: route.path === item.to }">{{ item.label }}</RouterLink>
          <span class="nav-divider" />
          <span class="edition"><BookOpen :size="15" /> 全国样例库</span>
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
    <div class="page-context container"><span>全国建筑图谱 · 样例数据持续接入</span><span class="context-current">{{ currentLabel }}</span></div>
    <main><RouterView /></main>
    <footer class="site-footer">
      <div class="container footer-grid">
        <div><BrandMark /><p class="footer-title">中国建筑数字志</p><p class="muted">以全国建筑样本为入口，建立可游览、可追溯、可扩展的建筑数字档案。</p></div>
        <div><p class="footer-label">全国图谱</p><p>省份入口 · 城市路径 · 建筑类型</p><p class="muted">样例数据先行，正式数据可按同一结构持续接入</p></div>
        <div><p class="footer-label">资料与模型</p><p>来源可追溯 · 版本可审阅</p><p class="muted">支持图文档案、地图定位和 3D 空间体验</p></div>
      </div>
      <div class="container footer-bottom"><span>© 2025 Architecture Atlas</span><span>National architecture, readable in space.</span></div>
    </footer>
  </div>
</template>

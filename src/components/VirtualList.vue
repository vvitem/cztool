<template>
  <div ref="rootRef" class="virt-root" @scroll.passive="onScroll">
    <div class="virt-spacer" :style="{ height: totalHeight + 'px' }">
      <div
        class="virt-window"
        :style="{ transform: `translateY(${offsetY}px)` }"
      >
        <div
          v-for="row in visible"
          :key="row.key"
          class="virt-item"
          :style="{ height: row.height + 'px' }"
        >
          <slot :item="row.item" :index="row.index" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" generic="T">
import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'

const props = withDefaults(
  defineProps<{
    items: T[]
    /** 固定行高，或按 index/item 返回高度 */
    itemHeight: number | ((index: number, item: T) => number)
    keyField?: string
    overscan?: number
  }>(),
  {
    keyField: 'id',
    overscan: 6,
  },
)

const rootRef = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const viewportHeight = ref(0)

let resizeObserver: ResizeObserver | null = null

const heightAt = (index: number): number => {
  const item = props.items[index]
  if (item === undefined) return 0
  return typeof props.itemHeight === 'function'
    ? props.itemHeight(index, item)
    : props.itemHeight
}

const offsets = computed(() => {
  const list = props.items
  const starts: number[] = new Array(list.length)
  let acc = 0
  for (let i = 0; i < list.length; i++) {
    starts[i] = acc
    acc += heightAt(i)
  }
  return { starts, total: acc }
})

const totalHeight = computed(() => offsets.value.total)

const lowerBound = (starts: number[], target: number) => {
  let lo = 0
  let hi = starts.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if ((starts[mid] ?? 0) < target) lo = mid + 1
    else hi = mid
  }
  return lo
}

const visible = computed(() => {
  const list = props.items
  const { starts } = offsets.value
  if (!list.length) {
    return [] as Array<{ item: T; index: number; key: string | number; height: number }>
  }

  const top = scrollTop.value
  const bottom = top + Math.max(viewportHeight.value, 1)
  const overscan = props.overscan

  let start = Math.max(0, lowerBound(starts, top) - overscan)
  let end = Math.min(list.length, lowerBound(starts, bottom) + overscan)

  const rows = []
  for (let i = start; i < end; i++) {
    const item = list[i]!
    const keyVal = props.keyField
      ? (item as Record<string, unknown>)[props.keyField]
      : i
    rows.push({
      item,
      index: i,
      key: (keyVal as string | number) ?? i,
      height: heightAt(i),
    })
  }
  return rows
})

const offsetY = computed(() => {
  const first = visible.value[0]
  if (!first) return 0
  return offsets.value.starts[first.index] || 0
})

const onScroll = () => {
  const el = rootRef.value
  if (!el) return
  scrollTop.value = el.scrollTop
}

const measure = () => {
  const el = rootRef.value
  if (!el) return
  viewportHeight.value = el.clientHeight
  scrollTop.value = el.scrollTop
}

const scrollToIndex = (index: number, behavior: ScrollBehavior = 'auto') => {
  const el = rootRef.value
  if (!el || index < 0 || index >= props.items.length) return
  const top = offsets.value.starts[index] || 0
  el.scrollTo({ top, behavior })
}

watch(
  () => props.items.length,
  () => {
    // 过滤后列表变短时，避免 scrollTop 悬空
    requestAnimationFrame(measure)
  },
)

onMounted(() => {
  measure()
  const el = rootRef.value
  if (el && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => measure())
    resizeObserver.observe(el)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})

defineExpose({
  scrollToIndex,
  rootRef: rootRef as Ref<HTMLElement | null>,
})
</script>

<style scoped>
.virt-root {
  height: 100%;
  overflow: auto;
  position: relative;
}

.virt-spacer {
  position: relative;
  width: 100%;
}

.virt-window {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  will-change: transform;
}

.virt-item {
  box-sizing: border-box;
  overflow: hidden;
}
</style>

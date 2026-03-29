<script setup lang="ts">
import HostCountCard from './HostCountCard.vue'
import CoresChart from './charts/CoresChart.vue'
import RamChart from './charts/RamChart.vue'
import StorageChart from './charts/StorageChart.vue'
</script>

<template>
  <div class="space-y-4">
    <HostCountCard />
    <CoresChart />
    <RamChart />
    <StorageChart />
    <slot name="toolbar" />
  </div>
</template>

<script setup lang="ts">
import HostCountCard from './HostCountCard.vue'
import VsanMaxClusterCard from './VsanMaxClusterCard.vue'
import CoresChart from './charts/CoresChart.vue'
import RamChart from './charts/RamChart.vue'
import StorageChart from './charts/StorageChart.vue'
import StretchNetworkChecklist from './StretchNetworkChecklist.vue'
import ExportToolbar from './ExportToolbar.vue'
</script>

<template>
  <div class="space-y-4 print:space-y-2">
    <HostCountCard />
    <VsanMaxClusterCard />
    <CoresChart />
    <RamChart />
    <StorageChart />
    <StretchNetworkChecklist />
    <ExportToolbar />
  </div>
</template>

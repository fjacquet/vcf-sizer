<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import HostCountCard from './HostCountCard.vue'
import VsanMaxClusterCard from './VsanMaxClusterCard.vue'
import CoresChart from './charts/CoresChart.vue'
import RamChart from './charts/RamChart.vue'
import StorageChart from './charts/StorageChart.vue'
import StretchNetworkChecklist from './StretchNetworkChecklist.vue'
import ExportToolbar from './ExportToolbar.vue'

const { t } = useI18n()
const reportDate = computed(() => new Date().toLocaleDateString())
</script>

<template>
  <div class="space-y-4 print:space-y-2">
    <!-- Print-only header: fixed position repeats on every page -->
    <div class="hidden print:flex fixed top-0 left-0 right-0 justify-between items-center text-xs text-gray-500 border-b border-gray-200 py-2 px-4 bg-white z-50">
      <span>{{ t('print.header.title') }}</span>
      <span>{{ reportDate }}</span>
    </div>

    <!-- Print-only footer: fixed position repeats on every page -->
    <div class="hidden print:flex fixed bottom-0 left-0 right-0 justify-center items-center text-xs text-gray-400 border-t border-gray-200 py-2 px-4 bg-white z-50">
      <span>{{ t('print.footer.attribution') }}</span>
    </div>

    <!-- Existing result components (unchanged order) -->
    <HostCountCard />
    <VsanMaxClusterCard />
    <CoresChart />
    <RamChart />
    <StorageChart />
    <StretchNetworkChecklist />
    <ExportToolbar />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
} from 'chart.js'
import type { ChartData, ChartOptions } from 'chart.js'
import { useCalculationStore } from '@/stores/calculationStore'
import { storeToRefs } from 'pinia'

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

const { t } = useI18n()
const calc = useCalculationStore()
const { storage } = storeToRefs(calc)

const chartData = computed((): ChartData<'bar'> => ({
  labels: [t('results.charts.storage')],
  datasets: [
    {
      label: t('results.charts.storageUsable'),
      data: [storage.value.safeUsableCapacityTB],
      backgroundColor: 'rgba(20,184,166,0.75)',
    },
    {
      label: t('results.charts.storageLfs'),
      data: [storage.value.lfsOverheadTB],
      backgroundColor: 'rgba(251,191,36,0.75)',
    },
    {
      label: t('results.charts.storageMetadata'),
      data: [storage.value.metadataOverheadTB],
      backgroundColor: 'rgba(148,163,184,0.75)',
    },
  ],
}))

const chartOptions: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: true, position: 'bottom' as const },
    tooltip: { enabled: true },
  },
  scales: {
    x: { stacked: true },
    y: { stacked: true, beginAtZero: true },
  },
}
</script>

<template>
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
    <h3 class="text-sm font-semibold text-gray-700 mb-2">{{ t('results.charts.storage') }}</h3>
    <div class="h-48 relative">
      <Bar :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>

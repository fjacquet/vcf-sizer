<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePreferredDark } from '@vueuse/core'
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
const isDark = usePreferredDark()

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
    {
      label: t('results.charts.storageRaid'),
      data: [storage.value.rawCapacityTB - storage.value.usableAfterRaidTB],
      backgroundColor: 'rgba(239,68,68,0.75)',
    },
  ],
}))

const chartOptions = computed((): ChartOptions<'bar'> => {
  const tickColor = isDark.value ? 'rgb(156,163,175)' : 'rgb(75,85,99)'
  const gridColor = isDark.value ? 'rgba(75,85,99,0.3)' : 'rgba(156,163,175,0.3)'
  const legendColor = isDark.value ? 'rgb(209,213,219)' : 'rgb(55,65,81)'
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom' as const,
        labels: { color: legendColor },
      },
      tooltip: { enabled: true },
    },
    scales: {
      x: {
        stacked: true,
        ticks: { color: tickColor },
        grid: { color: gridColor },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        ticks: { color: tickColor },
        grid: { color: gridColor },
      },
    },
  }
})
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 break-inside-avoid">
    <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{{ t('results.charts.storage') }}</h3>
    <div class="h-48 relative print:hidden">
      <Bar :data="chartData" :options="chartOptions" />
    </div>
    <!-- Print fallback: data table -->
    <table class="hidden print:table w-full text-sm border-collapse mt-2">
      <thead>
        <tr class="border-b border-gray-300">
          <th class="text-left py-1 font-medium">{{ t('results.charts.storage') }}</th>
          <th class="text-right py-1 font-medium">TB</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="py-1">{{ t('results.charts.storageUsable') }}</td>
          <td class="text-right font-mono">{{ storage.safeUsableCapacityTB.toFixed(2) }}</td>
        </tr>
        <tr>
          <td class="py-1">{{ t('results.charts.storageLfs') }}</td>
          <td class="text-right font-mono">{{ storage.lfsOverheadTB.toFixed(2) }}</td>
        </tr>
        <tr>
          <td class="py-1">{{ t('results.charts.storageMetadata') }}</td>
          <td class="text-right font-mono">{{ storage.metadataOverheadTB.toFixed(2) }}</td>
        </tr>
        <tr>
          <td class="py-1">{{ t('results.charts.storageRaid') }}</td>
          <td class="text-right font-mono">{{ (storage.rawCapacityTB - storage.usableAfterRaidTB).toFixed(2) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

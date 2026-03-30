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
const { compute } = storeToRefs(calc)
const isDark = usePreferredDark()

const chartData = computed((): ChartData<'bar'> => ({
  labels: [t('results.charts.required'), t('results.charts.available')],
  datasets: [
    {
      label: t('results.charts.cores'),
      data: [compute.value.totalCoresRequired, compute.value.availableCores],
      backgroundColor: [
        compute.value.totalCoresRequired > compute.value.availableCores
          ? 'rgba(239,68,68,0.75)'
          : 'rgba(20,184,166,0.75)',
        'rgba(100,116,139,0.4)',
      ],
    },
  ],
}))

const chartOptions = computed((): ChartOptions<'bar'> => {
  const tickColor = isDark.value ? 'rgb(156,163,175)' : 'rgb(75,85,99)'
  const gridColor = isDark.value ? 'rgba(75,85,99,0.3)' : 'rgba(156,163,175,0.3)'
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { color: tickColor },
        grid: { color: gridColor },
      },
      x: {
        ticks: { color: tickColor },
        grid: { color: gridColor },
      },
    },
  }
})
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 break-inside-avoid">
    <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{{ t('results.charts.cores') }}</h3>
    <div class="h-48 relative print:hidden">
      <Bar :data="chartData" :options="chartOptions" />
    </div>
    <!-- Print fallback: data table -->
    <table class="hidden print:table w-full text-sm border-collapse mt-2">
      <thead>
        <tr class="border-b border-gray-300">
          <th class="text-left py-1 font-medium">{{ t('results.charts.cores') }}</th>
          <th class="text-right py-1 font-medium">{{ t('results.charts.required') }}</th>
          <th class="text-right py-1 font-medium">{{ t('results.charts.available') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="py-1">{{ t('results.charts.cores') }}</td>
          <td class="text-right font-mono">{{ compute.totalCoresRequired }}</td>
          <td class="text-right font-mono">{{ compute.availableCores }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

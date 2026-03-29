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
      label: t('results.charts.ram'),
      data: [compute.value.totalRamRequiredGB, compute.value.availableRamGB],
      backgroundColor: [
        compute.value.totalRamRequiredGB > compute.value.availableRamGB
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
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
    <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{{ t('results.charts.ram') }}</h3>
    <div class="h-48 relative">
      <Bar :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>

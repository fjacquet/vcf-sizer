<script setup lang="ts">
import { computed, onMounted, watch, nextTick } from 'vue'
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
import type { ComputeResult } from '@/engine/types'
import { useUiStore } from '@/stores/uiStore'

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

const props = defineProps<{ compute: ComputeResult; domainId: string }>()

const { t } = useI18n()
const uiStore = useUiStore()
const isDark = usePreferredDark()

const canvasId = computed(() => 'ram-chart-' + props.domainId)

const chartData = computed((): ChartData<'bar'> => ({
  labels: [t('results.charts.required'), t('results.charts.available')],
  datasets: [
    {
      label: t('results.charts.ram'),
      data: [props.compute.totalRamRequiredGB, props.compute.availableRamGB],
      backgroundColor: [
        props.compute.totalRamRequiredGB > props.compute.availableRamGB
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
    animation: false,
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

function captureChartImage(): void {
  nextTick(() => {
    const chart = ChartJS.getChart(canvasId.value)
    if (chart) {
      uiStore.registerChartImage(props.domainId, 'ram', chart.toBase64Image())
    }
  })
}
onMounted(captureChartImage)
watch(() => props.compute, captureChartImage, { deep: true })
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 break-inside-avoid">
    <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{{ t('results.charts.ram') }}</h3>
    <div class="h-48 relative print:hidden">
      <Bar :id="canvasId" :data="chartData" :options="chartOptions" />
    </div>
    <!-- Print fallback: data table -->
    <table class="hidden print:table w-full text-sm border-collapse mt-2">
      <thead>
        <tr class="border-b border-gray-300">
          <th class="text-left py-1 font-medium">{{ t('results.charts.ram') }}</th>
          <th class="text-right py-1 font-medium">{{ t('results.charts.required') }}</th>
          <th class="text-right py-1 font-medium">{{ t('results.charts.available') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="py-1">{{ t('results.charts.ram') }}</td>
          <td class="text-right font-mono">{{ props.compute.totalRamRequiredGB }} GB</td>
          <td class="text-right font-mono">{{ props.compute.availableRamGB }} GB</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

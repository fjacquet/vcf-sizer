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
const { compute } = storeToRefs(calc)

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

const chartOptions: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { enabled: true },
  },
  scales: { y: { beginAtZero: true } },
}
</script>

<template>
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
    <h3 class="text-sm font-semibold text-gray-700 mb-2">{{ t('results.charts.ram') }}</h3>
    <div class="h-48 relative">
      <Bar :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>

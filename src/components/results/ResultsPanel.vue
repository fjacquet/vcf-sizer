<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useCalculationStore } from '@/stores/calculationStore'
import DomainResultCard from './DomainResultCard.vue'
import AggregateTotalsCard from './AggregateTotalsCard.vue'
import MgmtSizingTable from './MgmtSizingTable.vue'

const { t } = useI18n()
const calc = useCalculationStore()
const { domainResults, aggregateTotals, dedicatedMgmtHostCount } = storeToRefs(calc)

const reportDate = computed(() => new Date().toLocaleDateString())
</script>

<template>
  <div class="space-y-4 print:space-y-2">
    <!-- Export actions live in the global header (App.vue), next to the language/theme switchers. -->

    <!-- Print-only header: fixed position repeats on every page -->
    <div class="hidden print:flex fixed top-0 left-0 right-0 justify-between items-center text-xs text-gray-500 border-b border-gray-200 py-2 px-4 bg-white z-50">
      <span>{{ t('print.header.title') }}</span>
      <span>{{ reportDate }}</span>
    </div>

    <!-- Print-only footer: fixed position repeats on every page -->
    <div class="hidden print:flex fixed bottom-0 left-0 right-0 justify-center items-center text-xs text-gray-400 border-t border-gray-200 py-2 px-4 bg-white z-50">
      <span>{{ t('print.footer.attribution') }}</span>
    </div>

    <!-- Per-domain result cards -->
    <DomainResultCard
      v-for="result in domainResults"
      :key="result.id"
      :result="result"
    />

    <!-- Management sizing table (P4) — itemized appliances + WLD overhead -->
    <MgmtSizingTable />

    <!-- Aggregate totals card -->
    <AggregateTotalsCard
      :totals="aggregateTotals"
      :management-host-count="dedicatedMgmtHostCount"
    />
  </div>
</template>

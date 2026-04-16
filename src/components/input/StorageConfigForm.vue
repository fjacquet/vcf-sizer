<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInputStore } from '@/stores/inputStore'
import { useCalculationStore } from '@/stores/calculationStore'
import { createDefaultWorkloadDomain } from '@/engine/defaults'
import type { WorkloadDomainConfig } from '@/engine/types'
import WarningBanner from '@/components/shared/WarningBanner.vue'
import NumberSliderInput from '@/components/shared/NumberSliderInput.vue'
import { useStorageFormat } from '@/composables/useStorageFormat'

const { t } = useI18n()
const { fmt } = useStorageFormat()
const props = defineProps<{ domainId: string }>()
const input = useInputStore()
const calc = useCalculationStore()

function domainField<K extends keyof WorkloadDomainConfig>(key: K) {
  return computed({
    get: () => {
      const d = input.workloadDomains.find(d => d.id === props.domainId)
      return (d ?? createDefaultWorkloadDomain(0))[key]
    },
    set: (val: WorkloadDomainConfig[K]) => {
      input.updateDomain(props.domainId, { [key]: val } as Partial<WorkloadDomainConfig>)
    },
  })
}

const storageType = domainField('storageType')
const fttLevel = domainField('fttLevel')
const raidType = domainField('raidType')
const dedupEnabled = domainField('dedupEnabled')
const dedupRatio = domainField('dedupRatio')
const deploymentMode = domainField('deploymentMode')
const vsanMaxProfile = domainField('vsanMaxProfile')
const vsanMaxStorageNodes = domainField('vsanMaxStorageNodes')
const externalStorageUsableTiB = domainField('externalStorageUsableTiB')

const domainResult = computed(() =>
  calc.domainResults.find(r => r.id === props.domainId)
)
const storage = computed(() => domainResult.value?.storage)
const vsanMax = computed(() => domainResult.value?.vsanMax ?? null)
const validationErrors = computed(() => domainResult.value?.validationErrors ?? [])

const dedupExclusionError = computed(() =>
  validationErrors.value.find(e => e.code === 'DEDUP_STRETCH_EXCLUSION') ?? null
)
const isStretch = computed(() => deploymentMode.value === 'stretch')

const vsanMaxMinNodesError = computed(() =>
  validationErrors.value.find(e => e.code === 'VSAN_MAX_MIN_NODES') ?? null
)
const dedupNetworkSpeedError = computed(() =>
  validationErrors.value.find(e => e.code === 'DEDUP_NETWORK_SPEED') ?? null
)

const storageTypes = [
  { value: 'vsan-esa' as const, labelKey: 'storage.vsanEsa' },
  { value: 'fc' as const, labelKey: 'storage.fc' },
  { value: 'nfs' as const, labelKey: 'storage.nfs' },
  { value: 'vsan-max' as const, labelKey: 'storage.vsanMax' },
]
</script>

<template>
  <section class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
    <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">{{ t('storage.label') }}</h2>

    <!-- Storage type buttons (STOR-01) -->
    <div class="flex gap-2 flex-wrap">
      <button
        v-for="type in storageTypes"
        :key="type.value"
        :disabled="type.value === 'vsan-max' && isStretch"
        :title="type.value === 'vsan-max' && isStretch ? t('warnings.vsanMaxStretchExclusion') : ''"
        :aria-label="type.value === 'vsan-max' && isStretch
          ? `${t(type.labelKey)} — ${t('warnings.vsanMaxStretchExclusion')}`
          : t(type.labelKey)"
        :class="[
          'px-3 py-1.5 text-sm rounded border font-medium transition-colors',
          storageType === type.value
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400',
          type.value === 'vsan-max' && isStretch
            ? 'opacity-50 cursor-not-allowed hover:border-gray-300 dark:hover:border-gray-600'
            : ''
        ]"
        @click="storageType = type.value"
      >
        {{ t(type.labelKey) }}
      </button>
    </div>

    <!-- vSAN ESA options (STOR-02, STOR-04, STOR-05) -->
    <template v-if="storageType === 'vsan-esa'">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="space-y-1">
          <label class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('storage.fttLevel') }}</label>
          <select
            v-model="fttLevel"
            class="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option :value="1">FTT=1</option>
            <option :value="2">FTT=2</option>
          </select>
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('storage.raidType') }}</label>
          <select
            v-model="raidType"
            class="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="raid1">{{ t('storage.raid1') }}</option>
            <option value="raid5" :disabled="fttLevel === 2">{{ t('storage.raid5') }}</option>
            <option value="raid6" :disabled="fttLevel === 1">{{ t('storage.raid6') }}</option>
          </select>
        </div>
      </div>

      <!-- RAID scheme badge -->
      <div class="text-xs text-gray-500 dark:text-gray-400">
        {{ t('storage.raidType') }}: <span class="font-mono text-blue-700 dark:text-blue-400">{{ storage?.raidScheme ?? '—' }}</span>
        ({{ t('storage.minHosts', { count: storage?.minHostsRequired ?? 0 }) }})
      </div>

      <!-- Global Deduplication (STOR-05, STOR-06, STRCH-04) -->
      <div class="space-y-2">
        <label
          :class="['flex items-center gap-2', isStretch ? 'cursor-not-allowed opacity-50' : 'cursor-pointer']"
        >
          <input
            type="checkbox"
            v-model="dedupEnabled"
            :disabled="isStretch"
            class="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('storage.dedupEnabled') }}</span>
        </label>
        <!-- Stretch dedup mutual exclusion info (STRCH-04) -->
        <div
          v-if="isStretch"
          class="text-xs text-gray-500 dark:text-gray-400 italic"
        >
          {{ t('warnings.stretchDedup') }}
        </div>
        <WarningBanner
          v-if="dedupExclusionError"
          :message="t('warnings.dedupStretchExclusion')"
          severity="warning"
        />
        <WarningBanner
          v-if="dedupNetworkSpeedError"
          :message="t('validation.dedupNetworkSpeed')"
          severity="warning"
        />
        <NumberSliderInput
          v-if="dedupEnabled && !dedupExclusionError"
          v-model="dedupRatio"
          :label="t('storage.dedupRatio')"
          :min="1"
          :max="10"
          :step="0.5"
        />
      </div>
    </template>

    <!-- vSAN Max options (VMAX-01) -->
    <template v-if="storageType === 'vsan-max'">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <!-- Profile dropdown -->
        <div class="space-y-1">
          <label class="text-sm font-normal text-gray-700 dark:text-gray-300">
            {{ t('storage.vsanMaxProfile') }}
          </label>
          <select
            v-model="vsanMaxProfile"
            class="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="xs">XS — {{ fmt(20, 0) }}/node</option>
            <option value="sm">SM — {{ fmt(50, 0) }}/node</option>
            <option value="med">MED — {{ fmt(100, 0) }}/node</option>
            <option value="lrg">LRG — {{ fmt(150, 0) }}/node</option>
            <option value="xl">XL — {{ fmt(200, 0) }}/node</option>
          </select>
        </div>
        <!-- Storage nodes slider -->
        <NumberSliderInput
          v-model="vsanMaxStorageNodes"
          :label="t('storage.vsanMaxStorageNodes')"
          :min="4"
          :max="64"
          :step="1"
        />
      </div>
      <!-- VSAN_MAX_MIN_NODES error banner -->
      <WarningBanner
        v-if="vsanMaxMinNodesError"
        :message="t('validation.vsanMaxMinNodes')"
        severity="error"
      />
    </template>

    <!-- FC/NFS external pool sizing — exposes the pass-through capacity input -->
    <template v-if="storageType === 'fc' || storageType === 'nfs'">
      <NumberSliderInput
        v-model="externalStorageUsableTiB"
        :label="t('storage.externalPoolInput')"
        unit="TiB"
        :min="10"
        :max="2000"
        :step="10"
      />
    </template>

    <!-- Storage capacity summary (STOR-08) -->
    <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-3">
      <!-- Raw capacity (vSAN types only — FC/NFS show pool below) -->
      <template v-if="storageType !== 'fc' && storageType !== 'nfs'">
        <span>{{ t('storage.rawCapacity') }}</span>
        <span class="font-mono text-right">
          {{ storageType === 'vsan-max' && vsanMax ? fmt(vsanMax.rawCapacityTiB) : fmt(storage?.rawCapacityTiB ?? 0) }}
        </span>
      </template>
      <template v-if="storageType === 'vsan-esa'">
        <span>{{ t('storage.raidOverhead') }}</span>
        <span class="font-mono text-right">{{ storage?.raidMultiplier ?? 0 }}x</span>
        <span>{{ t('storage.netUsable') }}</span>
        <span class="font-mono text-right text-green-700 dark:text-green-400 font-semibold">
          {{ fmt(storage?.safeUsableCapacityTiB ?? 0) }}
        </span>
      </template>
      <template v-else-if="storageType === 'vsan-max' && vsanMax">
        <span>{{ t('storage.raidOverhead') }}</span>
        <span class="font-mono text-right">{{ vsanMax.raidScheme }}</span>
        <span>{{ t('storage.netUsable') }}</span>
        <span class="font-mono text-right text-green-700 dark:text-green-400 font-semibold">
          {{ fmt(vsanMax.usableCapacityTiB) }}
        </span>
      </template>
      <template v-else>
        <!-- FC/NFS: workload demand + external pool capacity -->
        <template v-if="(storage?.workloadStorageRequiredTiB ?? 0) > 0">
          <span>{{ t('storage.workloadRequired') }}</span>
          <span class="font-mono text-right text-blue-700 dark:text-blue-400 font-semibold">
            {{ fmt(storage!.workloadStorageRequiredTiB) }}
          </span>
        </template>
        <span>{{ t('storage.externalPool') }}</span>
        <span class="font-mono text-right text-green-700 dark:text-green-400 font-semibold">
          {{ fmt(storage?.rawCapacityTiB ?? 0) }}
        </span>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInputStore } from '@/stores/inputStore'
import { useCalculationStore } from '@/stores/calculationStore'
import type { ManagementDomainConfig } from '@/engine/types'
import type { MgmtProfile } from '@/engine/mgmt/types'
import NumberSliderInput from '@/components/shared/NumberSliderInput.vue'
import ConfirmationDialog from '@/components/shared/ConfirmationDialog.vue'
import MgmtCapacityHeadroom from './MgmtCapacityHeadroom.vue'
import MgmtOptionalAppliances from './MgmtOptionalAppliances.vue'
import MgmtValidatedSolutions from './MgmtValidatedSolutions.vue'
import MgmtAdvancedSizing from './MgmtAdvancedSizing.vue'

const { t } = useI18n()
const input = useInputStore()
const calc = useCalculationStore()

function mgmtField<K extends keyof ManagementDomainConfig>(key: K) {
  return computed({
    get: () => input.managementDomain[key],
    set: (val: ManagementDomainConfig[K]) => input.updateManagementDomain({ [key]: val } as Partial<ManagementDomainConfig>),
  })
}

const coresPerSocket = mgmtField('coresPerSocket')
const socketsPerHost = mgmtField('socketsPerHost')
const hostRamGB = mgmtField('hostRamGB')
const hostStorageTiB = mgmtField('hostStorageTiB')
const storageType = mgmtField('storageType')
const deploymentMode = mgmtField('deploymentMode')
const profile = mgmtField('profile')
const vsanMaxProfile = mgmtField('vsanMaxProfile')

// vSAN Max storage nodes — wrap with a numeric default for the slider (4 = min)
const vsanMaxStorageNodes = computed<number>({
  get: () => input.managementDomain.vsanMaxStorageNodes ?? 4,
  set: (val: number) => input.updateManagementDomain({ vsanMaxStorageNodes: val }),
})

const managementArchitecture = computed({
  get: () => input.managementArchitecture,
  set: (val: 'colocated' | 'dedicated') => { input.managementArchitecture = val },
})

const management = computed(() => calc.management)
const dedicatedMgmtHostCount = computed(() => calc.dedicatedMgmtHostCount)

const totalCoresPerHost = computed(() => coresPerSocket.value * socketsPerHost.value)

const profileChangeDialogOpen = ref(false)
const pendingProfile = ref<MgmtProfile | null>(null)

const overrideCount = computed(() => Object.keys(input.managementDomain.overrides ?? {}).length)

function attemptProfileChange(next: MgmtProfile) {
  if (overrideCount.value === 0 || profile.value === next) {
    profile.value = next
    return
  }
  pendingProfile.value = next
  profileChangeDialogOpen.value = true
}

function confirmProfileChange() {
  if (pendingProfile.value !== null) {
    input.updateManagementDomain({
      profile: pendingProfile.value,
      overrides: {},
    })
  }
  pendingProfile.value = null
  profileChangeDialogOpen.value = false
}

function cancelProfileChange() {
  pendingProfile.value = null
  profileChangeDialogOpen.value = false
}
</script>

<template>
  <section class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
    <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">{{ t('domain.managementSection') }}</h2>

    <!-- Management architecture toggle (ARCH-01/02) — global, not per-domain -->
    <div class="space-y-2">
      <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
        {{ t('deployment.architecture.label') }}
      </label>
      <div class="flex gap-2">
        <button
          v-for="arch in [
            { value: 'colocated' as const, labelKey: 'deployment.architecture.shared' },
            { value: 'dedicated' as const, labelKey: 'deployment.architecture.dedicated' },
          ]"
          :key="arch.value"
          :class="[
            'px-3 py-1.5 text-sm rounded border font-medium transition-colors',
            managementArchitecture === arch.value
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
          ]"
          @click="managementArchitecture = arch.value"
        >
          {{ t(arch.labelKey) }}
        </button>
      </div>
    </div>

    <!-- Management storage type — determines min host count (vSAN: 4, FC/NFS: 2) -->
    <div class="space-y-2">
      <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
        {{ t('management.storageType') }}
      </label>
      <div class="flex gap-2 flex-wrap">
        <button
          v-for="opt in [
            { value: 'vsan-esa' as const, labelKey: 'storage.vsanEsa' },
            { value: 'fc'       as const, labelKey: 'storage.fc'      },
            { value: 'nfs'      as const, labelKey: 'storage.nfs'     },
            { value: 'vsan-max' as const, labelKey: 'storage.vsanMax' },
          ]"
          :key="opt.value"
          :class="[
            'px-3 py-1.5 text-sm rounded border font-medium transition-colors',
            storageType === opt.value
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
          ]"
          @click="storageType = opt.value"
        >
          {{ t(opt.labelKey) }}
        </button>
      </div>
    </div>

    <!-- vSAN Max conditional inputs (P4) — only when storageType is vsan-max -->
    <div v-if="storageType === 'vsan-max'" class="space-y-3 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded">
      <p class="text-xs text-amber-800 dark:text-amber-200">{{ t('mgmt.vsanMax.warning') }}</p>
      <NumberSliderInput
        v-model="vsanMaxStorageNodes"
        :label="t('mgmt.vsanMax.storageNodes')"
        :min="4"
        :max="64"
        :step="1"
      />
      <div class="space-y-1">
        <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
          {{ t('mgmt.vsanMax.profile') }}
        </label>
        <div class="flex gap-2 flex-wrap">
          <button
            v-for="opt in [
              { value: 'xs' as const,  label: 'XS' },
              { value: 'sm' as const,  label: 'SM' },
              { value: 'med' as const, label: 'MED' },
              { value: 'lrg' as const, label: 'LRG' },
              { value: 'xl' as const,  label: 'XL' },
            ]"
            :key="opt.value"
            :class="[
              'px-3 py-1.5 text-sm rounded border font-medium transition-colors',
              vsanMaxProfile === opt.value
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
            ]"
            @click="vsanMaxProfile = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- Profile selector (P4) — Lab / Standard / Large -->
    <div class="space-y-2">
      <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
        {{ t('mgmt.profile.label') }}
      </label>
      <div class="flex gap-2">
        <button
          v-for="opt in [
            { value: 'lab' as const,      labelKey: 'mgmt.profile.lab' },
            { value: 'standard' as const, labelKey: 'mgmt.profile.standard' },
            { value: 'large' as const,    labelKey: 'mgmt.profile.large' },
          ]"
          :key="opt.value"
          :class="[
            'px-3 py-1.5 text-sm rounded border font-medium transition-colors',
            profile === opt.value
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
          ]"
          @click="attemptProfileChange(opt.value)"
        >
          {{ t(opt.labelKey) }}
        </button>
      </div>
      <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('mgmt.profile.hint') }}</p>
    </div>

    <!-- Management deployment mode — read-only, inherited from Step 1 topology -->
    <div class="space-y-1">
      <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
        {{ t('deployment.label') }}
      </label>
      <p class="text-sm text-gray-500 dark:text-gray-400">
        <span class="inline-block px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 font-medium mr-2">
          {{ t('deployment.' + deploymentMode) }}
        </span>
        <span class="text-xs text-gray-400 dark:text-gray-500">{{ t('wizard.step2.topologyLockedHint') }}</span>
      </p>
    </div>

    <!-- Management host specs -->
    <div class="space-y-2">
      <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('domain.managementHostSpecs') }}</h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <NumberSliderInput
          v-model="coresPerSocket"
          :label="t('host.coresPerSocket')"
          :min="4"
          :max="64"
          :step="2"
        />
        <NumberSliderInput
          v-model="socketsPerHost"
          :label="t('host.socketsPerHost')"
          :min="1"
          :max="8"
          :step="1"
        />
        <div class="text-sm text-gray-600 dark:text-gray-400 sm:col-span-2">
          {{ t('host.totalCores') }}:
          <span class="text-gray-900 dark:text-gray-100 font-semibold">{{ totalCoresPerHost }}</span>
        </div>
        <NumberSliderInput
          v-model="hostRamGB"
          :label="t('host.ramGB')"
          unit="GB"
          :min="64"
          :max="6144"
          :step="64"
        />
        <NumberSliderInput
          v-if="storageType === 'vsan-esa'"
          v-model="hostStorageTiB"
          :label="t('host.storageTB')"
          unit="TiB"
          :min="0.96"
          :max="30.72"
          :step="0.96"
        />
      </div>
    </div>

    <MgmtCapacityHeadroom />

    <MgmtOptionalAppliances />

    <MgmtValidatedSolutions />

    <MgmtAdvancedSizing />

    <!-- Management domain overhead summary -->
    <div class="text-xs text-gray-500 dark:text-gray-400 grid grid-cols-2 gap-x-4 gap-y-1 pt-2 border-t border-gray-100 dark:border-gray-700">
      <span>{{ t('management.totalCores') }}</span>
      <span class="font-mono text-right">{{ management.totalCores }}</span>
      <span>{{ t('management.totalRam') }}</span>
      <span class="font-mono text-right">{{ management.totalRamGB }} GB</span>
      <template v-if="dedicatedMgmtHostCount !== null">
        <span>{{ t('deployment.architecture.dedicatedHosts') }}</span>
        <span class="font-mono text-right font-semibold">{{ dedicatedMgmtHostCount }}</span>
      </template>
    </div>

    <ConfirmationDialog
      :visible="profileChangeDialogOpen"
      :title="t('mgmt.confirmProfileChange.title')"
      :message="t('mgmt.confirmProfileChange.message', { count: overrideCount })"
      :confirm-label="t('mgmt.confirmProfileChange.confirm')"
      :cancel-label="t('mgmt.confirmProfileChange.cancel')"
      @confirm="confirmProfileChange"
      @cancel="cancelProfileChange"
    />
  </section>
</template>

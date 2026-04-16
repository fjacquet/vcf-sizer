<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInputStore } from '@/stores/inputStore'
import { useUiStore } from '@/stores/uiStore'
import LanguageSwitcher from '@/components/shared/LanguageSwitcher.vue'
import WizardStepper from '@/components/shared/WizardStepper.vue'
import TopologySelector from '@/components/shared/TopologySelector.vue'
import DomainTabStrip from '@/components/shared/DomainTabStrip.vue'
import DeploymentModelSelector from '@/components/input/DeploymentModelSelector.vue'
import HostSpecsForm from '@/components/input/HostSpecsForm.vue'
import WorkloadProfileForm from '@/components/input/WorkloadProfileForm.vue'
import StorageConfigForm from '@/components/input/StorageConfigForm.vue'
import ManagementDomainSection from '@/components/input/ManagementDomainSection.vue'
import ManagementSummary from '@/components/shared/ManagementSummary.vue'
import ManagementResultCard from '@/components/shared/ManagementResultCard.vue'
import ManagementCommittedSummary from '@/components/shared/ManagementCommittedSummary.vue'
import ResultsPanel from '@/components/results/ResultsPanel.vue'
import LandingView from '@/components/shared/LandingView.vue'

const { t } = useI18n()
const input = useInputStore()
const ui = useUiStore()

// Derive active domain ID from activeDomainIndex
// Fallback to first domain if index is somehow out of bounds
const activeDomainId = computed(
  () => input.workloadDomains[input.activeDomainIndex]?.id ?? input.workloadDomains[0].id
)
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950 font-sans">
    <header class="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between sticky top-0 z-10 print:hidden">
      <h1 class="text-lg font-bold text-gray-900 dark:text-gray-100">{{ t('app.title') }}</h1>
      <LanguageSwitcher />
    </header>

    <LandingView v-if="ui.isLandingVisible" />

    <main v-else class="grid grid-cols-1 md:grid-cols-2 min-h-[calc(100vh-56px)] print:grid-cols-1 print:min-h-0">
      <!-- LEFT PANE: wizard steps -->
      <div class="border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-6 overflow-y-auto print:hidden">
        <!-- Wizard stepper — always visible at top of left pane (WIZARD-01) -->
        <WizardStepper />

        <!-- Step 1: Topology (WIZARD-01 step 1) -->
        <!-- v-show (NOT v-if) — all panels stay mounted, data preserved on back-nav (WIZARD-02) -->
        <div v-show="ui.currentWizardStep === 1" class="space-y-4">
          <TopologySelector />
        </div>

        <!-- Step 2: Management (WIZARD-01 step 2) -->
        <div v-show="ui.currentWizardStep === 2" class="space-y-4">
          <ManagementDomainSection />
          <ManagementSummary />
          <!-- ManagementResultCard at bottom of step 2 (WIZARD-05) -->
          <ManagementResultCard />
        </div>

        <!-- Step 3: Workloads (WIZARD-01 step 3) -->
        <!-- Order: Deployment → Storage → Host Specs → Workloads.
             Storage comes before Host Specs so storageType-driven v-if branches
             in HostSpecsForm render in their final shape on first paint. -->
        <div v-show="ui.currentWizardStep === 3" class="space-y-4">
          <!-- ManagementCommittedSummary at top of step 3, collapsed by default (WIZARD-06) -->
          <ManagementCommittedSummary />
          <DomainTabStrip />
          <!-- Transient auto-correction banner — fires when inputStore.updateDomain()
               normalizes an incompatible field combo (e.g., dedup off on switch to stretch). -->
          <div
            v-if="ui.autoCorrectionMessageKey"
            class="flex items-start gap-2 p-3 rounded-md border bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-sm"
            role="status"
          >
            <span class="flex-1">{{ t(ui.autoCorrectionMessageKey) }}</span>
            <button
              class="text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 font-bold px-1"
              aria-label="Dismiss"
              @click="ui.dismissAutoCorrection"
            >&times;</button>
          </div>
          <DeploymentModelSelector :domainId="activeDomainId" />
          <StorageConfigForm :domainId="activeDomainId" />
          <HostSpecsForm :domainId="activeDomainId" />
          <WorkloadProfileForm :domainId="activeDomainId" />
        </div>
      </div>
      <!-- RIGHT PANE: results — always visible regardless of wizard step -->
      <div class="px-4 py-6 bg-gray-50 dark:bg-gray-950 overflow-y-auto print:col-span-2">
        <ResultsPanel />
      </div>
    </main>
  </div>
</template>

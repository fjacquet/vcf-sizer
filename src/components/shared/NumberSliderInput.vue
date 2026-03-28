<script setup lang="ts">
const props = defineProps<{
  modelValue: number
  label: string
  min: number
  max: number
  step?: number
  unit?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

function onInput(e: Event) {
  const val = Number((e.target as HTMLInputElement).value)
  if (!isNaN(val)) emit('update:modelValue', val)
}
</script>

<template>
  <div class="flex flex-col gap-1">
    <label class="text-sm font-medium text-gray-700">
      {{ props.label }}
      <span v-if="props.unit" class="text-gray-400 font-normal ml-1">{{ props.unit }}</span>
    </label>
    <div class="flex items-center gap-3">
      <input
        type="number"
        :value="props.modelValue"
        :min="props.min"
        :max="props.max"
        :step="props.step ?? 1"
        class="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
        @input="onInput"
        @change="onInput"
      />
      <input
        type="range"
        :value="props.modelValue"
        :min="props.min"
        :max="props.max"
        :step="props.step ?? 1"
        class="flex-1 accent-blue-600"
        @input="onInput"
      />
    </div>
  </div>
</template>

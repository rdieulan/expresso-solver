<template>
  <div class="card mb-3">
    <div class="card-body">
      <form @submit.prevent>
        <div class="mb-2">
          <label>Profil actif</label>
          <div class="d-flex gap-2">
            <select :value="activeProfile" class="form-select" @change="onActiveChange">
              <option v-if="profiles.length === 0" disabled>(aucun profil)</option>
              <option v-else disabled :value="null">Sélectionner un profil</option>
              <option v-for="p in profiles" :key="p" :value="p">{{ p }}</option>
            </select>
            <button type="button" class="btn btn-outline-secondary" @click="$emit('fetch-profiles')">↻</button>
          </div>
        </div>

        <div class="mb-2">
          <label>Nombre de joueurs</label>
          <select :value="players" class="form-select" @change="onPlayersChange">
            <option value="2">2</option>
            <option value="3">3</option>
          </select>
        </div>

        <div class="mb-2">
          <label>Profondeur (bb)</label>
          <input :value="depth" @input="onDepthChange" type="number" class="form-control" min="5" max="15" />
        </div>

        <div class="mb-2">
          <label>Main</label>
          <input :value="hand" @input="onHandChange" type="text" class="form-control" />
        </div>

      </form>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'SettingsPanel',
  props: {
    players: { type: String, required: true },
    depth: { type: [Number, String], required: true },
    hand: { type: String, required: true },
    profiles: { type: Array as () => string[], required: true },
    activeProfile: { type: [String, null], required: false }
  },
  emits: ['update:players', 'update:depth', 'update:hand', 'update:activeProfile', 'fetch-profiles'],
  methods: {
    onActiveChange(e: Event) {
      const v = (e.target as HTMLSelectElement)?.value ?? null
      this.$emit('update:activeProfile', v)
    },
    onPlayersChange(e: Event) {
      const v = (e.target as HTMLSelectElement)?.value
      this.$emit('update:players', v)
    },
    onDepthChange(e: Event) {
      const v = Number((e.target as HTMLInputElement)?.value)
      this.$emit('update:depth', v)
    },
    onHandChange(e: Event) {
      const v = (e.target as HTMLInputElement)?.value
      this.$emit('update:hand', v)
    }
  }
})
</script>

<style scoped>
/* nothing special */
</style>

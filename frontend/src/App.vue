<template>
  <div class="container py-3 app-container">
    <div class="d-flex align-items-center mb-3">
      <h1 class="h4 mb-0">Expresso Solver — UI (Vue + TS)</h1>
      <small class="text-muted ms-3">(préflop)</small>
    </div>

    <div class="row">
      <div class="col-lg-9"> <!-- colonne éditeur élargie (75%) -->
        <DecisionsTable :decisionColumns="decisionColumns" :decisionsMatrix="decisionsMatrix" :heroPositions="heroPositions" :colLabel="colLabel" />

        <div class="card mb-3">
          <div class="card-body">
            <h6 class="card-title">Éditeur de ranges</h6>
            <div class="mb-2 d-flex gap-2 align-items-center">
              <select v-model="scenario" class="form-select form-select-sm" style="width:160px">
                <option value="Open">Open</option>
                <option value="VsOpen">VsOpen</option>
                <option value="VsShove">VsShove</option>
              </select>

              <select v-model="villain" class="form-select form-select-sm" style="width:120px">
                <option v-for="v in villainOptions" :key="v" :value="v">{{ v }}</option>
              </select>

              <select v-model="cellAction" class="form-select form-select-sm" style="width:120px">
                <option value="raise">raise</option>
                <option value="shove">shove</option>
                <option value="call">call</option>
                <option value="fold">fold</option>
              </select>

              <input v-model.number="cellPct" type="number" min="1" max="100" class="form-control form-control-sm" style="width:90px" />
            </div>

            <div class="mb-2 d-flex gap-2">
              <button class="btn btn-sm btn-outline-secondary" @click="reload">Reload</button>
              <button class="btn btn-sm btn-primary" @click="save">Save</button>
              <button class="btn btn-sm btn-outline-secondary" @click="exportJson">Export JSON</button>
            </div>

            <RangeGrid
              :rangeNode="currentPositionNode"
              :decisions="decisions"
              :scenario="scenario"
              :villain="villain"
              :cellAction="cellAction"
              :cellPct="cellPct"
              @cell-clicked="onCellClicked"
            />
          </div>
        </div>
      </div>

      <div class="col-lg-3 middle-column">
        <SettingsPanel
          v-model:players="players"
          v-model:depth="depth"
          v-model:hand="hand"
          v-model:activeProfile="activeProfile"
          :profiles="profiles"
          @fetch-profiles="fetchProfiles"
        />
      </div>

    </div>

  </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, computed, watch } from 'vue'
import RangeGrid from './components/RangeGrid.vue'
import DecisionsTable from './components/DecisionsTable.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import { fetchProfilesAPI, fetchCurrentAPI, decideAPI, uploadProfileAPI, activateProfileAPI } from './api'

export default defineComponent({
  components: { RangeGrid, DecisionsTable, SettingsPanel },
  setup() {
    const players = ref('3')
    const depth = ref(10)
    const hand = ref('AKs')
    const profiles = ref<string[]>([])
    const activeProfile = ref<string | null>(null)
    const decisions = ref<any[]>([])
    const currentPositionNode = ref<any>(null)
    const lastJson = ref<any>(null)
    const metaLine = ref('Aucune requête effectuée.')
    const outputText = ref('')

    const scenario = ref('Open')
    const villain = ref(null as string | null)
    const villainOptions = computed(() => {
      const hero = (heroPositions.value && heroPositions.value.length > 0) ? heroPositions.value[0] : 'BTN'
      return Number(players.value) === 2 ? (hero === 'SB' ? ['BB'] : ['SB']) : ['BTN','SB','BB'].filter(p => p !== hero)
    })

    const cellAction = ref('raise')
    const cellPct = ref(100)

    const decisionsMatrix = ref<Record<string, Record<string, any>>>({})
    const decisionColumns = ref<string[]>([])

    // heroPositions devient un ref modifiable : on le remplit à partir de la réponse API (meta.heroPositions) si possible
    const heroPositions = ref<string[]>(allowedPositionsForPlayers(players.value))

    async function fetchProfiles() {
      try {
        const body = await fetchProfilesAPI()
        // handle non-JSON fallback from API helper
        if (body && typeof body === 'object' && body.raw) {
          console.warn('fetchProfilesAPI returned non-JSON:', body.raw)
          // fallback: try /api/current which returns availableProfiles/activeProfile
          try {
            const cur = await fetchCurrentAPI()
            if (cur && typeof cur === 'object') {
              const names = cur.availableProfiles || cur.available || cur.available_profiles || []
              if (Array.isArray(names) && names.length > 0) {
                profiles.value = names.map((n:any)=>String(n))
                activeProfile.value = cur.activeProfile || cur.active || (profiles.value.length > 0 ? profiles.value[0] : null)
                metaLine.value = 'Profils récupérés depuis /api/current (fallback)'
                outputText.value = ''
                return
              }
            }
          } catch (e:any) {
            console.warn('fetchCurrentAPI fallback failed', e)
          }
          profiles.value = []
          activeProfile.value = null
          metaLine.value = 'Erreur: réponse non-JSON depuis /api/profiles'
          outputText.value = String(body.raw)
          return
        }

        const p = body && body.profiles
        if (!p) {
          // fallback: body might be an object mapping name->profile
          if (body && typeof body === 'object') {
            // if it's a map: extract keys
            profiles.value = Object.keys(body)
            activeProfile.value = (profiles.value.length > 0 ? profiles.value[0] : null)
            return
          }
          profiles.value = []
          activeProfile.value = null
          return
        }

        if (Array.isArray(p)) {
          // backend returns array of { name, active }
          if (p.length > 0 && typeof p[0] === 'object' && 'name' in p[0]) {
            profiles.value = (p as any[]).map(x => String(x.name))
            const active = (p as any[]).find(x => x.active)
            activeProfile.value = active ? String(active.name) : (profiles.value.length > 0 ? profiles.value[0] : null)
          } else {
            // array of strings
            profiles.value = p as string[]
            activeProfile.value = body.active || (profiles.value.length > 0 ? profiles.value[0] : null)
          }
        } else if (typeof p === 'object') {
          // object map: keys are profile names
          profiles.value = Object.keys(p as Record<string, unknown>)
          activeProfile.value = body.active || (profiles.value.length > 0 ? profiles.value[0] : null)
        } else {
          profiles.value = []
          activeProfile.value = null
        }
      } catch (e:any) { console.warn(e); profiles.value = []; activeProfile.value = null }
    }

    function allowedPositionsForPlayers(p: string | number) {
      const n = Number(p)
      return n === 2 ? ['SB', 'BB'] : ['BTN', 'SB', 'BB']
    }

    function scenOrder(k: string) {
      // Nouvelle logique de tri demandée :
      // 0_ => Open
      // 1_ => Vs<anything> BTN
      // 2_ => Vs<anything> SB
      // 3_ => Vs<anything> BB
      // 9_ => autres
      if (!k) return '9_' + k
      if (k.startsWith('Open')) return '0_' + k
      if (k.startsWith('Vs')) {
        const rest = k.substring(2)
        // détecte le villain dans la clé (BTN, SB, BB)
        const hasBTN = /BTN$|BTN/.test(rest)
        const hasSB = /SB$|SB/.test(rest)
        const hasBB = /BB$|BB/.test(rest)
        if (hasBTN) return '1_' + k
        if (hasSB) return '2_' + k
        if (hasBB) return '3_' + k
        return '4_' + k
      }
      return '9_' + k
    }

    async function buildDecisionsTable() {
      // Build matrix from decisions.value (single API response that contains decisions for all hero positions)
      const heroPositionsList = heroPositions.value && heroPositions.value.length > 0 ? heroPositions.value : allowedPositionsForPlayers(players.value)
      const colsSet = new Set<string>()
      const matrix: Record<string, Record<string, any>> = {}

      // initialize empty rows
      for (const h of heroPositionsList) matrix[h] = {}

      const allDecisions = decisions.value || []
      for (const d of allDecisions) {
        const hero = d.heroPos || (heroPositionsList.length > 0 ? heroPositionsList[0] : 'BTN')
        const sc = String(d.scenario || '')
        const key = sc + (d.villain ? (' ' + String(d.villain)) : '')

        // normalize and store
        if (d && typeof d === 'object') {
          const hasProbs = !!(d.probs || d.probabilities)
          const probsVal = d.probs || d.probabilities
          const actVal = d.action ? String(d.action).toUpperCase() : undefined
          if (hasProbs) {
            matrix[hero][key] = { probs: probsVal, action: actVal }
          } else if (d.action) {
            matrix[hero][key] = { action: String(d.action).toUpperCase() }
          } else {
            matrix[hero][key] = { raw: d }
          }
        } else {
          matrix[hero][key] = { action: String(d).toUpperCase() }
        }
        colsSet.add(key)
      }

      // ensure deterministic column order
      const cols = Array.from(colsSet)
      cols.sort((a,b)=> {
        const oa = scenOrder(a)
        const ob = scenOrder(b)
        if (oa < ob) return -1
        if (oa > ob) return 1
        return a.localeCompare(b)
      })

      // ensure Open present at least
      if (!cols.includes('Open')) cols.unshift('Open')

      decisionsMatrix.value = matrix
      decisionColumns.value = cols
    }

    async function decide() {
      metaLine.value = 'En attente...'
      try {
        // Request once for all hero positions. Backend will return decisions for each heroPos.
        const data = await decideAPI({ players: players.value, depth: depth.value, hand: hand.value })
        lastJson.value = data
        // backend returns data.decisions as an array with heroPos on each item
        decisions.value = data.decisions || []
        // use heroPositions from API meta if provided, otherwise derive from decisions
        const fromMeta = data && data.meta && Array.isArray(data.meta.heroPositions) ? data.meta.heroPositions.map((p:any)=>String(p)) : null
        if (fromMeta && fromMeta.length > 0) {
          heroPositions.value = fromMeta
        } else {
          const hp = new Set<string>()
          for (const d of decisions.value) if (d && d.heroPos) hp.add(String(d.heroPos))
          if (hp.size > 0) heroPositions.value = Array.from(hp)
          else heroPositions.value = allowedPositionsForPlayers(players.value)
        }

        // keep backward-compatible currentPositionNode using returned `range` (first hero)
        currentPositionNode.value = data.range || {}
        outputText.value = JSON.stringify(data, null, 2)
        metaLine.value = 'OK — réponses reçues'
        // build the table locally from the single response
        await buildDecisionsTable()
      } catch (e:any) { metaLine.value = 'Erreur'; outputText.value = String(e.message || e) }
    }

    async function reload() { await decide() }
    async function save() {
      if (!currentPositionNode.value) { alert('Aucune range chargée'); return }
      const heroPos = (heroPositions.value && heroPositions.value.length > 0) ? heroPositions.value[0] : 'BTN'
      const payload = { [players.value]: { [String(depth.value)]: { [heroPos]: currentPositionNode.value } } }
      const name = 'edited-' + Date.now()
      await uploadProfileAPI(name, payload)
      await fetchProfiles()
      alert('Profil uploadé: ' + name)
    }
    function onCellClicked(handLabel:string, scenarioParam:string, villainParam:string|null, fragment:any) {
      if (!currentPositionNode.value) currentPositionNode.value = {}
      const sc = scenarioParam || scenario.value
      if (sc === 'Open') {
        if (!currentPositionNode.value.Open) currentPositionNode.value.Open = {}
        currentPositionNode.value.Open[handLabel] = fragment
      } else if (sc === 'VsOpen') {
        // villainParam doit être non-null pour ce scénario
        if (!villainParam) return
        if (!currentPositionNode.value.VsOpen) currentPositionNode.value.VsOpen = {}
        if (!currentPositionNode.value.VsOpen[villainParam]) currentPositionNode.value.VsOpen[villainParam] = {}
        currentPositionNode.value.VsOpen[villainParam][handLabel] = fragment
      } else if (sc === 'VsShove') {
        // villainParam doit être non-null pour ce scénario
        if (!villainParam) return
        if (!currentPositionNode.value.VsShove) currentPositionNode.value.VsShove = {}
        if (!currentPositionNode.value.VsShove[villainParam]) currentPositionNode.value.VsShove[villainParam] = {}
        currentPositionNode.value.VsShove[villainParam][handLabel] = fragment
      }
    }

    // initial load
    onMounted(async ()=>{ await fetchProfiles(); await decide() })

    // export helper (used by UI)
    function exportJson() {
      const what = currentPositionNode.value || lastJson.value || {}
      try {
        const content = JSON.stringify(what, null, 2)
        const blob = new Blob([content], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'export-' + Date.now() + '.json'
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
      } catch (e:any) {
        alert('Erreur d\'export: ' + String(e?.message || e))
      }
    }

    function colLabel(key: string) {
      if (!key) return ''
      if (key.startsWith('Open')) return 'OPEN'
      if (key.startsWith('VsOpen')) {
        const rest = key.substring('VsOpen'.length)
        // our keys may have a leading space between scenario and villain
        const trimmed = rest.trim()
        return trimmed ? `VsOpen ${trimmed}` : 'VsOpen'
      }
      if (key.startsWith('VsShove')) {
        const rest = key.substring('VsShove'.length)
        const trimmed = rest.trim()
        return trimmed ? `VsShove ${trimmed}` : 'VsShove'
      }
      return key
    }

    // watcher pour activeProfile : active le profil côté backend puis recalcule
    watch(activeProfile, async (newV) => {
      if (!newV) return
      try {
        await activateProfileAPI(String(newV))
        // refresh la liste/état des profils
        await fetchProfiles()
      } catch (e:any) {
        console.warn('activateProfileAPI failed', e)
      }
      try { await decide() } catch (e) { /* ignore */ }
    })

    // watch autres settings (players/depth/hand)
    watch([players, depth, hand], async () => {
      try { await decide() } catch (e) { /* ignore */ }
    })

    return { players, depth, hand, profiles, activeProfile, decisions, currentPositionNode, lastJson, metaLine, outputText, fetchProfiles, decide, reload, save, scenario, villain, villainOptions, cellAction, cellPct, onCellClicked, exportJson, decisionsMatrix, decisionColumns, colLabel, heroPositions }
  }
})
</script>

<style scoped>
.app-container {
  max-width: 1800px;
  margin: 0 auto;
}
</style>

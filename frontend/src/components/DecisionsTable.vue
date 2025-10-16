<template>
  <div class="card mb-3">
    <div class="card-body">
      <h6>Décisions</h6>
      <div>
        <div v-if="decisionColumns.length === 0" class="small text-muted">(aucune donnée)</div>
        <div v-else class="table-responsive">
          <table class="table table-sm table-bordered mb-0 decisions-table">
            <thead>
              <tr>
                <th style="width:80px">Position</th>
                <th v-for="col in decisionColumns" :key="col" class="text-center">{{ colLabel(col) }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="hero in heroPositions" :key="hero">
                <td class="fw-bold align-middle">{{ hero }}</td>
                <td v-for="col in decisionColumns" :key="col" class="align-middle text-center">
                  <div v-if="cellFor(hero, col).type === 'na'" class="na-cell">N/A</div>

                  <div v-else-if="cellFor(hero, col).type === 'det'" class="det-cell rounded" :style="{ background: colorFor(cellFor(hero,col).action) }">
                    <span :class="textClassFor(cellFor(hero,col).action)">{{ cellFor(hero,col).action }}</span>
                  </div>

                  <div v-else-if="cellFor(hero, col).type === 'prob'" class="prob-cell rounded position-relative">
                    <div class="prob-bar d-flex rounded">
                      <div v-for="(s, idx) in cellFor(hero,col).segments" :key="idx" class="prob-seg" :style="{ width: s.width + '%', background: s.color }"></div>
                    </div>
                    <div class="prob-overlay">{{ cellFor(hero,col).chosen }}</div>
                  </div>

                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue'

export default defineComponent({
  name: 'DecisionsTable',
  props: {
    decisionColumns: { type: Array as () => string[], required: true },
    decisionsMatrix: { type: Object as () => Record<string, Record<string, any>>, required: true },
    heroPositions: { type: Array as () => string[], required: true },
    colLabel: { type: Function as unknown as () => (s:string)=>string, required: true }
  },
  setup(props) {
    // color map
    const actionColor: Record<string,string> = {
      'FOLD': '#6c757d',
      'CALL': '#0d6efd',
      'RAISE': '#ffc107',
      'SHOVE': '#dc3545'
    }

    function colorFor(action?: string) {
      if (!action) return '#f5f5f5'
      const a = String(action).toUpperCase()
      return actionColor[a] || '#eeeeee'
    }

    function textClassFor(action?: string) {
      if (!action) return ''
      const a = String(action).toUpperCase()
      // for RAISE (yellow) prefer dark text, otherwise white
      if (a === 'RAISE') return 'text-dark fw-bold'
      return 'text-white fw-bold'
    }

    function sampleChoice(probs: Record<string, number>) {
      const entries = Object.keys(probs).map(k => ({ k: k.toUpperCase(), v: Number(probs[k]) }))
      let total = 0
      for (const e of entries) total += isNaN(e.v) ? 0 : e.v
      if (total <= 0) return ''
      const r = Math.random() * total
      let acc = 0
      for (const e of entries) {
        acc += e.v
        if (r <= acc) return e.k
      }
      return entries.length ? entries[entries.length-1].k : ''
    }

    function buildSegments(probs: Record<string, number>) {
      const order = ['RAISE','SHOVE','CALL','FOLD']
      const segs: Array<{width:number,color:string,action:string}> = []
      let total = 0
      for (const k of Object.keys(probs)) total += Number(probs[k]) || 0
      if (total <= 0) return segs
      for (const a of order) {
        const v = Number(probs[a.toLowerCase()]) || Number(probs[a]) || 0
        if (v > 0) segs.push({ width: (v/total)*100, color: colorFor(a), action: a })
      }
      return segs
    }

    const cellCache = computed(() => {
      const cache: Record<string, Record<string, any>> = {}
      for (const hero of props.heroPositions) {
        cache[hero] = {}
        const row = (props.decisionsMatrix && props.decisionsMatrix[hero]) || {}
        for (const col of props.decisionColumns) {
          const cell = row[col]
          if (!cell) { cache[hero][col] = { type: 'na' }; continue }
          if (cell.action) {
            const action = String(cell.action).toUpperCase()
            cache[hero][col] = { type: 'det', action }
            continue
          }
          if (cell.probs && typeof cell.probs === 'object') {
            const probs = cell.probs
            const segments = buildSegments(probs)
            const chosen = sampleChoice(probs) || ''
            cache[hero][col] = { type: 'prob', segments, chosen }
            continue
          }
          cache[hero][col] = { type: 'na' }
        }
      }
      return cache
    })

    function cellFor(hero: string, col: string) {
      return (cellCache.value[hero] && cellCache.value[hero][col]) || { type: 'na' }
    }

    return { colorFor, textClassFor, cellFor }
  }
})
</script>

<style scoped>
.decisions-table td, .decisions-table th { vertical-align: middle; }
.na-cell { font-size:10px; padding:6px 8px; text-align:center; background:#1f1f1f; color:#fff; border-radius:6px; display:inline-block; min-width:64px }
.det-cell { padding:8px 10px; border-radius:6px; min-width:64px; display:inline-block }
.prob-cell { min-width:80px; height:28px; display:inline-block }
.prob-bar { height:100%; overflow:hidden }
.prob-seg { height:100% }
.prob-overlay { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:#000; font-weight:700 }
</style>

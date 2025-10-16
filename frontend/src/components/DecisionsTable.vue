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
                    <div class="prob-bar d-flex rounded" v-if="cellFor(hero,col).segments && cellFor(hero,col).segments.length > 0">
                      <div v-for="(s, idx) in cellFor(hero,col).segments" :key="idx" class="prob-seg" :style="{ width: s.width + '%', background: (s.color || colorFor(s.action)) }"></div>
                    </div>
                    <div v-else class="det-cell rounded" :style="{ background: colorFor(cellFor(hero,col).chosen) }">
                      <span :class="(cellFor(hero,col).chosen === 'RAISE' ? 'text-dark fw-bold' : 'text-white fw-bold')">{{ cellFor(hero,col).chosen }}</span>
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
      const probKeys = ['raise','shove','call','fold']
      for (const hero of props.heroPositions) {
        cache[hero] = {}
        const row = (props.decisionsMatrix && props.decisionsMatrix[hero]) || {}
        for (const col of props.decisionColumns) {
          const cell = row[col]
          if (!cell) { cache[hero][col] = { type: 'na' }; continue }

          // Case 1: simple string like 'CALL'
          if (typeof cell === 'string') {
            cache[hero][col] = { type: 'det', action: String(cell).toUpperCase() }
            continue
          }

          // Case: object containing probs directly (e.g. { raise:60, shove:40 }) OR object with .probs
          if (typeof cell === 'object') {
            // try explicit .probs or .probabilities
            const probsObj = (cell.probs || cell.probabilities)
            if (probsObj && typeof probsObj === 'object' && Object.keys(probsObj).length > 0) {
              // Normalize numeric map
              const normMap: Record<string, number> = {}
              let total = 0
              for (const k of Object.keys(probsObj)) {
                const v = Number((probsObj as any)[k]) || 0
                normMap[k.toLowerCase()] = v
                total += v
              }
              // detect degenerate distribution: exactly one non-zero weight -> treat as deterministic
              const nonZeroKeys = Object.keys(normMap).filter(k => normMap[k] > 0)
              const providedAction = (cell.action ? String(cell.action).toUpperCase() : undefined)
              if (nonZeroKeys.length === 1) {
                // pick that action as deterministic
                cache[hero][col] = { type: 'det', action: nonZeroKeys[0].toUpperCase() }
                continue
              }
              // otherwise build visual segments; if total <=0 fallback to provided action
              const segments = buildSegments(probsObj)
              if ((!segments || segments.length === 0)) {
                const fbAction = providedAction || ''
                if (fbAction) segments.push({ width: 100, color: colorFor(fbAction), action: fbAction })
              }
              const chosen = providedAction || sampleChoice(probsObj) || ''
              cache[hero][col] = { type: 'prob', segments, chosen }
               continue
             }

             // try treat the object itself as probs if it contains known keys
             const keys = Object.keys(cell || {})
             const hasProbKeys = keys.some(k => probKeys.includes(k.toLowerCase()))
             if (hasProbKeys) {
               // build a normalized probs map
               const map: Record<string, number> = {}
               for (const k of keys) {
                 const v = Number((cell as any)[k])
                 if (!isNaN(v)) map[k.toLowerCase()] = v
               }
               // detect degenerate distribution
               const nz = Object.keys(map).filter(k => map[k] > 0)
               const provided = (cell.action ? String(cell.action).toUpperCase() : undefined)
               if (nz.length === 1) {
                 cache[hero][col] = { type: 'det', action: nz[0].toUpperCase() }
                 continue
               }
               const segments = buildSegments(map)
               if ((!segments || segments.length === 0)) {
                 const fbAction = provided || ''
                 if (fbAction) segments.push({ width: 100, color: colorFor(fbAction), action: fbAction })
               }
               const chosen2 = provided || sampleChoice(map) || ''
               cache[hero][col] = { type: 'prob', segments, chosen: chosen2 }
               continue
             }
          }

          // Case: object with explicit action (no probs)
          if (cell.action) {
            const action = String(cell.action).toUpperCase()
            cache[hero][col] = { type: 'det', action }
            continue
          }

          // fallback: no usable info
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
.decisions-table { table-layout: fixed; width: 100%; --cell-height: 44px; }
.decisions-table td, .decisions-table th { padding: 4px; }

/* Inner block fills the TD (compensate padding on TD) */
.na-cell, .det-cell, .prob-cell {
   /* common box properties */
   width: 100%;
   box-sizing: border-box;
   height: var(--cell-height);
   border-radius: 6px;
   overflow: hidden;
   display: flex;
   align-items: center;
   justify-content: center;
 }

 /* keep NA and DET as centered blocks */
 .na-cell { font-size: 12px; text-align:center; background:#1f1f1f; color:#fff; }
 .det-cell { color: inherit; }
 .det-cell > span { display: block; width:100%; text-align:center }

 /* make prob-cell a flex container so its child .prob-bar can stretch to available space */
 .prob-cell {
   position: relative;
 }

 /* make the bar flexible and allow it to take the full height of the prob-cell (removed -8px) */
 .prob-bar { flex: 1 1 auto; width: 100%; display:flex; overflow:hidden; border-radius:6px; position:relative; z-index:1; height: var(--cell-height); margin: 4px 0; }
 .prob-seg { height:100%; flex: 0 0 auto; min-width: 1px; box-sizing:border-box }
 .prob-overlay { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:#000; font-weight:700; pointer-events:none; z-index:2; background: transparent }
</style>

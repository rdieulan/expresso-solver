<template>
  <div>
    <div id="rangeGridContainer" class="card-range mt-3 small text-monospace">
      <div class="range-grid">
        <div class="grid-header"></div>
        <div v-for="r in ranks" :key="r" class="grid-header">{{ r }}</div>

        <template v-for="rowIndex in 13">
          <div class="grid-header">{{ ranks[rowIndex - 1] }}</div>
          <template v-for="colIndex in 13">
            <div
              class="range-cell"
              :data-hand="cellLabel(rowIndex - 1, colIndex - 1)"
              :title="cellLabel(rowIndex - 1, colIndex - 1) + '\n' + cellTooltip(cellLabel(rowIndex - 1, colIndex - 1))"
              @click="onCellClick(cellLabel(rowIndex - 1, colIndex - 1))"
              @contextmenu.prevent="onCellContext(cellLabel(rowIndex - 1, colIndex - 1))"
            >
              <div v-if="cellFragments[cellLabel(rowIndex - 1, colIndex - 1)]" class="cell-bar">
                <div
                  v-for="(seg, idx) in cellFragments[cellLabel(rowIndex - 1, colIndex - 1)]"
                  :key="idx"
                  class="cell-seg"
                  :style="{ width: seg.width + '%', background: seg.color }"
                ></div>
              </div>
              <div class="cell-text">{{ shortLabel(cellLabel(rowIndex - 1, colIndex - 1)) }}</div>
            </div>
          </template>
        </template>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed, PropType } from 'vue'

type RangeNode = Record<string, any>

export default defineComponent({
  name: 'RangeGrid',
  props: {
    rangeNode: { type: Object as PropType<RangeNode | null>, required: false },
    decisions: { type: Array as PropType<any[]>, required: false },
    scenario: { type: String as PropType<string>, required: false },
    villain: { type: String as PropType<string | null>, required: false },
    cellAction: { type: String as PropType<string>, required: false, default: 'raise' },
    cellPct: { type: Number as PropType<number>, required: false, default: 100 }
  },
  emits: ['cell-clicked'],
  setup(props, { emit }) {
    const ranks = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']

    function cellLabel(r: number, c: number) {
      if (r < 0 || c < 0) return ''
      if (r === c) return ranks[r] + ranks[c]
      if (r < c) return ranks[r] + ranks[c] + 'O'
      return ranks[c] + ranks[r] + 'S'
    }

    function shortLabel(label: string) {
      return label.replace('10', 'T')
    }

    // Retrieve the fragment stored in the provided rangeNode for a given hand label
    function getFragmentForHand(hand: string) {
      if (!props.rangeNode) return null
      const sc = props.scenario || 'FirstIn'
      try {
        if (sc === 'FirstIn') {
          return props.rangeNode.FirstIn ? props.rangeNode.FirstIn[hand] || null : null
        }
        if (sc === 'VsOpen' || sc === 'VsOpen' /* tolerate both */) {
          const node = props.rangeNode.VsOpen || props.rangeNode.VsOpen || props.rangeNode.VsOpen
          if (!node) return null
          const v = props.villain || Object.keys(node)[0]
          return node[v] ? node[v][hand] || null : null
        }
        if (sc === 'VsShove') {
          const node = props.rangeNode.VsShove || props.rangeNode.VsShove
          if (!node) return null
          const v = props.villain || Object.keys(node)[0]
          return node[v] ? node[v][hand] || null : null
        }
      } catch (e) {
        return null
      }
      return null
    }

    // Build segments for rendering: [{width: number, color: string, action: string}]
    function segmentsFromFragment(frag: any) {
      if (!frag) return []
      // frag can be {action:percent} or {raise:30,shove:70} or {probs:{...}} etc.
      let map: Record<string, number> = {}
      if (frag.probs && typeof frag.probs === 'object') map = { ...frag.probs }
      else if (frag.probabilities && typeof frag.probabilities === 'object') map = { ...frag.probabilities }
      else if (typeof frag === 'object') {
        // could be action-string or mapping
        const keys = Object.keys(frag)
        // if single key and value is number -> treat as mapping
        if (keys.length === 1 && typeof frag[keys[0]] === 'number') map = { ...frag }
        else map = { ...frag }
      }

      // Normalize numeric values and convert to percentages if necessary
      const ordered = ['raise', 'shove', 'call', 'fold']
      const colorFor = (a: string) => (a === 'fold' ? '#6c757d' : a === 'call' ? '#0d6efd' : a === 'raise' ? '#ffc107' : a === 'shove' ? '#dc3545' : '#eee')

      // Sum raw numbers
      let total = 0
      for (const k of Object.keys(map)) {
        const v = Number(map[k]) || 0
        total += v
      }
      // If total is 0 but fragment contains a single action as string (e.g. {action:'raise'}), handle that
      if (total === 0) {
        if ((frag.action && typeof frag.action === 'string')) {
          const a = String(frag.action)
          return [{ width: 100, color: colorFor(a), action: a }]
        }
        if (Object.keys(map).length === 1) {
          const only = Object.keys(map)[0]
          const val = Number(map[only])
          if (val === 0) return []
        }
        return []
      }

      const segs: Array<{ width: number; color: string; action: string }> = []
      for (const a of ordered) {
        const v = Number(map[a]) || 0
        if (v > 0) {
          segs.push({ width: (v / total) * 100, color: colorFor(a), action: a })
        }
      }
      return segs
    }

    // Precompute fragments for all hands displayed for performance
    const cellFragments = computed(() => {
      const out: Record<string, Array<{ width: number; color: string; action: string }>> = {}
      for (let r = 0; r < 13; r++) {
        for (let c = 0; c < 13; c++) {
          const label = cellLabel(r, c)
          const frag = getFragmentForHand(label)
          const segs = segmentsFromFragment(frag)
          out[label] = segs
        }
      }
      return out
    })

    function cellTooltip(label: string) {
      const frag = getFragmentForHand(label)
      if (!frag) return '(vide)'
      if (frag.probs) return JSON.stringify(frag.probs)
      if (frag.action) return String(frag.action)
      return JSON.stringify(frag)
    }

    function onCellClick(label: string) {
      // build fragment from props.cellAction and props.cellPct
      const action = props.cellAction || 'raise'
      const pct = Math.max(1, Math.min(100, Number(props.cellPct) || 100))
      const fragment: any = {}
      fragment[action] = pct
      emit('cell-clicked', label, props.scenario || 'FirstIn', props.villain || null, fragment)
    }

    function onCellContext(label: string) {
      // context menu clears the cell (emit null fragment)
      emit('cell-clicked', label, props.scenario || 'FirstIn', props.villain || null, null)
    }

    return { ranks, cellLabel, shortLabel, cellFragments, onCellClick, onCellContext, cellTooltip }
  }
})
</script>

<style scoped>
.range-grid { display: grid; grid-template-columns: repeat(14, 46px); gap:6px; }
.range-cell { width:46px; height:46px; position:relative; display:flex; align-items:center; justify-content:center; font-size:11px; cursor:pointer; border-radius:6px; border:1px solid #e9ecef; user-select:none; overflow:hidden }
.grid-header { width:46px; height:46px; display:flex; align-items:center; justify-content:center; font-size:12px; color:#666 }
.cell-bar { position:absolute; left:0; right:0; top:6px; bottom:18px; display:flex; height:14px; border-radius:3px; overflow:hidden }
.cell-seg { height:100%; }
.cell-text { position:absolute; bottom:4px; left:2px; right:2px; text-align:center; font-size:10px; pointer-events:none }
</style>

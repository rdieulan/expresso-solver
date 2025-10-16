const http = require('http')

function fetch(url) {
  return new Promise((resolve, reject)=>{
    http.get(url, (res)=>{
      let data=''
      res.on('data', (c)=>data+=c)
      res.on('end', ()=>resolve({status:res.statusCode, body:data}))
    }).on('error', reject)
  })
}

(async ()=>{
  try{
    const url = 'http://localhost:3000/api/decide?players=2&depth=10&hand=AKs'
    const r = await fetch(url)
    const body = JSON.parse(r.body)
    const decisions = body.decisions || []
    const playersCount = 2
    const heroPositions = playersCount === 2 ? ['SB','BB'] : ['BTN','SB','BB']
    const colsSet = new Set()
    const matrix = {}
    for(const h of heroPositions) matrix[h] = {}

    for(const d of decisions){
      const sc = String(d.scenario || '')
      const key = sc + (d.villain ? String(d.villain) : '')
      const hasProbs = !!(d.probs || d.probabilities)
      const probsVal = d.probs || d.probabilities
      const actVal = d.action ? String(d.action).toUpperCase() : undefined
      if(hasProbs){
        matrix[d.heroPos || heroPositions[0]][key] = { probs: probsVal, action: actVal }
      } else if(d.action){
        matrix[d.heroPos || heroPositions[0]][key] = { action: String(d.action).toUpperCase() }
      } else {
        matrix[d.heroPos || heroPositions[0]][key] = { raw: d }
      }
      colsSet.add(key)
    }

    const cols = Array.from(colsSet)
    console.log('columns:', cols)
    console.log('matrix:')
    console.log(JSON.stringify(matrix,null,2))

    // simulate cellCache decisionSegments/buildSegments
    function colorFor(a){
      const map = { FOLD:'#6c757d', CALL:'#0d6efd', RAISE:'#ffc107', SHOVE:'#dc3545' }
      if(!a) return '#f5f5f5'
      return map[String(a).toUpperCase()] || '#eeeeee'
    }

    function buildSegments(probs){
      const order = ['RAISE','SHOVE','CALL','FOLD']
      const segs = []
      let total = 0
      for(const k of Object.keys(probs||{})) total += Number(probs[k]) || 0
      if(total<=0) return segs
      for(const a of order){
        const v = Number(probs[a.toLowerCase()]) || Number(probs[a]) || 0
        if(v>0) segs.push({width:(v/total)*100, color: colorFor(a), action: a})
      }
      return segs
    }

    for(const hero of heroPositions){
      for(const col of cols){
        const cell = (matrix[hero] && matrix[hero][col])
        if(!cell) continue
        if(cell.probs){
          const segs = buildSegments(cell.probs)
          console.log(`hero=${hero} col=${col} action=${cell.action} segs=${JSON.stringify(segs)}`)
        } else if(cell.action){
          console.log(`hero=${hero} col=${col} det action=${cell.action} color=${colorFor(cell.action)}`)
        }
      }
    }

  }catch(e){
    console.error(e)
  }
})()


// - [ ] Splash screen
// - [ ] Victory screen
// - [ ] Music!
// - [ ] Window dressing (gameboy body, centering)
// - [ ] Invincibility when you respawn
// - [ ] costs
// - [x] cooldowns
// - [ ] base 


// Abilities
// - [x] shoot bullet
// - [x] dash/blink
// - [x] shield
// - [x] laserbeam w/ telegraph
// - [x] heigan's dance / surge
//
// - [ ] ring of fire
// - [ ] ice
// - [ ] chain lightning
// - [ ] spawn creeps
// - [x] creep tower
// - [ ] drop a tower
// - [ ] push away
// - [x] buff creeps (give invincibility / shield for a few seconds)
// - [ ] trap (stun for 1sec)
// - [ ] battle hunger (trip opponent's abilities)
// - [ ] blood rite (drop circle, damage all in circle after timeout)
// - [ ] camouflage as creep
// - [ ] mirror image (mirror around center y-axis)
// - [ ] run/sprint
// - [ ] burrow
// - [?] wall

const canvas = document.getElementsByTagName('canvas')[0]
const WIDTH = 200, HEIGHT = 1000
canvas.width = canvas.clientWidth * devicePixelRatio
canvas.height = canvas.clientHeight * devicePixelRatio

const clamp = (x, a, b) => x < a ? a : (x > b ? b : x)

const keysDown = new Set
window.onkeydown = e => {
  keysDown.add(e.code)
  //console.log(e.code)
}
window.onkeyup = e => {
  keysDown.delete(e.code)
}
window.onblur = e => {
  keysDown.clear()
}


const controllers = {
  gamepads: [],

  getKeyboardGamepad(id) {
    let leftness = (id === 0 ? keysDown.has("ArrowLeft") : keysDown.has("KeyA"))
    let rightness = (id === 0 ? keysDown.has("ArrowRight") : keysDown.has("KeyD"))
    let upness = (id === 0 ? keysDown.has("ArrowUp") : keysDown.has("KeyW"))
    let downness = (id === 0 ? keysDown.has("ArrowDown") : keysDown.has("KeyS"))
    return {
      axes: [
        rightness - leftness,
        downness - upness
      ],
      buttons: [
        {pressed: (id === 0 ? keysDown.has("Space") : keysDown.has("KeyF"))}
      ]
    }
  },
  
  get(id) {
    return this.gamepads[id]
  },

  wentDown(id, btn) {
    const g = this.get(id)
    return g && g.buttons[btn] && !g.bprev[btn]
  },
  isPressed(id, btn) {
    const g = this.get(id)
    return g && g.buttons[btn]
  },

  update() {
    // https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API
    const newGamepads = navigator.getGamepads ? navigator.getGamepads() : (navigator.webkitGetGamepads ? navigator.webkitGetGamepads : []);

    for (let i = 0; i < 2; i++) {
      let data = newGamepads[i]
      if (!data) data = this.getKeyboardGamepad(i)
      if (!this.gamepads[i]) this.gamepads[i] = {axes:[], buttons:[]}

      const g = this.gamepads[i]
      g.bprev = g.buttons

      g.timestamp = data.timestamp
      g.axes = data.axes
      g.buttons = data.buttons.map(b => b.pressed)
    }
  }
}

window.addEventListener("gamepadconnected", function(e) {
  console.log("Gamepad connected at index %d: %s. %d buttons, %d axes.",
    e.gamepad.index, e.gamepad.id,
    e.gamepad.buttons.length, e.gamepad.axes.length);
});
window.addEventListener("gamepaddisconnected", e => {
  console.log('Gamepad ' + e.gamepad.index + ' disconnected')
});

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const loadSound = (url) =>
  fetch(url)
    .then(res => res.status === 200 ? res.arrayBuffer() : Promise.reject('Error fetching audio'))
    .then(audioData => audioCtx.decodeAudioData(audioData))

const sfx = {}
loadSound("/puff.mp3").then(buffer => sfx['puff'] = buffer)
const mixer = audioCtx.createGain()
mixer.connect(audioCtx.destination)
const playSound = (name, opts) => {
  if (!(name in sfx)) return
  let gain = (opts && opts.gain) || 1
  let rate = (opts && opts.rate) || 1
  let source = audioCtx.createBufferSource()
  source.buffer = sfx[name]
  source.playbackRate.value = rate
  let gainNode = audioCtx.createGain()
  source.connect(gainNode)
  gainNode.gain.value = gain
  gainNode.connect(mixer)
  source.start()
  return source
}

window.onblur = () => { mixer.gain.value = 0 }
window.onfocus = () => { mixer.gain.value = 1 }


const world = {
  time: 0,
  update(dt) {
    this.time += dt
    this.entities.forEach(e => e.update(dt))
  },  
  draw() {
    this.entities.forEach(e => e.drawShadow())
    this.entities.forEach(e => e.draw())
  },
  pc: {'-1':null, '1':null},
  //score: {'-1':20, '1':20},
  entities: new Set(),
  entitiesInCircle({x, y}, r) {
    let es = []
    this.entities.forEach(e => {
      if (e.c.body) {
        let {x: ox, y: oy, radius: or} = e.c.body
        let dx = ox-x
        let dy = oy-y
        let sumr = r + or
        if (dx*dx + dy*dy <= sumr*sumr) {
          es.push(e)
        }
      }
    })
    return es
  },
  entitiesInRect(x, y, w, h) {
    let es = []
    this.entities.forEach(e => {
      if (e.c.body) {
        let {x: ox, y: oy, radius: or} = e.c.body
        if (ox + or >= x && ox - or <= x + w && oy + or >= y && oy - or <= y + h) {
          es.push(e)
        }
      }
    })
    return es
  },
  kill(e, evt) {
    e.fireEvent('killed', evt || {})
    this.entities.delete(e)
  }
}


class Entity {
  constructor() {
    this.components = {}
    this.anonComponents = []
    this.birth = world.time
  }
  get age() {
    return world.time - this.birth
  }
  eachComponent(fn) {
    for(let name in this.components) {
      const c = this.components[name]
      fn(c, name)
    }
    this.anonComponents.forEach(fn)
  }

  update(dt) {
    this.eachComponent(c => c.update && c.update(this, dt))
  }
  drawShadow() {
    this.eachComponent(c => c.drawShadow && c.drawShadow(this))
  }
  draw() {
    this.eachComponent(c => c.draw && c.draw(this))
  }
  fireEvent(name, e) {
    const k = 'on' + name
    this.eachComponent(c => c[k] && c[k](this, e))
  }
  addComponent(c) {
    if (c.name) {
      if (this.components[c.name]) throw Error('already compnent called ' + c.name)
      this.components[c.name] = c
    } else {
      this.anonComponents.push(c)
    }
  }
  removeComponent(c) {
    if (!c) return
    if (c.onremove) c.onremove(this)
    if (c.name) {
      delete this.components[c.name]
    } else {
      const idx = this.anonComponents.indexOf(c)
      if (idx !== -1) this.anonComponents.splice(idx, 1)
    }
  }

  get c() { return this.components }

  get side() { return this.components.align.side }

  get isAlive() { return world.entities.has(this) }
}


class BodyComponent {
  constructor(e) {
    this.x = 0
    this.y = 0
    this.radius = 5
  }
  get name() { return 'body' }
}


class AlignmentComponent {
  constructor(e, side) {
    this.side = side
  }
  get name() { return 'align' }
}

class CreepComponent {
  constructor(e) {
    this.target = null
    this.cooldown = 0
    this.targetRange = 100
  }
  onkilled(e) {
    world.entities.add(makeExplosion(e.c.body))
  }
  validTarget(e, other) {
    const myside = e.c.align.side
    if (!other.isAlive) return false // must be alive
    if (!other.c.align) return false // Must have an alignment
    if (other.c.align.side === myside) return false // ... different from mine

    const dist = (other.c.body.y - e.c.body.y) * myside
    if (dist < 0 || dist > this.targetRange * 1.5) return false // must be ahead, but not too far ahead.
    return true
  }
  update(e, dt) {
    const myside = e.c.align.side
    this.cooldown -= dt
    if (this.target && !this.validTarget(e, this.target)) this.target = null
    if (this.target == null) {
      let es = world.entitiesInCircle(e.c.body, this.targetRange)
        .filter(other => this.validTarget(e, other))
      if (es.length) {
        this.target = es[0]
      }
    }

    if (this.target != null) {
      let dx = e.c.body.x - this.target.c.body.x
      if (Math.abs(dx) > 4) {
        e.c.body.x += -Math.sign(dx) * 50 * dt
      } else {
        if (this.cooldown <= 0) {
          this.fire()
          this.cooldown = 0.9
        }
      }
    } else {
      e.c.body.y += myside * 50 * dt
    }

    if (this.firing) {
      this.fireAnim -= dt
      if (this.fireAnim <= 0) {
        world.entities.add(makeBullet(e.c.body, myside))
        this.firing = false
      }
    }
  }

  fire() {
    this.firing = true
    this.fireAnim = 0.2
  }

  draw(e) {
    ctx.fillStyle = (e.c.align.side == 1 ? "green" : "red")
    const {x,y} = e.components.body
    ctx.beginPath()
    ctx.arc(x, y, e.c.body.radius, 0, Math.PI*2)
    ctx.fill()
    if (this.firing) {
      ctx.fillStyle = "hsla(0, 0%, 0%, 0.5)"
      ctx.beginPath()
      ctx.arc(x, y, e.c.body.radius + this.fireAnim / 0.2 * 10, 0, Math.PI*2)
      ctx.fill()
    }
  }
  get name() { return 'creep' }
}

class BulletComponent {
  get name() { return 'bullet' }
  constructor(e, {side, lifetime, speed}) {
    this.side = side
    this.lifetime = lifetime
    this.speed = speed || 180
  }

  draw(e) {
    ctx.fillStyle = 'black'
    const radius = e.c.body.radius
    ctx.fillRect(e.c.body.x - radius, e.c.body.y - radius, radius*2, radius*2)
  }

  update(e, dt) {
    this.lifetime -= dt
    if (this.lifetime < 0) {
      world.kill(e)
      return
    }
    e.c.body.y += this.side * this.speed * dt
    let nearby = world.entitiesInCircle(e.c.body, e.c.body.radius)
      .filter(other => other.c.align && other.c.align.side != this.side)
    if (nearby.length) {
      world.kill(e)
      nearby[0].fireEvent('hit', {by: e})
      //e.fireEvent('shot', nearby[0])
    }
  }
}

class DespawnOffscreen {
  get name() { return 'despawn' }
  update(e, dt) {
    if (e.c.body.x < 0 || e.c.body.x > WIDTH || e.c.body.y < 0 || e.c.body.y > HEIGHT) {
      world.kill(e)
    }
  }
}

class OneHp {
  get name() { return 'onehp' }
  onhit(e, evt) {
    world.kill(e, evt)
  }
}

class ConstrainToWorldComponent {
  update(e, dt) {
    const body = e.c.body
    const r = body.radius
    if (body.x - r < 0) body.x = r
    if (body.x + r >= WIDTH) body.x = WIDTH-r-1
    if (body.y - r < 0) body.y = r
    if (body.y + r >= HEIGHT) body.y = HEIGHT-r-1
  }
}


const shieldAbility = {
  icon: null,
  name: 'Sheldi',
  cost: 20,
  
  activate(player, setCooldown) {
    const hp = player.c.onehp
    player.removeComponent(hp)

    player.addComponent({
      remaining: 1.5,
      update(e, dt) {
        this.remaining -= dt
        if (this.remaining < 0) {
          player.addComponent(hp)
          player.removeComponent(this)

          // Activate cooldown.
          setCooldown(4)
        }
      },
      draw(e) {
        ctx.save()
        ctx.lineWidth = 4
        ctx.strokeStyle = "aquamarine"
        ctx.beginPath()
        let r = e.c.body.radius + 4 + Math.sin(this.remaining * 6) * 2
        ctx.arc(e.c.body.x, e.c.body.y, r, 0, Math.PI*2)
        ctx.stroke()
        ctx.restore()
      }
    })
  }
}

const shootAbility = ({cost, cooldown}) => ({
  icon: null,
  name: 'Hsoot',
  cost: cost,

  activate(player, setCooldown) {
    world.entities.add(makePlayerBullet(player.c.body, player.c.align.side))
    setCooldown(cooldown)
  }
})


const blinkAbility = {
  name: 'Blunk',
  icon: null,
  cost: 20,
  activate(player, setCooldown) {
    player.c.body.y += player.c.align.side * 300
    setCooldown(3)
  }
}

class SafetyComponent {
  constructor() {
    this.regions = 6

    this.stage = 0
    this.lastDrawnStage = 0

    this.duration = 10
  }
  bbForStage(side, stage) {
    const i = side === 1 ? stage : this.regions - stage - 1
    const rheight = HEIGHT/this.regions
    return {x:0, y:rheight*i, w:WIDTH, h:rheight}
  }
  update(e, dt) {
    const stage = (e.age / this.duration * this.regions)|0
    const side = e.side
    if (stage > this.regions) world.kill(e)
    while(stage > this.stage) {
      const bb = this.bbForStage(side, this.stage)
      const es = world.entitiesInRect(bb.x, bb.y, bb.w, bb.h)
        .filter(other => other.c.align && other.side !== side)

      es.forEach(other => other.fireEvent('hit', {by:e}))
      this.stage++
    }
  }
  drawShadow(e) {
    const side = e.side

    while (this.lastDrawnStage < this.stage) {
      const bb = this.bbForStage(side, this.lastDrawnStage)
      ctx.fillStyle = 'white'
      ctx.fillRect(bb.x, bb.y, bb.w, bb.h)
      this.lastDrawnStage++
    }
    
    const bb = this.bbForStage(side, this.stage)
    ctx.fillStyle = side === 1 ? 'darkgreen' : 'pink'
    ctx.fillRect(bb.x, bb.y, bb.w, bb.h)
  }
}

const safetyDance = {
  name: 'Safety',
  icon: null,
  cost: 100,
  activate(player, setCooldown) {
    setCooldown(30)
    const e = new Entity
    e.addComponent(new SafetyComponent(e))
    e.addComponent(new AlignmentComponent(e, player.side))
    world.entities.add(e)
  }
}

class Silenced {
  get name() { return 'silenced' }

  constructor(e) {
    e.silenced = (e.silenced ? e.silenced + 1 : 1)
  }
  onremove(e) {
    e.silenced--
  }
}

class Stun {
  constructor(e, duration) {
    this.remaining = duration
    e.stunned = (e.stunned ? e.stunned + 1 : 1)
  }
  update(e, dt) {
    this.remaining -= dt
    if (this.remaining <= 0) {
      e.stunned--
      e.removeComponent(this)
    }
  }
}

const laserAbility = {
  name: 'LARAS',
  cost: 20,
  activate(player, setCooldown) {
    setCooldown(5)
    player.addComponent(new Stun(player, 0.5))
    world.entities.add(makeLaser(player.c.body, player.c.align.side))
  }
}

class CreepTower {
  constructor(e) {
    this.cooldown = 1
  }
  update(e, dt) {
    this.cooldown -= dt
    if (this.cooldown <= 0) {
      let creep = spawnCreep(e.side)
      creep.c.body.x = e.c.body.x
      creep.c.body.y = e.c.body.y
      world.entities.add(creep)
      this.cooldown += 1
    }
  }
  draw(e) {
    ctx.save()
    ctx.lineWidth = 2
    ctx.fillStyle = e.side === 1 ? "green" : "red"
    ctx.strokeStyle = e.side === 1 ? "lightgreen" : "pink"
    ctx.beginPath()
    ctx.arc(e.c.body.x, e.c.body.y, e.c.body.radius, 0, Math.PI*2)
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }
}

const makeCreepTower = ({x, y}, side) => {
  let e = new Entity
  e.addComponent(new BodyComponent(e))
  e.addComponent(new AlignmentComponent(e, side))
  e.addComponent(new CreepTower(e))
  e.addComponent(new OneHp(e))
  e.c.body.x = x
  e.c.body.y = y
  e.c.body.radius = 8
  return e
}

const creepTowerAbility = {
  name: '4chan',
  cost: 60,
  activate(player, setCooldown) {
    setCooldown(10)
    world.entities.add(makeCreepTower(player.c.body, player.c.align.side))
  }
}

class CreepShield {
  constructor(e, onehp) {
    this.onehp = onehp
  }
  onhit(e) {
    e.removeComponent(this)
    e.addComponent(this.onehp)
  }
  draw(e) {
    ctx.save()
    ctx.lineWidth = 4
    ctx.strokeStyle = "aquamarine"
    ctx.beginPath()
    let r = e.c.body.radius + 4 + Math.sin(e.age * 6) * 2
    ctx.arc(e.c.body.x, e.c.body.y, r, 0, Math.PI*2)
    ctx.stroke()
    ctx.restore()
  }
}

class BuffRing {
  constructor(e) {
    this.alreadyBuffed = new Set  // only buff each creep once
  }
  get maxAge() { return 0.5 }
  radius(e) {
    return Math.pow(e.age / this.maxAge, 3) * 60
  }
  update(e, dt) {
    if (e.age > this.maxAge) {
      world.kill(e)
    } else {
      let es = world.entitiesInCircle(e.c.body, this.radius(e))
        .filter(o => o.c.creep && o.side === e.side && !this.alreadyBuffed.has(o))
        .forEach(o => {
          this.alreadyBuffed.add(o)
          let onehp = o.c.onehp
          o.removeComponent(onehp)
          o.addComponent(new CreepShield(o, onehp))
        })
    }
  }
  draw(e) {
    ctx.fillStyle = "hsla(160, 100%, 75%, 0.5)"
    ctx.beginPath()
    ctx.arc(e.c.body.x, e.c.body.y, this.radius(e), 0, Math.PI*2)
    ctx.fill()
  }
}

const makeBuffRing = ({x, y}, side) => {
  let e = new Entity
  e.addComponent(new BodyComponent(e))
  e.addComponent(new AlignmentComponent(e, side))
  e.addComponent(new BuffRing(e))
  e.c.body.x = x
  e.c.body.y = y
  return e
}

const creepBuffAbility = {
  name: 'Fluff',
  cost: 40,
  activate(player, setCooldown) {
    setCooldown(6)
    world.entities.add(makeBuffRing(player.c.body, player.c.align.side))
  }
}

const abilities = [
  [creepBuffAbility],
  [creepTowerAbility],
  [blinkAbility],
  [laserAbility],
  [shieldAbility],
  [
    {cost:20, cooldown:1},
    {cost:50, cooldown:0.7},
    {cost:100, cooldown:0.4}
  ].map(shootAbility),
  [safetyDance],
]


class LaserComponent {
  constructor(e) {
    this.telegraphDuration = 0.6
    this.followthroughDuration = 0.2
    this.maxR = 10
  }
  update(e, dt) {
    if (e.age >= this.telegraphDuration && !this.hasHit) {
      this.hasHit = true
      let r = this.maxR
      let deadThings =
        world.entitiesInRect(e.c.body.x - r, 0, r * 2, HEIGHT)
          .filter(o => o.c.align && o.c.align.side != e.c.align.side)
      deadThings.forEach(o => o.fireEvent('hit', {by: e}))
    }
    if (e.age >= this.telegraphDuration + this.followthroughDuration) {
      world.kill(e)
    }
  }
  draw(e) {
    let {x, y} = e.c.body
    let r;
    let collapse = this.telegraphDuration
    let total = this.telegraphDuration + this.followthroughDuration
    if (e.age < collapse) {
      ctx.fillStyle = "hsla(1, 100%, 60%, 0.6)"
      r = 2 - (e.age / collapse) * 2
    } else {
      let t = ((e.age - collapse) / (total - collapse))
      ctx.fillStyle = `hsl(160, 100%, ${100 - 25 * t}%)`
      r = (1 - t) * this.maxR
    }
    ctx.fillRect(x - r, 0, r * 2, HEIGHT)
  }
}

const makeLaser = ({x, y}, side) => {
  let e = new Entity
  e.addComponent(new BodyComponent(e))
  e.addComponent(new LaserComponent(e))
  e.addComponent(new AlignmentComponent(e, side))
  e.addComponent({name: 'giveScore', to:side})
  e.c.body.x = x
  e.c.body.y = y
  return e
}



class PlayerController {
  get name() { return 'player' }

  constructor(padId) {
    this.padId = padId
    this.speed = 120
    this.ybias = 1.5

    this.ownedAbility = [] // ability id => level.
    this.boundAbility = [] // list of numbers

    this.score = 200

    this.abilityCooldown = [0,0,0,0]
    this.abilityCooldownMax = [Infinity,Infinity,Infinity,Infinity]
  }

  update(e, dt) {
    const gamepad = controllers.get(this.padId)

    for (let i = 0; i < 4; i++) this.abilityCooldown[i] -= dt

    if (e.stunned) return

    e.c.body.x += dt * this.speed * gamepad.axes[0]
    e.c.body.y += dt * this.speed * gamepad.axes[1] * this.ybias

    if (e.silenced) return

    for (let i = 0; i < 4; i++) {
      const id = this.boundAbility[i]

      if (id == null || !controllers.isPressed(this.padId, i)
        || this.abilityCooldown[i] > 0) continue

      const a = abilities[id][this.ownedAbility[id]]
      this.abilityCooldown[i] = Infinity
      a.activate(e, (cooldown) => {
        this.abilityCooldown[i] = cooldown
        this.abilityCooldownMax[i] = cooldown
      })
    }
  }

  draw(e) {
    ctx.fillStyle = (e.c.align.side == 1 ? "darkgreen" : "pink")
    const {x,y} = e.components.body
    ctx.beginPath()
    ctx.arc(x, y, e.c.body.radius, 0, Math.PI*2)
    ctx.fill()
    for (let i = 0; i < 4; i++) {
      if (this.boundAbility[i]) {
        ctx.fillStyle = this.abilityCooldown[i] <= 0 ? 'white' : 'gray'
        ctx.beginPath()
        let theta = (i + 0.5) * Math.PI*2/4
        ctx.moveTo(e.c.body.x + Math.cos(theta) * 1, e.c.body.y + Math.sin(theta) * 1)
        let fullness = 1 - Math.max(0, this.abilityCooldown[i]) / this.abilityCooldownMax[i]
        let min = 1
        let max = e.c.body.radius - 2
        let r = (max - min) * fullness + min
        ctx.arc(e.c.body.x, e.c.body.y, r, (i + 0.1) * Math.PI*2/4, (i + 0.9) * Math.PI*2/4)
        ctx.fill()
      }
    }
  }
}

world.pc['-1'] = new PlayerController(0)
world.pc['1'] = new PlayerController(1)

class GiveScoreToKiller {
  constructor(e, num = 1) { this.num = num }
  onkilled(e, {by}) {
    if (by.c.giveScore) {
      world.pc[by.c.giveScore.to].score += this.num
    }
  }
}

const spawnPlayer = (side) => {
  const e = new Entity
  e.addComponent(new BodyComponent(e))
  e.addComponent(new AlignmentComponent(e, side))
  e.addComponent(new ConstrainToWorldComponent(e))
  e.addComponent(new OneHp(e))
  e.addComponent(new GiveScoreToKiller(e, 10))
  e.c.body.radius = 10
  e.c.body.x = WIDTH/2
  e.c.body.y = (side === -1) ? HEIGHT-30 : 30

  return e
}

const makePlayerSpawner = (side) => {
  const spawner = new Entity

  spawner.addComponent({
    cooldown: 1,
    player: null,
    update(e, dt) {
      if (this.player == null) {
        this.cooldown -= dt
        if (this.cooldown < 0) {
          this.player = spawnPlayer(side)
          this.player.addComponent(world.pc[side])
          this.player.addComponent({
            onkilled: () => {
              this.player = null
            }
          })
          world.entities.add(this.player)
          this.cooldown = 2
        }
      }
    }
  })
  return spawner
}


const spawnCreep = (side) => {
  let e = new Entity
  e.addComponent(new BodyComponent(e))
  e.addComponent(new AlignmentComponent(e, side))
  e.addComponent(new CreepComponent(e))
  e.addComponent(new DespawnOffscreen(e))
  e.addComponent(new OneHp(e))
  e.addComponent(new GiveScoreToKiller(e))
  if (side === -1) {
    e.c.body.y = HEIGHT
  }
  e.c.body.x = 100 + (Math.random() * 2 - 1) * 60
  return e
}

const makeBullet = ({x, y, from}, side) => {
  let e = new Entity
  e.addComponent(new BodyComponent(e))
  e.addComponent(new BulletComponent(e, {side, lifetime:1}))
  e.addComponent(new DespawnOffscreen(e))
  e.addComponent({name:'canDamageBase'})
  e.c.body.x = x
  e.c.body.y = y
  e.c.body.radius = 2
  return e
}

const makePlayerBullet = ({x, y}, side) => {
  let e = new Entity
  e.addComponent(new BodyComponent(e))
  e.addComponent(new BulletComponent(e, {side, lifetime:4, speed:300}))
  e.addComponent(new DespawnOffscreen(e))
  e.addComponent({name: 'giveScore', to:side})
  e.c.body.x = x
  e.c.body.y = y
  e.c.body.radius = 3
  return e
}

const makeExplosion = ({x, y}) => {
  let e = new Entity
  e.addComponent(new ParticleSystem({x, y}))
  playSound('puff', {gain: 0.1 + Math.random(), rate: 1.5 + Math.random() * 0.2})
  return e
}

class ParticleSystem {
  get name() { return 'particle' }
  constructor({x, y}) {
    this.t = 0
    this.particles = []
    let n = Math.floor(Math.random() * 3) + 4
    for (let i = 0; i < n; i++) {
      let dir = Math.random() * Math.PI*2
      let v = Math.random()*5 + 10
      let vx = Math.cos(dir) * v
      let vy = Math.sin(dir) * v
      this.particles.push(
        {
          color: 'gray',
          x, y, vx, vy,
          r: Math.random() * 3 + 4,
          life: Math.random() * 0.5 + 0.2
        }
      )
    }
    this.particles.push(
      {
        color: 'yellow',
        x, y, vx: 0, vy: 0,
        r: 10,
        life: 0.1
      }
    )
  }
  update(e, dt) {
    this.t += dt
    if (this.particles.every(p => this.t > p.life)) {
      world.entities.delete(e)
    }
  }
  draw(e) {
    this.particles.forEach(p => {
      let pt = this.t / p.life
      if (pt <= 1) {
        ctx.fillStyle = p.color
        let px = p.x + p.vx * this.t
        let py = p.y + p.vy * this.t
        ctx.beginPath()
        ctx.arc(px, py, p.r * (1-pt), 0, Math.PI*2)
        ctx.fill()
      }
    })
  }
}


const makeSpawner = (side) => {
  let spawner = new Entity
  spawner.addComponent({
    cooldown: 1,
    update(e, dt) {
      this.cooldown -= dt
      if (this.cooldown <= 0) {
        this.cooldown += 5
        const numCreeps = (5 + world.time / 30)|0
        for (let i = 0; i < numCreeps; i++) {
          let creep = spawnCreep(side)
          creep.c.body.y += i * 10 * side
          world.entities.add(creep)
        }
      }
    }
  })
  return spawner
}

class Base {
  constructor(e, side) {
    this.hp = 10
  }
  update(e, dt) {
  }
  draw(e) {
    if (e.c.align.side === 1) {
      ctx.fillStyle = "green"
    } else {
      ctx.fillStyle = "red"
    }
    ctx.beginPath()
    ctx.arc(e.c.body.x, e.c.body.y, e.c.body.radius, 0, Math.PI*2)
    ctx.fill()
    ctx.fillStyle = 'white'
    for (let i = 0; i < this.hp; i++) {
      ctx.beginPath()
      let theta = (i + 0.5) * Math.PI*2/10
      ctx.moveTo(e.c.body.x + Math.cos(theta) * 2, e.c.body.y + Math.sin(theta) * 2)
      ctx.arc(e.c.body.x, e.c.body.y, e.c.body.radius - 4, (i + 0.1) * Math.PI*2/10, (i + 0.9) * Math.PI*2/10)
      ctx.fill()
    }

    ctx.save()
    ctx.fillStyle = '#0E672B'
    ctx.font = '15px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = (e.side === -1) ? 'top' : 'bottom'
    const score = world.pc[e.side].score
    ctx.fillText(score, e.c.body.x, e.c.body.y - 30 * e.side)
    ctx.restore()
  }
  onhit(e, {by}) {
    //world.entitiesInRect
    if (by.c.canDamageBase) {
      this.hp -= 1
      if (this.hp <= 0) {
        console.log("game ovah")
      }
    }
  }
}

const makeBase = (side) => {
  let base = new Entity
  base.addComponent(new BodyComponent(base))
  base.addComponent(new Base(base, side))
  base.addComponent(new AlignmentComponent(base, side))
  if (side === 1) {
    base.c.body.y = 50
  } else {
    base.c.body.y = 1000 - 50
  }
  base.c.body.x = 100
  base.c.body.radius = 20
  return base
}

class ShopComponent {
  constructor(e, side) {
    this.side = side
    this.girth = 25
    this.hasPlayer = false
    this.pos = 0 // Position in ability list
    this.shopSize = 400

    this.playersInShop = []
  }
  update(e, dt) {
    const players = world.entitiesInRect(
        WIDTH-this.girth/2,
        this.side === 1 ? this.girth/2 : HEIGHT-this.girth/2,
        1, 1)
      .filter(other => other.c.player)

    this.hasPlayer = !!players.length

    this.playersInShop.forEach(p => p.removeComponent(p.c.silenced))
    players.forEach(p => {
      const pc = p.c.player
      if (controllers.wentDown(pc.padId, 4)) this.pos--
      if (controllers.wentDown(pc.padId, 5)) this.pos++
      this.pos = clamp(this.pos, 0, abilities.length - 1)

      const alist = abilities[this.pos]
      for (let i = 0; i < 4; i++) {
        if (!controllers.wentDown(pc.padId, i)) continue
        
        if (pc.boundAbility[i] === this.pos) {
          // Try to upgrade
          const a = alist[pc.ownedAbility[this.pos] + 1]
          if (a && a.cost <= pc.score) {
            pc.score -= a.cost
            pc.ownedAbility[this.pos]++
          }

        } else {
          if (pc.ownedAbility[this.pos] != null) {
            if (pc.boundAbility[i] == null || pc.abilityCooldown[i] <= 0) {
              // Bind it
              let cooldown = 0
              for (let k = 0; k < 4; k++) {
                if (pc.boundAbility[k] === this.pos) {
                  cooldown = pc.abilityCooldown[k]
                  pc.boundAbility[k] = null
                  pc.abilityCooldown[k] = 0
                }
              }
              pc.boundAbility[i] = this.pos
              pc.abilityCooldown[i] = cooldown
            }
          } else {
            // Buy it at lvl 1 and bind
            const a = alist[0]
            if (pc.score >= a.cost) {
              pc.score -= a.cost
              pc.ownedAbility[this.pos] = 0
              pc.boundAbility[i] = this.pos
            }
          }
        }
      }

      p.addComponent(new Silenced(p))
    })
    this.playersInShop = players

  }
  drawShadow() {
    ctx.fillStyle = this.hasPlayer ? 'grey' : 'yellow'
    const s = this.girth
    ctx.fillRect(WIDTH-s, this.side === 1 ? 0 : HEIGHT-s, s, s)

    ctx.save()
    ctx.translate(WIDTH, this.side === 1 ? 0 : HEIGHT-this.shopSize)
    ctx.fillStyle = 'black'
    ctx.fillRect(0, 0, WIDTH, this.shopSize)

    ctx.font = '20px sans-serif'
    const rowheight = 23
    const pc = world.pc[this.side]
    for (let i = 0; i < abilities.length; i++) {
      const alist = abilities[i]
      const y = this.shopSize/2 + (i-this.pos)*rowheight
      
      const ownedAt = pc.ownedAbility[i]
      let a = alist[ownedAt != null ? ownedAt+1 : 0]
      const ownMax = a == null
      if (ownMax) a = alist[alist.length - 1]

      ctx.fillStyle = ownMax ? 'grey' : (a.cost <= pc.score ? 'white' : 'grey')
      ctx.fillText(ownMax ? '*' : a.cost, 10, y)
      ctx.fillStyle = this.pos === i ? 'white' : 'skyblue'
      ctx.fillText(a.name + ' ' + (ownedAt == null ? 0 : ownedAt), 50, y)

    }

    ctx.restore()
  }
}

const makeShop = (side) => {
  let shop = new Entity
  shop.addComponent(new ShopComponent(shop, side))
  return shop
}

world.entities.add(makeSpawner(1))
world.entities.add(makeSpawner(-1))

world.entities.add(makePlayerSpawner(1))
world.entities.add(makePlayerSpawner(-1))

world.entities.add(makeBase(1))
world.entities.add(makeBase(-1))

world.entities.add(makeShop(1))
world.entities.add(makeShop(-1))

// helper functions for getEntitiesInBB() inCircle() ...
// add / remove entiries



var ctx = canvas.getContext('2d')
ctx.scale(devicePixelRatio, devicePixelRatio) // For high dpi display support


function frame() {
  ctx.fillStyle = '#8EC401'
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  controllers.update()
  world.update(1/60)
  if (keysDown.has('ShiftLeft')) {
    for (var i = 0; i < 6; i++) world.update(1/60)
  }
  world.draw()

  requestAnimationFrame(frame)
}

frame()


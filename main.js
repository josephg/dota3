// - [x] Shooting
// - [x] Telegraphing
// - [ ] Ability selection
// - [ ] Ability display
// - [ ] Make some abilities
// - [ ] Splash screen
// - [ ] Victory screen
// - [x] Base building
// - [ ] Score
// - [x] Use keyboard instead of gamepads
// - [ ] Music!
// - [ ] Window dressing (gameboy body, centering)
// - [x] Creep bunching
// - [ ] Invincibility when you respawn


// Abilities
// - [x] shoot bullet
// - [x] dash/blink
// - [x] shield
// - [ ] ring of fire
// - [x] laserbeam w/ telegraph
// - [ ] heigan's dance / surge
// - [ ] ice
// - [ ] chain lightning
// - [ ] spawn creeps
// - [ ] creep tower
// - [ ] drop a tower
// - [ ] push away
// - [ ] buff creeps (give invincibility / shield for a few seconds)
// - [ ] trap (stun for 1sec)
// - [ ] battle hunger (trip opponent's abilities)
// - [ ] blood rite (drop circle, damage all in circle after timeout)
// - [ ] camouflage as creep
// - [ ] mirror image (mirror around center y-axis)
// - [ ] run/sprint
// - [ ] burrow
// - [?] wall

const canvas = document.getElementsByTagName('canvas')[0]
var WIDTH, HEIGHT
canvas.width = (WIDTH = canvas.clientWidth) * devicePixelRatio
canvas.height = (HEIGHT = canvas.clientHeight) * devicePixelRatio

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

  keyboardGamepad(id) {
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
        (id === 0 ? keysDown.has("Space") : keysDown.has("KeyF"))
      ]
    }
  },
  
  get(id) {
    return this.gamepads[id] || this.keyboardGamepad(id)
  },

  wasPressedNow(id, btn) {
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

    for (let i = 0; i < newGamepads.length; i++) {
      const data = newGamepads[i]
      if (!data) return this.gamepads[i] = null
      if (!this.gamepads[i]) this.gamepads[i] = {axes:[], buttons:[]}

      const g = this.gamepads[i]
      g.bprev = g.buttons
      //if (data.timestamp === g.timestamp) return

      g.timestamp = data.timestamp
      g.axes = data.axes
      g.buttons = data.buttons.map(b => b.pressed)
    }
    //console.log(this.gamepads[0] && this.gamepads[0].buttons[0])

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

sfx = {}
loadSound("/puff.mp3").then(buffer => sfx['puff'] = buffer)
mixer = audioCtx.createGain()
mixer.connect(audioCtx.destination)
playSound = (name, opts) => {
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

const world = {
  time: 0,
  update(dt) {
    this.time += dt
    this.entities.forEach(e => e.update(dt))
  },  
  draw() {
    this.entities.forEach(e => e.draw())
  },
  score: {'-1':0, '1':0},
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
    if (c.name) {
      delete this.components[c.name]
    } else {
      const idx = this.anonComponents.indexOf(c)
      if (idx !== -1) this.anonComponents.splice(idx, 1)
    }
  }

  get c() { return this.components }

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
  constructor(e, {side, lifetime}) {
    this.side = side
    this.lifetime = lifetime
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
    e.c.body.y += this.side * 180 * dt
    let nearby = world.entitiesInCircle(e.c.body, e.c.body.radius)
      .filter(other => other.c.align && other.c.align.side != this.side)
    if (nearby.length) {
      world.kill(e)
      nearby[0].fireEvent('hit', {by: e})
      e.fireEvent('shot', nearby[0])
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

class PlayerComponent {
  draw(e) {
    ctx.fillStyle = (e.c.align.side == 1 ? "darkgreen" : "pink")
    const {x,y} = e.components.body
    ctx.beginPath()
    ctx.arc(x, y, e.c.body.radius, 0, Math.PI*2)
    ctx.fill()
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

const shootAbility = {
  icon: null,

  activate(player, setCooldown) {
    world.entities.add(makePlayerBullet(player.c.body, player.c.align.side))
    setCooldown(0.5)
  }
}

const blinkAbility = {
  icon: null,
  activate(player, setCooldown) {
    player.c.body.y += player.c.align.side * 300
    setCooldown(3)
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
  activate(player, setCooldown) {
    setCooldown(5)
    player.addComponent(new Stun(player, 0.5))
    world.entities.add(makeLaser(player.c.body, player.c.align.side))
  }
}

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
      ctx.fillStyle = "hsla(0, 100%, 60%, 0.6)"
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
  e.c.body.x = x
  e.c.body.y = y
  return e
}



class PlayerController {
  constructor(e, padId) {
    this.padId = padId
    this.speed = 120
    this.ybias = 1.5

    this.abilities = []

    this.abilities[0] = blinkAbility
    this.abilities[1] = shootAbility
    this.abilities[0] = shieldAbility
    this.abilities[0] = laserAbility

    this.abilityCooldown = [0,0,0,0]
  }
  
  update(e, dt) {
    const gamepad = controllers.get(this.padId)

    for (let i = 0; i < 4; i++) this.abilityCooldown[i] -= dt

    if (e.stunned) return

    e.c.body.x += dt * this.speed * gamepad.axes[0]
    e.c.body.y += dt * this.speed * gamepad.axes[1] * this.ybias

    for (let i = 0; i < 4; i++) {
      const a = this.abilities[i]
      if (!a || !controllers.isPressed(this.padId, i)
        || this.abilityCooldown[i] > 0) continue

      this.abilityCooldown[i] = Infinity
      this.abilities[i].activate(e, (cooldown) => {
        this.abilityCooldown[i] = cooldown
      })
    }
  }
}

class GiveScoreToKiller {
  constructor(e, num = 1) { this.num = num }
  onkilled(e, {by}) {
    if (by.c.giveScore) {
      world.score[by.c.giveScore.to] += this.num
      console.log(world.score)
    }
  }
}

const spawnPlayer = (side) => {
  let e = new Entity
  e.addComponent(new BodyComponent(e))
  e.addComponent(new AlignmentComponent(e, side))
  e.addComponent(new PlayerComponent(e))
  e.addComponent(new PlayerController(e, side === 1 ? 0 : 1))
  e.addComponent(new ConstrainToWorldComponent(e))
  e.addComponent(new OneHp(e))
  e.addComponent(new GiveScoreToKiller(e, 10))
  e.c.body.radius = 10
  e.c.body.x = WIDTH/2
  e.c.body.y = (side === -1) ? HEIGHT-30 : 30

  return e
}

const makePlayerSpawner = (side) => {
  let spawner = new Entity
  spawner.addComponent({
    cooldown: 1,
    player: null,
    update(e, dt) {
      if (this.player == null) {
        this.cooldown -= dt
        if (this.cooldown < 0) {
          this.player = spawnPlayer(side)
          this.player.addComponent({onkilled: () => this.player = null})
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

const makeBullet = ({x, y}, side) => {
  let e = new Entity
  e.addComponent(new BodyComponent(e))
  e.addComponent(new BulletComponent(e, {side, lifetime:1}))
  e.addComponent(new DespawnOffscreen(e))
  e.c.body.x = x
  e.c.body.y = y
  e.c.body.radius = 2
  return e
}

const makePlayerBullet = ({x, y}, side) => {
  const e = makeBullet({x, y}, side)
  e.addComponent({name: 'giveScore', to:side})
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
        for (let i = 0; i < 5; i++) {
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
  }
  onhit() {
    this.hp -= 1
    if (this.hp <= 0) {
      console.log("game ovah")
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

world.entities.add(makeSpawner(1))
world.entities.add(makeSpawner(-1))


world.entities.add(makePlayerSpawner(1))
world.entities.add(makePlayerSpawner(-1))

world.entities.add(makeBase(1))
world.entities.add(makeBase(-1))


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


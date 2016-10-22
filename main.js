// - Shooting
// - Telegraphing
// - Ability selection
// - Ability display
// - Make some abilities
// - Splash screen
// - Victory screen
// - Base building
// - Score
// - Use keyboard instead of gamepads
// - Music!
// - Window dressing (gameboy body, centering)

const canvas = document.getElementsByTagName('canvas')[0]
var WIDTH, HEIGHT
canvas.width = (WIDTH = canvas.clientWidth) * devicePixelRatio
canvas.height = (HEIGHT = canvas.clientHeight) * devicePixelRatio

const controllers = {
  gamepads: [],
  
  get(id) {
    return this.gamepads[id]
  },

  wasPressedNow(id, btn) {
    const g = this.gamepads[id]
    return g && g.buttons[btn] && !g.bprev[btn]
  },
  isPressed(id, btn) {
    const g = this.gamepads[id]
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
  update(dt) {
    this.entities.forEach(e => e.update(dt))
  },  
  draw() {
    this.entities.forEach(e => e.draw())
  },
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
  kill(e) {
    e.fireEvent('killed')
    this.entities.delete(e)
  }
}


class Entity {
  constructor() {
    this.components = {}
    this.anonComponents = []
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
  }
  onkilled(e) {
    world.entities.add(makeExplosion(e.c.body))
  }
  update(e, dt) {
    const myside = e.c.align.side
    this.cooldown -= dt
    if (this.target && (!this.target.isAlive
      || Math.sign(this.target.c.body.y - e.c.body.y) !== myside)) this.target = null
    if (this.target == null) {
      let es = world.entitiesInCircle(e.c.body, 100)
        .filter(other => other.c.align && other.c.align.side !== myside)
        .filter(other => Math.sign(other.c.body.y - e.c.body.y) === myside)
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
  constructor(e, side) {
    this.side = side
    this.lifetime = 1
  }

  draw(e) {
    ctx.fillStyle = 'black'
    ctx.fillRect(e.c.body.x - 2, e.c.body.y - 2, 4, 4)
  }

  update(e, dt) {
    this.lifetime -= dt
    if (this.lifetime < 0) {
      world.kill(e)
      return
    }
    e.c.body.y += this.side * 180 * dt
    let nearby = world.entitiesInCircle(e.c.body, 2)
      .filter(other => other.c.align && other.c.align.side != this.side)
    if (nearby.length) {
      world.kill(e)
      world.kill(nearby[0])
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

class PlayerController {
  constructor(e, padId) {
    this.padId = padId
    this.speed = 120
    this.ybias = 1.5

    this.abilityCooldown = [0,0,0,0]
  }
  
  update(e, dt) {
    const gamepad = controllers.get(this.padId)
    if (!gamepad) return

    e.c.body.x += dt * this.speed * gamepad.axes[0]
    e.c.body.y += dt * this.speed * gamepad.axes[1] * this.ybias

    for (let i = 0; i < 4; i++) this.abilityCooldown[i] -= dt

    if (controllers.isPressed(this.padId, 0)) {
      if (this.abilityCooldown[0] <= 0) {
        world.entities.add(makeBullet(e.c.body, e.c.align.side))
        this.abilityCooldown[0] = 0.5
      }
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
      const c = this
      if (this.player == null) {
        this.cooldown -= dt
        if (this.cooldown < 0) {
          this.player = spawnPlayer(side)
          this.player.addComponent({onkilled: () => c.player = null})
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
  if (side === -1) {
    e.c.body.y = HEIGHT
  }
  e.c.body.x = 100 + (Math.random() * 2 - 1) * 60
  return e
}

const makeBullet = ({x, y}, side) => {
  let e = new Entity
  e.addComponent(new BodyComponent(e))
  e.addComponent(new BulletComponent(e, side))
  e.addComponent(new DespawnOffscreen(e))
  e.c.body.x = x
  e.c.body.y = y
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
        this.cooldown += 1
        let creep = spawnCreep(side)
        world.entities.add(creep)
      }
    }
  })
  return spawner
}

world.entities.add(makeSpawner(1))
world.entities.add(makeSpawner(-1))


world.entities.add(makePlayerSpawner(1))
world.entities.add(makePlayerSpawner(-1))



// helper functions for getEntitiesInBB() inCircle() ...
// add / remove entiries



var ctx = canvas.getContext('2d')
ctx.scale(devicePixelRatio, devicePixelRatio) // For high dpi display support


function frame() {
  ctx.fillStyle = '#8EC401'
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  controllers.update()
  world.update(1/60)
  world.draw()

  requestAnimationFrame(frame)
}

frame()


window.addEventListener("gamepadconnected", function(e) {
  console.log("Gamepad connected at index %d: %s. %d buttons, %d axes.",
    e.gamepad.index, e.gamepad.id,
    e.gamepad.buttons.length, e.gamepad.axes.length);
});


const canvas = document.getElementsByTagName('canvas')[0]
var WIDTH, HEIGHT
canvas.width = (WIDTH = canvas.clientWidth) * devicePixelRatio
canvas.height = (HEIGHT = canvas.clientHeight) * devicePixelRatio

const controllers = {
  gamepads: [],
  get(i) {
    return this.gamepads[i]
  },

  update() {
    // https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API
    this.gamepads = navigator.getGamepads ? navigator.getGamepads() : (navigator.webkitGetGamepads ? navigator.webkitGetGamepads : []);
  }
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
          world.entities.add(makeBullet(e.c.body, myside))
          this.cooldown = 1
        }
      }
    } else {
      e.c.body.y += myside * 50 * dt
    }
  }

  draw(e) {
    ctx.fillStyle = (e.c.align.side == 1 ? "green" : "red")
    const {x,y} = e.components.body
    ctx.beginPath()
    ctx.arc(x, y, e.c.body.radius, 0, Math.PI*2)
    ctx.fill()
  }
  get name() { return 'creep' }
}

class BulletComponent {
  get name() { return 'bullet' }
  constructor(e, side) {
    this.side = side
  }

  draw(e) {
    ctx.fillStyle = 'black'
    ctx.fillRect(e.c.body.x - 2, e.c.body.y - 2, 4, 4)
  }

  update(e, dt) {
    e.c.body.y += this.side * 100 * dt
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

class GamepadController {
  constructor(e, padId) {
    this.padId = padId
    this.speed = 120
    this.ybias = 1.5
  }
  
  update(e, dt) {
    const gamepad = controllers.get(this.padId)
    if (!gamepad) return

    e.c.body.x += dt * this.speed * gamepad.axes[0]
    e.c.body.y += dt * this.speed * gamepad.axes[1] * this.ybias
  }
}

const spawnPlayer = (side) => {
  let e = new Entity
  e.addComponent(new BodyComponent(e))
  e.addComponent(new AlignmentComponent(e, side))
  e.addComponent(new PlayerComponent(e))
  e.addComponent(new GamepadController(e, side === 1 ? 0 : 1))
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

window.addEventListener("gamepaddisconnected", function(e) {
  console.log("Gamepad disconnected from index %d: %s",
    e.gamepad.index, e.gamepad.id);
});

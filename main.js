var canvas = document.getElementsByTagName('canvas')[0]
var width, height
var resize = window.onresize = function() {
  canvas.width = (width = canvas.clientWidth) * devicePixelRatio
  canvas.height = (height = canvas.clientHeight) * devicePixelRatio
}
resize()




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
}


class Entity {
  constructor() {
    this.components = {}
  }
  eachComponent(fn) {
    for(let name in this.components) {
      const c = this.components[name]
      fn(c, name)
    }
  }
  
  update(dt) {
    this.eachComponent(c => c.update && c.update(this, dt))
  }
  draw() {
    this.eachComponent(c => c.draw && c.draw(this))
  }
  addComponent(c) {
    if (!c.name) throw Error('No component name')
    if (this.components[c.name]) throw Error('already compnent called ' + c.name)
    this.components[c.name] = c
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
  constructor(e, side) {
    this.side = side
    this.target = null
  }
  update(e, dt) {
    if (this.target && !this.target.isAlive) this.target = null
    if (this.target == null) {
      let es = world.entitiesInCircle(e.c.body, 100)
        .filter(other => other.c.align && other.c.align.side != e.c.align.side)
      if (es.length) {
        this.target = es[0]
      }
    }
    if (this.target != null) {
      let dx = e.c.body.x - this.target.c.body.x
      if (Math.abs(dx) > 4) {
        e.c.body.x += -Math.sign(dx) * 50 * dt
      } else {
        world.entities.add(makeBullet(e.c.body, this.side))
      }
    } else {
      e.c.body.y += this.side * 50 * dt
    }
  }
  draw(e) {
    ctx.fillStyle = (this.side == 1 ? "green" : "red")
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
      world.entities.delete(e)
      world.entities.delete(nearby[0])
    }
  }
}


const spawnCreep = (side) => {
  let e = new Entity
  e.addComponent(new BodyComponent(e))
  e.addComponent(new CreepComponent(e, side))
  e.addComponent(new AlignmentComponent(e, side))
  if (side === -1) {
    e.c.body.y = 1000
  }
  e.c.body.x = 100 + (Math.random() * 2 - 1) * 10
  return e
}

const makeBullet = ({x, y}, side) => {
  let e = new Entity
  e.addComponent(new BodyComponent(e))
  e.addComponent(new BulletComponent(e, side))
  e.c.body.x = x
  e.c.body.y = y
  return e
}


const makeSpawner = (side) => {
  let spawner = new Entity
  spawner.c['spawn'] = {
    get name() { return 'spawn' },
    cooldown: 1,
    update(e, dt) {
      this.cooldown -= dt
      if (this.cooldown <= 0) {
        this.cooldown += 1
        let creep = spawnCreep(side)
        world.entities.add(creep)
      }
    }
  }
  return spawner
}

world.entities.add(makeSpawner(1))
world.entities.add(makeSpawner(-1))




// helper functions for getEntitiesInBB() inCircle() ...
// add / remove entiries



var ctx = canvas.getContext('2d')
ctx.scale(devicePixelRatio, devicePixelRatio) // For high dpi display support


function frame() {
  ctx.fillStyle = '#8EC401'
  ctx.fillRect(0, 0, width, height)

  world.update(1/60)
  world.draw()

  requestAnimationFrame(frame)
}

frame()


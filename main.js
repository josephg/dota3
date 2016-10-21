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
}


class BodyComponent {
  constructor(e) {
    this.x = 0
    this.y = 0
  }
  get name() { return 'body' }
}


const e = new Entity()
e.addComponent(new BodyComponent(e))

e.components['yo'] = {
  draw(e) {
    ctx.fillStyle = 'red'
    const {x,y} = e.components.body
    ctx.fillRect(x-5, y-5, 10, 10)
  },
  update(e, dt) {
    e.components.body.y += dt * 100
  }
}
world.entities.add(e)


class CreepComponent {
  constructor(e, side) {
    this.side = side
  }
  update(e, dt) {
    e.c.body.y += this.side * 50 * dt
  }
  draw(e) {
    ctx.fillStyle = (this.side == 1 ? "green" : "red")
    const {x,y} = e.components.body
    ctx.beginPath()
    ctx.arc(x, y, 5, 0, Math.PI*2)
    ctx.fill()
  }
  get name() { return 'creep' }
}


const spawnCreep = (side) => {
  let e = new Entity
  e.addComponent(new BodyComponent(e))
  e.addComponent(new CreepComponent(e, side))
  if (side === -1) {
    e.c.body.y = 1000
  }
  e.c.body.x = 100 + (Math.random() * 2 - 1) * 10
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


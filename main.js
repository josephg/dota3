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


// entities
// components {}
// draw() -> draw on components
// update() -> update on components



// helper functions for getEntitiesInBB() inCircle() ...
// add / remove entiries



var ctx = canvas.getContext('2d')
ctx.scale(devicePixelRatio, devicePixelRatio) // For high dpi display support


function frame() {
  ctx.fillStyle = 'skyblue'
  ctx.fillRect(0, 0, width, height)

  world.update(1/60)
  world.draw()

  requestAnimationFrame(frame)
}

frame()


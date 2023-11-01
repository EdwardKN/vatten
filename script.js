var particles = [];

var smoothingRadius = 20;

var targetDensity = 20;

var pressureMultiplier = 100;

var gravity = 0.05;


const velocityMultiplier = 1;
const bounceFactor = 0.8;

const chunkSize = smoothingRadius*4;
var chunks = {};

window.onload = init;

async function init() {
    fixCanvas();

    spawnParticles(1800);
    particles.forEach(e => e.density = calculateDensity(e.x,e.y));

    update();

};

function update(){
    requestAnimationFrame(update);
    renderC.clearRect(0, 0, renderCanvas.width, renderCanvas.height)
    c.clearRect(0, 0, canvas.width, canvas.height);

    render();

    c.fillStyle = "white"
    c.font = "10px Arial"
    c.fillText(fps, 5, 10)

    renderC.imageSmoothingEnabled = false;
    renderC.drawImage(canvas, 0, 0, renderCanvas.width, renderCanvas.height);
}

function render() {
    particles.forEach(e => e.predictPosition());
    particles.forEach(e => e.updateDensity());
    particles.forEach(e => e.updateVelocity());
    particles.forEach(e => e.updatePosition());
    particles.forEach(e => e.draw());
    particles.forEach(e => {
        //drawCircle(e.x,e.y,5,"black")
    })
};


function spawnParticles(amount){
    for(let i = 0; i < amount; i++){
        let x = randomIntFromRange(20,canvas.width-20)
        let y = randomIntFromRange(20,canvas.height-20)
        let particle = new Particle(x,y,particles.length);

        particles.push(particle);
    }
}

function smoothingKernel(dst,radius){
    if(dst >= radius) return 0;

    let volume = (Math.PI * Math.pow(radius, 4)) / 6
    return (radius-dst) * (radius - dst) / volume
}

function smoothingKernelDerivative(dst,radius){
    if(dst >= radius) return 0;

    let scale = 12 / (Math.pow(radius,4)*Math.PI)
    return (dst-radius) * scale
}

function calculateDensity(x,y){
    let density = 0;
    const mass = 100;

    let chunkRadiusThing = Math.ceil(smoothingRadius / chunkSize);
    let chunkX = Math.floor(x/chunkSize)
    let chunkY = Math.floor(y/chunkSize)
    for(let tmpX = chunkX - chunkRadiusThing; tmpX < chunkX+chunkRadiusThing*2; tmpX++){
        for(let tmpY = chunkY - chunkRadiusThing; tmpY < chunkY+chunkRadiusThing*2; tmpY++){
            for(let i = 0; i< chunks[tmpX+","+tmpY]?.length; i++){
                let particle = chunks[tmpX+","+tmpY][i];
                let dst = distance(particle.x,particle.y,x,y);
                let influence = smoothingKernel(dst,smoothingRadius);
                density += mass * influence;
            }
        }
    }

    return density
}
function convertDensityToPressure(density){
    let densityError = density-targetDensity;
    let pressure = densityError * pressureMultiplier;
    return pressure
}
function calculatePressureForce(particleIndex){
    const mass = 1;
    let pressureForce = {
        x:0,
        y:0
    }
    let chunkRadiusThing = Math.ceil(smoothingRadius / chunkSize);
    for(let x = particles[particleIndex].chunkX - chunkRadiusThing; x < particles[particleIndex].chunkX+chunkRadiusThing*2; x++){
        for(let y = particles[particleIndex].chunkY - chunkRadiusThing; y < particles[particleIndex].chunkY+chunkRadiusThing*2; y++){
            for(let i = 0; i< chunks[x+","+y]?.length; i++){
                if(particles[particleIndex] == chunks[x+","+y][i]) continue;
                let particle = chunks[x+","+y][i];
                let dst = distance(particle.predictedPosition.x,particle.predictedPosition.y,particles[particleIndex].predictedPosition.x,particles[particleIndex].predictedPosition.y);
                let dir = {
                    x:(dst < 0.1) ? Math.random()-Math.random()*2 :(particle.predictedPosition.x-particles[particleIndex].predictedPosition.x)/dst,
                    y:(dst < 0.1) ? Math.random()-Math.random()*2 :(particle.predictedPosition.y-particles[particleIndex].predictedPosition.y)/dst,
                }
                let slope = smoothingKernelDerivative(dst,smoothingRadius);
                if(slope == 0) continue
                let density = particle.density;
                let sharedPressure = calculateSharedPressure(density,particles[particleIndex].density);
                pressureForce.x += (density != 0) ? (-sharedPressure * dir.x * slope * mass / density) : 0;
                pressureForce.y += (density != 0) ? (-sharedPressure * dir.y * slope * mass / density) : 0;
            }
        }
    }
        
    return pressureForce;
}

function calculateSharedPressure(densityA,densityB){
    let pressureA = convertDensityToPressure(densityA);
    let pressureB = convertDensityToPressure(densityB);
    return (pressureA + pressureB) / 2;
}
function getInteractionForce(inputPos,radius,strength,particle){
    let force = {
        x:0,
        y:0
    };
    let dst = distance(particle.x,particle.y,inputPos.x,inputPos.y);
    if(dst < radius){
        let dirX = (particle.x - inputPos.x) / dst;
        let dirY = (particle.y - inputPos.y) / dst;

        let centreT = 1 - dst / radius;

        force.x = dirX * (strength == 3 ? 2 : -2) - particle.vx * centreT
        force.y = dirY * (strength == 3 ? 2 : -2) - particle.vy * centreT
        
    }
    return force
}





class Particle{
    constructor(x,y,i){
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.radius = 5
        this.density = calculateDensity(this.x,this.y);
        this.i = i;
        this.predictedPosition = {
            x:x,
            y:y
        }
        this.chunkX = Math.floor(this.x / chunkSize);
        this.chunkY = Math.floor(this.y / chunkSize);

        if(!chunks[this.chunkX + "," + this.chunkY]){
            chunks[this.chunkX + "," + this.chunkY] = [];
        }
        chunks[this.chunkX + "," + this.chunkY].push(this); 
    }
    draw(){
        let grd = c.createRadialGradient(this.x, this.y,0, this.x, this.y, smoothingRadius*2);
        grd.addColorStop(0, "rgba(0,0,255,0.2)");
        grd.addColorStop(0.5, "rgba(0,0,255,0.1)");
        grd.addColorStop(1, "rgba(0,0,255,0)");
        drawCircle(this.x,this.y,smoothingRadius*2,grd)
    }
    predictPosition(){
        this.vy += gravity*velocityMultiplier;
        this.predictedPosition = {
            x:this.x + this.vx,
            y:this.y + this.vy
        }
    }
    updateDensity(){
        this.density = calculateDensity(this.predictedPosition.x,this.predictedPosition.y);
    }
    updateVelocity(){
        let pressureForce = calculatePressureForce(this.i);
        let interactionForce = {
            x:0,
            y:0
        }
        if(mouse.down){
            interactionForce = getInteractionForce(mouse,200,mouse.which,this)
        }
        if(this.density !== 0){
            this.vx += (pressureForce.x / this.density + interactionForce.x)*velocityMultiplier;
            this.vy += (pressureForce.y / this.density + interactionForce.y)*velocityMultiplier
        }
        this.vx = this.vx.clamp(-10,10)
        this.vy = this.vy.clamp(-10,10)
    }
    updatePosition(){
        this.x += this.vx;
        this.y += this.vy;

        if(this.chunkX != Math.floor(this.x / chunkSize) || this.chunkY != Math.floor(this.y / chunkSize)){
            chunks[this.chunkX + "," + this.chunkY].splice(chunks[this.chunkX + "," + this.chunkY].indexOf(this),1);
            this.chunkX = Math.floor(this.x / chunkSize);
            this.chunkY = Math.floor(this.y / chunkSize);
            if(!chunks[this.chunkX + "," + this.chunkY]){
                chunks[this.chunkX + "," + this.chunkY] = [];
            }
            chunks[this.chunkX + "," + this.chunkY].push(this); 
        }


        if(this.x+ this.radius> canvas.width || this.x- this.radius< 0 ){
            this.x -= this.vx;
            this.vx *= -bounceFactor;
        }
        if(this.y+ this.radius> canvas.height || this.y- this.radius< 0 ){
            this.y -= this.vy;
            this.vy *= -bounceFactor;
        }
    }

}

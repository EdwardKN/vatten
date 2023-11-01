var particles = [];

var smoothingRadius = 30;

var targetDensity = 20;

var pressureMultiplier = 100;

var gravity = 0.05;

var viscosityStrength = 1

var nearPressureMultiplier = 10;


const velocityMultiplier = 1;
const bounceFactor = 0.8;

const chunkSize = smoothingRadius;
var chunks = {};

window.onload = init;

async function init() {
    fixCanvas();

    spawnParticles(1500);
    particles.forEach(e => {
        let tmp = calculateDensity(e.x,e.y)
        e.density = tmp.density
        e.nearDensity = tmp.nearDensity;
    });

    update();

};

function update(){
    requestAnimationFrame(update);

    renderC.clearRect(0, 0, renderCanvas.width, renderCanvas.height)
    c.clearRect(0, 0, canvas.width, canvas.height);

    c.fillStyle = "black"
    c.font = "50px Arial"
    c.fillText(fps, 20, 40)

    step();

    //particles.forEach(e => e.draw());
    particles.forEach(e => {
        drawCircle(e.x,e.y,5,"rgb("+distance(e.vx,e.vy,0,0)*100+",0,0)")
    })

    renderC.imageSmoothingEnabled = false;
    renderC.drawImage(canvas, 0, 0, renderCanvas.width, renderCanvas.height);
}




function spawnParticles(amount){
    for(let i = 0; i < amount; i++){
        let x = randomIntFromRange(200,canvas.width-200)
        let y = randomIntFromRange(200,canvas.height-200)
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
function viscositySmoothingKernel(dst,radius){
    let value = Math.max(0,radius*radius - dst * dst);
    return value*value*value
}

function nearSmoothingKernel(dst,radius){
    if(dst >= radius) return 0;

    let volume = 2 * Math.PI * Math.pow(radius,6) / 15;
    return Math.pow(radius-dst,4) / volume
}

function calculateDensity(x,y){
    let density = 0;
    let nearDensity = 0;
    const mass = 100;

    let chunkRadiusThing = Math.ceil(smoothingRadius / chunkSize);
    let chunkX = Math.floor(x/chunkSize)
    let chunkY = Math.floor(y/chunkSize)
    let minX = chunkX - chunkRadiusThing
    let maxX = chunkX+chunkRadiusThing*2;
    let minY = chunkY - chunkRadiusThing;
    let maxY = chunkY+chunkRadiusThing*2;
    for(let tmpX = minX; tmpX < maxX; tmpX++){
        for(let tmpY = minY; tmpY < maxY; tmpY++){
            let chunklength = chunks[tmpX+","+tmpY]?.length;
            for(let i = 0; i< chunklength; i++){
                let particle = chunks[tmpX+","+tmpY][i];
                let dst = distance(particle.x,particle.y,x,y);
                let influence = smoothingKernel(dst,smoothingRadius);
                let nearInfluence = nearSmoothingKernel(dst,smoothingRadius);
                density += mass * influence;
                nearDensity += mass*nearInfluence;
            }
        }
    }

    return {
        density:density,
        nearDensity:nearDensity
    }
}
function convertDensityToPressure(density,nearDensity){
    let densityError = density-targetDensity;
    let pressure = densityError * pressureMultiplier;
    let nearPressure = nearDensity * nearPressureMultiplier;
    return {
        pressure:pressure,
        nearPressure:nearPressure
    };
}
function calculatePressureForce(particleIndex){
    const mass = 1;
    let pressureForce = {
        x:0,
        y:0
    }
    let chunkRadiusThing = Math.ceil(smoothingRadius / chunkSize);
    let minX = particles[particleIndex].chunkX - chunkRadiusThing
    let maxX = particles[particleIndex].chunkX+chunkRadiusThing*2;
    let minY = particles[particleIndex].chunkY - chunkRadiusThing;
    let maxY = particles[particleIndex].chunkY+chunkRadiusThing*2;
    for(let x = minX; x < maxX; x++){
        for(let y = minY; y < maxY; y++){
            let chunklength = chunks[x+","+y]?.length;
            for(let i = 0; i< chunklength; i++){
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
                let nearDensity = particle.nearDensity;
                let sharedPressure = calculateSharedPressure(density,nearDensity,particles[particleIndex].density,particles[particleIndex].nearDensity);
                pressureForce.x += (density != 0) ? (-sharedPressure.pressure * dir.x * slope * mass / density) : 0;
                pressureForce.x += (density != 0) ? (-sharedPressure.nearPressure * dir.x * slope * mass / density) : 0;
                pressureForce.y += (density != 0) ? (-sharedPressure.pressure * dir.y * slope * mass / density) : 0;
                pressureForce.y += (density != 0) ? (-sharedPressure.nearPressure * dir.y * slope * mass / density) : 0;
            }
        }
    }
        
    return pressureForce;
}
function calculateVescosityForce(particleIndex){
    let viscosityForce = {
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
                let influence = viscositySmoothingKernel(dst,smoothingRadius);
                
                viscosityForce.x += (particle.vx - particles[particleIndex].vx) * influence *viscosityStrength;
                viscosityForce.y += (particle.vy - particles[particleIndex].vy) * influence *viscosityStrength;
            }
        }
    }


}

function calculateSharedPressure(densityA,nearDensityA,densityB,nearDensityB){
    let pressureA = convertDensityToPressure(densityA,nearDensityA);
    let pressureB = convertDensityToPressure(densityB,nearDensityB);
    return {
        pressure:(pressureA.pressure + pressureB.pressure) / 2,
        nearPressure:(pressureA.nearPressure + pressureB.nearPressure) / 2
    };
}


function getInteractionForce(inputPos,radius,strength,particle){
    let force = {
        x:0,
        y:0
    };
    let dst = distance(particle.x,particle.y,inputPos.x,inputPos.y);
    if(dst < radius && dst > 4){
        let dirX = (particle.x - inputPos.x) / dst;
        let dirY = (particle.y - inputPos.y) / dst;

        let forceStrength = (dst/5) / radius;

        let centreT = 1 - dst / radius;

        force.x = dirX * (strength == 3 ? 5 : -5)*forceStrength - particle.vx * centreT
        force.y = dirY * (strength == 3 ? 5 : -5)*forceStrength - particle.vy * centreT
        
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
        let tmp643346 = calculateDensity(this.x,this.y);
        this.density = tmp643346.density;
        this.nearDensity = tmp643346.nearDensity;
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
        let grd = c.createRadialGradient(this.x, this.y,0, this.x, this.y, smoothingRadius);
        grd.addColorStop(0, "rgba(0,0,255,0.2)");
        grd.addColorStop(0.5, "rgba(0,0,255,0.1)");
        grd.addColorStop(1, "rgba(0,0,255,0)");
        drawCircle(this.x,this.y,smoothingRadius,grd)
    }
    predictPosition(){
        this.vy += gravity*velocityMultiplier * deltaStepTime;
        this.predictedPosition = {
            x:this.x + this.vx * deltaStepTime * deltaTime,
            y:this.y + this.vy * deltaStepTime * deltaTime
        }
    }
    updateDensity(){
        let tmp = calculateDensity(this.predictedPosition.x,this.predictedPosition.y);
        this.density = tmp.density;
        this.nearDensity = tmp.nearDensity;
    }
    updateVelocity(){
        let pressureForce = calculatePressureForce(this.i);
        let interactionForce = {
            x:0,
            y:0
        }
        if(mouse.down){
            interactionForce = getInteractionForce(mouse,100,mouse.which,this)
        }
        if(this.density !== 0){
            this.vx += (pressureForce.x / this.density + interactionForce.x)*velocityMultiplier * deltaStepTime;
            this.vy += (pressureForce.y / this.density + interactionForce.y)*velocityMultiplier * deltaStepTime;
        }
        this.vx = this.vx.clamp(-10,10)
        this.vy = this.vy.clamp(-10,10)
    }
    updatePosition(){
        this.x += this.vx * deltaStepTime * deltaTime;
        this.y += this.vy * deltaStepTime * deltaTime;

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
            this.x -= this.vx * deltaStepTime * deltaTime;
            this.vx *= -bounceFactor;
        }
        if(this.y+ this.radius> canvas.height || this.y- this.radius< 0 ){
            this.y -= this.vy * deltaStepTime * deltaTime;
            this.vy *= -bounceFactor;
        }
    }

}
async function step() {
    particles.forEach(e => e.predictPosition())
    particles.forEach(e => e.updateDensity())
    particles.forEach(e => e.updateVelocity())
    particles.forEach(e => e.updatePosition())
};

let deltaStepTime = 1;

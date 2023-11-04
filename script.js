var particles = [];

const smoothingRadius = 30;

var targetDensity = 0.1;

var pressureMultiplier = 50;

var gravity = 1;

var viscosityStrength = 1000;

var nearPressureMultiplier = 50000;


var velocityMultiplier = 1;
const bounceFactor = 0.8;

const chunkSize = smoothingRadius;
var simulationStepsPerFrame = 3;

var spacialLookup = [];
var startIndices = [];

window.onload = init;

async function init() {
    fixCanvas();

    spawnParticles(1000,400);
    particles.forEach(e => {
        let tmp = calculateDensity(e.x,e.y)
        e.density = tmp.density
        e.nearDensity = tmp.nearDensity;
    });
    updateSpacialLookup()
    update();

};

function update(){
    requestAnimationFrame(update);

    renderC.clearRect(0, 0, renderCanvas.width, renderCanvas.height)
    c.clearRect(0, 0, canvas.width, canvas.height);

    c.fillStyle = "black"
    c.font = "50px Arial"
    c.fillText(fps, 20, 40)

    for(let i = 0; i < simulationStepsPerFrame; i++){
        step();
    }

    particles.forEach(e => e.draw());
    /*particles.forEach(e => {
        drawCircle(e.x,e.y,5,"rgb("+distance(e.vx,e.vy,0,0)*100+",0,0)")
    })*/

    renderC.imageSmoothingEnabled = false;
    renderC.drawImage(canvas, 0, 0, renderCanvas.width, renderCanvas.height);
}




function spawnParticles(amount,spawnSize){
    for(let i = 0; i < amount; i++){
        let centerX = canvas.width/2;
        let centerY = canvas.height/2;
        let x = randomIntFromRange(centerX-spawnSize,centerX+spawnSize)
        let y = randomIntFromRange(centerY-spawnSize,centerY+spawnSize)
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
    let volume = Math.PI * Math.pow(radius,8) / 4;
    let value = Math.max(0,radius*radius - dst * dst);
    return value*value*value / volume
}

function nearSmoothingKernel(dst,radius){
    if(dst >= radius) return 0;
    let tmp = radius-dst;

    let volume = 2 * Math.PI * Math.pow(radius,6) / 15;
    return tmp * tmp * tmp * tmp / volume
}

function calculateDensity(x,y){

    let density = 0;
    let nearDensity = 0;    
    const mass = 100;

    foreachPointWithinRadius({x:x,y:y}).forEach(particle => {
        let dst = distance(particle.x,particle.y,x,y);
        let influence = smoothingKernel(dst,smoothingRadius);
        let nearInfluence = nearSmoothingKernel(dst,smoothingRadius);
        density += mass * influence;
        nearDensity += mass*nearInfluence;
    })
    return {
        density:density,
        nearDensity:nearDensity
    }
}
function convertDensityToPressure(density,nearDensity){
    let densityError = density-targetDensity;
    let pressure = densityError * pressureMultiplier;
    let nearPressure = nearDensity * -nearPressureMultiplier;
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
    let particlesWithinRange = foreachPointWithinRadius(particles[particleIndex])
    let length = particlesWithinRange.length;
    for(let i = 0; i< length; i++){
        if(particles[particleIndex] == particlesWithinRange[i]) continue;
        let particle = particlesWithinRange[i];
        let dst = distance(particle.predictedPosition.x,particle.predictedPosition.y,particles[particleIndex].predictedPosition.x,particles[particleIndex].predictedPosition.y);
        let dir = {
            x:(dst ==0) ? Math.random()-Math.random()*2 :(particle.predictedPosition.x-particles[particleIndex].predictedPosition.x)/dst,
            y:(dst ==0) ? Math.random()-Math.random()*2 :(particle.predictedPosition.y-particles[particleIndex].predictedPosition.y)/dst,
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
                
    return pressureForce;
}
function calculateViscosityForce(particleIndex){
    let viscosityForce = {
        x:0,
        y:0
    }
    let particlesWithinRange = foreachPointWithinRadius(particles[particleIndex])
    let length = particlesWithinRange.length;
    for(let i = 0; i< length; i++){
        if(particles[particleIndex] == particlesWithinRange[i]) continue;
        let particle = particlesWithinRange[i];

        let dst = distance(particle.predictedPosition.x,particle.predictedPosition.y,particles[particleIndex].predictedPosition.x,particles[particleIndex].predictedPosition.y);
        let influence = viscositySmoothingKernel(dst,smoothingRadius);

        
        viscosityForce.x += (particle.vx - particles[particleIndex].vx) * influence *viscosityStrength;
        viscosityForce.y += (particle.vy - particles[particleIndex].vy) * influence *viscosityStrength;
    }
        
    return viscosityForce;


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

        let forceStrength = (dst/2) / radius;

        let centreT = 1 - dst / radius;

        force.x = dirX * (strength == 3 ? 10 : -10)*forceStrength - particle.vx * centreT
        force.y = dirY * (strength == 3 ? 10 : -10)*forceStrength - particle.vy * centreT
        
    }
    return force
}
function positionToCellCoord(x,y){
    return {
        x:Math.floor(x/chunkSize),
        y:Math.floor(y/chunkSize)
    }
}
function cellCoordToHash(cell){
    return (15823 * cell.x) + (9737333 * cell.y);
}
function getKeyFromHash(hash,particleLength){
    return hash%particleLength;
}


function updateSpacialLookup(){
    spacialLookup = [];
    let particleLength = particles.length;
    particles.forEach((particle,i) => {
        let cell = positionToCellCoord(particle.predictedPosition.x,particle.predictedPosition.y);
        let cellKey = getKeyFromHash(cellCoordToHash(cell),particleLength);
        spacialLookup[i] = {cellKey:cellKey,index:i};
        startIndices[i] = Infinity;
    })
    spacialLookup.sort((a,b) => a.cellKey-b.cellKey);

    particles.forEach((particle,i) => {
        let key = spacialLookup[i].cellKey;
        let keyPrev = i == 0 ? Infinity : spacialLookup[i-1].cellKey;
        if(key != keyPrev){
            startIndices[key] = i;
        }
    })
}
function foreachPointWithinRadius(samplePoint){
    let cellCoord = positionToCellCoord(samplePoint.x,samplePoint.y);
    let particlesWithinRange = [];
    let length = spacialLookup.length;
    let particleLength = particles.length;
    for(let x = cellCoord.x-1; x < cellCoord.x+2; x++){
        for(let y = cellCoord.y-1; y < cellCoord.y+2; y++){
            let key = getKeyFromHash(cellCoordToHash({x:x,y:y}),particleLength)
            let startIndex = startIndices[key];
             
            for(let i = startIndex; i < length; i++){
                if(spacialLookup[i].cellKey != key) break;

                let particleIndex = spacialLookup[i].index;
                let particle = particles[particleIndex];
                let dst = distance(samplePoint.x,samplePoint.y,particle.x,particle.y);
                if(dst < smoothingRadius){
                    particlesWithinRange.push(particle);
                }
            }
        }
    }
    return particlesWithinRange;
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
    }
    draw(){
        let grd = c.createRadialGradient(this.x, this.y,0, this.x, this.y, smoothingRadius);
        grd.addColorStop(0, "rgba(0,0,255,0.4)");
        grd.addColorStop(1, "rgba(0,0,255,0)");
        drawCircle(this.x,this.y,smoothingRadius,grd)
    }
    predictPosition(){
        this.vy += gravity*velocityMultiplier * deltaStepTime;
        this.predictedPosition = {
            x:this.x + this.vx * deltaStepTime * deltaTime * velocityMultiplier,
            y:this.y + this.vy * deltaStepTime * deltaTime * velocityMultiplier
        }
    }
    updateDensity(){
        let tmp = calculateDensity(this.predictedPosition.x,this.predictedPosition.y);
        this.density = tmp.density;
        this.nearDensity = tmp.nearDensity;
    }
    updateVelocity(){
        let pressureForce = calculatePressureForce(this.i);
        let viscosityForce = calculateViscosityForce(this.i);
        let interactionForce = {
            x:0,
            y:0
        }
        if(mouse.down){
            interactionForce = getInteractionForce(mouse,400,mouse.which,this)
        }
        if(this.density !== 0){
            this.vx += ((pressureForce.x) / this.density + interactionForce.x)*velocityMultiplier * deltaStepTime + viscosityForce.x;
            this.vy += ((pressureForce.y) / this.density + interactionForce.y)*velocityMultiplier * deltaStepTime + viscosityForce.y;
        }
        this.vx = this.vx.clamp(-10,10)
        this.vy = this.vy.clamp(-10,10)
    }
    updatePosition(){
        this.x += this.vx * deltaStepTime * deltaTime * velocityMultiplier;
        this.y += this.vy * deltaStepTime * deltaTime * velocityMultiplier;

        if(this.x+ this.radius> canvas.width || this.x- this.radius< 0 ){
            this.x -= this.vx * deltaStepTime * deltaTime *velocityMultiplier;
            this.vx *= -bounceFactor;
        }
        if(this.y+ this.radius> canvas.height || this.y- this.radius< 0 ){
            this.y -= this.vy * deltaStepTime * deltaTime *velocityMultiplier;
            this.vy *= -bounceFactor;
        }
    }

}
async function step() {
    particles.forEach(e => e.predictPosition())
    updateSpacialLookup()
    particles.forEach(e => e.updateDensity())
    particles.forEach(e => e.updateVelocity())
    particles.forEach(e => e.updatePosition())
};

let deltaStepTime = 1/simulationStepsPerFrame;

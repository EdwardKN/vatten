var canvas = document.createElement("canvas");
var c = canvas.getContext("2d");

var renderCanvas = document.createElement("canvas");
var renderC = renderCanvas.getContext("2d");
document.body.appendChild(renderCanvas);
renderCanvas.style.zIndex = 0

var scale = 0;

const renderScale = 1;

window.onload = fixCanvas;

window.addEventListener("resize", fixCanvas);

document.addEventListener('contextmenu', event => event.preventDefault());

renderCanvas.addEventListener("mousemove", function (e) {
    let oldDown = mouse.down;
    let oldWhich = mouse.which;
    mouse = {
        x: e.offsetX / scale,
        y: e.offsetY / scale,
        down: oldDown,
        which:oldWhich
    };
});

var mouse = {
    x: undefined,
    y: undefined,
    down: false
};

renderCanvas.addEventListener("mousedown", function (e) {
    mouse.down = true;
    mouse.which = e.which;
});
renderCanvas.addEventListener("mouseup", function (e) {
    mouse.down = false;
});

function fixCanvas() {
    canvas.width = 1920 / renderScale;
    canvas.height = 1080 / renderScale;
    if (window.innerWidth * 9 > window.innerHeight * 16) {
        renderCanvas.width = window.innerHeight * 16 / 9;
        renderCanvas.height = window.innerHeight;
        scale = renderCanvas.width / canvas.width;
    } else {
        renderCanvas.width = window.innerWidth;
        renderCanvas.height = window.innerWidth * 9 / 16;
        scale = renderCanvas.height / canvas.height;
    };
};



var spritesheet;
var spritesheetImage;

async function loadSpriteSheet() {
    var response = await fetch("./images/texture.json")
    spritesheet = await response.json();
    spritesheetImage = new Image();
    spritesheetImage.src = "./images/texture.png";
}

async function loadImages(imageObject) {
    await loadSpriteSheet();
    Object.entries(imageObject).forEach((image, i) => {
        let src2 = "images/" + image[1]
        images[image[0]] = (spritesheet.frames[spritesheet.frames.map(function (e) { return e.filename; }).indexOf(src2 + ".png")])
    });
}

CanvasRenderingContext2D.prototype.drawImageFromSpriteSheet = function (x, y, w, h, frame, cropX, cropY, cropW, cropH) {
    if (!frame) { return }
    this.drawImage(spritesheetImage, Math.floor(cropX + frame.frame.x), Math.floor(cropY + frame.frame.y), Math.floor(cropW), Math.floor(cropH), Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
}

const toRad = Math.PI / 180
const toDeg = 180 * Math.PI

function drawCircle(x, y, r, co) {
    c.beginPath();
    c.arc(x, y, r, 0, 2 * Math.PI, false);
    c.fillStyle = co;
    c.fill();
}

function detectCollision(x, y, w, h, x2, y2, w2, h2) {
    let convertedR1 = rectangleConverter(x, y, w, h);
    let convertedR2 = rectangleConverter(x2, y2, w2, h2);

    x = convertedR1[0];
    y = convertedR1[1];
    w = convertedR1[2];
    h = convertedR1[3];
    x2 = convertedR2[0];
    y2 = convertedR2[1];
    w2 = convertedR2[2];
    h2 = convertedR2[3];
    if (x + w > x2 && x < x2 + w2 && y + h > y2 && y < y2 + h2) {
        return true;
    };
};

function rectangleConverter(x, y, w, h) {
    if (w < 0) {
        x += w;
        w = Math.abs(w)
    }
    if (h < 0) {
        y += h;
        h = Math.abs(h)
    }
    return [x, y, w, h]
}
function distance(x1, y1, x2, y2) {
    const xDist = x2 - x1;
    const yDist = y2 - y1;

    return Math.sqrt(Math.pow(xDist, 2) + Math.pow(yDist, 2));
};

function drawLine(from, to, co) {
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(from.x * tileSize, from.y * tileSize);
    c.lineTo(to.x * tileSize, to.y * tileSize);
    c.strokeStyle = co
    c.stroke();
}


function pointCircleCollide(point, circle, r) {
    if (r === 0) return false
    var dx = circle[0] - point[0]
    var dy = circle[1] - point[1]
    return dx * dx + dy * dy <= r * r
}

var tmp = [0, 0]

function lineCircleCollide(a, b, circle, radius, nearest) {
    //check to see if start or end points lie within circle
    if (pointCircleCollide(a, circle, radius)) {
        if (nearest) {
            nearest[0] = a[0]
            nearest[1] = a[1]
        }
        return true
    } if (pointCircleCollide(b, circle, radius)) {
        if (nearest) {
            nearest[0] = b[0]
            nearest[1] = b[1]
        }
        return true
    }

    var x1 = a[0],
        y1 = a[1],
        x2 = b[0],
        y2 = b[1],
        cx = circle[0],
        cy = circle[1]

    //vector d
    var dx = x2 - x1
    var dy = y2 - y1

    //vector lc
    var lcx = cx - x1
    var lcy = cy - y1

    //project lc onto d, resulting in vector p
    var dLen2 = dx * dx + dy * dy //len2 of d
    var px = dx
    var py = dy
    if (dLen2 > 0) {
        var dp = (lcx * dx + lcy * dy) / dLen2
        px *= dp
        py *= dp
    }

    if (!nearest)
        nearest = tmp
    nearest[0] = x1 + px
    nearest[1] = y1 + py

    //len2 of p
    var pLen2 = px * px + py * py

    //check collision
    return pointCircleCollide(nearest, circle, radius)
        && pLen2 <= dLen2 && (px * dx + py * dy) >= 0
}

function checkLineIntersection(line1StartX, line1StartY, line1EndX, line1EndY, line2StartX, line2StartY, line2EndX, line2EndY) {
    // if the lines intersect, the result contains the x and y of the intersection (treating the lines as infinite) and booleans for whether line segment 1 or line segment 2 contain the point
    var denominator, a, b, numerator1, numerator2, result = {
        x: null,
        y: null,
        onLine1: false,
        onLine2: false
    };
    denominator = ((line2EndY - line2StartY) * (line1EndX - line1StartX)) - ((line2EndX - line2StartX) * (line1EndY - line1StartY));
    if (denominator == 0) {
        return result;
    }
    a = line1StartY - line2StartY;
    b = line1StartX - line2StartX;
    numerator1 = ((line2EndX - line2StartX) * a) - ((line2EndY - line2StartY) * b);
    numerator2 = ((line1EndX - line1StartX) * a) - ((line1EndY - line1StartY) * b);
    a = numerator1 / denominator;
    b = numerator2 / denominator;

    // if we cast these lines infinitely in both directions, they intersect here:
    result.x = line1StartX + (a * (line1EndX - line1StartX));
    result.y = line1StartY + (a * (line1EndY - line1StartY));
    /*
            // it is worth noting that this should be the same as:
            x = line2StartX + (b * (line2EndX - line2StartX));
            y = line2StartX + (b * (line2EndY - line2StartY));
            */
    // if line1 is a segment and line2 is infinite, they intersect if:
    if (a > 0 && a < 1) {
        result.onLine1 = true;
    }
    // if line2 is a segment and line1 is infinite, they intersect if:
    if (b > 0 && b < 1) {
        result.onLine2 = true;
    }
    // if line1 and line2 are segments, they intersect if both of the above are true
    return result;
};

function lineIntersect(a, b, c, d, p, q, r, s) {
    var det, gamma, lambda;
    det = (c - a) * (s - q) - (r - p) * (d - b);
    if (det === 0) {
        return false;
    } else {
        lambda = ((s - q) * (r - a) + (p - r) * (s - b)) / det;
        gamma = ((b - d) * (r - a) + (c - a) * (s - b)) / det;
        return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
    }
};

function rectangleToLineIntersect(from, to, x, y, w, h) {
    let collisionArray = [];
    if (lineIntersect(from.x, from.y, to.x, to.y, x, y, x + w, y)) {
        collisionArray.push("up")
    }
    if (lineIntersect(from.x, from.y, to.x, to.y, x, y, x, y + h)) {
        collisionArray.push("left")
    }
    if (lineIntersect(from.x, from.y, to.x, to.y, x + w, y, x + w, y + h)) {
        collisionArray.push("right")
    }
    if (lineIntersect(from.x, from.y, to.x, to.y, x, y + h, x + w, y + h)) {
        collisionArray.push("down")
    }
    if (from.x == to.x) {
        if (detectCollision(from.x, from.y, 2, to.y - from.y, x + 2, y, 1, h)) {
            collisionArray.push("left")
        }
        if (detectCollision(from.x, from.y, 2, to.y - from.y, x + w, y, 1, h)) {
            collisionArray.push("right")
        }
    }
    if (from.y == to.y) {
        if (detectCollision(from.x, from.y, to.x - from.x, 2, x, y, w, 1)) {
            collisionArray.push("up")
        }
        if (detectCollision(from.x, from.y, to.x - from.x, 2, x, y + h, w, 1)) {
            collisionArray.push("down")
        }
    }
    return collisionArray;
}

function movingObjectToLineIntersect(from, to, x, y, w, h, oldX, oldY) {
    let collisionArray = [];
    if (lineIntersect(from.x, from.y, to.x, to.y, oldX, oldY, x + w, y)) {
        collisionArray.push("up")
    }
    if (lineIntersect(from.x, from.y, to.x, to.y, oldX, oldY, x, y + h)) {
        collisionArray.push("left")
    }
    if (lineIntersect(from.x, from.y, to.x, to.y, oldX + w, oldY, x + w, y + h)) {
        collisionArray.push("right")
    }
    if (lineIntersect(from.x, from.y, to.x, to.y, oldX, oldY + h, x + w, y + h)) {
        collisionArray.push("down")
    }
    if (from.x == to.x) {
        if (detectCollision(from.x, from.y, 2, to.y - from.y, x + 2, y, 1, h)) {
            collisionArray.push("left")
        }
        if (detectCollision(from.x, from.y, 2, to.y - from.y, x + w, y, 1, h)) {
            collisionArray.push("right")
        }
    }
    if (from.y == to.y) {
        if (detectCollision(from.x, from.y, to.x - from.x, 2, x, y, w, 1)) {
            collisionArray.push("up")
        }
        if (detectCollision(from.x, from.y, to.x - from.x, 2, x, y + h, w, 1)) {
            collisionArray.push("down")
        }
    }
    return collisionArray;
}

var pressedKeys = [];

window.addEventListener('keydown', function (e) {
    pressedKeys[e.code] = true;
})

window.addEventListener('keyup', function (e) {
    pressedKeys[e.code] = false;
})

Number.prototype.clamp = function (min, max) {
    return Math.min(Math.max(this, min), max);
};

function angleFromPoints(x, y, x2, y2) {
    return Math.atan2(y2 - y, x2 - x) * 180 / Math.PI
}
function angle(cx, cy, ex, ey) {
    var dy = ey - cy;
    var dx = ex - cx;
    var theta = Math.atan2(dy, dx); // range (-PI, PI]
    theta *= 180 / Math.PI; // rads to degs, range (-180, 180]
    return theta;
  }
function angle360(cx, cy, ex, ey) {
    var theta = angle(cx, cy, ex, ey); // range (-180, 180]
    if (theta < 0) theta = 360 + theta; // range [0, 360)
    return theta;
  }
  function sum(a) {
    var s = 0;
    for (var i = 0; i < a.length; i++) s += a[i];
    return s;
} 

function degToRad(a) {
    return Math.PI / 180 * a;
}
  function meanAngleDeg(a) {
    let tmp = 180 / Math.PI * Math.atan2(
        sum(a.map(degToRad).map(Math.sin)) / a.length,
        sum(a.map(degToRad).map(Math.cos)) / a.length
    );
    if (tmp < 0) tmp = 360 + tmp; // range [0, 360)
    return tmp;
}

function getGroupedBy(arr, key) {
    var groups = {}, result = [];
    arr.forEach(function (a) {
        if (!(a[key] in groups)) {
            groups[a[key]] = [];
            result.push(groups[a[key]]);
        }
        groups[a[key]].push(a);
    });
    return result;
}

function randomIntFromRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min)
};


var times = [];
var fps = 60;
var deltaTime = 1;

function refreshLoop() {
    window.requestAnimationFrame(function () {
        const now = performance.now();
        while (times.length > 0 && times[0] <= now - 1000) {
            times.shift();
        }
        times.push(now);
        fps = times.length;
        //deltaTime = 60 / fps;
        refreshLoop();
    });
}
refreshLoop();



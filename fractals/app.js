'use strict';


const fsText = `
precision highp float;

uniform vec2 viewportDimensions;
uniform float minI;
uniform float maxI;
uniform float minR;
uniform float maxR;
uniform float time;

uniform float mandelbrotCoeff;
uniform float burningShipCoeff;
uniform float juliaCoeff;

uniform float cycledPaletteCoeff;
uniform float trippyPaletteCoeff;



float hue2rgb(float f1, float f2, float hue) {
	if (hue < 0.0)
			hue += 1.0;
	else if (hue > 1.0)
			hue -= 1.0;
	float res;
	if ((6.0 * hue) < 1.0)
			res = f1 + (f2 - f1) * 6.0 * hue;
	else if ((2.0 * hue) < 1.0)
			res = f2;
	else if ((3.0 * hue) < 2.0)
			res = f1 + (f2 - f1) * ((2.0 / 3.0) - hue) * 6.0;
	else
			res = f1;
	return res;
}

vec3 hsl2rgb(vec3 hsl) {
	vec3 rgb;
	
	if (hsl.y == 0.0) {
			rgb = vec3(hsl.z); // Luminance
	} else {
			float f2;
			
			if (hsl.z < 0.5)
					f2 = hsl.z * (1.0 + hsl.y);
			else
					f2 = hsl.z + hsl.y - hsl.y * hsl.z;
					
			float f1 = 2.0 * hsl.z - f2;
			
			rgb.r = hue2rgb(f1, f2, hsl.x + (1.0/3.0));
			rgb.g = hue2rgb(f1, f2, hsl.x);
			rgb.b = hue2rgb(f1, f2, hsl.x - (1.0/3.0));
	}   
	return rgb;
}

vec3 hsl2rgb(float h, float s, float l) {
	return hsl2rgb(vec3(h, s, l));
}







vec3 palette0(float value) {
	float t = time / 20.0;

	float hue = value + t - floor(value + t);

	return hsl2rgb(hue, 0.95, value);
}

vec3 palette_cycled(float value) {
	float t = -time / 20.0;

	float hue = 1.0 - value + t - floor(value + t);

	return hsl2rgb(hue, 0.95, value);
}


vec3 palette1(float value) {
	float t = time / 50.0;

	float cycles = 20.0;
	float valueCycled = (value + t) * cycles - floor((value + t) * cycles);

	float bright = max(value, 0.65);

	return hsl2rgb(valueCycled, 0.95, bright);
}


vec3 palette_trippy(float value) {
	float t = -time / 50.0;

	float cycles = 20.0;
	float valueCycled = (value + t) * cycles - floor((value + t) * cycles);

	float bright = max(value, 0.65);

	return hsl2rgb(valueCycled, 0.9, bright);
}



// for Julia set
vec2 lissajous() {
	const float a = 5.0;
	const float b = 4.0;
	const float w = 3.1415926 / 2.0;

	float t = 14.52/20.0; // ~14.52, ~19.1, ~29.85, 33.85, 43.05, 45.57
	float x = sin(a * t + w);
	float y = sin(b * t);

	return vec2(x, y);
}




void main()
{
	vec2 z = vec2(
		gl_FragCoord.x * (maxR - minR) / viewportDimensions.x + minR,
		gl_FragCoord.y * (maxI - minI) / viewportDimensions.y + minI
	);

	vec2 c = mix(z, lissajous(), juliaCoeff);

	float iterations = 0.0;
	const int imaxIterations = 400;
	float maxIterations = float(imaxIterations);

	for (int i = 0; i < imaxIterations; i++) {
		float xtemp = z.x * z.x - z.y * z.y + c.x;
		z.y = 2.0 * mix(z.x * z.y, abs(z.x * z.y), burningShipCoeff) + c.y;
		z.x = xtemp;
		if (z.x * z.x + z.y * z.y > 256.0) break;

		iterations += 1.0;
	}

	float log_zn = log(z.x*z.x + z.y*z.y) / 2.0;
	float nu = log( log_zn / log(2.0) ) / log(2.0);
	float iterationsSm = float(iterations) + 1.0 - nu;

	float value = min(iterationsSm / maxIterations, 1.0);

	gl_FragColor = vec4(mix(palette_cycled(value), palette_trippy(value), trippyPaletteCoeff), 1.0);
}
`;

const vsText = `
precision highp float;

attribute vec2 vPos;

void main() {
	gl_Position = vec4(vPos, 0.0, 1.0);
}
`;





function Init() {
	window.addEventListener('resize', OnResizeWindow);
	window.addEventListener('wheel', OnZoom);
	window.addEventListener('mousemove', OnMouseMove);

	var canvas = document.getElementById('gl-surface');
	var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
	if (!gl) {
		alert('Cannot get WebGL context - browser does not support WebGL');
		return;
	}

	// Create shader program
	var vs = gl.createShader(gl.VERTEX_SHADER);
	gl.shaderSource(vs, vsText);
	gl.compileShader(vs);
	if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
		console.error(
			'Vertex shader compile error:',
			gl.getShaderInfoLog(vs)
		);
	}

	var fs = gl.createShader(gl.FRAGMENT_SHADER);
	gl.shaderSource(fs, fsText);
	gl.compileShader(fs);
	if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
		console.error(
			'Fragment shader compile error:',
			gl.getShaderInfoLog(fs)
		);
	}

	var program = gl.createProgram();
	gl.attachShader(program, vs);
	gl.attachShader(program, fs);
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		console.error(
			'Shader program link error:',
			gl.getShaderInfoLog(program)
		);
	}

	gl.validateProgram(program);
	if (!gl.getProgramParameter(program, gl.VALIDATE_STATUS)) {
		console.error(
			'Shader program validate error:',
			gl.getShaderInfoLog(program)
		);
	}

	gl.useProgram(program);

	// Get uniform locations
	var uniforms = {
		viewportDimensions: gl.getUniformLocation(program, 'viewportDimensions'),
		minI: gl.getUniformLocation(program, 'minI'),
		maxI: gl.getUniformLocation(program, 'maxI'),
		minR: gl.getUniformLocation(program, 'minR'),
		maxR: gl.getUniformLocation(program, 'maxR'),
		time: gl.getUniformLocation(program, 'time'),
		mandelbrotCoeff: gl.getUniformLocation(program, 'mandelbrotCoeff'),
		burningShipCoeff: gl.getUniformLocation(program, 'burningShipCoeff'),
		juliaCoeff: gl.getUniformLocation(program, 'juliaCoeff'),
		cycledPaletteCoeff: gl.getUniformLocation(program, 'cycledPaletteCoeff'),
		trippyPaletteCoeff: gl.getUniformLocation(program, 'trippyPaletteCoeff'),
	};



	// Set CPU-side variables for all of our shader variables
	var vpDimensions = [canvas.clientWidth, canvas.clientHeight];
	var minI = -2.0;
	var maxI = 2.0;
	var minR = -2.0;
	var maxR = 2.0;

	var minIDest = -2.0;
	var maxIDest = 2.0;
	var minRDest = -2.0;
	var maxRDest = 2.0;

	var mandelbrotCoeff = 1.0;
	var burningShipCoeff = 0.0;
	var juliaCoeff = 0.0;
	var cycledPaletteCoeff = 1.0;
	var trippyPaletteCoeff = 0.0;

	var mandelbrotCoeffDest = 1.0;
	var burningShipCoeffDest = 0.0;
	var juliaCoeffDest = 0.0;
	var cycledPaletteCoeffDest = 1.0;
	var trippyPaletteCoeffDest = 0.0;



	// Create buffers
	var vertexBuffer = gl.createBuffer();
	var vertices = [
		-1, 1,
		-1, -1,
		1, -1,
		
		-1, 1,
		1, 1,
		1, -1
	];
	gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

	var vPosAttrib = gl.getAttribLocation(program, 'vPos');
	gl.vertexAttribPointer(
		vPosAttrib,
		2, gl.FLOAT,
		gl.FALSE,
		2 * Float32Array.BYTES_PER_ELEMENT,
		0
	);
	gl.enableVertexAttribArray(vPosAttrib);

	var thisframetime;
	var lastframetime = performance.now();
	var dt;
	var frames = [];
	var lastPrintTime = performance.now();


	var startTime = Date.now();

	var loop = function () {
		// FPS information
		thisframetime = performance.now();
		dt = thisframetime - lastframetime;
		lastframetime = thisframetime;
		frames.push(dt);
		if (lastPrintTime + 750 < thisframetime) {
			lastPrintTime = thisframetime;
			var average = 0;
			for (var i = 0; i < frames.length; i++) {
				average += frames[i];
			}
			average /= frames.length;
			document.title = 1000 / average + ' fps';
		}
		frames = frames.slice(0, 250);

	
		// animated variables
		const zoomSpeed = 0.25;
		minI = minI + (minIDest - minI) * zoomSpeed;
		maxI = maxI + (maxIDest - maxI) * zoomSpeed;
		minR = minR + (minRDest - minR) * zoomSpeed;
		maxR = maxR + (maxRDest - maxR) * zoomSpeed;


		const transformSpeed = 0.05;
		mandelbrotCoeff = mandelbrotCoeff + (mandelbrotCoeffDest - mandelbrotCoeff) * transformSpeed;
		burningShipCoeff = burningShipCoeff + (burningShipCoeffDest - burningShipCoeff) * transformSpeed;
		juliaCoeff = juliaCoeff + (juliaCoeffDest - juliaCoeff) * transformSpeed;
		cycledPaletteCoeff = cycledPaletteCoeff + (cycledPaletteCoeffDest - cycledPaletteCoeff) * transformSpeed;
		trippyPaletteCoeff = trippyPaletteCoeff + (trippyPaletteCoeffDest - trippyPaletteCoeff) * transformSpeed;
		 
		// Draw
		gl.clearColor(0.0, 0.0, 0.0, 1.0);
		gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);

		gl.uniform2fv(uniforms.viewportDimensions, vpDimensions);
		gl.uniform1f(uniforms.minI, minI);
		gl.uniform1f(uniforms.maxI, maxI);
		gl.uniform1f(uniforms.minR, minR);
		gl.uniform1f(uniforms.maxR, maxR);
		gl.uniform1f(uniforms.time, (Date.now() - startTime) / 1000);
		gl.uniform1f(uniforms.mandelbrotCoeff, mandelbrotCoeff);
		gl.uniform1f(uniforms.burningShipCoeff, burningShipCoeff);
		gl.uniform1f(uniforms.juliaCoeff, juliaCoeff);
		gl.uniform1f(uniforms.cycledPaletteCoeff, cycledPaletteCoeff);
		gl.uniform1f(uniforms.trippyPaletteCoeff, trippyPaletteCoeff);

		gl.drawArrays(gl.TRIANGLES, 0, 6);

		// console.log((Date.now() - startTime) / 1000);

		requestAnimationFrame(loop);
	};

	requestAnimationFrame(loop);

	OnResizeWindow();

	



	function OnResizeWindow() {
		if (!canvas) {
			return;
		}

		const { innerWidth, innerHeight } = window;
		canvas.width = innerWidth;
		canvas.height = innerHeight;

		vpDimensions = [innerWidth, innerHeight];

		var newRealRange = (maxI - minI) * (innerWidth / innerHeight) / 1.0; // 1.4
		var oldRealRange = maxR - minR;

		minR = minRDest -= (newRealRange - oldRealRange) / 2;
		maxR = maxRDest = newRealRange + minR;

		gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
	}

	function OnZoom({ deltaY, clientX, clientY }) {
		const { innerWidth, innerHeight } = window;

		var imaginaryRange = maxIDest - minIDest;
		var newRange = imaginaryRange * (deltaY < 0 ? 0.5 : 1.7);

		if (newRange < 0.00004 || newRange > 5) return;

		var offsetY = (imaginaryRange - newRange) / 2;
		var vertPercent = clientY / innerHeight;

		minIDest += offsetY * (1 - vertPercent);
		maxIDest -= offsetY * vertPercent;


		var oldRealRange = maxRDest - minRDest;
		var newRealRange = oldRealRange * (deltaY < 0 ? 0.5 : 1.7);
		var offsetX = (oldRealRange - newRealRange) / 2;
		var horizPercent = clientX / innerWidth;

		minRDest += offsetX * horizPercent;
		maxRDest -= offsetX * (1 - horizPercent);
	}

	function OnMouseMove(e) {
		if (e.buttons === 1) {
			var iRange = maxI - minI;
			var rRange = maxR - minR;

			var iDelta = (e.movementY / canvas.clientHeight) * iRange;
			var rDelta = (e.movementX / canvas.clientWidth) * rRange;

			minI = minIDest += iDelta;
			maxI = maxIDest += iDelta;
			minR = minRDest -= rDelta;
			maxR = maxRDest -= rDelta;
		}
	}

	window.setFractalType = (type = 'mandelbrot') => {
		mandelbrotCoeffDest = type === 'mandelbrot' ? 1.0 : 0;
		burningShipCoeffDest = type === 'burning_ship' ? 1.0 : 0;
		juliaCoeffDest = type === 'julia' ? 1.0 : 0;
	}

	window.setPaletteType = (type = 'cycled') => {
		cycledPaletteCoeffDest = type === 'cycled' ? 1.0 : 0;
		trippyPaletteCoeffDest = type === 'trippy' ? 1.0 : 0;
	}
}

window.addEventListener('gestureend', function(e) {
	e.preventDefault();
  if (e.scale < 1.0) {
    alert(e.scale);
  } else if (e.scale > 1.0) {
    alert(e.scale);
  }
}, false);
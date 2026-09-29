import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const waveCommon = /* glsl */`
uniform sampler2D heightMap;
uniform float time;
const vec2 poolSize = vec2(8.0,5.2);
const vec2 texel = vec2(1.0/256.0);
float ambient(vec2 p) {
  // A broad directional spectrum avoids two dominant crossing wave trains.
  p+=0.12*vec2(sin(p.y*.81+p.x*.47-time*.23),sin(p.x*.67-p.y*.92+time*.16));
  float shelter=0.69+0.22*sin(p.x*.61+p.y*.37+0.5)*sin(p.y*.71-p.x*.23);
  return shelter*(0.010*sin(dot(p,vec2(3.7,2.1))-time*1.82)
       + 0.007*sin(dot(p,vec2(-5.3,6.1))-time*2.47+0.7)
       + 0.0042*sin(dot(p,vec2(10.1,2.3))-time*3.14+1.3)
       + 0.0048*sin(dot(p,vec2(-7.2,5.9))-time*2.91+2.4)
       + 0.0035*sin(dot(p,vec2(3.6,14.2))-time*3.86+3.8)
       + 0.0034*sin(dot(p,vec2(14.4,11.7))-time*4.23+1.8)
       + 0.0042*sin(dot(p,vec2(-13.2,8.4))-time*3.95+0.4)
       + 0.0028*sin(dot(p,vec2(21.8,9.2))-time*4.80+4.1)
       + 0.0016*sin(dot(p,vec2(19.7,-24.1))-time*5.52+2.6)
       + 0.0010*sin(dot(p,vec2(-29.4,-12.7))-time*5.64+0.9));
}
float heightAt(vec2 uv) {
  vec2 p=(uv-0.5)*poolSize;
  return texture2D(heightMap,clamp(uv,texel*0.5,1.0-texel*0.5)).r+ambient(p);
}
vec3 normalAt(vec2 uv) {
  float dx=(heightAt(uv+vec2(texel.x,0.0))-heightAt(uv-vec2(texel.x,0.0)))/(2.0*poolSize.x*texel.x);
  float dz=(heightAt(uv+vec2(0.0,texel.y))-heightAt(uv-vec2(0.0,texel.y)))/(2.0*poolSize.y*texel.y);
  return normalize(vec3(-dx,1.0,-dz));
}
`;
const waterVertex=/* glsl */`
${waveCommon}
varying vec3 vWorld;
varying vec2 vUv;
void main(){
 vUv=uv;
 vec3 p=vec3(position.x,heightAt(vec2(uv.x,1.0-uv.y)),-position.y);
 vWorld=p;
 gl_Position=projectionMatrix*viewMatrix*vec4(p,1.0);
}
`;
const waterFragment=/* glsl */`
${waveCommon}
uniform sampler2D environmentMap;
uniform sampler2D causticsMap;
uniform float hasEnvironment;
varying vec3 vWorld;
varying vec2 vUv;
const vec3 sun=vec3(-0.423,0.845,0.327);
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
vec3 environment(vec3 d) {
 vec2 uv=vec2(atan(d.z,d.x)*0.15915494+0.5,asin(clamp(d.y,-1.0,1.0))*0.31830989+0.5);
 vec3 sky=mix(vec3(0.5,0.64,0.71),vec3(0.28,0.48,0.75),max(d.y,0.0));
 return mix(sky,texture2D(environmentMap,uv).rgb*0.75,hasEnvironment);
}
vec3 tiles(vec2 p, float wall){
 vec2 q=p/0.115;
 vec2 cell=floor(q);
 float r=hash(cell);
 vec2 f=fract(q);
 vec2 w=fwidth(q)*1.1;
 vec2 edge=smoothstep(vec2(0.017)-w,vec2(0.017)+w,min(f,1.0-f));
 float joint=1.0-edge.x*edge.y;
 vec3 tile=mix(vec3(0.26,0.50,0.47),vec3(0.38,0.61,0.57),r);
 tile*=1.0+0.018*sin(p.x*412.0)*sin(p.y*373.0);
 tile=mix(tile,vec3(0.22,0.39,0.36),joint*0.48);
 return tile;
}
vec3 basin(vec3 origin,vec3 ray){
 float tf=(-1.35-origin.y)/ray.y;
 vec2 side=(sign(ray.xz)*vec2(4.0,2.6)-origin.xz)/ray.xz;
 float t=min(tf,min(side.x,side.y));
 vec3 p=origin+ray*t;
 vec3 n=vec3(0.0,1.0,0.0);
 vec2 tileUv=p.xz;
 float wall=0.0;
 if(side.x<tf && side.x<side.y){n=vec3(-sign(ray.x),0.0,0.0);tileUv=p.zy;wall=1.0;}
 else if(side.y<tf){n=vec3(0.0,0.0,-sign(ray.z));tileUv=p.xy;wall=1.0;}
 vec3 base=tiles(tileUv,wall);
 float depth=-p.y;
 vec2 surface=p.xz+sun.xz/sun.y*depth;
 float shadow=smoothstep(-0.09,0.08,4.0-abs(surface.x))*smoothstep(-0.09,0.08,2.6-abs(surface.y));
 vec2 cuv=p.xz/poolSize+0.5;
 float caustic=texture2D(causticsMap,clamp(cuv,0.001,0.999)).r;
 if(wall>0.5){
  vec2 c=tileUv*7.0;
  float f=sin(c.x+sin(c.y*1.7+time*.61))+sin(c.y+sin(c.x*1.31-time*.49));
  caustic=0.6+0.75*pow(max(0.0,1.0-abs(f)),7.0);
 }
 float ao=0.79+0.21*smoothstep(0.0,0.3,min(4.0-abs(p.x),2.6-abs(p.z)));
 float diffuse=max(dot(n,sun),0.0);
 vec3 col=base*(0.29+shadow*(0.38+caustic*0.57)*diffuse)*ao;
 // A submerged perimeter band and the very slight staining at the waterline.
 if(wall>0.5){col*=1.0-0.12*exp(-depth*38.0);}
 vec3 absorption=exp(-vec3(0.34,0.075,0.032)*t);
 col=col*absorption+vec3(0.025,0.25,0.24)*(1.0-absorption)*0.25;
 return col;
}
void main(){
 // PlaneGeometry's v axis points toward negative world z.
 vec2 uv=vec2(vUv.x,1.0-vUv.y);
 vec3 normal=normalAt(uv);
 vec3 eye=normalize(cameraPosition-vWorld);
 vec3 refracted=refract(-eye,normal,1.0/1.333);
 vec3 transmitted=basin(vWorld,refracted);
 vec3 reflected=reflect(-eye,normal);
 vec3 reflection=environment(reflected);
 float fresnel=0.02037+0.97963*pow(1.0-max(dot(normal,eye),0.0),5.0);
 vec3 color=mix(transmitted,reflection,fresnel);
 vec3 halfway=normalize(eye+sun);
 float highlight=pow(max(dot(normal,halfway),0.0),950.0);
 color+=vec3(1.0,0.94,0.79)*highlight*3.2;
 gl_FragColor=vec4(color,1.0);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}
`;
const causticsVertex=/* glsl */`
${waveCommon}
varying vec3 oldPos;
varying vec3 newPos;
void main(){
 vec2 coord=vec2(uv.x,1.0-uv.y);
 vec3 p=vec3(position.x,heightAt(coord),-position.y);
 vec3 light=normalize(vec3(0.423,-0.845,-0.327));
 vec3 ray=refract(light,normalAt(coord),1.0/1.333);
 vec3 flatRay=refract(light,vec3(0.0,1.0,0.0),1.0/1.333);
 oldPos=p+flatRay*((-1.35-p.y)/flatRay.y);
 newPos=p+ray*((-1.35-p.y)/ray.y);
 gl_Position=vec4(newPos.x/4.0,newPos.z/2.6,0.0,1.0);
}
`;
const causticsFragment=/* glsl */`
varying vec3 oldPos;
varying vec3 newPos;
void main(){
 float oldArea=length(cross(dFdx(oldPos),dFdy(oldPos)));
 float newArea=length(cross(dFdx(newPos),dFdy(newPos)));
 float intensity=clamp(oldArea/max(newArea,0.0000001),0.0,8.0)*0.66;
 gl_FragColor=vec4(vec3(intensity),1.0);
}
`;
const simulationFragment=/* glsl */`
uniform sampler2D state;
uniform vec4 impulses[16];
uniform int impulseCount;
uniform float delta;
varying vec2 vUv;
void main(){
 vec2 dx=vec2(1.0/256.0,0.0),dy=dx.yx;
 vec2 s=texture2D(state,vUv).rg;
 float lapX=texture2D(state,vUv+dx).r+texture2D(state,vUv-dx).r-2.0*s.r;
 float lapZ=texture2D(state,vUv+dy).r+texture2D(state,vUv-dy).r-2.0*s.r;
 s.g+=(lapX*1024.0+lapZ*2423.67)*1.21*delta;
 s.g*=exp(-0.64*delta);
 s.r+=s.g*delta;
 for(int i=0;i<16;i++){
  if(i>=impulseCount)break;
  vec2 d=(vUv-impulses[i].xy)*vec2(8.0,5.2);
  float q=dot(d,d)/(impulses[i].z*impulses[i].z);
  s.r+=impulses[i].w*(1.0-q)*exp(-q);
 }
 gl_FragColor=vec4(clamp(s.r,-0.3,0.3),s.g,0.0,1.0);
}
`;


// A fixed-step 2D wave equation, with a no-flux boundary at the pool walls.
// Heights are metres; velocities are metres/second. dx != dz is accounted for.
class WaterSimulation {
  constructor(renderer) {
    this.renderer=renderer;
    const options={type:THREE.HalfFloatType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:false,stencilBuffer:false};
    this.a=new THREE.WebGLRenderTarget(256,256,options);
    this.b=this.a.clone();
    this.scene=new THREE.Scene();
    this.camera=new THREE.Camera();
    this.pending=[];
    this.accumulator=0;
    this.steps=0;
    this.uniforms={state:{value:this.a.texture},delta:{value:1/120},impulseCount:{value:0},impulses:{value:Array.from({length:16},()=>new THREE.Vector4())}};
    this.material=new THREE.ShaderMaterial({uniforms:this.uniforms,vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:simulationFragment,depthTest:false,depthWrite:false});
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.material));
    this.reset();
  }
  get texture(){return this.a.texture;}
  disturb(x,z,radius,strength){
    if(Math.abs(x)>3.97||Math.abs(z)>2.57)return;
    if(this.pending.length<64)this.pending.push(new THREE.Vector4(x/8+.5,z/5.2+.5,radius,strength));
  }
  reset(){
    const old=this.renderer.getRenderTarget();
    const oldColor=this.renderer.getClearColor(new THREE.Color());
    this.renderer.setClearColor(0,0);
    for(const t of [this.a,this.b]){this.renderer.setRenderTarget(t);this.renderer.clear();}
    this.renderer.setRenderTarget(old);this.renderer.setClearColor(oldColor,1);
    this.pending.length=0;this.accumulator=0;
  }
  update(dt){
    this.accumulator+=Math.min(dt,1/20);
    while(this.accumulator>=1/120){
      this.uniforms.state.value=this.a.texture;
      const count=Math.min(this.pending.length,16);
      this.uniforms.impulseCount.value=count;
      for(let i=0;i<count;i++)this.uniforms.impulses.value[i].copy(this.pending.shift());
      this.renderer.setRenderTarget(this.b);
      this.renderer.render(this.scene,this.camera);
      [this.a,this.b]=[this.b,this.a];
      this.accumulator-=1/120;this.steps++;
    }
    this.renderer.setRenderTarget(null);
  }
}

// Interactive pool water. Move to ripple, move fast to splash, click to drop.
// R resets; Space drops a pebble. No images, local imports, or build step.


const canvas = document.querySelector('#water');
const errorElement = document.querySelector('#error');
function showError(message) {
  errorElement.textContent = message;
  errorElement.hidden = false;
}

let renderer;
try {
  renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance'});
  if (!renderer.extensions.has('EXT_color_buffer_float')) {
    throw new Error('Floating-point rendering is unavailable.');
  }
} catch (error) {
  showError('This effect needs WebGL 2 and floating-point rendering. Enable hardware acceleration or try another browser.');
  throw error;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.setClearColor('#227c88');
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 50);
camera.up.set(0, 0, -1);

// Cover the viewport with water, cropping the 8 × 5.2 metre surface as needed.
function resize() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  camera.aspect = width / height;
  const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const distance = Math.min(2.6 / tangent, 4 / (camera.aspect * tangent)) * 0.98;
  camera.position.set(0, distance, 0);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  renderer.setSize(width, height, false);
}
resize();
addEventListener('resize', resize);

scene.add(new THREE.HemisphereLight('#d9eef9', '#346c6c', 1.2));
const sunLight = new THREE.DirectionalLight('#fff6df', 2.5);
sunLight.position.set(-5, 10, 3.87);
scene.add(sunLight);

// Generate the reflection environment in memory: no fourth file or HDR download.
function makeSkyTexture() {
  const width = 512, height = 256;
  const data = new Float32Array(width * height * 4);
  const sun = new THREE.Vector3(-0.423, 0.845, 0.327).normalize();
  for (let y = 0; y < height; y++) {
    const elevation = ((y + 0.5) / height - 0.5) * Math.PI;
    const dy = Math.sin(elevation), horizontal = Math.cos(elevation);
    for (let x = 0; x < width; x++) {
      const azimuth = ((x + 0.5) / width - 0.5) * Math.PI * 2;
      const dx = Math.cos(azimuth) * horizontal, dz = Math.sin(azimuth) * horizontal;
      const up = Math.max(dy, 0);
      let r = 0.64 - up * 0.35, g = 0.78 - up * 0.28, b = 0.86 - up * 0.10;
      const noise = Math.sin(dx * 11 + dz * 7) * 0.4
        + Math.sin(dx * 19 - dz * 13 + 2) * 0.25
        + Math.sin(dx * 31 + dz * 23 + 1) * 0.12;
      const cloud = THREE.MathUtils.smoothstep(noise, 0.1, 0.65)
        * THREE.MathUtils.smoothstep(dy, 0.04, 0.25) * 0.7;
      r += (1 - r) * cloud; g += (1.03 - g) * cloud; b += (1.05 - b) * cloud;
      if (dy < 0) {
        r = 0.18; g = 0.25; b = 0.23;
      }
      const facing = Math.max(dx * sun.x + dy * sun.y + dz * sun.z, 0);
      const glow = Math.pow(facing, 1300) * 8 + Math.pow(facing, 80) * 0.12;
      const offset = (y * width + x) * 4;
      data[offset] = r + glow;
      data[offset + 1] = g + glow * 0.94;
      data[offset + 2] = b + glow * 0.8;
      data[offset + 3] = 1;
    }
  }
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.wrapS = THREE.RepeatWrapping;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
const skyTexture = makeSkyTexture();
const pmrem = new THREE.PMREMGenerator(renderer);
const environmentTarget = pmrem.fromEquirectangular(skyTexture);
scene.environment = environmentTarget.texture;
scene.environmentIntensity = 0.5;
pmrem.dispose();

const sim = new WaterSimulation(renderer);
const uniforms = {
  heightMap: {value: sim.texture},
  time: {value: 0},
  environmentMap: {value: skyTexture},
  hasEnvironment: {value: 1},
  causticsMap: {value: null}
};
const geometry = new THREE.PlaneGeometry(8, 5.2, 256, 256);
const water = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
  uniforms, vertexShader: waterVertex, fragmentShader: waterFragment
}));
water.frustumCulled = false;
scene.add(water);

const causticsTarget = new THREE.WebGLRenderTarget(1024, 1024, {
  type: THREE.HalfFloatType,
  depthBuffer: false,
  minFilter: THREE.LinearMipmapLinearFilter,
  magFilter: THREE.LinearFilter,
  generateMipmaps: true
});
uniforms.causticsMap.value = causticsTarget.texture;
const causticsScene = new THREE.Scene();
const caustics = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
  uniforms,
  vertexShader: causticsVertex,
  fragmentShader: causticsFragment,
  depthWrite: false,
  depthTest: false,
  side: THREE.DoubleSide,
  blending: THREE.AdditiveBlending,
  transparent: true
}));
caustics.frustumCulled = false;
causticsScene.add(caustics);

const drops = [], crowns = [];
const maxDrops = 800;
const dummy = new THREE.Object3D();
const droplets = new THREE.InstancedMesh(
  new THREE.SphereGeometry(1, 10, 8),
  new THREE.MeshPhysicalMaterial({
    color: '#ddfffb', metalness: 0.05, roughness: 0.03,
    transmission: 0.68, thickness: 0.06, ior: 1.333,
    transparent: true, opacity: 0.97, envMapIntensity: 2.2
  }), maxDrops
);
droplets.count = 0;
droplets.frustumCulled = false;
scene.add(droplets);
const crownMaterial = new THREE.MeshPhysicalMaterial({
  color: '#92c4bd', roughness: 0.035, metalness: 0.15,
  transparent: true, opacity: 0.46, side: THREE.DoubleSide, envMapIntensity: 1.5
});
let splashCount = 0, impactCount = 0;

function splash(x, z, power = 1, vx = 0, vz = 0) {
  const moving = Math.hypot(vx, vz) > 0.5;
  const count = Math.floor((moving ? 13 : 22) + power * (moving ? 16 : 24));
  for (let i = 0; i < count && drops.length < maxDrops; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * 0.1;
    drops.push({
      x: x + Math.cos(a) * r, y: 0.015 + Math.random() * 0.02, z: z + Math.sin(a) * r,
      vx: Math.cos(a) * (0.25 + Math.random() * 0.85) * power + vx * 0.055,
      vz: Math.sin(a) * (0.25 + Math.random() * 0.85) * power + vz * 0.055,
      vy: (0.85 + Math.random() * 2.7) * Math.sqrt(power),
      r: i < 5 ? 0.022 + Math.random() * 0.013 : 0.004 + Math.random() ** 3 * 0.023
    });
  }
  const crownGeometry = new THREE.BufferGeometry();
  crownGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(65 * 2 * 3), 3));
  const indices = [];
  for (let i = 0; i < 64; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  crownGeometry.setIndex(indices);
  const mesh = new THREE.Mesh(crownGeometry, crownMaterial.clone());
  mesh.position.set(x, 0, z);
  mesh.frustumCulled = false;
  scene.add(mesh);
  crowns.push({mesh, age: 0, power, phase: Math.random() * 6, moving, direction: Math.atan2(vz, vx)});
  splashCount++;
}

function removeCrown(crown) {
  scene.remove(crown.mesh);
  crown.mesh.geometry.dispose();
  crown.mesh.material.dispose();
}

function updateSplashes(dt) {
  let count = 0;
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.vy -= 9.81 * dt;
    d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
    if (d.y <= 0 || Math.abs(d.x) > 4 || Math.abs(d.z) > 2.6) {
      if (d.y <= 0 && Math.abs(d.x) < 4 && Math.abs(d.z) < 2.6) {
        sim.disturb(d.x, d.z, 0.055, d.r * 0.2);
        impactCount++;
      }
      drops.splice(i, 1);
      continue;
    }
    dummy.position.set(d.x, d.y, d.z);
    dummy.scale.set(d.r, d.r * (1 + Math.min(Math.abs(d.vy) * 0.17, 0.8)), d.r);
    dummy.updateMatrix();
    droplets.setMatrixAt(count++, dummy.matrix);
  }
  droplets.count = count;
  droplets.instanceMatrix.needsUpdate = true;
  for (let i = crowns.length - 1; i >= 0; i--) {
    const c = crowns[i];
    c.age += dt;
    if (c.age > 0.39) {
      removeCrown(c); crowns.splice(i, 1); continue;
    }
    const positions = c.mesh.geometry.attributes.position, progress = c.age / 0.39;
    const radius = 0.06 + c.age * 0.6 * c.power;
    const height = Math.sin(progress * Math.PI) * 0.24 * c.power;
    for (let j = 0; j <= 64; j++) {
      const a = c.moving ? c.direction + (j / 64 - 0.5) * 2.7 : j / 64 * Math.PI * 2;
      const lobes = 0.7 + 0.32 * Math.sin(a * 7 + c.phase) + 0.22 * Math.sin(a * 11 + 1.7) + 0.12 * Math.sin(a * 17);
      const r = radius * (1 + 0.12 * Math.sin(a * 5 + c.phase));
      const taper = c.moving ? Math.sin(j / 64 * Math.PI) : 1;
      positions.setXYZ(j * 2, Math.cos(a) * r, 0.004, Math.sin(a) * r);
      positions.setXYZ(j * 2 + 1, Math.cos(a) * r * (1.07 + 0.12 * progress), height * lobes * taper + 0.004, Math.sin(a) * r * (1.07 + 0.12 * progress));
    }
    positions.needsUpdate = true;
    c.mesh.geometry.computeVertexNormals();
    c.mesh.material.opacity = 0.46 * (1 - progress);
  }
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let lastPoint = null, lastPointerTime = 0, lastSplash = 0, lastImpulse = 0;

function pointOnWater(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  pointer.set((clientX - rect.left) / rect.width * 2 - 1, 1 - (clientY - rect.top) / rect.height * 2);
  raycaster.setFromCamera(pointer, camera);
  const point = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(waterPlane, point) || Math.abs(point.x) > 3.95 || Math.abs(point.z) > 2.55) return null;
  return point;
}

function dropPebbleAt(x, z) {
  sim.disturb(x, z, 0.32, -0.22);
  splash(x, z, 1.35);
}

canvas.addEventListener('pointermove', event => {
  if (!event.isPrimary) return;
  const point = pointOnWater(event.clientX, event.clientY), now = performance.now();
  if (!point) { lastPoint = null; return; }
  if (lastPoint) {
    const seconds = Math.max((now - lastPointerTime) / 1000, 0.008);
    const distance = point.distanceTo(lastPoint), speed = distance / seconds;
    if (distance > 0.014 && now - lastImpulse > 12) {
      const segments = Math.min(8, Math.max(1, Math.ceil(distance / 0.065)));
      for (let i = 1; i <= segments; i++) {
        const at = lastPoint.clone().lerp(point, i / segments);
        sim.disturb(at.x, at.z, 0.13 + Math.min(speed, 5) * 0.007,
          Math.min(0.02, 0.006 + speed * 0.0013) * Math.min(1.5, distance / segments / 0.055));
      }
      lastImpulse = now;
    }
    if (speed > 3.3 && distance > 0.045 && distance < 2.3 && now - lastSplash > 95) {
      splash(point.x, point.z, Math.min(1.65, 0.5 + speed * 0.085), (point.x - lastPoint.x) / seconds, (point.z - lastPoint.z) / seconds);
      lastSplash = now;
    }
  }
  lastPoint = point;
  lastPointerTime = now;
});

canvas.addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.button !== 0) return;
  const point = pointOnWater(event.clientX, event.clientY);
  if (point) dropPebbleAt(point.x, point.z);
  canvas.focus({preventScroll: true});
});
for (const event of ['pointerleave', 'pointercancel']) {
  canvas.addEventListener(event, () => { lastPoint = null; });
}

function reset() {
  sim.reset(); drops.length = 0; droplets.count = 0;
  crowns.forEach(removeCrown); crowns.length = 0; lastPoint = null;
}
addEventListener('keydown', event => {
  if (event.target !== document.body && event.target !== canvas) return;
  if (event.key.toLowerCase() === 'r') reset();
  if (event.code === 'Space') {
    event.preventDefault();
    dropPebbleAt((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 2);
  }
});
canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault();
  showError('The graphics context was interrupted. Reload the preview to restart the water.');
});
canvas.addEventListener('webglcontextrestored', () => location.reload());

let previous = performance.now(), elapsed = 0, fps = 60, frames = 0, fpsTime = 0;
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - previous) / 1000, 0.05);
  previous = now;
  if (document.hidden || renderer.getContext().isContextLost()) return;
  elapsed += dt; frames++; fpsTime += dt;
  if (fpsTime >= 1) { fps = frames / fpsTime; frames = 0; fpsTime = 0; }
  sim.update(dt);
  uniforms.heightMap.value = sim.texture;
  uniforms.time.value = elapsed;
  updateSplashes(dt);
  renderer.setClearColor(0, 0);
  renderer.setRenderTarget(causticsTarget);
  renderer.clear();
  renderer.render(causticsScene, camera);
  renderer.setRenderTarget(null);
  renderer.setClearColor('#227c88', 1);
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);

// Optional diagnostics for testing; this adds no visible interface.
window.pool = {
  reset,
  get stats() { return {fps: Math.round(fps), drops: drops.length, splashCount, impactCount, steps: sim.steps}; },
  project(x, z) {
    const point = new THREE.Vector3(x, 0, z).project(camera);
    const rect = canvas.getBoundingClientRect();
    return {x: rect.left + (point.x + 1) * rect.width / 2, y: rect.top + (1 - point.y) * rect.height / 2};
  },
  sample() {
    const values = new Uint16Array(256 * 256 * 4);
    renderer.readRenderTargetPixels(sim.a, 0, 0, 256, 256, values);
    let peak = 0, sum = 0, finite = true;
    for (let i = 0; i < values.length; i += 4) {
      const h = THREE.DataUtils.fromHalfFloat(values[i]);
      finite &&= Number.isFinite(h);
      peak = Math.max(peak, Math.abs(h)); sum += h * h;
    }
    return {peak, rms: Math.sqrt(sum / 65536), finite};
  }
};

import type { ArtifactRecord, CameraState, SceneObject, Vec3 } from './core';

type Mat4 = Float32Array;
type GpuMesh = { vao: WebGLVertexArrayObject; indexBuffer: WebGLBuffer; count: number };

export class ViewerRuntime {
  private readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly meshes = new Map<string, GpuMesh>();
  private objects: SceneObject[] = [];
  private artifacts = new Map<string, ArtifactRecord>();
  private camera: CameraState;
  private frame = 0;
  private resizeObserver: ResizeObserver;
  private pointer?: { x: number; y: number };
  private uniforms: Record<string, WebGLUniformLocation | null>;

  constructor(private readonly canvas: HTMLCanvasElement, initialCamera: CameraState, private readonly onCameraChange: (camera: CameraState) => void) {
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    if (!gl) throw new Error('WebGL2 is required for Design Studio.');
    this.gl = gl;
    this.camera = structuredClone(initialCamera);
    this.program = createProgram(gl, vertexShader, fragmentShader);
    this.uniforms = {
      viewProjection: gl.getUniformLocation(this.program, 'uViewProjection'),
      model: gl.getUniformLocation(this.program, 'uModel'),
      color: gl.getUniformLocation(this.program, 'uColor'),
      light: gl.getUniformLocation(this.program, 'uLightDirection'),
    };
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.bindControls();
    this.resize();
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    for (const mesh of this.meshes.values()) {
      this.gl.deleteVertexArray(mesh.vao);
      this.gl.deleteBuffer(mesh.indexBuffer);
    }
    this.meshes.clear();
    this.gl.deleteProgram(this.program);
  }

  setScene(objects: SceneObject[], artifacts: ArtifactRecord[]): void {
    this.objects = structuredClone(objects);
    this.artifacts = new Map(artifacts.map((artifact) => [artifact.id, artifact]));
    const required = new Set(objects.map((object) => object.artifactId));
    for (const artifactId of required) {
      const artifact = this.artifacts.get(artifactId);
      if (artifact && !this.meshes.has(artifactId)) this.meshes.set(artifactId, uploadMesh(this.gl, artifact));
    }
    for (const [artifactId, mesh] of this.meshes) {
      if (!required.has(artifactId)) {
        this.gl.deleteVertexArray(mesh.vao);
        this.gl.deleteBuffer(mesh.indexBuffer);
        this.meshes.delete(artifactId);
      }
    }
    this.requestRender();
  }

  setCamera(camera: CameraState): void { this.camera = structuredClone(camera); this.requestRender(); }
  getCamera(): CameraState { return structuredClone(this.camera); }

  fitToScreen(): void {
    const bounds = combinedBounds(this.objects, this.artifacts);
    if (!bounds) return;
    this.camera.target = midpoint(bounds.min, bounds.max);
    const size = Math.hypot(bounds.max[0] - bounds.min[0], bounds.max[1] - bounds.min[1], bounds.max[2] - bounds.min[2]);
    this.camera.distance = Math.max(20, size * 1.35);
    this.camera.orthographicScale = Math.max(20, size * 0.72);
    this.changedCamera();
  }

  resetCamera(): void {
    this.camera = { projection: this.camera.projection, target: [0, 0, 0], distance: 140, yaw: 0.45, pitch: 0.3, orthographicScale: 90 };
    this.fitToScreen();
  }

  setProjection(projection: CameraState['projection']): void { this.camera.projection = projection; this.changedCamera(); }

  private bindControls(): void {
    this.canvas.addEventListener('pointerdown', (event) => { this.pointer = { x: event.clientX, y: event.clientY }; this.canvas.setPointerCapture(event.pointerId); });
    this.canvas.addEventListener('pointermove', (event) => {
      if (!this.pointer) return;
      const dx = event.clientX - this.pointer.x, dy = event.clientY - this.pointer.y;
      this.pointer = { x: event.clientX, y: event.clientY };
      if (event.shiftKey || event.button === 1) {
        const scale = this.camera.projection === 'orthographic' ? this.camera.orthographicScale / 500 : this.camera.distance / 500;
        const right: Vec3 = [Math.cos(this.camera.yaw), 0, -Math.sin(this.camera.yaw)];
        this.camera.target = [this.camera.target[0] - right[0] * dx * scale, this.camera.target[1] + dy * scale, this.camera.target[2] - right[2] * dx * scale];
      } else {
        this.camera.yaw += dx * 0.008;
        this.camera.pitch = clamp(this.camera.pitch + dy * 0.008, -1.45, 1.45);
      }
      this.changedCamera();
    });
    const release = () => { this.pointer = undefined; };
    this.canvas.addEventListener('pointerup', release);
    this.canvas.addEventListener('pointercancel', release);
    this.canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      const factor = Math.exp(event.deltaY * 0.001);
      if (this.camera.projection === 'orthographic') this.camera.orthographicScale = clamp(this.camera.orthographicScale * factor, 1, 5000);
      else this.camera.distance = clamp(this.camera.distance * factor, 1, 10000);
      this.changedCamera();
    }, { passive: false });
  }

  private changedCamera(): void { this.onCameraChange(structuredClone(this.camera)); this.requestRender(); }
  private requestRender(): void { cancelAnimationFrame(this.frame); this.frame = requestAnimationFrame(() => this.render()); }

  private resize(): void {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(this.canvas.clientWidth * ratio));
    const height = Math.max(1, Math.floor(this.canvas.clientHeight * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height; }
    this.requestRender();
  }

  private render(): void {
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0.035, 0.045, 0.075, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program);
    const aspect = this.canvas.width / Math.max(1, this.canvas.height);
    const viewProjection = cameraMatrix(this.camera, aspect);
    gl.uniformMatrix4fv(this.uniforms.viewProjection, false, viewProjection);
    gl.uniform3f(this.uniforms.light, -0.35, 0.75, 0.55);
    const visible = this.objects.filter((object) => object.visible);
    visible.sort((a, b) => b.material.opacity - a.material.opacity);
    for (const object of visible) {
      const mesh = this.meshes.get(object.artifactId);
      if (!mesh) continue;
      const model = composeTransform(object.transform.position, object.transform.scale);
      gl.uniformMatrix4fv(this.uniforms.model, false, model);
      const [r, g, b] = object.selected ? [0.94, 0.72, 0.28] : object.material.color;
      gl.uniform4f(this.uniforms.color, r, g, b, object.material.opacity);
      gl.disable(gl.CULL_FACE);
      gl.bindVertexArray(mesh.vao);
      gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_INT, 0);
    }
    gl.bindVertexArray(null);
  }
}

function uploadMesh(gl: WebGL2RenderingContext, artifact: ArtifactRecord): GpuMesh {
  const vao = gl.createVertexArray(); const positions = gl.createBuffer(); const normals = gl.createBuffer(); const indices = gl.createBuffer();
  if (!vao || !positions || !normals || !indices) throw new Error('Unable to allocate WebGL buffers');
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, positions); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(artifact.mesh.positions), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, normals); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(artifact.mesh.normals), gl.STATIC_DRAW); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(artifact.mesh.indices), gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  return { vao, indexBuffer: indices, count: artifact.mesh.indices.length };
}

function createProgram(gl: WebGL2RenderingContext, vertex: string, fragment: string): WebGLProgram {
  const program = gl.createProgram(); if (!program) throw new Error('Unable to create WebGL program');
  const compile = (type: number, source: string) => { const shader = gl.createShader(type); if (!shader) throw new Error('Unable to create shader'); gl.shaderSource(shader, source); gl.compileShader(shader); if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'Shader compile failed'); gl.attachShader(program, shader); };
  compile(gl.VERTEX_SHADER, vertex); compile(gl.FRAGMENT_SHADER, fragment); gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'Program link failed');
  return program;
}

const vertexShader = `#version 300 es
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
uniform mat4 uViewProjection;
uniform mat4 uModel;
out vec3 vNormal;
out vec3 vWorld;
void main(){ vec4 world=uModel*vec4(aPosition,1.0); vWorld=world.xyz; vNormal=mat3(uModel)*aNormal; gl_Position=uViewProjection*world; }`;
const fragmentShader = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vWorld;
uniform vec4 uColor;
uniform vec3 uLightDirection;
out vec4 outColor;
void main(){ vec3 n=normalize(vNormal); float diffuse=max(dot(n,normalize(uLightDirection)),0.0); float rim=pow(1.0-abs(n.z),2.0); vec3 color=uColor.rgb*(0.3+0.7*diffuse)+vec3(0.1)*rim; outColor=vec4(color,uColor.a); }`;

function cameraMatrix(camera: CameraState, aspect: number): Mat4 {
  const cp = Math.cos(camera.pitch), sp = Math.sin(camera.pitch), cy = Math.cos(camera.yaw), sy = Math.sin(camera.yaw);
  const eye: Vec3 = [camera.target[0] + camera.distance * cp * sy, camera.target[1] + camera.distance * sp, camera.target[2] + camera.distance * cp * cy];
  const view = lookAt(eye, camera.target, [0, 1, 0]);
  const projection = camera.projection === 'perspective' ? perspective(Math.PI / 4, aspect, 0.1, 20000) : orthographic(-camera.orthographicScale * aspect, camera.orthographicScale * aspect, -camera.orthographicScale, camera.orthographicScale, -20000, 20000);
  return multiply(projection, view);
}

function lookAt(eye: Vec3, target: Vec3, up: Vec3): Mat4 {
  const z = normalize([eye[0]-target[0], eye[1]-target[1], eye[2]-target[2]]); const x = normalize(cross(up,z)); const y = cross(z,x);
  return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);
}
function perspective(fovy:number,aspect:number,near:number,far:number):Mat4{const f=1/Math.tan(fovy/2),nf=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);}
function orthographic(l:number,r:number,b:number,t:number,n:number,f:number):Mat4{return new Float32Array([2/(r-l),0,0,0,0,2/(t-b),0,0,0,0,-2/(f-n),0,-(r+l)/(r-l),-(t+b)/(t-b),-(f+n)/(f-n),1]);}
function multiply(a:Mat4,b:Mat4):Mat4{const out=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)out[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return out;}
function composeTransform(position:Vec3,scale:Vec3):Mat4{return new Float32Array([scale[0],0,0,0,0,scale[1],0,0,0,0,scale[2],0,position[0],position[1],position[2],1]);}
function normalize(v:Vec3):Vec3{const length=Math.hypot(...v)||1;return[v[0]/length,v[1]/length,v[2]/length];}
function cross(a:Vec3,b:Vec3):Vec3{return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function dot(a:Vec3,b:Vec3):number{return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
function midpoint(a:Vec3,b:Vec3):Vec3{return[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2];}
function clamp(value:number,min:number,max:number):number{return Math.max(min,Math.min(max,value));}
function combinedBounds(objects:SceneObject[],artifacts:Map<string,ArtifactRecord>):{min:Vec3;max:Vec3}|null{const min:Vec3=[Infinity,Infinity,Infinity],max:Vec3=[-Infinity,-Infinity,-Infinity];let found=false;for(const object of objects.filter(item=>item.visible)){const artifact=artifacts.get(object.artifactId);if(!artifact)continue;found=true;for(let axis=0;axis<3;axis++){min[axis]=Math.min(min[axis],artifact.mesh.bounds.min[axis]*object.transform.scale[axis]+object.transform.position[axis]);max[axis]=Math.max(max[axis],artifact.mesh.bounds.max[axis]*object.transform.scale[axis]+object.transform.position[axis]);}}return found?{min,max}:null;}

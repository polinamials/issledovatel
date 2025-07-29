
import * as THREE         from 'three';
import { GLTFLoader }     from 'three/addons/loaders/GLTFLoader.js';
//import { OrbitControls }  from 'three/addons/controls/OrbitControls.js';
import { LineSegments2 }      from 'three/addons/lines/LineSegments2.js';
import { LineMaterial }       from 'three/addons/lines/LineMaterial.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { RenderPass }       from 'three/addons/postprocessing/RenderPass.js';
import { EffectComposer }   from 'three/addons/postprocessing/EffectComposer.js';
import { ShaderPass }       from 'three/addons/postprocessing/ShaderPass.js';
import { BrightnessContrastShader } from 'three/addons/shaders/BrightnessContrastShader.js';
import { FilmPass }      from 'three/addons/postprocessing/FilmPass.js';
import { VignetteShader } from 'three/addons/shaders/VignetteShader.js';
import { UnrealBloomPass }  from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { PMREMGenerator } from 'three';

import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

// ------------------------- Hand landmarker setup ---------------------------------------------
const demosSection = document.getElementById("demos");
const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
let handLandmarker = undefined;
let runningMode = "IMAGE";
let enableWebcamButton;
let webcamRunning = false;
let rafID = null;
// Before we can use HandLandmarker class we must wait for it to finish
// loading. Machine Learning models can be large and take a moment to
// get everything needed to run.
const createHandLandmarker = async () => {
    const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm");
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
        },
        runningMode: runningMode,
        numHands: 2
    });
    demosSection.classList.remove("invisible");
};
createHandLandmarker();

// Check if webcam access is supported.
const hasGetUserMedia = () => { var _a; return !!((_a = navigator.mediaDevices) === null || _a === void 0 ? void 0 : _a.getUserMedia); };
// If webcam supported, add event listener to button for when user
// wants to activate it.
if (hasGetUserMedia()) {
    webcamToggle = document.getElementById("webcamToggle");
    webcamToggle.addEventListener("change", event => {
  if (event.target.checked) {
        // turn webcam off;
        enableCam();
    } else {
        // turn webcam off
        disableCam();
    }
    });
}
else {
    console.warn("getUserMedia() is not supported by your browser");
}


// ---------------------- Three.js setup -----------------------------------
// Scene
const scene    = new THREE.Scene();
scene.background = new THREE.TextureLoader().load( "/models/thereminglb/theremin_blur.jpg" );

// Camera
const camera   = new THREE.PerspectiveCamera(60, 1, 0.01, 10);
camera.position.set(0.07, 0.15, -0.5);
//camera.position.set(1, 1, -1);
//camera.lookAt(0,0,0);

camera.rotation.y = Math.PI; 
camera.aspect = window.innerWidth / window.innerHeight;
camera.updateProjectionMatrix();

// OrbitControls
//const controls = new OrbitControls( camera, renderer.domElement );
//controls.update();

// Renderer
const renderer = new THREE.WebGLRenderer({alpha: true, canvas: canvasElement});
renderer.setClearColor(0xdddddd, 1);
renderer.setSize(window.innerWidth, window.innerHeight, false);

const size = new THREE.Vector2();
renderer.getSize(size);
//renderer.setPixelRatio(window.devicePixelRatio);

// 1) Tell Three.js to use a realistic tone mapping
renderer.toneMapping        = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;   // tweak up/down to control brightness

// Composer Effects
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

// const bc = new ShaderPass(BrightnessContrastShader);
// bc.uniforms['brightness'].value = -0.05;  
// bc.uniforms['contrast'].value   =  0.0;
// composer.addPass(bc);

composer.addPass(new UnrealBloomPass(
  new THREE.Vector2(innerWidth, innerHeight),
  0.3,    // strength
  0.5,    // radius
  0.7    // threshold
));

composer.addPass(new FilmPass(
  0.3,   // noise intensity
  0.025,  // scanline intensity
  648,    // scanline count
  false   // grayscale
));

const vig = new ShaderPass(VignetteShader);
vig.uniforms[ 'offset' ].value   = 1.0;
vig.uniforms[ 'darkness' ].value = 1.1;
composer.addPass(vig);

// Lighting
const ambient = new THREE.AmbientLight(0x666666, 1);  
scene.add(ambient);

// const dir = new THREE.DirectionalLight(0x404040, 1);
// dir.position.set(-1, 0.0, -1);
// scene.add(dir);

// const light = new THREE.HemisphereLight( 0xffffbb, 0x080820, 1 );
// scene.add( light );

const spotlight = new THREE.SpotLight(0xfef9f7, 1, 0, Math.PI/2);
spotlight.position.set(0, 1, -3)
scene.add(spotlight);

const pmrem = new PMREMGenerator(renderer);

new EXRLoader()
  .load('/models/textures/IndoorEnvironmentHDRI009_1K-HDR.exr', (exrData) => {
    // EXRLoader already gives you a DataTexture with float data
    const envMap = pmrem.fromEquirectangular(exrData).texture;
    scene.environment = envMap;    // for PBR reflections
    // keep scene.background = null (or a solid color)
    pmrem.dispose();
  });

// Hands geometry
const lineSegWidth = 0.01;
const handColor = 0xfbae17;

// Hand 1
const skeletonGeom1 = new LineSegmentsGeometry();
const skeletonMat1  = new LineMaterial({
  color:       handColor,
  linewidth:   lineSegWidth,    // 0.005 world units thick
  worldUnits:  true
});
const skeletonMesh1 = new LineSegments2(skeletonGeom1, skeletonMat1);
scene.add(skeletonMesh1);

// Hand 2
const skeletonGeom2 = new LineSegmentsGeometry();
const skeletonMat2  = new LineMaterial({
  color:       handColor,
  linewidth:   lineSegWidth,
  worldUnits:  true
});
const skeletonMesh2 = new LineSegments2(skeletonGeom2, skeletonMat2);
scene.add(skeletonMesh2);

// Set resolution to match renderer size
skeletonMat1.resolution.set(size.x, size.y);
skeletonMat2.resolution.set(size.x, size.y);

// Theremin Model
const gltfLoader = new GLTFLoader();
const MODEL_URL = '/models/thereminglb/theremin_t.glb';

let powerSwitch;

gltfLoader.load(
  MODEL_URL,
  gltf => {
    gltf.scene.traverse((child) => {
      if (child.isMesh) {
        child.material.side = THREE.DoubleSide;
        child.material.needsUpdate = true;
      }
    });

    gltf.scene.scale.set(1.5, 1.5, 1.5);
    gltf.scene.position.set(0, 0, 0);
    gltf.scene.rotation.y = Math.PI;

    scene.add(gltf.scene);

    powerSwitch = gltf.scene.getObjectByName('PowerSwitch_9');
    //powerSwitch.rotation.y = -20 * Math.PI/180;
  },
  xhr => console.log(`Model ${(xhr.loaded/xhr.total*100).toFixed(1)}% loaded`),
  err => console.error('GLTF load error:', err)
);

// Antenna and loop geometry
const antennaPos = new THREE.Vector3( -0.21, 0.05, 0 );
const antennaDirection = new THREE.Vector3(0,1,0).normalize();

const loopPos = new THREE.Vector3( 0.25, 0, 0 );
const loopDirection = new THREE.Vector3(1,0,0).normalize();

// ------------------------------------ Tone.js setup --------------------------------------
const minDAntenna = 0.05, maxDAntenna = 0.50;
const minF = 55.0, maxF = 3135.96;
const minDLoop = 0.07, maxDLoop = 0.50;
const minVol = 0.0, maxVol = 0.75;

let synth, master;

function initAudio() {
  master = new Tone.Gain(0.3).toDestination();

  const fm = new Tone.FMSynth({
    harmonicity: 2,
    modulationIndex: 6,
    oscillator: { type: 'sine' },
    detune: -10,
    envelope:   { 
      attack:  0.05, 
      decay:   0.1, 
      sustain: 1.0, 
      release: 0.5,
      attackCurve: 'linear',
      decayCurve: 'exponential',
      releaseCurve: 'exponential' 
    },
    modulation: { type: 'sine' },
    modulationEnvelope: {
      attack:  0.2,
      decay:   0.01,
      sustain: 1.0,
      release: 0.5,
      attackCurve: 'linear',
      decayCurve: 'exponential',
      releaseCurve: 'exponential' 
    }
  }).connect(master);

  const rev = new Tone.Reverb({ decay: 2.5, wet: 0.3 }).connect(master);
  fm.connect(rev);

  fm.portamento = 0.2;

    const lp = new Tone.Filter({
    type: "lowpass",
    frequency: 500
  }).connect(master);

  synth = fm;
}

async function enableCam() {
  if (!handLandmarker) {
    console.warn("HandLandmarker not loaded yet.");
    return;
  }
  if (!synth) {
    await Tone.start();
    initAudio();
  }
  synth.triggerAttack();          // power on the synth
  webcamRunning = true;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    video.addEventListener("loadeddata", predictWebcam);
  } catch (err) {
    console.error("Unable to access webcam:", err);
  }
}

function disableCam() {
  // stop all tracks
  if (video.srcObject) {
    video.srcObject.getTracks().forEach(track => track.stop());
    video.srcObject = null;

    if (rafID) {
      cancelAnimationFrame(rafID);
      rafID = null;
    }
    video.removeEventListener("loadeddata", predictWebcam)
  }
  // shut off audio
  if (synth) synth.triggerRelease();
  webcamRunning = false;
  skeletonMesh1.visible=false;
  skeletonMesh2.visible=false;
}

function getHandPoints(results, hand_index, pts){

    const moving_origin = results.landmarks[hand_index][0];
    const hand3D = results.worldLandmarks[hand_index];
    const wrist = hand3D[0];

    for (const [i, j] of HAND_CONNECTIONS) {
        const A = hand3D[i], B = hand3D[j];

        pts.push(-(A.x - wrist.x + moving_origin.x)+0.5,
        -(A.y - wrist.y + moving_origin.y)+1.0, 
        A.z - wrist.z - moving_origin.z, 
        -(B.x - wrist.x + moving_origin.x)+0.5,
        -(B.y - wrist.y + moving_origin.y)+1.0,
        B.z - wrist.z - moving_origin.z);
    }
}

function getDistFromPointToLine(point, lineOrigin, lineDirection){
    const v = new THREE.Vector3().subVectors(point, lineOrigin);
    const dist = new THREE.Vector3().crossVectors(v, lineDirection).length();

    return dist;
}

function updateHandSkeleton(geom, mesh, pts){
    geom.setPositions(pts);
    mesh.rotation.y = Math.PI;
    mesh.updateMatrixWorld();
    geom.computeBoundingSphere();

}

function getNewFreq(distToAntenna) {
  let t = (maxDAntenna - distToAntenna) / (maxDAntenna - minDAntenna);
  t = THREE.MathUtils.clamp(t, 0, 1);

  return minF + (maxF - minF) * t;
}

function getNewVolume(distToLoop){
    let u = (distToLoop - minDLoop) / (maxDLoop - minDLoop);
    u = THREE.MathUtils.clamp(u, 0, 1);

    return minVol + (maxVol - minVol) * u;
}

let lastVideoTime = -1;
let results = undefined;
console.log(video);

const freqGlideTime = 0.1;
const volGlideTime = 0.1;

async function predictWebcam() {


  if (video.videoWidth === 0 || video.videoHeight === 0) {
    if (webcamRunning) rafID = requestAnimationFrame(predictWebcam);
    return;
  }
  // 1) Switch MediaPipe to VIDEO mode on first frame
  if (runningMode === "IMAGE") {
    await handLandmarker.setOptions({ runningMode: "VIDEO" });
    runningMode = "VIDEO";
  }

  // 2) Grab a new prediction if the video advanced
  const now = performance.now();
  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    results       = handLandmarker.detectForVideo(video, now);
  }

    if (results.worldLandmarks?.length) {

        // at least one is visible

        skeletonMesh1.visible = true;
        skeletonMesh2.visible = true;

        synth.triggerAttack();

        const pts1 = [];
        const pts2 = [];

        if (results.landmarks.length === 1){

            skeletonMesh2.visible = false;

            // only adjust the pitch with one hand
            getHandPoints(results, 0, pts1);
            //  upload into your skeleton geometry
            updateHandSkeleton(skeletonGeom1, skeletonMesh1, pts1);

            const localCenter = skeletonGeom1.boundingSphere.center.clone();
            // convert it into world‐space
            skeletonMesh1.localToWorld(localCenter);

            // get distance from hand sphere center to antenna
            const dist = getDistFromPointToLine(localCenter, antennaPos, antennaDirection);

            const freq = getNewFreq(dist);
            // synth.frequency.value = freq;
            const now = Tone.now();
            synth.frequency.rampTo(freq, freqGlideTime, now);

        }
        else if (results.landmarks.length === 2){
            // hand closer to the antenna adjust pitch
            // hand closer to the loop adjusts volume

            // hand 1
            getHandPoints(results, 0, pts1);

            // hand 2
            getHandPoints(results, 1, pts2);

            updateHandSkeleton(skeletonGeom1, skeletonMesh1, pts1);
            updateHandSkeleton(skeletonGeom2, skeletonMesh2, pts2);

            const localCenter1 = skeletonGeom1.boundingSphere.center.clone();
            skeletonMesh1.localToWorld(localCenter1);
            const distToAntenna1 = getDistFromPointToLine(localCenter1, antennaPos, antennaDirection);

            const localCenter2 = skeletonGeom2.boundingSphere.center.clone();
            skeletonMesh2.localToWorld(localCenter2);
            const distToAntenna2 = getDistFromPointToLine(localCenter2, antennaPos, antennaDirection);

            if (distToAntenna1<distToAntenna2){
                // hand 1 is closer to antenna, controls freq

                const distToLoop2 = getDistFromPointToLine(localCenter2, loopPos, loopDirection);

                const volume = getNewVolume(distToLoop2);
                const freq = getNewFreq(distToAntenna1);

                const now = Tone.now();
                synth.frequency.rampTo(freq, freqGlideTime, now);
                master.gain.rampTo(volume, volGlideTime, now);
            }
            else if(distToAntenna2<distToAntenna1){

                const distToLoop1 = getDistFromPointToLine(localCenter1, loopPos, loopDirection);
                const volume = getNewVolume(distToLoop1);

                // hand 2 is closer to antenna, controls freq
                const freq = getNewFreq(distToAntenna2);

                const now = Tone.now();
                synth.frequency.rampTo(freq, freqGlideTime, now);
                master.gain.rampTo(volume, volGlideTime, now);
            }
            else{
                //the distance is equal: keep volume at previous level, only adjust frequency
            }

            
        }
        else{
            // handle situation when more than two hands are visible.
        }
    }
    else{

        // if no hands are visible...
        skeletonMesh1.visible = false;
        skeletonMesh2.visible = false;
        synth.triggerRelease();
    }

  if (webcamRunning) {
    rafID = requestAnimationFrame(predictWebcam);
  }
}

// Animation loop
function animate() {
  composer.render();
  requestAnimationFrame(animate);
}
animate();

import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let currentObject: THREE.Object3D | undefined; // Can be Mesh or Group

function init(): void {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdddddd);

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 50, 100); // Default position

    // Renderer
    const canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement;
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Lighting
    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1); // sky color, ground color, intensity
    hemisphereLight.position.set(0, 200, 0);
    scene.add(hemisphereLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); // color, intensity
    directionalLight.position.set(0, 200, 100);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Controls
    if (OrbitControls) {
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.screenSpacePanning = false;
        controls.minDistance = 10;
        controls.maxDistance = 2000;
        controls.maxPolarAngle = Math.PI / 2;
    } else {
        console.error("OrbitControls not loaded via import");
    }

    // Handle window resize
    window.addEventListener('resize', onWindowResize, false);

    // Start animation loop
    animate();

    // Request file from parent
    if (window.parent && window.parent !== window) {
        window.parent.postMessage({ action: 'requestFile' }, '*');
    } else {
        console.error("Cannot access parent window to request file.");
        const errorMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000, wireframe: true });
        const errorGeometry = new THREE.BoxGeometry(50, 50, 50);
        const errorMesh = new THREE.Mesh(errorGeometry, errorMaterial);
        scene.add(errorMesh);
        camera.lookAt(errorMesh.position);
    }
}

function onWindowResize(): void {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate(): void {
    requestAnimationFrame(animate);
    if (controls) {
        controls.update();
    }
    renderer.render(scene, camera);
}

function loadModel(file: File): void {
    if (!file) {
        console.error("No file provided to loadModel.");
        return;
    }

    if (currentObject) {
        scene.remove(currentObject);
        if (currentObject instanceof THREE.Mesh) {
            if (currentObject.geometry) currentObject.geometry.dispose();
            if (currentObject.material) {
                if (Array.isArray(currentObject.material)) {
                    currentObject.material.forEach(m => m.dispose());
                } else {
                    currentObject.material.dispose();
                }
            }
        } else if (currentObject instanceof THREE.Group) {
            currentObject.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    child.geometry?.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => m.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                }
            });
        }
    }
    
    const manager = new THREE.LoadingManager();
    manager.onProgress = function (item: string, loaded: number, total: number) {
        console.log('Loading progress: ' + (loaded / total * 100) + '%');
    };
    manager.onError = function (url: string) {
        console.error('There was an error loading ' + url);
    };

    const objectURL = URL.createObjectURL(file);
    const filename = file.name.toLowerCase();

    // Setup DRACO loader for GLTF compression
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

    try {
        if (filename.endsWith('.stl')) {
            if (!STLLoader) {
                console.error("STLLoader not available via import!");
                alert("STLLoader is not available. Cannot load STL files.");
                URL.revokeObjectURL(objectURL);
                return;
            }
            const loader = new STLLoader(manager);
            loader.load(objectURL, (geometry: THREE.BufferGeometry) => { // THREE.BufferGeometry for STL
                const material = new THREE.MeshPhongMaterial({ color: 0x2196F3, specular: 0x111111, shininess: 200 });
                currentObject = new THREE.Mesh(geometry, material);
                currentObject.castShadow = true;
                currentObject.receiveShadow = true;
                scene.add(currentObject);
                centerCameraOnObject(currentObject);
            });
        } else if (filename.endsWith('.obj')) {
            if (!OBJLoader) { 
                console.error("OBJLoader not available via import!");
                alert("OBJLoader is not available. Cannot load OBJ files.");
                URL.revokeObjectURL(objectURL);
                return;
            }

            const loader = new OBJLoader(manager);
            loader.load(objectURL, (object) => {
                object.traverse(function (child) {
                    if (child instanceof THREE.Mesh) {
                        child.material = new THREE.MeshPhongMaterial({ color: 0x0000ff, specular: 0x111111, shininess: 200 });
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                currentObject = object;
                scene.add(currentObject);
                centerCameraOnObject(currentObject);
            });
        } else if (filename.endsWith('.gltf') || filename.endsWith('.glb')) {
            const loader = new GLTFLoader(manager);
            loader.setDRACOLoader(dracoLoader);
            loader.load(objectURL, (gltf) => {
                currentObject = gltf.scene;
                currentObject.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                scene.add(currentObject);
                centerCameraOnObject(currentObject);
            });
        } else if (filename.endsWith('.fbx')) {
            const loader = new FBXLoader(manager);
            loader.load(objectURL, (object) => {
                currentObject = object;
                currentObject.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                scene.add(currentObject);
                centerCameraOnObject(currentObject);
            });
        } else if (filename.endsWith('.ply')) {
            const loader = new PLYLoader(manager);
            loader.load(objectURL, (geometry) => {
                const material = new THREE.MeshPhongMaterial({
                    color: 0x2196F3,
                    specular: 0x111111,
                    shininess: 200
                });
                currentObject = new THREE.Mesh(geometry, material);
                currentObject.castShadow = true;
                currentObject.receiveShadow = true;
                scene.add(currentObject);
                centerCameraOnObject(currentObject);
            });
        } else {
            console.warn("Unsupported file type:", filename);
            alert("Unsupported file type: " + filename);
        }
    } finally {
        URL.revokeObjectURL(objectURL);
    }
}

function centerCameraOnObject(object: THREE.Object3D): void {
    const boundingBox = new THREE.Box3().setFromObject(object);
    const center = boundingBox.getCenter(new THREE.Vector3());
    const size = boundingBox.getSize(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 * Math.tan(fov * 2));

    cameraZ *= 2.5;

    camera.position.set(center.x, center.y, center.z + cameraZ);

    if (controls) {
        controls.target.copy(center);
        controls.update();
    } else {
        camera.lookAt(center);
    }
}

window.addEventListener('message', (event: MessageEvent) => {
    if (event.data && event.data.action === 'respondFile' && event.data.file) {
        console.log("File received from parent:", (event.data.file as File).name);
        loadModel(event.data.file as File);
    }
}, false);

init();

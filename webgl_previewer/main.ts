import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let currentObject: THREE.Object3D | undefined; // Can be Mesh or Group

// Ensure Three.js objects are available globally via the CDN script tags
// const {
//     Scene, PerspectiveCamera, WebGLRenderer, HemisphereLight, DirectionalLight,
//     Color, Mesh, MeshPhongMaterial, Box3, Vector3, LoadingManager
// } = THREE; // This is now handled by imports

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
        controls.maxDistance = 500;
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
        if (currentObject instanceof THREE.Mesh) { // Type guard for Mesh
            if (currentObject.geometry) currentObject.geometry.dispose();
            if (currentObject.material) {
                if (Array.isArray(currentObject.material)) {
                    currentObject.material.forEach(m => m.dispose());
                } else {
                    currentObject.material.dispose();
                }
            }
        } else if (currentObject instanceof THREE.Group) { // Type guard for Group
             // For groups, traverse and dispose if necessary, or handle based on group structure
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
    manager.onProgress = function ( item: string, loaded: number, total: number ) {
        console.log( 'Loading progress: ' + (loaded / total * 100) + '%' );
    };
    manager.onError = function ( url: string ) {
        console.error( 'There was an error loading ' + url );
        alert('Error loading model. Check console for details.');
    };

    const objectURL = URL.createObjectURL(file);
    const filename = file.name.toLowerCase();

    let loader: STLLoader | OBJLoader; // Union type for loader

    if (filename.endsWith('.stl')) {
        if (!STLLoader) { 
            console.error("STLLoader not available via import!");
            alert("STLLoader is not available. Cannot load STL files.");
            URL.revokeObjectURL(objectURL);
            return;
        }
        loader = new STLLoader(manager);
        loader.load(objectURL, (geometry: THREE.BufferGeometry) => { // THREE.BufferGeometry for STL
            const material = new THREE.MeshPhongMaterial({ color: 0x00ff00, specular: 0x111111, shininess: 200 });
            currentObject = new THREE.Mesh(geometry, material);
            currentObject.castShadow = true;
            currentObject.receiveShadow = true;
            scene.add(currentObject);
            centerCameraOnObject(currentObject);
            URL.revokeObjectURL(objectURL); 
        }, undefined, (error: ErrorEvent) => {
            console.error("Error loading STL:", error);
            alert("Error loading STL file. Check console.");
            URL.revokeObjectURL(objectURL); 
        });
    } else if (filename.endsWith('.obj')) {
        if (!OBJLoader) { 
            console.error("OBJLoader not available via import!");
            alert("OBJLoader is not available. Cannot load OBJ files.");
            URL.revokeObjectURL(objectURL);
            return;
        }
        loader = new OBJLoader(manager);
        loader.load(objectURL, (object: THREE.Group) => { // OBJLoader returns a Group
            object.traverse(function (child: THREE.Object3D) {
                if (child instanceof THREE.Mesh) { 
                    child.material = new THREE.MeshPhongMaterial({ color: 0x0000ff, specular: 0x111111, shininess: 200 });
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            currentObject = object;
            scene.add(currentObject);
            centerCameraOnObject(currentObject);
            URL.revokeObjectURL(objectURL); 
        }, undefined, (error: ErrorEvent) => {
            console.error("Error loading OBJ:", error);
            alert("Error loading OBJ file. Check console.");
            URL.revokeObjectURL(objectURL);
        });
    } else {
        console.warn("Unsupported file type:", filename);
        alert("Unsupported file type: " + filename);
        URL.revokeObjectURL(objectURL); 
        return;
    }
}

function centerCameraOnObject(object: THREE.Object3D): void {
    const boundingBox = new THREE.Box3().setFromObject(object);
    const center = boundingBox.getCenter(new THREE.Vector3());
    const size = boundingBox.getSize(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 * Math.tan(fov * 2)); 
    
    cameraZ *= 1.5; 

    camera.position.set(center.x, center.y, center.z + cameraZ);
    
    if (controls) {
        controls.target.copy(center);
        controls.update();
    } else {
        camera.lookAt(center);
    }
}

window.addEventListener('message', (event: MessageEvent) => {
    // Consider adding origin check for security:
    // if (event.origin !== 'http://your-expected-origin.com') return;

    if (event.data && event.data.action === 'respondFile' && event.data.file) {
        console.log("File received from parent:", (event.data.file as File).name);
        loadModel(event.data.file as File);
    }
}, false);

init();

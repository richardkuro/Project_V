import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { SoundSource } from '../types';

interface SceneProps {
    soundSources: SoundSource[];
    is3DMode: boolean;
    onSourceMove: (id: string, position: { x: number, y: number, z: number }) => void;
}

const Scene: React.FC<SceneProps> = ({ soundSources, is3DMode, onSourceMove }) => {
    const mountRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<THREE.Scene>(new THREE.Scene());
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const labelRendererRef = useRef<CSS2DRenderer | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const soundSourceMeshes = useRef(new Map<string, THREE.Mesh>()).current;
    
    // Effect for initializing the scene, camera, renderer, etc.
    useEffect(() => {
        const mount = mountRef.current;
        if (!mount) return;

        // Basic setup
        cameraRef.current = new THREE.PerspectiveCamera(75, mount.clientWidth / mount.clientHeight, 0.1, 1000);
        cameraRef.current.position.set(0, 5, 15);
        
        rendererRef.current = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        rendererRef.current.setSize(mount.clientWidth, mount.clientHeight);
        rendererRef.current.setPixelRatio(window.devicePixelRatio);
        mount.appendChild(rendererRef.current.domElement);
        
        labelRendererRef.current = new CSS2DRenderer();
        labelRendererRef.current.setSize(mount.clientWidth, mount.clientHeight);
        labelRendererRef.current.domElement.style.position = 'absolute';
        labelRendererRef.current.domElement.style.top = '0px';
        labelRendererRef.current.domElement.style.pointerEvents = 'none';
        mount.appendChild(labelRendererRef.current.domElement);

        controlsRef.current = new OrbitControls(cameraRef.current, rendererRef.current.domElement);
        controlsRef.current.enableDamping = true;
        controlsRef.current.dampingFactor = 0.05;
        controlsRef.current.minDistance = 5;
        controlsRef.current.maxDistance = 50;
        controlsRef.current.enablePan = false;
        
        // Lighting
        sceneRef.current.add(new THREE.AmbientLight(0xffffff, 0.5));
        const directionalLight = new THREE.DirectionalLight(0xccfbf1, 1.5); // A cyan-tinted light
        directionalLight.position.set(5, 10, 7.5);
        sceneRef.current.add(directionalLight);

        // Stage
        const stageGeom3D = new THREE.SphereGeometry(10, 32, 32);
        const stageMat3D = new THREE.MeshStandardMaterial({ color: 0x334155, transparent: true, opacity: 0.1, wireframe: true });
        const stageSphere3D = new THREE.Mesh(stageGeom3D, stageMat3D);
        stageSphere3D.name = 'stageSphere3D';
        sceneRef.current.add(stageSphere3D);

        const stageGeom2D = new THREE.RingGeometry(9.9, 10, 64);
        const stageMat2D = new THREE.MeshBasicMaterial({ color: 0x334155, side: THREE.DoubleSide });
        const stageCircle2D = new THREE.Mesh(stageGeom2D, stageMat2D);
        stageCircle2D.name = 'stageCircle2D';
        stageCircle2D.rotation.x = -Math.PI / 2;
        stageCircle2D.visible = false;
        sceneRef.current.add(stageCircle2D);

        // Listener representation
        const listenerGeometry = new THREE.BoxGeometry(0.5, 0.8, 0.5);
        const listenerMaterial = new THREE.MeshStandardMaterial({ color: 0xa5f3fc, emissive: 0x22d3ee, emissiveIntensity: 0.5 });
        sceneRef.current.add(new THREE.Mesh(listenerGeometry, listenerMaterial));

        // Directional markers
        const markerPositions = { 'Front': new THREE.Vector3(0, 0, -11), 'Back': new THREE.Vector3(0, 0, 11), 'Left': new THREE.Vector3(-11, 0, 0), 'Right': new THREE.Vector3(11, 0, 0) };
        for (const [name, position] of Object.entries(markerPositions)) {
            const div = document.createElement('div');
            div.className = 'marker-label text-cyan-300 text-sm font-semibold pointer-events-none text-glow';
            div.textContent = name;
            const label = new CSS2DObject(div);
            label.position.copy(position);
            label.name = `marker-${name}`;
            sceneRef.current.add(label);
        }

        // Animation loop
        const animate = () => {
            requestAnimationFrame(animate);
            controlsRef.current?.update();
            rendererRef.current?.render(sceneRef.current, cameraRef.current!);
            labelRendererRef.current?.render(sceneRef.current, cameraRef.current!);
        };
        animate();

        // Interaction setup
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        let selectedObject: THREE.Mesh | null = null;
        let hoveredObject: THREE.Mesh | null = null;
        let hoverTimeout: number | null = null;

        const onPointerDown = (event: PointerEvent) => {
             // Clear any pending hover effects immediately on click
            if (hoverTimeout) clearTimeout(hoverTimeout);
            if (hoveredObject && hoveredObject.userData.label) {
                hoveredObject.userData.label.visible = false;
            }
            hoveredObject = null;

            if (event.target !== rendererRef.current?.domElement) return;
            const rect = mount.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouse, cameraRef.current!);
            const intersects = raycaster.intersectObjects(Array.from(soundSourceMeshes.values()));
            if (intersects.length > 0) {
                selectedObject = intersects[0].object as THREE.Mesh;
                mount.style.cursor = 'grabbing';
                if (controlsRef.current) controlsRef.current.enabled = false;
            }
        };

        const onPointerMove = (event: PointerEvent) => {
            const rect = mount.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouse, cameraRef.current!);

            if (selectedObject) { // Dragging logic
                event.preventDefault();
                const intersectionPoint = new THREE.Vector3();
                if (is3DMode) {
                    raycaster.ray.intersectSphere(new THREE.Sphere(new THREE.Vector3(), 10), intersectionPoint);
                } else {
                    raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), intersectionPoint);
                    if (intersectionPoint.length() > 10) intersectionPoint.normalize().multiplyScalar(10);
                }
                selectedObject.position.copy(intersectionPoint);
                onSourceMove(selectedObject.userData.id, selectedObject.position);
            } else { // Hover logic
                const intersects = raycaster.intersectObjects(Array.from(soundSourceMeshes.values()));
                const newHoveredObject = intersects.length > 0 ? (intersects[0].object as THREE.Mesh) : null;

                if (newHoveredObject !== hoveredObject) {
                    if (hoverTimeout) clearTimeout(hoverTimeout);
                    
                    if (hoveredObject && hoveredObject.userData.label) {
                        hoveredObject.userData.label.visible = false;
                    }

                    hoveredObject = newHoveredObject;

                    if (hoveredObject) {
                        hoverTimeout = window.setTimeout(() => {
                            if (hoveredObject && hoveredObject.userData.label) {
                                hoveredObject.userData.label.visible = true;
                            }
                        }, 500);
                    }
                }
            }
        };

        const onPointerUp = () => {
            if (selectedObject) {
                selectedObject = null;
                mount.style.cursor = 'grab';
                if (controlsRef.current) controlsRef.current.enabled = true;
            }
        };

        mount.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        
        const handleResize = () => {
             if (!cameraRef.current || !rendererRef.current || !labelRendererRef.current || !mount) return;
             cameraRef.current.aspect = mount.clientWidth / mount.clientHeight;
             cameraRef.current.updateProjectionMatrix();
             rendererRef.current.setSize(mount.clientWidth, mount.clientHeight);
             labelRendererRef.current.setSize(mount.clientWidth, mount.clientHeight);
        }
        window.addEventListener('resize', handleResize);

        // Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
            mount.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            if (rendererRef.current?.domElement && mount.contains(rendererRef.current.domElement)) {
                mount.removeChild(rendererRef.current.domElement);
            }
            if (labelRendererRef.current?.domElement && mount.contains(labelRendererRef.current.domElement)) {
                mount.removeChild(labelRendererRef.current.domElement);
            }
        };
    }, [onSourceMove, is3DMode]);

    // Effect for handling sound source mesh updates
    useEffect(() => {
        const currentIds = new Set(soundSources.map(s => s.id));
        
        // Remove old meshes
        soundSourceMeshes.forEach((mesh, id) => {
            if (!currentIds.has(id)) {
                sceneRef.current.remove(mesh);
                soundSourceMeshes.delete(id);
            }
        });

        // Add new meshes
        soundSources.forEach(source => {
            if (!soundSourceMeshes.has(source.id)) {
                const mesh = new THREE.Mesh(
                    new THREE.SphereGeometry(0.5, 32, 16),
                    new THREE.MeshStandardMaterial({ 
                        color: source.color,
                        emissive: source.color, // Make the spheres glow
                        emissiveIntensity: 0.5
                    })
                );
                mesh.position.setFromSphericalCoords(10, Math.random() * Math.PI, Math.random() * 2 * Math.PI);
                if (!is3DMode) mesh.position.y = 0;
                
                const labelDiv = document.createElement('div');
                labelDiv.className = 'text-cyan-200 p-1 px-2 bg-slate-950 bg-opacity-70 rounded text-xs pointer-events-none transform -translate-x-1/2 translate-y-5 text-glow';
                labelDiv.textContent = source.name.length > 15 ? `${source.name.substring(0, 12)}...` : source.name;
                const label = new CSS2DObject(labelDiv);
                label.visible = false; // Hide label by default
                mesh.add(label);
                
                mesh.userData.id = source.id;
                mesh.userData.label = label; // Store reference for hover logic
                onSourceMove(source.id, mesh.position);
                
                sceneRef.current.add(mesh);
                soundSourceMeshes.set(source.id, mesh);
            }
        });
    }, [soundSources, is3DMode, onSourceMove, soundSourceMeshes]);

    // Effect for toggling 2D/3D mode
    useEffect(() => {
        const stageSphere3D = sceneRef.current.getObjectByName('stageSphere3D');
        const stageCircle2D = sceneRef.current.getObjectByName('stageCircle2D');
        const frontMarker = sceneRef.current.getObjectByName('marker-Front');
        const backMarker = sceneRef.current.getObjectByName('marker-Back');

        if (stageSphere3D && stageCircle2D && cameraRef.current && controlsRef.current && frontMarker && backMarker) {
            // Consistently define Front as -Z and Back as +Z
            const frontPos = new THREE.Vector3(0, 0, -11);
            const backPos = new THREE.Vector3(0, 0, 11);
            
            frontMarker.position.copy(frontPos);
            backMarker.position.copy(backPos);

            if (is3DMode) {
                stageSphere3D.visible = true;
                stageCircle2D.visible = false;
                controlsRef.current.enableRotate = true;
                cameraRef.current.position.set(0, 5, 15);
                controlsRef.current.target.set(0, 0, 0);
            } else {
                stageSphere3D.visible = false;
                stageCircle2D.visible = true;
                controlsRef.current.enableRotate = false;
                cameraRef.current.position.set(0, 20, 0.01);
                controlsRef.current.target.set(0, 0, 0);
                soundSourceMeshes.forEach(mesh => {
                    mesh.position.y = 0;
                    onSourceMove(mesh.userData.id, mesh.position);
                });
            }
            controlsRef.current.update();
        }
    }, [is3DMode, onSourceMove, soundSourceMeshes]);

    return <div ref={mountRef} className="absolute top-0 left-0 w-full h-full cursor-grab active:cursor-grabbing"></div>;
};

export default Scene;
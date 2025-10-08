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

    // Refs for Three.js objects that persist across renders
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const soundSourceMeshes = useRef(new Map<string, THREE.Mesh>()).current;

    // Use refs for props/state used in event listeners to avoid stale closures
    const is3DModeRef = useRef(is3DMode);
    useEffect(() => { is3DModeRef.current = is3DMode; }, [is3DMode]);
    
    const onSourceMoveRef = useRef(onSourceMove);
    useEffect(() => { onSourceMoveRef.current = onSourceMove; }, [onSourceMove]);

    // Effect for initializing the scene, camera, renderer, etc. Runs only ONCE.
    useEffect(() => {
        const mount = mountRef.current;
        if (!mount || rendererRef.current) return; // Exit if not mounted or already initialized

        const scene = new THREE.Scene();
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(75, mount.clientWidth / mount.clientHeight, 0.1, 1000);
        camera.position.set(0, 5, 15);
        cameraRef.current = camera;
        
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(mount.clientWidth, mount.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        mount.appendChild(renderer.domElement);
        rendererRef.current = renderer;
        
        const labelRenderer = new CSS2DRenderer();
        labelRenderer.setSize(mount.clientWidth, mount.clientHeight);
        labelRenderer.domElement.style.position = 'absolute';
        labelRenderer.domElement.style.top = '0px';
        labelRenderer.domElement.style.pointerEvents = 'none';
        mount.appendChild(labelRenderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.minDistance = 5;
        controls.maxDistance = 50;
        controls.enablePan = false;
        controlsRef.current = controls;
        
        scene.add(new THREE.AmbientLight(0xffffff, 0.5));
        const directionalLight = new THREE.DirectionalLight(0xccfbf1, 1.5);
        directionalLight.position.set(5, 10, 7.5);
        scene.add(directionalLight);

        const stageSphere3D = new THREE.Mesh(
            new THREE.SphereGeometry(10, 32, 32),
            new THREE.MeshStandardMaterial({ color: 0x334155, transparent: true, opacity: 0.1, wireframe: true })
        );
        stageSphere3D.name = 'stageSphere3D';
        scene.add(stageSphere3D);

        const stageCircle2D = new THREE.Mesh(
            new THREE.RingGeometry(9.9, 10, 64),
            new THREE.MeshBasicMaterial({ color: 0x334155, side: THREE.DoubleSide })
        );
        stageCircle2D.name = 'stageCircle2D';
        stageCircle2D.rotation.x = -Math.PI / 2;
        stageCircle2D.visible = false;
        scene.add(stageCircle2D);

        const listenerMesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.8, 0.5),
            new THREE.MeshStandardMaterial({ color: 0xa5f3fc, emissive: 0x22d3ee, emissiveIntensity: 0.5 })
        );
        scene.add(listenerMesh);

        const markerPositions = { 
            'Front': new THREE.Vector3(0, 0, -11), 'Back': new THREE.Vector3(0, 0, 11), 
            'Left': new THREE.Vector3(-11, 0, 0), 'Right': new THREE.Vector3(11, 0, 0),
            'Top': new THREE.Vector3(0, 11, 0), 'Bottom': new THREE.Vector3(0, -11, 0)
        };
        for (const [name, position] of Object.entries(markerPositions)) {
            const div = document.createElement('div');
            div.className = 'marker-label text-cyan-300 text-sm font-semibold pointer-events-none text-glow';
            div.textContent = name;
            const label = new CSS2DObject(div);
            label.position.copy(position);
            label.name = `marker-${name}`;
            scene.add(label);
        }

        let animationFrameId: number;
        let selectedObjectForScroll: THREE.Mesh | null = null;
        let scrollTargetDistance: number | null = null;

        const animate = () => {
            animationFrameId = requestAnimationFrame(animate);
            controls.update();

            // Smooth scrolling logic
            if (selectedObjectForScroll && scrollTargetDistance !== null) {
                const currentLength = selectedObjectForScroll.position.length();
                if (Math.abs(currentLength - scrollTargetDistance) > 0.01) {
                    const newLength = THREE.MathUtils.lerp(currentLength, scrollTargetDistance, 0.1);
                    selectedObjectForScroll.position.setLength(newLength);
                    onSourceMoveRef.current(selectedObjectForScroll.userData.id, selectedObjectForScroll.position);
                }
            }

            renderer.render(scene, camera);
            labelRenderer.render(scene, camera);
        };
        animate();

        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        let selectedObjectForDrag: THREE.Mesh | null = null;
        let hoveredObject: THREE.Mesh | null = null;
        let hoverTimeout: number | null = null;

        const dragPlane = new THREE.Plane();
        const intersectionPoint = new THREE.Vector3();
        const offset = new THREE.Vector3();

        const onPointerDown = (event: PointerEvent) => {
            if (hoverTimeout) clearTimeout(hoverTimeout);
            if (hoveredObject && hoveredObject.userData.label) hoveredObject.userData.label.visible = false;
            hoveredObject = null;

            if (event.target !== renderer.domElement) return;
            const rect = mount.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(Array.from(soundSourceMeshes.values()));
            if (intersects.length > 0) {
                const selected = intersects[0].object as THREE.Mesh;
                selectedObjectForDrag = selected;
                selectedObjectForScroll = selected; // Link for scrolling
                
                mount.style.cursor = 'grabbing';
                controls.enabled = false;
                
                if (is3DModeRef.current) {
                    const cameraDirection = new THREE.Vector3();
                    camera.getWorldDirection(cameraDirection);
                    dragPlane.setFromNormalAndCoplanarPoint(cameraDirection, selected.position);
                } else {
                    dragPlane.set(new THREE.Vector3(0, 1, 0), 0);
                }

                if (raycaster.ray.intersectPlane(dragPlane, intersectionPoint)) {
                    offset.copy(intersectionPoint).sub(selected.position);
                }
                
                scrollTargetDistance = selected.position.length(); // Initialize for scrolling
            }
        };

        const onPointerMove = (event: PointerEvent) => {
            const rect = mount.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);

            if (selectedObjectForDrag) {
                event.preventDefault();
                if (raycaster.ray.intersectPlane(dragPlane, intersectionPoint)) {
                    const newPosition = intersectionPoint.clone().sub(offset);

                    if (newPosition.length() > 10) {
                        newPosition.setLength(10);
                    }
                    if (!is3DModeRef.current) {
                        newPosition.y = 0;
                    }
                    
                    selectedObjectForDrag.position.copy(newPosition);
                    scrollTargetDistance = newPosition.length(); // Update scroll target while dragging
                    onSourceMoveRef.current(selectedObjectForDrag.userData.id, selectedObjectForDrag.position);
                }
            } else {
                const intersects = raycaster.intersectObjects(Array.from(soundSourceMeshes.values()));
                const newHoveredObject = intersects.length > 0 ? (intersects[0].object as THREE.Mesh) : null;
                if (newHoveredObject !== hoveredObject) {
                    if (hoverTimeout) clearTimeout(hoverTimeout);
                    if (hoveredObject && hoveredObject.userData.label) hoveredObject.userData.label.visible = false;
                    hoveredObject = newHoveredObject;
                    if (hoveredObject) {
                        hoverTimeout = window.setTimeout(() => {
                            if (hoveredObject && hoveredObject.userData.label) hoveredObject.userData.label.visible = true;
                        }, 500);
                    }
                }
            }
        };

        const onWindowPointerUp = () => {
            if (selectedObjectForDrag) {
                selectedObjectForDrag = null;
                mount.style.cursor = 'grab';
                controls.enabled = true;
            }
            selectedObjectForScroll = null;
            scrollTargetDistance = null;
        };

        const onWheel = (event: WheelEvent) => {
            if (!is3DModeRef.current || !selectedObjectForScroll) return;
            
            event.preventDefault();

            const scrollSensitivity = 0.005;
            const scrollAmount = event.deltaY * scrollSensitivity;
            
            if (scrollTargetDistance === null) {
                scrollTargetDistance = selectedObjectForScroll.position.length();
            }

            scrollTargetDistance -= scrollAmount;
            scrollTargetDistance = THREE.MathUtils.clamp(scrollTargetDistance, 0.1, 10);
        };

        mount.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onWindowPointerUp);
        mount.addEventListener('wheel', onWheel, { passive: false });
        
        const handleResize = () => {
             camera.aspect = mount.clientWidth / mount.clientHeight;
             camera.updateProjectionMatrix();
             renderer.setSize(mount.clientWidth, mount.clientHeight);
             labelRenderer.setSize(mount.clientWidth, mount.clientHeight);
        }
        window.addEventListener('resize', handleResize);

        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', handleResize);
            mount.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onWindowPointerUp);
            mount.removeEventListener('wheel', onWheel);

            scene.traverse(object => {
                if (!(object instanceof THREE.Mesh)) return;
                object.geometry.dispose();
                const material = object.material as THREE.Material | THREE.Material[];
                if (Array.isArray(material)) {
                    material.forEach(m => m.dispose());
                } else {
                    material.dispose();
                }
            });

            controls.dispose();
            renderer.dispose();
            if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
            if (labelRenderer.domElement.parentElement === mount) mount.removeChild(labelRenderer.domElement);
            rendererRef.current = null;
        };
    }, []); // Empty dependency array ensures this runs only once.

    // Effect for handling sound source mesh updates
    useEffect(() => {
        if (!sceneRef.current) return;
        const scene = sceneRef.current;
        const currentIds = new Set(soundSources.map(s => s.id));
        
        soundSourceMeshes.forEach((mesh, id) => {
            if (!currentIds.has(id)) {
                if (mesh.userData.label) mesh.remove(mesh.userData.label);
                scene.remove(mesh);
                soundSourceMeshes.delete(id);
            }
        });

        soundSources.forEach(source => {
            if (!soundSourceMeshes.has(source.id)) {
                const mesh = new THREE.Mesh(
                    new THREE.SphereGeometry(0.5, 32, 16),
                    new THREE.MeshStandardMaterial({ color: source.color, emissive: source.color, emissiveIntensity: 0.5 })
                );
                mesh.position.setFromSphericalCoords(10, Math.random() * Math.PI, Math.random() * 2 * Math.PI);
                if (!is3DMode) mesh.position.y = 0;
                
                const labelDiv = document.createElement('div');
                labelDiv.className = 'text-cyan-200 p-1 px-2 bg-slate-950 bg-opacity-70 rounded text-xs pointer-events-none transform -translate-x-1/2 translate-y-5 text-glow';
                labelDiv.textContent = source.name.length > 15 ? `${source.name.substring(0, 12)}...` : source.name;
                const label = new CSS2DObject(labelDiv);
                label.visible = false;
                mesh.add(label);
                
                mesh.userData.id = source.id;
                mesh.userData.label = label;
                onSourceMove(source.id, mesh.position);
                
                scene.add(mesh);
                soundSourceMeshes.set(source.id, mesh);
            }
        });
    }, [soundSources, is3DMode, onSourceMove, soundSourceMeshes]);

    // Effect for toggling 2D/3D mode
    useEffect(() => {
        const scene = sceneRef.current;
        const camera = cameraRef.current;
        const controls = controlsRef.current;
        if (!scene || !camera || !controls) return;

        const stageSphere3D = scene.getObjectByName('stageSphere3D');
        const stageCircle2D = scene.getObjectByName('stageCircle2D');
        const topMarker = scene.getObjectByName('marker-Top');
        const bottomMarker = scene.getObjectByName('marker-Bottom');

        if (stageSphere3D && stageCircle2D) {
            if (is3DMode) {
                stageSphere3D.visible = true;
                stageCircle2D.visible = false;
                if(topMarker) topMarker.visible = true;
                if(bottomMarker) bottomMarker.visible = true;
                controls.enableRotate = true;
                camera.position.set(0, 5, 15);
                controls.target.set(0, 0, 0);
            } else {
                stageSphere3D.visible = false;
                stageCircle2D.visible = true;
                if(topMarker) topMarker.visible = false;
                if(bottomMarker) bottomMarker.visible = false;
                controls.enableRotate = false;
                camera.position.set(0, 20, 0.01);
                controls.target.set(0, 0, 0);
                soundSourceMeshes.forEach(mesh => {
                    if (mesh.position.y !== 0) {
                        const newPosition = mesh.position.clone();
                        newPosition.y = 0;
                        if (newPosition.length() > 10) newPosition.normalize().multiplyScalar(10);
                        mesh.position.copy(newPosition);
                        onSourceMove(mesh.userData.id, mesh.position);
                    }
                });
            }
            controls.update();
        }
    }, [is3DMode, onSourceMove, soundSourceMeshes]);

    return <div ref={mountRef} className="absolute top-0 left-0 w-full h-full cursor-grab active:cursor-grabbing"></div>;
};

export default Scene;
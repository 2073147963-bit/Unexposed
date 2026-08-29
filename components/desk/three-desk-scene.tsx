"use client";

import { Html } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { useLanguage } from "@/components/ui/language-provider";
import { useSound } from "@/components/sound/sound-provider";
import type { StoredRoll } from "@/lib/types";
import { stableHash } from "@/lib/utils/desk-placement";

interface ThreeDeskSceneProps { rolls: StoredRoll[]; onNewRoll: () => void; reducedMotion: boolean; onReady: () => void; onFailure: () => void }

const palettes = [
  { paper: "#d1c3a6", edge: "#a8862b", ink: "#18130f" },
  { paper: "#292321", edge: "#8e2d22", ink: "#ddd1b9" },
  { paper: "#c8b895", edge: "#315d49", ink: "#18231d" },
  { paper: "#332b27", edge: "#a75132", ink: "#e1d1b6" },
] as const;

function CameraRig({ reducedMotion, panRef }: { reducedMotion: boolean; panRef: { current: THREE.Vector3 } }) {
  const { camera } = useThree();
  useFrame(() => {
    // 桌面可无限拖动：相机跟随 pan 偏移平移，无边界限制。
    const pan = panRef.current;
    camera.position.x = pan.x;
    camera.position.y = 8.1;
    camera.position.z = 8.4 + pan.z;
    camera.lookAt(pan.x, 0, pan.z);
  });
  return null;
}

function RollObject({ roll, index, count, reducedMotion, onOpen }: { roll: StoredRoll; index: number; count: number; reducedMotion: boolean; onOpen: (id: string) => void }) {
  const group = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const hash = stableHash(roll.id);
  const palette = palettes[hash % palettes.length];
  const columns = Math.min(5, Math.max(2, Math.ceil(Math.sqrt(count * 1.45))));
  const rows = Math.ceil(count / columns);
  const column = index % columns;
  const row = Math.floor(index / columns);
  const stacked = index > 0 && index % 7 === 0;
  const x = (column - (columns - 1) / 2) * 2.15 + (((hash >> 4) % 29) - 14) / 25 - (stacked ? 0.62 : 0);
  const z = (row - (rows - 1) / 2) * 2.45 + (((hash >> 9) % 27) - 13) / 24 - (stacked ? 0.48 : 0);
  const baseY = 0.17 + (stacked ? 0.14 : 0);
  const baseRotation = (((hash >> 2) % 25) - 12) * 0.015;
  // 新封存的胶卷从上方落下，落在桌面网格位置上。
  const dropRef = useRef(3.2);

  useEffect(() => { document.body.style.cursor = hovered ? "pointer" : ""; return () => { document.body.style.cursor = ""; }; }, [hovered]);
  useFrame((_, delta) => {
    if (!group.current) return;
    if (reducedMotion) {
      group.current.position.y = baseY;
      group.current.rotation.y = baseRotation;
      dropRef.current = 0;
      return;
    }
    dropRef.current = Math.max(0, dropRef.current - delta * 5);
    group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, hovered ? baseY + 0.22 : baseY, 0.12) + dropRef.current;
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, hovered ? baseRotation * 0.45 : baseRotation, 0.1);
  });

  return (
    <group ref={group} position={[x, baseY, z]} rotation={[0, baseRotation, 0]}
      onPointerDown={(event) => { event.stopPropagation(); }}
      onPointerEnter={(event) => { event.stopPropagation(); setHovered(true); }}
      onPointerLeave={() => setHovered(false)} onClick={(event) => { event.stopPropagation(); onOpen(roll.id); }}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.45, 0.22, 2.12]} />
        <meshStandardMaterial color={palette.paper} roughness={0.88} />
      </mesh>
      <mesh position={[-0.69, 0.025, 0]} castShadow><boxGeometry args={[0.12, 0.28, 2.24]} /><meshStandardMaterial color={palette.edge} roughness={0.78} /></mesh>
      <mesh position={[0.69, 0.025, 0]} castShadow><boxGeometry args={[0.12, 0.28, 2.24]} /><meshStandardMaterial color={palette.edge} roughness={0.78} /></mesh>
      <mesh position={[0, 0.14, -1.08]} castShadow><boxGeometry args={[1.62, 0.24, 0.18]} /><meshStandardMaterial color="#090908" roughness={0.72} /></mesh>
      <mesh position={[0, 0.14, 1.08]} castShadow><boxGeometry args={[1.62, 0.24, 0.18]} /><meshStandardMaterial color="#090908" roughness={0.72} /></mesh>
      <mesh position={[0, 0.125, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.12, 1.64]} />
        <meshBasicMaterial color={palette.ink} transparent opacity={0.055} />
      </mesh>
      {hovered && <Html position={[0, 0.55, 0]} center distanceFactor={9}><span className="three-roll-title">{roll.title}</span></Html>}
    </group>
  );
}

function Scene({ rolls, reducedMotion, onOpen, onReady, onFailure }: { rolls: StoredRoll[]; reducedMotion: boolean; onOpen: (id: string) => void; onReady: () => void; onFailure: () => void }) {
  const { gl, camera } = useThree();
  // 无限桌面：panRef 记录拖拽平移量，相机跟随它平移，无边界限制。
  const panRef = useRef(new THREE.Vector3());
  const dragRef = useRef<{ pointerId: number; baseX: number; baseZ: number; startX: number; startZ: number } | null>(null);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const floorPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);

  // 把屏幕坐标换算成 y=0 桌面平面上的世界坐标（用于拖拽平移）。
  const floorPoint = useCallback((clientX: number, clientY: number) => {
    const rect = gl.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
    const point = new THREE.Vector3();
    raycaster.ray.intersectPlane(floorPlane, point);
    return point;
  }, [camera, floorPlane, gl, raycaster]);

  useEffect(() => {
    onReady();
    const lost = (event: Event) => { event.preventDefault(); onFailure(); };
    gl.domElement.addEventListener("webglcontextlost", lost);
    return () => gl.domElement.removeEventListener("webglcontextlost", lost);
  }, [gl, onFailure, onReady]);

  // 窗口级拖拽监听：即使指针滑过胶卷也持续平移，松手即停。
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      const point = floorPoint(event.clientX, event.clientY);
      panRef.current.x = drag.baseX - (point.x - drag.startX);
      panRef.current.z = drag.baseZ - (point.z - drag.startZ);
    };
    const onUp = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      dragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [floorPoint]);

  return (
    <>
      <color attach="background" args={["#17100c"]} />
      <fog attach="fog" args={["#17100c", 10, 20]} />
      <ambientLight intensity={1.15} />
      <directionalLight position={[-4, 8, 4]} intensity={2.4} color="#ffd9aa" castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[5, 4, -3]} intensity={0.7} color="#8b3b26" />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        position={[0, 0, 0]}
        onPointerDown={(event) => {
          // 只有点在空桌面上才启动平移；胶卷自身的 onPointerDown 会 stopPropagation。
          event.stopPropagation();
          const point = floorPoint(event.clientX, event.clientY);
          dragRef.current = { pointerId: event.pointerId, baseX: panRef.current.x, baseZ: panRef.current.z, startX: point.x, startZ: point.z };
        }}
      >
        <planeGeometry args={[320, 320]} />
        <meshStandardMaterial color="#2b1b14" roughness={0.96} />
      </mesh>
      {rolls.map((roll, index) => <RollObject key={roll.id} roll={roll} index={index} count={rolls.length} reducedMotion={reducedMotion} onOpen={onOpen} />)}
      <CameraRig reducedMotion={reducedMotion} panRef={panRef} />
    </>
  );
}

export function ThreeDeskScene({ rolls, onNewRoll, reducedMotion, onReady, onFailure }: ThreeDeskSceneProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const { playSound } = useSound();
  const stableReady = useCallback(onReady, [onReady]);
  const stableFailure = useCallback(onFailure, [onFailure]);
  const openRoll = useCallback((id: string) => { playSound("openRoll"); router.push(`/roll/${encodeURIComponent(id)}`); }, [playSound, router]);
  const camera = useMemo(() => ({ position: [0, 8.1, 8.4] as [number, number, number], fov: 42, near: 0.1, far: 120 }), []);

  return (
    <main className="three-desk-page">
      <div className="cinema-matte" aria-hidden="true" />
      <section className="three-desk-stage" aria-label={t("deskLabel")}>
        <div className="desk-metadata" aria-hidden="true"><span>UNEXPOSED / TABLE</span><span>{String(rolls.length).padStart(2, "0")} {t("sealedRolls")}</span></div>
        <Canvas camera={camera} shadows dpr={[1, 1.5]} gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }} fallback={<DeskCanvasFallback onFailure={stableFailure} />}>
          <Suspense fallback={null}><Scene rolls={rolls} reducedMotion={reducedMotion} onOpen={openRoll} onReady={stableReady} onFailure={stableFailure} /></Suspense>
        </Canvas>
        <div className="three-desk-accessible-rolls sr-only">{rolls.map((roll) => <button key={roll.id} type="button" onClick={() => openRoll(roll.id)}>{roll.title}</button>)}</div>
        <button className="physical-new-roll" type="button" onClick={onNewRoll}>{t("newRoll")}</button>
        <p className="physical-desk-hint">{t("deskHint")}</p>
      </section>
    </main>
  );
}

function DeskCanvasFallback({ onFailure }: { onFailure: () => void }) {
  useEffect(onFailure, [onFailure]);
  return null;
}

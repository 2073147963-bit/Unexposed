"use client";

import Matter from "matter-js";
import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type CanisterInteractionState = "idle" | "hover" | "dragging" | "inertia" | "focusing" | "readyToOpen";

export interface CanisterPose {
  x: number;
  y: number;
  angle: number;
}

const anchors = [
  { x: 0.27, y: 0.29, angle: -0.13 },
  { x: 0.52, y: 0.25, angle: 0.11 },
  { x: 0.76, y: 0.49, angle: 0.17 },
  { x: 0.34, y: 0.69, angle: -0.045 },
  { x: 0.58, y: 0.65, angle: 0.07 },
  { x: 0.83, y: 0.75, angle: -0.1 },
  { x: 0.16, y: 0.76, angle: 0.12 },
  { x: 0.67, y: 0.35, angle: -0.07 },
] as const;

interface DragSession {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
  maxDistance: number;
  constraint: Matter.Constraint;
}

export function useCanisterPhysics({
  ids,
  containerRef,
  reducedMotion,
}: {
  ids: string[];
  containerRef: RefObject<HTMLDivElement | null>;
  reducedMotion: boolean;
}) {
  const [poses, setPoses] = useState<Record<string, CanisterPose>>({});
  const [states, setStates] = useState<Record<string, CanisterInteractionState>>({});
  const statesRef = useRef<Record<string, CanisterInteractionState>>({});
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState<"focusing" | "ready" | "returning" | null>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const bodiesRef = useRef(new Map<string, Matter.Body>());
  const dragRef = useRef<DragSession | null>(null);
  const pausedRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const readyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idKey = useMemo(() => ids.join("|"), [ids]);

  const setInteraction = useCallback((id: string, state: CanisterInteractionState) => {
    setStates((current) => {
      if (current[id] === state) return current;
      const next = { ...current, [id]: state };
      statesRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || ids.length === 0) {
      setPoses({});
      return;
    }

    const engine = Matter.Engine.create({ enableSleeping: true });
    engine.gravity.x = 0;
    engine.gravity.y = 0;
    engine.gravity.scale = 0;
    engineRef.current = engine;
    bodiesRef.current.clear();

    const rebuild = () => {
      const rect = container.getBoundingClientRect();
      const compact = rect.width < 680;
      const bodyWidth = compact ? 78 : 100;
      const bodyHeight = compact ? 126 : 162;
      const wall = 80;
      const existingWalls = Matter.Composite.allBodies(engine.world).filter((body) => body.label === "desk-boundary");
      Matter.Composite.remove(engine.world, existingWalls);

      Matter.Composite.add(engine.world, [
        Matter.Bodies.rectangle(rect.width / 2, -wall / 2, rect.width + wall * 2, wall, { isStatic: true, label: "desk-boundary" }),
        Matter.Bodies.rectangle(rect.width / 2, rect.height + wall / 2, rect.width + wall * 2, wall, { isStatic: true, label: "desk-boundary" }),
        Matter.Bodies.rectangle(-wall / 2, rect.height / 2, wall, rect.height + wall * 2, { isStatic: true, label: "desk-boundary" }),
        Matter.Bodies.rectangle(rect.width + wall / 2, rect.height / 2, wall, rect.height + wall * 2, { isStatic: true, label: "desk-boundary" }),
      ]);

      ids.forEach((id, index) => {
        const anchor = anchors[index % anchors.length];
        const existing = bodiesRef.current.get(id);
        if (existing) {
          Matter.Body.setPosition(existing, {
            x: Math.max(bodyWidth / 2, Math.min(rect.width - bodyWidth / 2, existing.position.x)),
            y: Math.max(bodyHeight / 2, Math.min(rect.height - bodyHeight / 2, existing.position.y)),
          });
          return;
        }

        const body = Matter.Bodies.rectangle(rect.width * anchor.x, rect.height * anchor.y, bodyWidth, bodyHeight, {
          label: `canister:${id}`,
          chamfer: { radius: compact ? 14 : 20 },
          friction: 0.62,
          frictionAir: 0.075,
          restitution: 0.16,
          density: 0.0024,
          sleepThreshold: 45,
        });
        Matter.Body.setAngle(body, anchor.angle);
        Matter.Body.setInertia(body, body.inertia * 4.2);
        bodiesRef.current.set(id, body);
        Matter.Composite.add(engine.world, body);
      });
    };

    rebuild();
    const observer = new ResizeObserver(rebuild);
    observer.observe(container);

    let previousTime = performance.now();
    const tick = (time: number) => {
      const delta = Math.min(32, time - previousTime);
      previousTime = time;

      if (!pausedRef.current) {
        const substep = delta / 2;
        Matter.Engine.update(engine, substep);
        Matter.Engine.update(engine, substep);

        for (const [id, body] of bodiesRef.current) {
          const speed = Matter.Vector.magnitude(body.velocity);
          if (speed > 22) Matter.Body.setVelocity(body, Matter.Vector.mult(Matter.Vector.normalise(body.velocity), 22));
          if (Math.abs(body.angularVelocity) > 0.035) Matter.Body.setAngularVelocity(body, Math.sign(body.angularVelocity) * 0.035);
          if (statesRef.current[id] === "inertia" && speed < 0.08 && Math.abs(body.angularVelocity) < 0.002) {
            setInteraction(id, "idle");
          }
        }
      }

      const nextPoses: Record<string, CanisterPose> = {};
      for (const [id, body] of bodiesRef.current) nextPoses[id] = { x: body.position.x, y: body.position.y, angle: body.angle };
      setPoses(nextPoses);
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      observer.disconnect();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      if (readyTimerRef.current) clearTimeout(readyTimerRef.current);
      Matter.Engine.clear(engine);
      Matter.Composite.clear(engine.world, false, true);
      engineRef.current = null;
      bodiesRef.current.clear();
    };
    // idKey intentionally rebuilds the world only when the roll set changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, idKey, reducedMotion, setInteraction]);

  const pointInDesk = useCallback((event: ReactPointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    return rect ? { x: event.clientX - rect.left, y: event.clientY - rect.top } : { x: 0, y: 0 };
  }, [containerRef]);

  const focusCanister = useCallback((id: string) => {
    if (focusedId || !bodiesRef.current.has(id)) return;
    pausedRef.current = true;
    const body = bodiesRef.current.get(id)!;
    Matter.Body.setVelocity(body, { x: 0, y: 0 });
    Matter.Body.setAngularVelocity(body, 0);
    setFocusedId(id);
    setFocusMode("focusing");
    setInteraction(id, "focusing");
    readyTimerRef.current = setTimeout(() => {
      setFocusMode("ready");
      setInteraction(id, "readyToOpen");
    }, reducedMotion ? 40 : 430);
  }, [focusedId, reducedMotion, setInteraction]);

  const cancelFocus = useCallback(() => {
    if (!focusedId) return;
    if (readyTimerRef.current) clearTimeout(readyTimerRef.current);
    setFocusMode("returning");
    setInteraction(focusedId, "focusing");
    setTimeout(() => {
      setInteraction(focusedId, "idle");
      setFocusedId(null);
      setFocusMode(null);
      pausedRef.current = false;
    }, reducedMotion ? 40 : 380);
  }, [focusedId, reducedMotion, setInteraction]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancelFocus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cancelFocus]);

  const handlersFor = useCallback((id: string) => ({
    onPointerEnter: () => {
      if (!pausedRef.current && states[id] !== "dragging") setInteraction(id, "hover");
    },
    onPointerLeave: () => {
      if (!pausedRef.current && states[id] === "hover") setInteraction(id, "idle");
    },
    onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (pausedRef.current || !engineRef.current) return;
      const body = bodiesRef.current.get(id);
      if (!body) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      Matter.Sleeping.set(body, false);
      const point = pointInDesk(event);
      const constraint = Matter.Constraint.create({ pointA: point, bodyB: body, pointB: { x: 0, y: 0 }, stiffness: reducedMotion ? 0.9 : 0.16, damping: 0.24, length: 0 });
      Matter.Composite.add(engineRef.current.world, constraint);
      dragRef.current = { id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, maxDistance: 0, constraint };
      setInteraction(id, "dragging");
    },
    onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.id !== id || drag.pointerId !== event.pointerId) return;
      drag.maxDistance = Math.max(drag.maxDistance, Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY));
      drag.constraint.pointA = pointInDesk(event);
    },
    onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      const engine = engineRef.current;
      if (!drag || drag.id !== id || drag.pointerId !== event.pointerId || !engine) return;
      Matter.Composite.remove(engine.world, drag.constraint);
      dragRef.current = null;
      if (drag.maxDistance < 7) focusCanister(id);
      else {
        if (reducedMotion) {
          const body = bodiesRef.current.get(id);
          if (body) {
            Matter.Body.setVelocity(body, { x: 0, y: 0 });
            Matter.Body.setAngularVelocity(body, 0);
          }
        }
        setInteraction(id, reducedMotion ? "idle" : "inertia");
      }
    },
    onPointerCancel: () => {
      const drag = dragRef.current;
      const engine = engineRef.current;
      if (drag?.id === id && engine) {
        Matter.Composite.remove(engine.world, drag.constraint);
        dragRef.current = null;
        setInteraction(id, "idle");
      }
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        focusCanister(id);
      }
    },
  }), [focusCanister, pointInDesk, reducedMotion, setInteraction, states]);

  return { poses, states, focusedId, focusMode, handlersFor, cancelFocus };
}

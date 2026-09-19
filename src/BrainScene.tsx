import { useEffect, useRef } from "react";
import { mountBrainScene } from "./brain-scene";
import "./brain-scene.css";

// Renders the exact same HUD/tooltip/stick/gate markup the original
// index.html had in <body>, then hands the container to mountBrainScene()
// once it's in the DOM. Cleanup runs the returned unmount function, so
// React StrictMode's dev-only mount->unmount->remount doesn't double up
// renderers or leak listeners.
export default function BrainScene() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const unmount = mountBrainScene(root);
    return unmount;
  }, []);

  return (
    <div className="brain-root" ref={rootRef}>
      <div id="hud">
        <div id="title">
          <h1>Inner Cortex</h1>
          <p>Spectator view from inside a living network</p>
        </div>
        <div id="stats">
          <div><b>Neurons</b><span id="nCount">0</span></div>
          <div><b>Synapses</b><span id="eCount">0</span></div>
          <div><b>Firing</b><span id="fCount">0</span></div>
        </div>
        <div id="hint">WASD fly · Drag to look · Scroll to travel · Click a neuron</div>
      </div>
      <div id="tooltip"><div className="id" /><div className="reg" /></div>
      <div id="stick" aria-label="Move joystick"><div id="knob" /></div>
      <div id="gate">
        <div className="copy">
          <div className="kicker">Immersive neural map</div>
          <h1>Inner Cortex</h1>
          <p>You are standing inside a living brain. Fly with WASD (or the left stick on a phone). Look around. Touch a neuron.</p>
          <button id="enter" type="button">Enter the network</button>
        </div>
      </div>
    </div>
  );
}

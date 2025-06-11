const scene = document.querySelector("a-scene");
const reticle = document.querySelector("[ar-hit-test]");
const hoop = document.getElementById("hoop");
const ball = document.getElementById("ball");
const startBtn = document.getElementById("go-button");
const exitBtn = document.getElementById("exit-button");

const up = new THREE.Vector3(0, 1, 0);
const forward = new THREE.Vector3();
const rotation = new THREE.Quaternion();

function hasOverlay(session) {
  return session?.domOverlayState?.type || false;
}

function placeHoop() {
  const pos = reticle.getAttribute("position");
  hoop.setAttribute("position", pos);
  hoop.setAttribute("visible", true);

  forward.set(0, 0, -1).applyQuaternion(reticle.object3D.quaternion);
  rotation.setFromUnitVectors(forward, up);
  hoop.object3D.quaternion.multiplyQuaternions(
    rotation,
    reticle.object3D.quaternion
  );
}

function startGame(e) {
  e.preventDefault();
  if (!hoop.getAttribute("visible")) placeHoop();

  document.body.classList.remove("ar-preparing");
  document.body.classList.add("playing");

  reticle.setAttribute("ar-hit-test", "doHitTest:false");
  reticle.setAttribute("visible", "false");
}

scene.addEventListener("enter-vr", () => {
  const arMode = scene.is("ar-mode");
  const overlay = hasOverlay(scene.xrSession);

  document
    .getElementById("text")
    .setAttribute("text", "value", "Overlay: " + overlay);

  document.body.className = arMode ? "ar-preparing" : "playing";
  reticle.setAttribute("visible", arMode);
  reticle.setAttribute("ar-hit-test", "doHitTest:" + arMode);
});

scene.addEventListener("exit-vr", () => {
  document.body.className = "inline";
  reticle.setAttribute("visible", false);
  reticle.setAttribute("ar-hit-test", "doHitTest:false");
});

reticle.addEventListener("select", (e) => {
  const overlay = hasOverlay(scene.xrSession);
  const playing = document.body.classList.contains("playing");

  if (playing) {
    const { position, orientation } = e.detail.pose.transform;
    ball.body.position.copy(position);
    forward.set(0, 0, -5).applyQuaternion(orientation);
    ball.body.velocity.copy(forward);
  } else {
    const validPose =
      overlay || reticle.components["ar-hit-test"].hasFoundAPose;
    if (validPose) {
      placeHoop();
      startGame(e);
    }
  }
});

startBtn.addEventListener("mousedown", startGame);
startBtn.addEventListener("touchstart", startGame);
exitBtn.addEventListener("click", () => scene.xrSession.end());

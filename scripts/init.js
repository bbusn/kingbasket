window.addEventListener("DOMContentLoaded", () => {
  fetch("components/scene.html")
    .then((res) => res.text())
    .then((html) => (document.getElementById("scene-container").innerHTML = html));

  fetch("components/overlay.html")
    .then((res) => res.text())
    .then((html) => (document.getElementById("overlay-container").innerHTML = html));
});

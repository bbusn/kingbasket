AFRAME.registerComponent("hide-in-ar", {
  init() {
    const scene = this.el.sceneEl;
    scene.addEventListener("enter-vr", () => {
      if (scene.is("ar-mode")) this.el.setAttribute("visible", false);
    });
    scene.addEventListener("exit-vr", () => {
      this.el.setAttribute("visible", true);
    });
  },
});

AFRAME.registerComponent("occlusion", {
  update() {
    this.el.components.material.material.colorWrite = false;
  },
});

class SimpleHitTest {
  constructor(renderer, options) {
    this.renderer = renderer;
    this.hitTestSrc = null;
    this.transient = !!options.profile;

    const onStart = () => this.setup(options);
    const onEnd = () => (this.hitTestSrc = null);

    renderer.xr.addEventListener("sessionstart", onStart);
    renderer.xr.addEventListener("sessionend", onEnd);

    if (renderer.xr.isPresenting) onStart();
  }

  async setup(opts) {
    const session = this.renderer.xr.getSession();
    this.hitTestSrc = opts.space
      ? await session.requestHitTestSource(opts)
      : await session.requestHitTestSourceForTransientInput(opts);
  }

  hit(frame, refSpace) {
    if (!this.hitTestSrc) return null;
    const results = this.transient
      ? frame
          .getHitTestResultsForTransientInput(this.hitTestSrc)
          .flatMap((r) => r.results)
      : frame.getHitTestResults(this.hitTestSrc);

    const hit = results[0];
    if (!hit) return null;

    const pose = hit.getPose(refSpace);
    return pose ? { pose, transient: this.transient } : null;
  }
}

AFRAME.registerComponent("ar-placement", {
  schema: { target: { type: "selector" }, test: { default: true } },

  init() {
    this.renderer = this.el.sceneEl.renderer;
    this.hitTest = null;
    this.userHit = false;

    this.renderer.xr.addEventListener("sessionstart", async () => {
      const session = this.renderer.xr.getSession();
      const viewer = await session.requestReferenceSpace("viewer");
      this.hitTest = new SimpleHitTest(this.renderer, { space: viewer });

      session.addEventListener("select", (e) => {
        if (!this.data.test) return;
        this.userHit = true;
        this.handleSelect(e);
      });
    });

    this.renderer.xr.addEventListener("sessionend", () => {
      this.hitTest = null;
      this.userHit = false;
    });
  },

  tick(time, frame) {
    if (!frame || !this.hitTest || !this.data.test) return;

    const refSpace = this.renderer.xr.getReferenceSpace();
    const hit = this.hitTest.hit(frame, refSpace);
    if (hit) {
      const { pose } = hit;
      this.el.setAttribute("visible", true);
      this.el.setAttribute("position", pose.transform.position);
      this.el.object3D.quaternion.copy(pose.transform.orientation);
    }
  },

  handleSelect({ frame, inputSource }) {
    if (!this.userHit) return;
    const el = this.el;
    const pose = frame.getPose(
      inputSource.targetRaySpace,
      this.renderer.xr.getReferenceSpace()
    );
    if (!pose) return;

    const pos = pose.transform.position;
    const quat = pose.transform.orientation;

    if (this.data.target) {
      this.data.target.setAttribute("position", pos);
      this.data.target.object3D.quaternion.copy(quat);
      this.data.target.setAttribute("visible", true);
    }

    el.setAttribute("visible", false);
    this.data.test = false;
  },
});

AFRAME.registerPrimitive("a-reticle", {
  defaultComponents: { "ar-placement": {} },
  mappings: { target: "ar-placement.target", test: "ar-placement.test" },
});

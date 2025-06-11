AFRAME.registerComponent("hide-in-ar-mode", {
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

AFRAME.registerComponent("occlusion-material", {
  update() {
    // Make this material invisible but still able to occlude
    this.el.components.material.material.colorWrite = false;
  },
});

class HitTest {
  constructor(renderer, options) {
    this.renderer = renderer;
    this.source = null;
    this.transient = !!options.profile;

    renderer.xr.addEventListener("sessionstart", () => this.init(options));
    renderer.xr.addEventListener("sessionend", () => (this.source = null));

    if (renderer.xr.isPresenting) this.init(options);
  }

  async init(options) {
    const session = this.renderer.xr.getSession();
    const refSpace = options.space;

    this.source = refSpace
      ? await session.requestHitTestSource(options)
      : await session.requestHitTestSourceForTransientInput(options);
  }

  doHit(frame) {
    if (!this.source || !this.renderer.xr.isPresenting) return;

    const refSpace = this.renderer.xr.getReferenceSpace();
    const viewerPose = frame.getViewerPose(refSpace);
    if (!viewerPose) return;

    if (this.transient) {
      const result = frame.getHitTestResultsForTransientInput(this.source);
      const pose = result[0]?.results[0]?.getPose(refSpace);
      if (pose) return { pose, inputSpace: result[0].inputSource.targetRaySpace };
    } else {
      const result = frame.getHitTestResults(this.source);
      const pose = result[0]?.getPose(refSpace);
      if (pose) return { pose, inputSpace: options.space };
    }

    return null;
  }
}

const hitTestCache = new Map();

AFRAME.registerComponent("ar-hit-test", {
  schema: {
    target: { type: "selector" },
    doHitTest: { default: true },
  },

  init() {
    const scene = this.el.sceneEl;
    const renderer = scene.renderer;
    this.session = null;
    this.hasHit = false;
    this.hitTest = null;
    this.waitingForSelect = null;

    renderer.xr.addEventListener("sessionstart", async () => {
      this.session = renderer.xr.getSession();
      const viewerSpace = await this.session.requestReferenceSpace("viewer");

      const viewerHit = new HitTest(renderer, { space: viewerSpace });
      const transientHit = new HitTest(renderer, { profile: "generic-touchscreen" });

      this.hitTest = viewerHit;

      this.session.addEventListener("selectstart", (e) => {
        if (!this.data.doHitTest) return;

        const input = e.inputSource;
        this.hitTest = input.profiles[0] === "generic-touchscreen"
          ? transientHit
          : hitTestCache.get(input) || new HitTest(renderer, { space: input.targetRaySpace });

        hitTestCache.set(input, this.hitTest);
        this.el.setAttribute("visible", true);
      });

      this.session.addEventListener("selectend", (e) => {
        if (!this.data.doHitTest) return;

        if (this.hasHit) {
          this.el.setAttribute("visible", false);
          this.hitTest = null;

          if (e.inputSource.profiles[0] === "generic-touchscreen") {
            setTimeout(() => (this.hitTest = viewerHit), 300);
          }

          if (this.data.target) {
            this.data.target.setAttribute("position", this.el.getAttribute("position"));
            this.data.target.object3D.quaternion.copy(this.el.object3D.quaternion);
            this.data.target.setAttribute("visible", true);
          }
        }

        this.waitingForSelect = e.inputSource;
      });
    });

    renderer.xr.addEventListener("sessionend", () => {
      this.hitTest = null;
      this.hasHit = false;
    });
  },

  tick() {
    const frame = this.el.sceneEl.frame;
    if (!frame || !this.data.doHitTest || !this.hitTest) return;

    if (this.waitingForSelect) {
      const input = this.waitingForSelect;
      this.waitingForSelect = null;
      try {
        const pose = frame.getPose(input.targetRaySpace, this.el.sceneEl.renderer.xr.getReferenceSpace());
        this.el.emit("select", { inputSource: input, pose });
      } catch (e) {
        console.warn("Pose error:", e);
      }
    }

    const hit = this.hitTest.doHit(frame);
    if (hit) {
      this.hasHit = true;
      this.el.setAttribute("visible", true);
      this.el.setAttribute("position", hit.pose.transform.position);
      this.el.object3D.quaternion.copy(hit.pose.transform.orientation);
    }
  },
});

AFRAME.registerPrimitive("a-hit-test", {
  defaultComponents: {
    "ar-hit-test": {},
  },
  mappings: {
    target: "ar-hit-test.target",
  },
});

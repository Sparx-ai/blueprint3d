/// <reference path="../../lib/jQuery.d.ts" />
/// <reference path="../../lib/three.d.ts" />
/// <reference path="../core/utils.ts" />
/// <reference path="controller.ts" />
/// <reference path="floorplan.ts" />
/// <reference path="lights.ts" />
/// <reference path="skybox.ts" />
/// <reference path="controls.ts" />
/// <reference path="hud.ts" />

module BP3D.Three {
  export var Main = function (model, element, canvasElement, opts) {
    var scope = this;
    var model = model;
    var scene = new THREE.Scene();
    var renderer;
    var camera;
    var canvas;
    var controller;

    // aliases
    var sceneObj = model.scene.getScene();

    var elementJQ = $(element);
    var domElement;

    // default options
    var defaultOptions = {
      resize: true,
      pushHair: false,
      spin: true,
      spinSpeed: .00002
    };

    // merge options
    var options = defaultOptions;
    if (opts) {
      for (var key in opts) {
        if (opts.hasOwnProperty(key)) {
          options[key] = opts[key];
        }
      }
    }

    // camera params
    var camera_far = 10000;
    var camera_near = 1;

    var controls;
    var hud;
    var floorplan;

    var mouseOver = false;
    var hasClicked = false;

    var haveDrawnOnce = false;

    // scene
    this.heightMargin = null;
    this.widthMargin = null;
    this.elementHeight = null;
    this.elementWidth = null;

    this.itemSelectedCallbacks = $.Callbacks(); //item
    this.itemUnselectedCallbacks = $.Callbacks();

    this.wallClicked = $.Callbacks(); // wall
    this.floorClicked = $.Callbacks(); // floor
    this.nothingClicked = $.Callbacks();

    function init() {
      // Updated for Three.js r100 - TextureLoader replaces ImageUtils
      var textureLoader = new THREE.TextureLoader();
      textureLoader.crossOrigin = "";

      domElement = elementJQ.get(0) // Container
      camera = new THREE.PerspectiveCamera(45, 1, 1, 10000);
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: true // required to support .toDataURL()
      });
      renderer.autoClear = false;
      
      // Color management for proper texture display
      if ((renderer as any).outputEncoding !== undefined) {
        (renderer as any).outputEncoding = (window as any).THREE.sRGBEncoding;
      }
      
      // Enable gamma correction for older Three.js versions
      if ((renderer as any).gammaOutput !== undefined) {
        (renderer as any).gammaOutput = true;
      }
      
      // Updated shadow map properties for Three.js r100
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      var skybox = new Three.Skybox(sceneObj);

      scope.controls = new Three.Controls(camera, domElement);

      hud = new Three.HUD(scope);

      controller = new Three.Controller(
        scope, model, camera, elementJQ, scope.controls, hud);

      domElement.appendChild(renderer.domElement);

      // handle window resizing
      scope.updateWindowSize();
      if (options.resize) {
        $(window).resize(scope.updateWindowSize);
      }

      // setup camera nicely
      scope.centerCamera();
      model.floorplan.fireOnUpdatedRooms(scope.centerCamera);

      var lights = new Three.Lights(sceneObj, model.floorplan);

      floorplan = new Three.Floorplan(sceneObj,
        model.floorplan, scope.controls);

      animate();

      elementJQ.mouseenter(function () {
        mouseOver = true;
      }).mouseleave(function () {
        mouseOver = false;
      }).click(function () {
        hasClicked = true;
      });

      //canvas = new ThreeCanvas(canvasElement, scope);
    }

    function spin() {
      if (options.spin && !mouseOver && !hasClicked) {
        var theta = 2 * Math.PI * options.spinSpeed * (Date.now() - lastRender);
        scope.controls.rotateLeft(theta);
        scope.controls.update()
      }
    }

    this.dataUrl = function () {
      var dataUrl = renderer.domElement.toDataURL("image/png");
      return dataUrl;
    }

    this.stopSpin = function () {
      hasClicked = true;
    }

    this.options = function () {
      return options;
    }

    this.getModel = function () {
      return model;
    }

    this.getScene = function () {
      return sceneObj;
    }

    this.getController = function () {
      return controller;
    }

    this.getCamera = function () {
      return camera;
    }

    this.needsUpdate = function () {
      scope.shouldRender = true;
    }

    function shouldRender() {
      // Do we need a re-draw?
      if (scope.shouldRender || scope.controls.update()) {
        scope.shouldRender = false;
        haveDrawnOnce = true;
        return true;
      } else {
        return false;
      }
    }

    function render() {
      spin();
      if (shouldRender()) {

        renderer.clear();
        renderer.render(sceneObj, camera);

        if (scope.controls.enabled) {
          renderer.clearDepth();
          hud.getScene() && renderer.render(hud.getScene(), camera);
        }
      }
    }

    var lastAnimateTime = 0;
    var targetFPS = 60;
    var frameInterval = 1000 / targetFPS;

    function animate() {
      var now = Date.now();
      var delta = now - lastAnimateTime;
      
      if (delta >= frameInterval) {
        lastRender = now;
        lastAnimateTime = now - (delta % frameInterval);
        render();
      }
      
      requestAnimationFrame(animate);
    }

    this.rotatePressed = function () {
      controller.rotatePressed();
    }

    this.rotateReleased = function () {
      controller.rotateReleased();
    }

    this.setCameraToTopView = function () {
      scope.controls.reset();
      var rotateTo = new THREE.Vector3(0, 1, 0);
      var up = new THREE.Vector3(0, 0, 1);
      scope.controls.setRotationFromTopView(rotateTo, up);
      scope.controls.update();
    }

    this.centerCamera = function () {
      var yOffset = 150;
      var pan = model.floorplan.getCenter();
      pan.y = yOffset;

      scope.controls.target.copy(pan);
      var distance = model.floorplan.getSize().z * 1.5;

      var offset = pan.clone().add(
        new THREE.Vector3(0, distance, distance));
      //scope.controls.setOffset(offset);
      camera.position.copy(offset);

      scope.controls.update();
    }

    // projects the object's center point into x,y screen coords
    // x,y are relative to top left corner of viewer
    this.projectVector = function (vec3, ignoreMargin) {
      ignoreMargin = ignoreMargin || false;

      var widthHalf = scope.elementWidth / 2;
      var heightHalf = scope.elementHeight / 2;

      var vector = new THREE.Vector3();
      vector.copy(vec3);
      vector.project(camera);

      var vec2 = new THREE.Vector2();

      vec2.x = (vector.x * widthHalf) + widthHalf;
      vec2.y = -(vector.y * heightHalf) + heightHalf;

      if (!ignoreMargin) {
        vec2.x += scope.widthMargin;
        vec2.y += scope.heightMargin;
      }

      return vec2;
    }

    this.updateWindowSize = function () {
      scope.heightMargin = elementJQ.offset().top;
      scope.widthMargin = elementJQ.offset().left;

      // For absolute positioned container, use the main column dimensions
      var parent = elementJQ.parent();
      var parentWidth = parent.innerWidth();
      var parentHeight = parent.innerHeight();
      
      // Fallback to window dimensions if parent is not sized
      scope.elementWidth = parentWidth > 0 ? parentWidth : window.innerWidth * 0.75; // 75% for col-xs-9
      scope.elementHeight = parentHeight > 0 ? parentHeight : window.innerHeight;

      camera.aspect = scope.elementWidth / scope.elementHeight;
      camera.updateProjectionMatrix();

      renderer.setSize(scope.elementWidth, scope.elementHeight);
      scope.needsUpdate();
    }

    // private vars
    var lastRender = Date.now();

    init();
  }
}
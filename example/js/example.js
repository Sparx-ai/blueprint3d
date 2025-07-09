function convertStructureToBlueprint(rooms, mergeThreshold = 0.1) {
  const coordToUUID = {};  // "x,y" => UUID
  const uuidToCoord = {};  // UUID => { x, y }
  const wallSet = new Set();
  const wallsOutput = [];
  const itemsOutput = [];

  console.log("File updated - timestamp: " + new Date());
  
  function round(n) {
    return parseFloat(n.toFixed(3));
  }

  function getCoordKey(x, y) {
    return `${round(x)},${round(y)}`;
  }

  function findNearbyUUID(x, y) {
    for (const [key, uuid] of Object.entries(coordToUUID)) {
      const [cx, cy] = key.split(',').map(Number);
      if (Math.abs(cx - x) < mergeThreshold && Math.abs(cy - y) < mergeThreshold) {
        return uuid;
      }
    }
    return null;
  }

  function processVertex(vertex) {
    const x = round(vertex.x);
    const y = round(vertex.y);
    const key = getCoordKey(x, y);
    let uuid = findNearbyUUID(x, y);
    if (!uuid) {
      uuid = crypto.randomUUID();
      coordToUUID[key] = uuid;
      uuidToCoord[uuid] = { x, y };
    }
    return uuid;
  }
  
  // Process room boundaries as walls
  for (const room of rooms) {
    for (const boundary of room.boundaries) {
      // Scale vertices around center (preserves room position)
      const scaledVertex1 = boundary.vertex1
      const scaledVertex2 = boundary.vertex2

      const uuid1 = processVertex(scaledVertex1);
      const uuid2 = processVertex(scaledVertex2);
      if (uuid1 === uuid2) continue;

      const wallKey = [uuid1, uuid2].sort().join('|');
      if (wallSet.has(wallKey)) continue;

      // Calculate wall length
      const coord1 = uuidToCoord[uuid1];
      const coord2 = uuidToCoord[uuid2];
      const length = Math.sqrt(
        Math.pow(coord2.x - coord1.x, 2) + 
        Math.pow(coord2.y - coord1.y, 2)
      );
      console.log(`Wall length (${uuid1} to ${uuid2}): ${round(length)} cm`);

      wallSet.add(wallKey);
      wallsOutput.push({ 
        corner1: uuid1, 
        corner2: uuid2,
        height: 275, // hard coded height
        length: round(length) // Add calculated length in cm
      });
    }
  }

  // === FINAL CORNER FILTERING ===
  const usedCorners = new Set();
  for (const wall of wallsOutput) {
    usedCorners.add(wall.corner1);
    usedCorners.add(wall.corner2);
  }

  const filteredCorners = {};
  for (const uuid of usedCorners) {
    filteredCorners[uuid] = uuidToCoord[uuid];
  }

  return {
    floorplan: {
      corners: filteredCorners,
      walls: wallsOutput
    },
    items: itemsOutput
  };
}
/*
 * Camera Buttons
 */

async function generatePresignedUrl(objKey) {
  const response = await fetch(`https://api.sparx.ai/api/resource/${objKey}`, {
    headers: {
      Authorization: 'xZRuBuykeDuRRei0lw0Oe5WJOXbwuRQK'
    }
  })
  const data = await response.text()
  return data
}


var CameraButtons = function (blueprint3d) {

  var orbitControls = blueprint3d.three.controls;
  var three = blueprint3d.three;

  var panSpeed = 30;
  var directions = {
    UP: 1,
    DOWN: 2,
    LEFT: 3,
    RIGHT: 4
  }

  function init() {
    // Camera controls
    $("#zoom-in").click(zoomIn);
    $("#zoom-out").click(zoomOut);
    $("#zoom-in").dblclick(preventDefault);
    $("#zoom-out").dblclick(preventDefault);

    $("#reset-view").click(three.centerCamera)

    $("#move-left").click(function () {
      pan(directions.LEFT)
    })
    $("#move-right").click(function () {
      pan(directions.RIGHT)
    })
    $("#move-up").click(function () {
      pan(directions.UP)
    })
    $("#move-down").click(function () {
      pan(directions.DOWN)
    })

    $("#move-left").dblclick(preventDefault);
    $("#move-right").dblclick(preventDefault);
    $("#move-up").dblclick(preventDefault);
    $("#move-down").dblclick(preventDefault);
  }

  function preventDefault(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function pan(direction) {
    switch (direction) {
      case directions.UP:
        orbitControls.panXY(0, panSpeed);
        break;
      case directions.DOWN:
        orbitControls.panXY(0, -panSpeed);
        break;
      case directions.LEFT:
        orbitControls.panXY(panSpeed, 0);
        break;
      case directions.RIGHT:
        orbitControls.panXY(-panSpeed, 0);
        break;
    }
  }

  function zoomIn(e) {
    e.preventDefault();
    orbitControls.dollyIn(1.1);
    orbitControls.update();
  }

  function zoomOut(e) {
    e.preventDefault;
    orbitControls.dollyOut(1.1);
    orbitControls.update();
  }

  init();
}

/*
 * Context menu for selected item
 */

var ContextMenu = function (blueprint3d) {

  var scope = this;
  var selectedItem;
  var three = blueprint3d.three;

  function init() {
    $("#context-menu-delete").click(function (event) {
      selectedItem.remove();
    });

    three.itemSelectedCallbacks.add(itemSelected);
    three.itemUnselectedCallbacks.add(itemUnselected);

    initResize();

    $("#fixed").click(function () {
      var checked = $(this).prop('checked');
      selectedItem.setFixed(checked);
    });
  }

  function cmToIn(cm) {
    return cm / 2.54;
  }

  function inToCm(inches) {
    return inches * 2.54;
  }

  function itemSelected(item) {
    selectedItem = item;

    $("#context-menu-name").text(item.metadata.itemName);

    $("#item-width").val(cmToIn(selectedItem.getWidth()).toFixed(0));
    $("#item-height").val(cmToIn(selectedItem.getHeight()).toFixed(0));
    $("#item-depth").val(cmToIn(selectedItem.getDepth()).toFixed(0));

    $("#context-menu").show();

    $("#fixed").prop('checked', item.fixed);
  }

  function resize() {
    selectedItem.resize(
      inToCm($("#item-height").val()),
      inToCm($("#item-width").val()),
      inToCm($("#item-depth").val())
    );
  }

  function initResize() {
    $("#item-height").change(resize);
    $("#item-width").change(resize);
    $("#item-depth").change(resize);
  }

  function itemUnselected() {
    selectedItem = null;
    $("#context-menu").hide();
  }

  init();
}

/*
 * Loading modal for items
 */

var ModalEffects = function (blueprint3d) {

  var scope = this;
  var blueprint3d = blueprint3d;
  var itemsLoading = 0;

  this.setActiveItem = function (active) {
    itemSelected = active;
    update();
  }

  function update() {
    if (itemsLoading > 0) {
      $("#loading-modal").show();
    } else {
      $("#loading-modal").hide();
    }
  }

  function init() {
    blueprint3d.model.scene.itemLoadingCallbacks.add(function () {
      itemsLoading += 1;
      update();
    });

    blueprint3d.model.scene.itemLoadedCallbacks.add(function () {
      itemsLoading -= 1;
      update();
    });

    update();
  }

  init();
}

/*
 * Side menu
 */

var SideMenu = function (blueprint3d, floorplanControls, modalEffects) {
  var blueprint3d = blueprint3d;
  var floorplanControls = floorplanControls;
  var modalEffects = modalEffects;

  var ACTIVE_CLASS = "active";

  var tabs = {
    "FLOORPLAN": $("#floorplan_tab"),
    "SHOP": $("#items_tab"),
    "DESIGN": $("#design_tab")
  }

  var scope = this;
  this.stateChangeCallbacks = $.Callbacks();

  this.states = {
    "DEFAULT": {
      "div": $("#viewer"),
      "tab": tabs.DESIGN
    },
    "FLOORPLAN": {
      "div": $("#floorplanner"),
      "tab": tabs.FLOORPLAN
    },
    "SHOP": {
      "div": $("#add-items"),
      "tab": tabs.SHOP
    }
  }

  // sidebar state
  var currentState = scope.states.FLOORPLAN;

  function init() {
    for (var tab in tabs) {
      var elem = tabs[tab];
      elem.click(tabClicked(elem));
    }

    $("#update-floorplan").click(floorplanUpdate);

    initLeftMenu();

    blueprint3d.three.updateWindowSize();
    handleWindowResize();

    initItems();

    setCurrentState(scope.states.DEFAULT);
  }

  function floorplanUpdate() {
    setCurrentState(scope.states.DEFAULT);
  }

  function tabClicked(tab) {
    return function () {
      // Stop three from spinning
      blueprint3d.three.stopSpin();

      // Selected a new tab
      for (var key in scope.states) {
        var state = scope.states[key];
        if (state.tab == tab) {
          setCurrentState(state);
          break;
        }
      }
    }
  }

  function setCurrentState(newState) {

    if (currentState == newState) {
      return;
    }

    // show the right tab as active
    if (currentState.tab !== newState.tab) {
      if (currentState.tab != null) {
        currentState.tab.removeClass(ACTIVE_CLASS);
      }
      if (newState.tab != null) {
        newState.tab.addClass(ACTIVE_CLASS);
      }
    }

    // set item unselected
    blueprint3d.three.getController().setSelectedObject(null);

    // show and hide the right divs
    currentState.div.hide()
    newState.div.show()

    // custom actions
    if (newState == scope.states.FLOORPLAN) {
      floorplanControls.updateFloorplanView();
      floorplanControls.handleWindowResize();
    }

    if (currentState == scope.states.FLOORPLAN) {
      blueprint3d.model.floorplan.update();
    }

    if (newState == scope.states.DEFAULT) {
      // Small delay to ensure DOM updates visibility first
      setTimeout(function () {
        blueprint3d.three.updateWindowSize();
        // Force canvas to fill the container
        var canvas = $("#viewer canvas");
        if (canvas.length > 0) {
          var parent = $("#viewer");
          canvas.attr('width', parent.width());
          canvas.attr('height', parent.height());
          canvas.css({
            'width': '100%',
            'height': '100%'
          });
        }
      }, 10);
    }

    // set new state
    handleWindowResize();
    currentState = newState;

    scope.stateChangeCallbacks.fire(newState);
  }

  function initLeftMenu() {
    $(window).resize(handleWindowResize);
    handleWindowResize();
  }

  function handleWindowResize() {
    $(".sidebar").height(window.innerHeight);
    $("#add-items").height(window.innerHeight);

    // Update 3D viewer size if it's the current state
    if (currentState == scope.states.DEFAULT) {
      setTimeout(function () {
        blueprint3d.three.updateWindowSize();
      }, 10);
    }
  };

  // TODO: this doesn't really belong here
  function initItems() {
    $("#add-items").find(".add-item").mousedown(function (e) {
      var modelUrl = $(this).attr("model-url");
      var itemType = parseInt($(this).attr("model-type"));
      var metadata = {
        itemName: $(this).attr("model-name"),
        resizable: true,
        modelUrl: modelUrl,
        itemType: itemType
      }

      blueprint3d.model.scene.addItem(itemType, modelUrl, metadata);
      setCurrentState(scope.states.DEFAULT);
    });
  }

  init();

}

/*
 * Change floor and wall textures
 */

var TextureSelector = function (blueprint3d, sideMenu) {

  var scope = this;
  var three = blueprint3d.three;
  var isAdmin = isAdmin;

  var currentTarget = null;

  function initTextureSelectors() {
    $(".texture-select-thumbnail").click(function (e) {
      var textureUrl = $(this).attr("texture-url");
      var textureStretch = ($(this).attr("texture-stretch") == "true");
      var textureScale = parseInt($(this).attr("texture-scale"));
      currentTarget.setTexture(textureUrl, textureStretch, textureScale);

      e.preventDefault();
    });
  }

  function init() {
    three.wallClicked.add(wallClicked);
    three.floorClicked.add(floorClicked);
    three.itemSelectedCallbacks.add(reset);
    three.nothingClicked.add(reset);
    sideMenu.stateChangeCallbacks.add(reset);
    initTextureSelectors();
  }

  function wallClicked(halfEdge) {
    currentTarget = halfEdge;
    $("#floorTexturesDiv").hide();
    $("#wallTextures").show();
  }

  function floorClicked(room) {
    currentTarget = room;
    $("#wallTextures").hide();
    $("#floorTexturesDiv").show();
  }

  function reset() {
    $("#wallTextures").hide();
    $("#floorTexturesDiv").hide();
  }

  init();
}

/*
 * Floorplanner controls
 */

var ViewerFloorplanner = function (blueprint3d) {

  var canvasWrapper = '#floorplanner';

  // buttons
  var move = '#move';
  var remove = '#delete';
  var draw = '#draw';

  var activeStlye = 'btn-primary disabled';

  this.floorplanner = blueprint3d.floorplanner;

  var scope = this;

  function init() {

    $(window).resize(scope.handleWindowResize);
    scope.handleWindowResize();

    // mode buttons
    scope.floorplanner.modeResetCallbacks.add(function (mode) {
      $(draw).removeClass(activeStlye);
      $(remove).removeClass(activeStlye);
      $(move).removeClass(activeStlye);
      if (mode == BP3D.Floorplanner.floorplannerModes.MOVE) {
        $(move).addClass(activeStlye);
      } else if (mode == BP3D.Floorplanner.floorplannerModes.DRAW) {
        $(draw).addClass(activeStlye);
      } else if (mode == BP3D.Floorplanner.floorplannerModes.DELETE) {
        $(remove).addClass(activeStlye);
      }

      if (mode == BP3D.Floorplanner.floorplannerModes.DRAW) {
        $("#draw-walls-hint").show();
        scope.handleWindowResize();
      } else {
        $("#draw-walls-hint").hide();
      }
    });

    $(move).click(function () {
      scope.floorplanner.setMode(BP3D.Floorplanner.floorplannerModes.MOVE);
    });

    $(draw).click(function () {
      scope.floorplanner.setMode(BP3D.Floorplanner.floorplannerModes.DRAW);
    });

    $(remove).click(function () {
      scope.floorplanner.setMode(BP3D.Floorplanner.floorplannerModes.DELETE);
    });
  }

  this.updateFloorplanView = function () {
    scope.floorplanner.reset();
  }

  this.handleWindowResize = function () {
    $(canvasWrapper).height(window.innerHeight - $(canvasWrapper).offset().top);
    scope.floorplanner.resizeView();
  };

  init();
};

var mainControls = function (blueprint3d) {
  var blueprint3d = blueprint3d;

  function newDesign() {
    blueprint3d.model.loadSerialized('{"floorplan":{"corners":{"f90da5e3-9e0e-eba7-173d-eb0b071e838e":{"x":204.85099999999989,"y":289.052},"da026c08-d76a-a944-8e7b-096b752da9ed":{"x":672.2109999999999,"y":289.052},"4e3d65cb-54c0-0681-28bf-bddcc7bdb571":{"x":672.2109999999999,"y":-178.308},"71d4f128-ae80-3d58-9bd2-711c6ce6cdf2":{"x":204.85099999999989,"y":-178.308}},"walls":[{"corner1":"71d4f128-ae80-3d58-9bd2-711c6ce6cdf2","corner2":"f90da5e3-9e0e-eba7-173d-eb0b071e838e","frontTexture":{"url":"rooms/textures/wallmap.png","stretch":true,"scale":0},"backTexture":{"url":"rooms/textures/wallmap.png","stretch":true,"scale":0}},{"corner1":"f90da5e3-9e0e-eba7-173d-eb0b071e838e","corner2":"da026c08-d76a-a944-8e7b-096b752da9ed","frontTexture":{"url":"rooms/textures/wallmap.png","stretch":true,"scale":0},"backTexture":{"url":"rooms/textures/wallmap.png","stretch":true,"scale":0}},{"corner1":"da026c08-d76a-a944-8e7b-096b752da9ed","corner2":"4e3d65cb-54c0-0681-28bf-bddcc7bdb571","frontTexture":{"url":"rooms/textures/wallmap.png","stretch":true,"scale":0},"backTexture":{"url":"rooms/textures/wallmap.png","stretch":true,"scale":0}},{"corner1":"4e3d65cb-54c0-0681-28bf-bddcc7bdb571","corner2":"71d4f128-ae80-3d58-9bd2-711c6ce6cdf2","frontTexture":{"url":"rooms/textures/wallmap.png","stretch":true,"scale":0},"backTexture":{"url":"rooms/textures/wallmap.png","stretch":true,"scale":0}}],"wallTextures":[],"floorTextures":{},"newFloorTextures":{}},"items":[]}');
  }

  function loadDesign() {
    files = $("#loadFile").get(0).files;
    var reader = new FileReader();
    reader.onload = function (event) {
      var data = event.target.result;
      blueprint3d.model.loadSerialized(data);
    }
    reader.readAsText(files[0]);
  }

  function saveDesign() {
    var data = blueprint3d.model.exportSerialized();
    var a = window.document.createElement('a');
    var blob = new Blob([data], { type: 'text' });
    a.href = window.URL.createObjectURL(blob);
    a.download = 'design.blueprint3d';
    document.body.appendChild(a)
    a.click();
    document.body.removeChild(a)
  }

  function init() {
    $("#new").click(newDesign);
    $("#loadFile").change(loadDesign);
    $("#saveFile").click(saveDesign);
  }

  init();
}

/*
 * Initialize!
 */

$(document).ready(function () {

  // main setup
  var opts = {
    floorplannerElement: 'floorplanner-canvas',
    threeElement: '#viewer',
    threeCanvasElement: 'three-canvas',
    textureDir: "models/textures/",
    widget: false
  }
  var blueprint3d = new BP3D.Blueprint3d(opts);

  var modalEffects = new ModalEffects(blueprint3d);
  var viewerFloorplanner = new ViewerFloorplanner(blueprint3d);
  var contextMenu = new ContextMenu(blueprint3d);
  var sideMenu = new SideMenu(blueprint3d, viewerFloorplanner, modalEffects);
  var textureSelector = new TextureSelector(blueprint3d, sideMenu);
  var cameraButtons = new CameraButtons(blueprint3d);
  mainControls(blueprint3d);

  // Load sample floorplan from JSON file
  fetch('/data/sample.json')
    .then(response => response.json())
    .then(data => {
      blueprint3d.model.loadSerialized(JSON.stringify(convertStructureToBlueprint(data)));
    })
    .catch(error => {
      console.error('Error loading sample floorplan:', error);
    });

  // Load the GLB model using the REAL Three.js r100 GLTFLoader
  setTimeout(function () {
    console.log('Loading LOCAL GLB model with Three.js r100...');
    
    // Test with a local GLB file to avoid CORS issues
    // loadLocalGLBModel();
    
    // DISABLED: External GLB loading to avoid CORS errors in development
    loadExternalGLBModels();
  }, 1000); // Wait for scene initialization

  // Function to load local GLB models (no CORS issues)
  function loadLocalGLBModel() {
    console.log('THREE.GLTFLoader available:', typeof THREE.GLTFLoader !== 'undefined');

    if (typeof THREE.GLTFLoader === 'undefined') {
      console.error('GLTFLoader not found! Make sure GLTFLoader.js is loaded.');
      return;
    }

    var loader = new THREE.GLTFLoader();
    
    // Load a local GLB file (you can change this path)
    const localGLBPath = '/glb/new_models_wayfair_glb_arena_table_lamp.glb'; // Example local file
    
    loader.load(localGLBPath, function (gltf) {
      console.log('LOCAL GLB model loaded successfully!', gltf);

      var model = gltf.scene;

      // Debug: Check the actual model contents
      console.log('Model children count:', model.children.length);
      console.log('Model visible:', model.visible);

      // Enhanced texture and material handling for GLB models
      model.traverse(function (child) {
        if (child.isMesh) {
          console.log('Processing mesh:', child.name, child.material);
          
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(material => {
                fixMaterialTextures(material);
              });
            } else {
              fixMaterialTextures(child.material);
            }
          }
          
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      // Function to fix material textures and encoding
      function fixMaterialTextures(material) {
        if (!material) return;
        
        if (material.map) {
          material.map.encoding = THREE.sRGBEncoding;
          material.map.flipY = false;
        }
        
        if (material.emissiveMap) {
          material.emissiveMap.encoding = THREE.sRGBEncoding;
          material.emissiveMap.flipY = false;
        }
        
        if (material.normalMap) {
          material.normalMap.encoding = THREE.LinearEncoding;
          material.normalMap.flipY = false;
        }
        
        if (material.roughnessMap) {
          material.roughnessMap.encoding = THREE.LinearEncoding;
          material.roughnessMap.flipY = false;
        }
        
        if (material.metalnessMap) {
          material.metalnessMap.encoding = THREE.LinearEncoding;
          material.metalnessMap.flipY = false;
        }
        
        if (material.aoMap) {
          material.aoMap.encoding = THREE.LinearEncoding;
          material.aoMap.flipY = false;
        }
        
        material.needsUpdate = true;
        console.log('Fixed material textures for:', material.name || 'unnamed material');
      }

      // Position the model in the scene
      // model.position.set(0, 0, 50); // Adjust position as needed
      // model.scale.set(10, 10, 10);  // Scale up if too small
      model.visible = true;

      // Add to the blueprint3d scene
      console.log('Adding LOCAL GLB model to blueprint3d.model.scene...');
      blueprint3d.model.scene.add(model);

      console.log('LOCAL GLB model loaded and positioned at:', model.position);
      console.log('Scene now contains local GLB geometry - no CORS errors!');

    }, function (progress) {
      console.log('Loading progress:', (progress.loaded / progress.total * 100) + '%');
    }, function (error) {
      console.error('Error loading LOCAL GLB model:', error);
    });
  }

  function positionModel(model, component, name, roomCenter) {
      // 🎯 COORDINATE SYSTEM CONVERSION
      // Component coordinates → Three.js coordinates
      // component.x → Three.js X (right)
      // component.y → Three.js Z (forward/back) 
      // component.z → Three.js Y (up)
      
      const origin = new THREE.Vector3(
        component.origin.x, 
        component.origin.z, 
        component.origin.y
      );

      const topPoint = new THREE.Vector3(
        component.top.x, 
        component.top.z, 
        component.top.y
      );
      
      const frontPoint = new THREE.Vector3(
        component.front.x, 
        component.front.z, 
        component.front.y
      );

      // 🎯 CORRECT VECTOR CALCULATION
      // Calculate direction vectors
      const upVec = new THREE.Vector3().subVectors(topPoint, origin).normalize();
      const forwardVec = new THREE.Vector3().subVectors(frontPoint, origin).normalize();
      
      // Calculate right vector (cross product: forward × up = right)
      const rightVec = new THREE.Vector3().crossVectors(forwardVec, upVec).normalize();
      
      // Recalculate forward to ensure orthogonality (up × right = forward)
      const correctedForwardVec = new THREE.Vector3().crossVectors(upVec, rightVec).normalize();

      // 🎯 THREE.JS ROTATION MATRIX
      // Three.js expects: X=right, Y=up, Z=forward
      const rotMatrix = new THREE.Matrix4().makeBasis(rightVec, upVec, correctedForwardVec);
      const quaternion = new THREE.Quaternion().setFromRotationMatrix(rotMatrix);

      // 🎯 CENTER-PRESERVING MODEL POSITIONING
      // Apply the same scaling transformation as room boundaries
      
      console.log(`📍 Model positioning for ${name}:`, {
        originalPos: {x: component.origin.x.toFixed(1), y: component.origin.y.toFixed(1), z: component.origin.z.toFixed(1)},
        scaledPos: {x: origin.x.toFixed(1), y: origin.y.toFixed(1), z: origin.z.toFixed(1)},
        roomCenter: roomCenter
      });
      
      // Set position and rotation
      model.position.copy(origin);
      model.quaternion.copy(quaternion);
      
      // Debug: Log rotation vectors
      console.log(`🧭 Rotation vectors for ${name}:`, {
        right: {x: rightVec.x.toFixed(3), y: rightVec.y.toFixed(3), z: rightVec.z.toFixed(3)},
        up: {x: upVec.x.toFixed(3), y: upVec.y.toFixed(3), z: upVec.z.toFixed(3)},
        forward: {x: correctedForwardVec.x.toFixed(3), y: correctedForwardVec.y.toFixed(3), z: correctedForwardVec.z.toFixed(3)}
      });
      
      // Log model size
      const box = new THREE.Box3().setFromObject(model);
      const size2 = box.getSize(new THREE.Vector3());
      console.log('Model size:', {
        name: name || 'unnamed model',
        width: size2.z.toFixed(2),
        height: size2.x.toFixed(2), 
        depth: size2.y.toFixed(2)
      });
      // Log component details
      console.log('Component details:', {
        origin: component.origin,
        top: component.top,
        front: component.front,
        scale: component.scale || { x: 1, y: 1, z: 1 }
      });
      // Apply component scale factor
      // const componentScale = component.scale || { x: 1, y: 1, z: 1 };
    
      model.scale.set(component.scale.x, component.scale.y, component.scale.z);
      
      // Get final size after scaling  
      const scaledBox = new THREE.Box3().setFromObject(model);
      const finalSize = scaledBox.getSize(new THREE.Vector3());
      
      console.log('📊 BACKEND SCALING (CONSISTENT WITH ROOM SCALING):', {
        assetId: component.sparxAssetId,
        originalSize_cm: {x: size2.x.toFixed(1), y: size2.y.toFixed(1), z: size2.z.toFixed(1)},
        componentScale: component.scale,
        finalScale: {x: component.scale.x.toFixed(6), y: component.scale.y.toFixed(6), z: component.scale.z.toFixed(6)},
        finalSize_cm: {x: (finalSize.x).toFixed(1), y: (finalSize.y).toFixed(1), z: (finalSize.z).toFixed(1)}
      });
  }

  // Function to load external GLB models (currently disabled due to CORS)
  function loadExternalGLBModels() {
    // console.log('THREE.GLTFLoader available:', typeof THREE.GLTFLoader !== 'undefined');

    // if (typeof THREE.GLTFLoader === 'undefined') {
    //   console.error('GLTFLoader not found! Make sure GLTFLoader.js is loaded.');
    //   return;
    // }
    var loader = new THREE.GLTFLoader();

    fetch('/data/specific.json')
      .then(response => response.json())
      .then(data => {
        console.log('Designs data loaded:', data);
        console.log('Number of design layouts:', data.data.design_layouts.length);

        console.log('Extracting components from design data...');
        const components = data.data.design_layouts[0].room_designs.map(d => d.design_components).flat().filter(c => c.sparxCategory === 'Asset')
        console.log('Found components:', components.length);
        console.log('Component details:', components);

        // 🎯 CALCULATE ROOM CENTER FROM COMPONENT POSITIONS
        // Use component positions to estimate the room center for consistent scaling
        const componentCenter = {
          x: components.reduce((sum, c) => sum + c.origin.x, 0) / components.length,
          y: components.reduce((sum, c) => sum + c.origin.y, 0) / components.length
        };
        console.log(`📐 Estimated room center from components: (${componentCenter.x.toFixed(1)}, ${componentCenter.y.toFixed(1)})`);

        for (const component of components) {
          console.log('Processing component:', component.sparxAssetId);
          console.log('Component full details:', component);
          
          const assets = component.assets
          console.log('Assets:', assets);
          const key = assets[0].models[0].high_res_model_path
          console.log('Key:', key);
          const filename = '/glb/' + key.split('/').pop() + '.glb'  // Yes, .pop() gets 'ccc' from 'aaa/bbb/ccc'
          console.log('Generated filename:', filename);

          loader.load(filename, function (gltf) {
            console.log('LOCAL GLB model loaded successfully!', gltf);
      
            var model = gltf.scene;
            positionModel(model, component, key, componentCenter);
            // Debug: Check the actual model contents
            console.log('Model children count:', model.children.length);
            console.log('Model visible:', model.visible);
      
            // Position the model in the scene
            // model.position.set(0, 0, 50); // Adjust position as needed
            // model.scale.set(10, 10, 10);  // Scale up if too small
            // model.visible = true;
      
            // Add to the blueprint3d scene
            console.log('Adding LOCAL GLB model to blueprint3d.model.scene...');
            blueprint3d.model.scene.add(model);
      
            console.log('LOCAL GLB model loaded and positioned at:', model.position);
            console.log('Scene now contains local GLB geometry - no CORS errors!');
      
          }, function (progress) {
            console.log('Loading progress:', (progress.loaded / progress.total * 100) + '%');
          }, function (error) {
            console.error('Error loading LOCAL GLB model:', error);
          });
        }
      })
      .catch(error => {
        console.error('Error loading designs:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      });
  }
});

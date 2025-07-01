## See it

This repository includes an example application built using blueprint3d:

### http://furnishup.github.io/blueprint3d/example/

## What is this?

This is a customizable application built on three.js that allows users to design an interior space such as a home or apartment. Below are screenshots from our Example App (link above). 

1) Create 2D floorplan:

![floorplan](https://s3.amazonaws.com/furnishup/floorplan.png)

2) Add items:

![add_items](https://s3.amazonaws.com/furnishup/add_items.png)

3) Design in 3D:

![3d_design](https://s3.amazonaws.com/furnishup/design.png)

## GLB Model Texture Fixes

This repository has been updated to properly handle textures in GLB models. The following improvements have been implemented:

### Issues Fixed
- GLB models were loading without textures due to improper texture encoding
- Material configurations were not optimized for PBR workflow
- Color space management was missing from the renderer setup

### Technical Improvements

#### 1. Enhanced GLTFLoader Configuration
- Added proper texture encoding handling for different texture types:
  - **Color textures** (diffuse, emissive): Set to `THREE.sRGBEncoding`
  - **Data textures** (normal, roughness, metalness, AO): Set to `THREE.LinearEncoding`
- Disabled Y-axis flipping for GLB textures (`flipY = false`)
- Added material update triggers (`needsUpdate = true`)

#### 2. Material Processing Pipeline
Both the main application (`example/js/example.js`) and the Blueprint3D core (`src/model/scene.ts`) now include:
- Automatic traversal of loaded GLTF scenes to process all meshes
- Material array handling for multi-material objects
- Proper shadow casting and receiving configuration

#### 3. Renderer Color Management
- Added sRGB output encoding to the WebGL renderer
- Implemented gamma correction for older Three.js versions
- Ensures proper linear workflow for PBR materials

### Code Examples

#### Texture Encoding Fix Function
```javascript
function fixMaterialTextures(material) {
  if (!material) return;
  
  // Color textures use sRGB encoding
  if (material.map) {
    material.map.encoding = THREE.sRGBEncoding;
    material.map.flipY = false;
  }
  
  if (material.emissiveMap) {
    material.emissiveMap.encoding = THREE.sRGBEncoding;
    material.emissiveMap.flipY = false;
  }
  
  // Data textures use linear encoding
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
  
  material.needsUpdate = true;
}
```

#### Usage in GLTFLoader Callback
```javascript
loader.load(url, function (gltf) {
  gltf.scene.traverse(function (child) {
    if (child.isMesh && child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach(mat => fixMaterialTextures(mat));
      } else {
        fixMaterialTextures(child.material);
      }
    }
  });
  
  // Add to scene...
});
```

### Best Practices for GLB Models

1. **Texture Formats**: Ensure GLB files embed textures properly or use external textures with correct CORS headers
2. **Color Space**: Use sRGB for color textures and linear for data textures
3. **Material Validation**: Always check material properties exist before accessing them
4. **Renderer Setup**: Configure output encoding for proper color management

### Compatibility Notes
- Works with Three.js r69-r100+
- Backward compatible with existing models
- Automatic fallback for missing texture properties
- Console logging for debugging material processing

This fix ensures that GLB models display with their intended textures and materials, providing a proper PBR (Physically Based Rendering) workflow.

## Developing and Running Locally

To get started, clone the repository and ensure you npm >= 3 and grunt installed, then run:

    npm install
    grunt

The latter command generates `example/js/blueprint3d.js` from `src`.

The easiest way to run locally is to run a local server from the `example` directory. There are plenty of options. One uses Python's built in webserver:

    cd example

    # Python 2.x
    python -m SimpleHTTPServer

    # Python 3.x
    python -m http.server

Then, visit `http://localhost:8000` in your browser.

## Contribute!

This project requires a lot more work. In general, it was rushed through various prototype stages, and never refactored as much as it probably should be. We need your help!

Please contact us if you are interested in contributing.

### Todos

- More complete documentation (based on the TypeDoc comments)
- Test suite (e.g. jasmine)
- Make it easier to build a complete application using blueprint3d (cleaner API, more inclusive base, easier integration with a backend)
- Better serialization format for saving/loading "designs"
- Remove the dependency on jquery from the core source!
- Better use of npm conventions and packaging
- Various bug fixes
- refactor three/* - use of classes, lambdas
- update to current threejs
- introduce a more formal persistency format
- put all relevant settings into Core.Configuration to make them read-/writeable, User settings?
- complete type docs for all entities
- there're a few TODO_Ekki's left, kill them all

## Directory Structure

### `src/` Directory

The `src` directory contains the core of the project. Here is a description of the various sub-directories:

`core` - Basic utilities such as logging and generic functions

`floorplanner` - 2D view/controller for editing the floorplan

`items` - Various types of items that can go in rooms

`model` - Data model representing both the 2D floorplan and all of the items in it

`three` - 3D view/controller for viewing and modifying item placement


### `example/` Directory

The example directory contains an application built using the core blueprint3d javascript building blocks. It adds html, css, models, textures, and more javascript to tie everything together.

## License

This project is open-source! See LICENSE.txt for more information.

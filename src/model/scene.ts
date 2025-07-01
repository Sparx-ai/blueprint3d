/// <reference path="../../lib/three.d.ts" />
/// <reference path="../../lib/jQuery.d.ts" />
/// <reference path="../core/utils.ts" />
/// <reference path="../items/factory.ts" />

module BP3D.Model {
  /**
   * The Scene is a manager of Items and also links to a ThreeJS scene.
   */
  export class Scene {

    /** The associated ThreeJS scene. */
    private scene: THREE.Scene;

    /** */
    private items: Items.Item[] = [];

    /** */
    public needsUpdate = false;

    /** The GLTF loader (updated for r100). */
    private loader: any; // THREE.GLTFLoader type not available in r69 definitions

    /** */
    private itemLoadingCallbacks = $.Callbacks();

    /** Item */
    private itemLoadedCallbacks = $.Callbacks();

    /** Item */
    private itemRemovedCallbacks = $.Callbacks();

    /**
     * Constructs a scene.
     * @param model The associated model.
     * @param textureDir The directory from which to load the textures.
     */
    constructor(private model: Model, private textureDir: string) {
      this.scene = new THREE.Scene();

      // init item loader - use GLTFLoader for modern Three.js
      if ((window as any).THREE && (window as any).THREE.GLTFLoader) {
        this.loader = new (window as any).THREE.GLTFLoader();
      } else {
        console.warn("GLTFLoader not available, item loading may not work");
      }
    }

    /** Adds a non-item, basically a mesh, to the scene.
     * @param mesh The mesh to be added.
     */
    public add(mesh: THREE.Object3D) {
      this.scene.add(mesh);
    }

    /** Removes a non-item, basically a mesh, from the scene.
     * @param mesh The mesh to be removed.
     */
    public remove(mesh: THREE.Object3D) {
      this.scene.remove(mesh);
      Core.Utils.removeValue(this.items, mesh);
    }

    /** Gets the scene.
     * @returns The scene.
     */
    public getScene(): THREE.Scene {
      return this.scene;
    }

    /** Gets the items.
     * @returns The items.
     */
    public getItems(): Items.Item[] {
      return this.items;
    }

    /** Gets the count of items.
     * @returns The count.
     */
    public itemCount(): number {
      return this.items.length
    }

    /** Removes all items. */
    public clearItems() {
      var items_copy = this.items
      var scope = this;
      this.items.forEach((item) => {
        scope.removeItem(item, true);
      });
      this.items = []
    }

    /**
     * Removes an item.
     * @param item The item to be removed.
     * @param dontRemove If not set, also remove the item from the items list.
     */
    public removeItem(item: Items.Item, dontRemove?: boolean) {
      dontRemove = dontRemove || false;
      // use this for item meshes
      this.itemRemovedCallbacks.fire(item);
      item.removed();
      this.scene.remove(item);
      if (!dontRemove) {
        Core.Utils.removeValue(this.items, item);
      }
    }

    /**
     * Function to fix material textures and encoding for GLB models
     */
    private fixMaterialTextures(material: any) {
      if (!material) return;
      
      // Set proper texture encoding for color textures (sRGB)
      if (material.map) {
        material.map.encoding = (window as any).THREE.sRGBEncoding;
        material.map.flipY = false; // GLB textures don't need flipping
        material.map.needsUpdate = true;
      }
      
      if (material.emissiveMap) {
        material.emissiveMap.encoding = (window as any).THREE.sRGBEncoding;
        material.emissiveMap.flipY = false;
        material.emissiveMap.needsUpdate = true;
      }
      
      // Keep data textures (non-color) in linear encoding
      if (material.normalMap) {
        material.normalMap.encoding = (window as any).THREE.LinearEncoding;
        material.normalMap.flipY = false;
        material.normalMap.needsUpdate = true;
      }
      
      if (material.roughnessMap) {
        material.roughnessMap.encoding = (window as any).THREE.LinearEncoding;
        material.roughnessMap.flipY = false;
        material.roughnessMap.needsUpdate = true;
      }
      
      if (material.metalnessMap) {
        material.metalnessMap.encoding = (window as any).THREE.LinearEncoding;
        material.metalnessMap.flipY = false;
        material.metalnessMap.needsUpdate = true;
      }
      
      if (material.aoMap) {
        material.aoMap.encoding = (window as any).THREE.LinearEncoding;
        material.aoMap.flipY = false;
        material.aoMap.needsUpdate = true;
      }
      
      // Ensure material updates
      material.needsUpdate = true;
      
      console.log('Fixed material textures for GLB item:', material.name || 'unnamed material');
    }

    /**
     * Creates an item and adds it to the scene.
     * @param itemType The type of the item given by an enumerator.
     * @param fileName The name of the file to load.
     * @param metadata TODO
     * @param position The initial position.
     * @param rotation The initial rotation around the y axis.
     * @param scale The initial scaling.
     * @param fixed True if fixed.
     */
    public addItem(itemType: number, fileName: string, metadata, position: THREE.Vector3, rotation: number, scale: THREE.Vector3, fixed: boolean) {
      itemType = itemType || 1;
      var scope = this;
      
      // Updated loader callback for GLTF format
      var loaderCallback = function (gltf: any) {
        // For GLTF files, extract the scene or first mesh
        var geometry, material;
        
        if (gltf.scene) {
          // Enhanced material and texture handling for GLB models
          gltf.scene.traverse(function (child: any) {
            if (child.isMesh) {
              console.log('Processing GLB mesh:', child.name, child.material);
              
              // Handle materials and textures properly
              if (child.material) {
                // If it's an array of materials
                if (Array.isArray(child.material)) {
                  child.material.forEach((mat: any) => {
                    scope.fixMaterialTextures(mat);
                  });
                } else {
                  // Single material
                  scope.fixMaterialTextures(child.material);
                }
              }
              
              // Ensure proper rendering settings
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });



          // Use the whole scene as geometry (modern approach)
          var item = new (Items.Factory.getClass(itemType))(
            scope.model,
            metadata, 
            gltf.scene, // Use the loaded scene directly
            null, // Material is embedded in GLTF
            position, rotation, scale
          );
          item.fixed = fixed || false;
          scope.items.push(item);
          scope.add(item);
          item.initObject();
          scope.itemLoadedCallbacks.fire(item);
        } else {
          console.warn("Loaded GLTF has no scene data");
        }
      }

      this.itemLoadingCallbacks.fire();
      
      if (this.loader && this.loader.load) {
        this.loader.load(
          fileName,
          loaderCallback,
          undefined, // progress callback
          function(error) {
            console.error("Error loading model:", error);
          }
        );
      } else {
        console.error("No loader available for loading items");
      }
    }
  }
}

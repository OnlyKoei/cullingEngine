/*
 Copyright (c) 2008-2010 Ricardo Quesada
 Copyright (c) 2011-2012 cocos2d-x.org
 Copyright (c) 2013-2016 Chukong Technologies Inc.
 Copyright (c) 2017-2020 Xiamen Yaji Software Co., Ltd.

 http://www.cocos2d-x.org

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
*/

/* spell-checker:words COORD, Quesada, INITED, Renerer */

import { DEBUG, EDITOR, BUILD, TEST } from 'internal:constants';
import { SceneAsset } from './assets/scene-asset';
import System from './components/system';
import { CCObject } from './data/object';
import { EventTarget } from './event';
import { input } from '../input';
import { Root } from './root';
import { Node, Scene } from './scene-graph';
import { ComponentScheduler } from './scene-graph/component-scheduler';
import NodeActivator from './scene-graph/node-activator';
import { Scheduler } from './scheduler';
import { js } from './utils/js';
import { legacyCC } from './global-exports';
import { errorID, error, assertID, warnID, debug } from './platform/debug';
import { containerManager } from './memop/container-manager';
import { uiRendererManager } from '../2d/framework/ui-renderer-manager';
import { deviceManager } from './gfx';

// ----------------------------------------------------------------------------------------------------------------------

/**
 * @en
 * ATTENTION: USE `director` INSTEAD OF `Director`.
 * `director` is a singleton object which manage your game's logic flow.
 * Since the `director` is a singleton, you don't need to call any constructor or create functions,
 * the standard way to use it is by calling:
 * `director.methodName();`
 * It creates and handle the main Window and manages how and when to execute the Scenes.
 *
 * @zh
 * ???????????? `director` ?????? `Director`???
 * `director` ?????????????????????????????????????????????????????????
 * ?????? `director` ????????????????????????????????????????????????????????????????????????
 * ??????????????????????????????????????????
 * `director.methodName();`
 * ??????????????????????????????????????????????????????????????????
 */
export class Director extends EventTarget {
    /**
     * @en The event which will be triggered when the singleton of Director initialized.
     * @zh Director ?????????????????????????????????
     * @event Director.EVENT_INIT
     */
    /**
     * @en The event which will be triggered when the singleton of Director initialized.
     * @zh Director ?????????????????????????????????
     */
    public static readonly EVENT_INIT = 'director_init';

    /**
     * @en The event which will be triggered when the singleton of Director reset.
     * @zh Director ??????????????????????????????
     * @event Director.EVENT_RESET
     */
    /**
     * @en The event which will be triggered when the singleton of Director reset.
     * @zh Director ??????????????????????????????
     */
    public static readonly EVENT_RESET = 'director_reset';

    /**
     * @en The event which will be triggered before loading a new scene.
     * @zh ??????????????????????????????????????????
     * @event Director.EVENT_BEFORE_SCENE_LOADING
     * @param {String} sceneName - The loading scene name
     */
    /**
     * @en The event which will be triggered before loading a new scene.
     * @zh ??????????????????????????????????????????
     */
    public static readonly EVENT_BEFORE_SCENE_LOADING = 'director_before_scene_loading';

    /**
     * @en The event which will be triggered before launching a new scene.
     * @zh ??????????????????????????????????????????
     * @event Director.EVENT_BEFORE_SCENE_LAUNCH
     * @param {String} sceneName - New scene which will be launched
     */
    /**
     * @en The event which will be triggered before launching a new scene.
     * @zh ??????????????????????????????????????????
     */
    public static readonly EVENT_BEFORE_SCENE_LAUNCH = 'director_before_scene_launch';

    /**
     * @en The event which will be triggered after launching a new scene.
     * @zh ??????????????????????????????????????????
     * @event Director.EVENT_AFTER_SCENE_LAUNCH
     * @param {String} sceneName - New scene which is launched
     */
    /**
     * @en The event which will be triggered after launching a new scene.
     * @zh ??????????????????????????????????????????
     */
    public static readonly EVENT_AFTER_SCENE_LAUNCH = 'director_after_scene_launch';

    /**
     * @en The event which will be triggered at the beginning of every frame.
     * @zh ??????????????????????????????????????????
     * @event Director.EVENT_BEFORE_UPDATE
     */
    /**
     * @en The event which will be triggered at the beginning of every frame.
     * @zh ??????????????????????????????????????????
     */
    public static readonly EVENT_BEFORE_UPDATE = 'director_before_update';

    /**
     * @en The event which will be triggered after engine and components update logic.
     * @zh ????????????????????? ???update??? ?????????????????????????????????
     * @event Director.EVENT_AFTER_UPDATE
     */
    /**
     * @en The event which will be triggered after engine and components update logic.
     * @zh ????????????????????? ???update??? ?????????????????????????????????
     */
    public static readonly EVENT_AFTER_UPDATE = 'director_after_update';

    /**
     * @en The event which will be triggered before the rendering process.
     * @zh ???????????????????????????????????????
     * @event Director.EVENT_BEFORE_DRAW
     */
    public static readonly EVENT_BEFORE_DRAW = 'director_before_draw';

    /**
     * @en The event which will be triggered after the rendering process.
     * @zh ???????????????????????????????????????
     * @event Director.EVENT_AFTER_DRAW
     */
    public static readonly EVENT_AFTER_DRAW = 'director_after_draw';

    /**
     * @en The event which will be triggered before the pipeline render commit.
     * @zh ?????????????????????????????????????????????
     * @event Director.EVENT_BEFORE_COMMIT
     */
    public static readonly EVENT_BEFORE_COMMIT = 'director_before_commit';

    /**
     * @en The event which will be triggered before the physics process.<br/>
     * @zh ???????????????????????????????????????
     * @event Director.EVENT_BEFORE_PHYSICS
     */
    public static readonly EVENT_BEFORE_PHYSICS = 'director_before_physics';

    /**
     * @en The event which will be triggered after the physics process.<br/>
     * @zh ???????????????????????????????????????
     * @event Director.EVENT_AFTER_PHYSICS
     */
    public static readonly EVENT_AFTER_PHYSICS = 'director_after_physics';

    /**
     * @en The event which will be triggered at the frame begin.<br/>
     * @zh ????????????????????????????????????
     * @event Director.EVENT_BEGIN_FRAME
     */
    public static readonly EVENT_BEGIN_FRAME = 'director_begin_frame';

    /**
     * @en The event which will be triggered at the frame end.<br/>
     * @zh ???????????????????????????????????????
     * @event Director.EVENT_END_FRAME
     */
    public static readonly EVENT_END_FRAME = 'director_end_frame';

    public static instance: Director;

    /**
     * @deprecated since v3.5.0, this is an engine private interface that will be removed in the future.
     */
    public _compScheduler: ComponentScheduler;
    /**
     * @deprecated since v3.5.0, this is an engine private interface that will be removed in the future.
     */
    public _nodeActivator: NodeActivator;
    private _invalid: boolean;
    private _paused: boolean;
    private _root: Root | null;
    private _loadingScene: string;
    private _scene: Scene | null;
    private _totalFrames: number;
    private _scheduler: Scheduler;
    private _systems: System[];
    private _persistRootNodes = {};

    constructor () {
        super();

        this._invalid = false;
        // paused?
        this._paused = false;

        // root
        this._root = null;

        // scenes
        this._loadingScene = '';
        this._scene = null;

        // FPS
        this._totalFrames = 0;

        // Scheduler for user registration update
        this._scheduler = new Scheduler();
        // Scheduler for life-cycle methods in component
        this._compScheduler = new ComponentScheduler();
        // Node activator
        this._nodeActivator = new NodeActivator();

        this._systems = [];
    }

    /**
     * @en Calculates delta time since last time it was called, the result is saved to an internal property.
     * @zh ???????????????????????????????????????????????????????????????????????????
     * @deprecated since v3.3.0 no need to use it anymore
     */
    public calculateDeltaTime (now) {}

    /**
     * @en End the life of director in the next frame
     * @zh ??????????????????????????? director ?????????
     */
    public end () {
        this.once(Director.EVENT_END_FRAME, () => {
            this.purgeDirector();
        });
    }

    /**
     * @en Pause the director's ticker, only involve the game logic execution.<br>
     * It won't pause the rendering process nor the event manager.<br>
     * If you want to pause the entire game including rendering, audio and event,<br>
     * please use `game.pause`.
     * @zh ??????????????????????????????????????????????????????????????????????????????????????????????????? UI ?????????<br>
     * ????????????????????????????????????????????????????????????????????????????????? `game.pause` ???
     */
    public pause () {
        if (this._paused) {
            return;
        }
        this._paused = true;
    }

    /**
     * @en Purge the `director` itself, including unschedule all schedule,<br>
     * remove all event listeners, clean up and exit the running scene, stops all animations, clear cached data.
     * @zh ?????? `director` ??????????????????????????????????????????<br>
     * ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????
     */
    public purgeDirector () {
        // cleanup scheduler
        this._scheduler.unscheduleAll();
        this._compScheduler.unscheduleAll();

        this._nodeActivator.reset();

        if (!EDITOR) {
            if (legacyCC.isValid(this._scene)) {
                this._scene!.destroy();
            }
            this._scene = null;
        }

        this.stopAnimation();

        // Clear all caches
        legacyCC.assetManager.releaseAll();
    }

    /**
     * @en Reset the director, can be used to restart the director after purge
     * @zh ????????? Director?????????????????????????????? Director???
     */
    public reset () {
        this.purgeDirector();

        for (const id in this._persistRootNodes) {
            this.removePersistRootNode(this._persistRootNodes[id]);
        }

        // Clear scene
        this.getScene()?.destroy();

        this.emit(Director.EVENT_RESET);

        this.startAnimation();
    }

    /**
     * @en
     * Run a scene. Replaces the running scene with a new one or enter the first scene.<br>
     * The new scene will be launched immediately.
     * @zh ???????????????????????????????????????????????????????????????????????????????????????????????????????????????
     * @param scene - The need run scene.
     * @param onBeforeLoadScene - The function invoked at the scene before loading.
     * @param onLaunched - The function invoked at the scene after launch.
     */
    public runSceneImmediate (scene: Scene|SceneAsset, onBeforeLoadScene?: Director.OnBeforeLoadScene, onLaunched?: Director.OnSceneLaunched) {
        if (scene instanceof SceneAsset) scene = scene.scene!;
        assertID(scene instanceof Scene, 1216);

        if (BUILD && DEBUG) {
            console.time('InitScene');
        }
        // @ts-expect-error run private method
        scene._load();  // ensure scene initialized
        if (BUILD && DEBUG) {
            console.timeEnd('InitScene');
        }
        // Re-attach or replace persist nodes
        if (BUILD && DEBUG) {
            console.time('AttachPersist');
        }
        const persistNodeList = Object.keys(this._persistRootNodes).map((x) => this._persistRootNodes[x] as Node);
        for (let i = 0; i < persistNodeList.length; i++) {
            const node = persistNodeList[i];
            node.emit(Node.EventType.SCENE_CHANGED_FOR_PERSISTS, scene.renderScene);
            const existNode = scene.uuid === node._originalSceneId && scene.getChildByUuid(node.uuid);
            if (existNode) {
                // scene also contains the persist node, select the old one
                const index = existNode.getSiblingIndex();
                // restore to the old saving flag
                node.hideFlags &= ~CCObject.Flags.DontSave;
                node.hideFlags |= CCObject.Flags.DontSave & existNode.hideFlags;
                existNode._destroyImmediate();
                scene.insertChild(node, index);
            } else {
                node.hideFlags |= CCObject.Flags.DontSave;
                // @ts-expect-error insert to new scene
                node.parent = scene;
            }
        }
        if (BUILD && DEBUG) {
            console.timeEnd('AttachPersist');
        }
        const oldScene = this._scene;

        // unload scene
        if (BUILD && DEBUG) {
            console.time('Destroy');
        }
        if (legacyCC.isValid(oldScene)) {
            oldScene!.destroy();
        }
        if (!EDITOR) {
            // auto release assets
            if (BUILD && DEBUG) {
                console.time('AutoRelease');
            }
            legacyCC.assetManager._releaseManager._autoRelease(oldScene, scene, this._persistRootNodes);
            if (BUILD && DEBUG) {
                console.timeEnd('AutoRelease');
            }
        }

        this._scene = null;

        // purge destroyed nodes belongs to old scene
        CCObject._deferredDestroy();
        if (BUILD && DEBUG) { console.timeEnd('Destroy'); }

        if (onBeforeLoadScene) {
            onBeforeLoadScene();
        }
        this.emit(Director.EVENT_BEFORE_SCENE_LAUNCH, scene);

        // Run an Entity Scene
        this._scene = scene;

        if (BUILD && DEBUG) {
            console.time('Activate');
        }
        // @ts-expect-error run private method
        scene._activate();
        if (BUILD && DEBUG) {
            console.timeEnd('Activate');
        }
        // start scene
        if (this._root) {
            this._root.resetCumulativeTime();
        }
        this.startAnimation();
        if (onLaunched) {
            onLaunched(null, scene);
        }
        this.emit(Director.EVENT_AFTER_SCENE_LAUNCH, scene);
    }

    /**
     * @en
     * Run a scene. Replaces the running scene with a new one or enter the first scene.<br>
     * The new scene will be launched at the end of the current frame.<br>
     * @zh ?????????????????????
     * @param scene - The need run scene.
     * @param onBeforeLoadScene - The function invoked at the scene before loading.
     * @param onLaunched - The function invoked at the scene after launch.
     * @private
     */
    public runScene (scene: Scene | SceneAsset, onBeforeLoadScene?: Director.OnBeforeLoadScene, onLaunched?: Director.OnSceneLaunched) {
        if (scene instanceof SceneAsset) scene = scene.scene!;
        assertID(scene, 1205);
        assertID(scene instanceof Scene, 1216);

        // ensure scene initialized
        // @ts-expect-error run private method
        scene._load();

        // Delay run / replace scene to the end of the frame
        this.once(Director.EVENT_END_FRAME, () => {
            this.runSceneImmediate(scene, onBeforeLoadScene, onLaunched);
        });
    }

    /**
     * @en Loads the scene by its name.
     * @zh ???????????????????????????????????????
     *
     * @param sceneName - The name of the scene to load.
     * @param onLaunched - callback, will be called after scene launched.
     * @return if error, return false
     */
    public loadScene (sceneName: string, onLaunched?: Director.OnSceneLaunched, onUnloaded?: Director.OnUnload) {
        if (this._loadingScene) {
            warnID(1208, sceneName, this._loadingScene);
            return false;
        }
        const bundle = legacyCC.assetManager.bundles.find((bundle) => !!bundle.getSceneInfo(sceneName));
        if (bundle) {
            this.emit(Director.EVENT_BEFORE_SCENE_LOADING, sceneName);
            this._loadingScene = sceneName;
            console.time(`LoadScene ${sceneName}`);
            bundle.loadScene(sceneName, (err, scene) => {
                console.timeEnd(`LoadScene ${sceneName}`);
                this._loadingScene = '';
                if (err) {
                    error(err);
                    if (onLaunched) {
                        onLaunched(err);
                    }
                } else {
                    this.runSceneImmediate(scene, onUnloaded, onLaunched);
                }
            });
            return true;
        } else {
            errorID(1209, sceneName);
            return false;
        }
    }

    /**
     * @en
     * Pre-loads the scene asset to reduces loading time. You can call this method at any time you want.<br>
     * After calling this method, you still need to launch the scene by `director.loadScene`.<br>
     * It will be totally fine to call `director.loadScene` at any time even if the preloading is not<br>
     * yet finished, the scene will be launched after loaded automatically.
     * @zh ?????????????????????????????????????????????????????????????????????
     * ???????????????????????????????????? `director.loadScene` ?????????????????????????????????????????????????????????????????????<br>
     * ?????????????????????????????????????????????????????? `director.loadScene`???????????????????????????????????????
     * @param sceneName @en The name of the scene to load @zh ???????????????
     * @param onLoaded @en Callback to execute once the scene is loaded @zh ???????????????
     */
    public preloadScene (sceneName: string, onLoaded?: Director.OnSceneLoaded): void;

    /**
     * @en
     * Pre-loads the scene to reduces loading time. You can call this method at any time you want.<br>
     * After calling this method, you still need to launch the scene by `director.loadScene`.<br>
     * It will be totally fine to call `director.loadScene` at any time even if the preloading is not<br>
     * yet finished, the scene will be launched after loaded automatically.
     * @zh ???????????????????????????????????????????????????????????????
     * ???????????????????????????????????? `director.loadScene` ?????????????????????????????????????????????????????????????????????<br>
     * ?????????????????????????????????????????????????????? `director.loadScene`???????????????????????????????????????
     * @param sceneName @en The name of scene to load @zh ???????????????
     * @param onProgress @en Callback to execute when the load progression change.  @zh ?????????????????????
     * @param onLoaded @en Callback to execute once the scene is loaded @zh ???????????????
     */
    public preloadScene (sceneName: string, onProgress: Director.OnLoadSceneProgress, onLoaded: Director.OnSceneLoaded): void;

    public preloadScene (
        sceneName: string,
        onProgress?: Director.OnLoadSceneProgress | Director.OnSceneLoaded,
        onLoaded?: Director.OnSceneLoaded,
    ) {
        const bundle = legacyCC.assetManager.bundles.find((bundle) => !!bundle.getSceneInfo(sceneName));
        if (bundle) {
            bundle.preloadScene(sceneName, null, onProgress, onLoaded);
        } else {
            const err = `Can not preload the scene "${sceneName}" because it is not in the build settings.`;
            if (onLoaded) {
                onLoaded(new Error(err));
            }
            error(`preloadScene: ${err}`);
        }
    }

    /**
     * @en Resume game logic execution after pause, if the current scene is not paused, nothing will happen.
     * @zh ?????????????????????????????????????????????????????????????????????????????????????????????
     */
    public resume () {
        if (!this._paused) {
            return;
        }
        this._paused = false;
    }

    get root () {
        return this._root;
    }

    /**
     * @en Returns current logic Scene.
     * @zh ???????????????????????????
     * @example
     * ```
     * import { director } from 'cc';
     * // This will help you to get the Canvas node in scene
     * director.getScene().getChildByName('Canvas');
     * ```
     */
    public getScene (): Scene | null {
        return this._scene;
    }

    /**
     * @en Returns the delta time since last frame.
     * @zh ?????????????????????????????????
     * @deprecated since v3.3.0, please use game.deltaTime instead
     */
    public getDeltaTime () {
        return legacyCC.game.deltaTime as number;
    }

    /**
     * @en Returns the total passed time since game start, unit: ms
     * @zh ??????????????????????????????????????????????????????????????? ms
     * @deprecated since v3.3.0, please use game.totalTime instead
     */
    public getTotalTime () {
        return legacyCC.game.totalTime as number;
    }

    /**
     * @en Returns the current time.
     * @zh ???????????????????????????
     * @deprecated since v3.3.0, please use game.frameStartTime instead
     */
    public getCurrentTime () {
        return legacyCC.game.frameStartTime as number;
    }

    /**
     * @en Returns how many frames were called since the director started.
     * @zh ?????? director ???????????????????????????????????????
     */
    public getTotalFrames () {
        return this._totalFrames;
    }

    /**
     * @en Returns whether or not the Director is paused.
     * @zh ???????????????????????????
     */
    public isPaused () {
        return this._paused;
    }

    /**
     * @en Returns the scheduler associated with this director.
     * @zh ????????? director ????????????????????????
     */
    public getScheduler () {
        return this._scheduler;
    }

    /**
     * @en Sets the scheduler associated with this director.
     * @zh ????????? director ????????????????????????
     */
    public setScheduler (scheduler: Scheduler) {
        if (this._scheduler !== scheduler) {
            this.unregisterSystem(this._scheduler);
            this._scheduler = scheduler;
            this.registerSystem(Scheduler.ID, scheduler, 200);
        }
    }

    /**
     * @en Register a system.
     * @zh ?????????????????????
     */
    public registerSystem (name: string, sys: System, priority: number) {
        sys.id = name;
        sys.priority = priority;
        this._systems.push(sys);
        this._systems.sort(System.sortByPriority);
    }

    public unregisterSystem (sys: System) {
        js.array.fastRemove(this._systems, sys);
        this._systems.sort(System.sortByPriority);
    }

    /**
     * @en get a system.
     * @zh ???????????? system???
     */
    public getSystem (name: string) {
        return this._systems.find((sys) => sys.id === name);
    }

    /**
     * @en Returns the `AnimationManager` associated with this director. Please use getSystem(AnimationManager.ID)
     * @zh ????????? director ???????????? `AnimationManager`????????????????????????????????? getSystem(AnimationManager.ID) ?????????
     * @deprecated since 3.0.0
     */
    public getAnimationManager (): any {
        return this.getSystem(legacyCC.AnimationManager.ID);
    }

    // Loop management
    /**
     * @en Starts the director
     * @zh ????????????????????????
     */
    public startAnimation () {
        this._invalid = false;
    }

    /**
     * @en Stops the director
     * @zh ??????????????????????????????????????????????????????
     */
    public stopAnimation () {
        this._invalid = true;
    }

    /**
     * @en Run main loop of director
     * @zh ???????????????
     * @deprecated Since v3.6, please use [tick] instead
     */
    public mainLoop (now: number) {
        let dt;
        if (EDITOR && !legacyCC.GAME_VIEW || TEST) {
            dt = now;
        } else {
            dt = legacyCC.game._calculateDT(now);
        }
        this.tick(dt);
    }

    /**
     * @en Run main loop of director
     * @zh ???????????????
     * @param dt Delta time in seconds
     */
    public tick (dt: number) {
        if (!this._invalid) {
            this.emit(Director.EVENT_BEGIN_FRAME);
            if (!EDITOR || legacyCC.GAME_VIEW) {
                // @ts-expect-error _frameDispatchEvents is a private method.
                input._frameDispatchEvents();
            }
            // Update
            if (!this._paused) {
                this.emit(Director.EVENT_BEFORE_UPDATE);
                // Call start for new added components
                this._compScheduler.startPhase();
                // Update for components
                this._compScheduler.updatePhase(dt);
                // Update systems
                for (let i = 0; i < this._systems.length; ++i) {
                    this._systems[i].update(dt);
                }
                // Late update for components
                this._compScheduler.lateUpdatePhase(dt);
                // User can use this event to do things after update
                this.emit(Director.EVENT_AFTER_UPDATE);
                // Destroy entities that have been removed recently
                CCObject._deferredDestroy();

                // Post update systems
                for (let i = 0; i < this._systems.length; ++i) {
                    this._systems[i].postUpdate(dt);
                }
            }

            this.emit(Director.EVENT_BEFORE_DRAW);
            uiRendererManager.updateAllDirtyRenderers();
            this._root!.frameMove(dt);
            this.emit(Director.EVENT_AFTER_DRAW);

            Node.resetHasChangedFlags();
            Node.clearNodeArray();
            containerManager.update(dt);
            this.emit(Director.EVENT_END_FRAME);
            this._totalFrames++;
        }
    }

    /**
     * @internal
     */
    public init () {
        this._totalFrames = 0;
        this._paused = false;
        // Scheduler
        // TODO: have a solid organization of priority and expose to user
        this.registerSystem(Scheduler.ID, this._scheduler, 200);
        this._root = new Root(deviceManager.gfxDevice);
        const rootInfo = {};
        this._root.initialize(rootInfo);
        for (let i = 0; i < this._systems.length; i++) {
            this._systems[i].init();
        }
        this.emit(Director.EVENT_INIT);
    }

    //  @ Persist root node section
    /**
     * @en
     * Add a persistent root node to the game, the persistent node won't be destroyed during scene transition.<br>
     * The target node must be placed in the root level of hierarchy, otherwise this API won't have any effect.
     * @zh
     * ?????????????????????????????????????????????????????????????????????<br>
     * ???????????????????????????????????????????????????????????????
     * @param node - The node to be made persistent
     */
    public addPersistRootNode (node: Node) {
        if (!legacyCC.Node.isNode(node) || !node.uuid) {
            warnID(3800);
            return;
        }
        const id = node.uuid;
        if (!this._persistRootNodes[id]) {
            const scene = this._scene as any;
            if (legacyCC.isValid(scene)) {
                if (!node.parent) {
                    node.parent = scene;
                    node._originalSceneId = scene.uuid;
                } else if (!(node.parent instanceof Scene)) {
                    warnID(3801);
                    return;
                } else if (node.parent !== scene) {
                    warnID(3802);
                    return;
                } else {
                    node._originalSceneId = scene.uuid;
                }
            }
            this._persistRootNodes[id] = node;
            node._persistNode = true;
            legacyCC.assetManager._releaseManager._addPersistNodeRef(node);
        }
    }

    /**
     * @en Remove a persistent root node.
     * @zh ????????????????????????
     * @param node - The node to be removed from persistent node list
     */
    public removePersistRootNode (node: Node) {
        const id = node.uuid || '';
        if (node === this._persistRootNodes[id]) {
            delete this._persistRootNodes[id];
            node._persistNode = false;
            node._originalSceneId = '';
            legacyCC.assetManager._releaseManager._removePersistNodeRef(node);
        }
    }

    /**
     * @en Check whether the node is a persistent root node.
     * @zh ???????????????????????????????????????
     * @param node - The node to be checked
     */
    public isPersistRootNode (node: Node): boolean {
        return !!node._persistNode;
    }
}

export declare namespace Director {
    export type OnBeforeLoadScene = () => void;

    export type OnUnload = () => void;

    export type OnSceneLoaded = (error: null | Error, sceneAsset?: SceneAsset) => void;

    export type OnSceneLaunched = (error: null | Error, scene?: Scene) => void;

    /**
     * @param completedCount - The number of the items that are already completed.
     * @param totalCount - The total number of the items.
     * @param item - The latest item which flow out the pipeline.
     */
    export type OnLoadSceneProgress = (completedCount: number, totalCount: number, item: any) => void;
}

legacyCC.Director = Director;

/**
 * @en Director of the game, used to control game update loop and scene management
 * @zh ??????????????????????????????????????????????????????????????????
 */
export const director: Director = Director.instance = legacyCC.director = new Director();

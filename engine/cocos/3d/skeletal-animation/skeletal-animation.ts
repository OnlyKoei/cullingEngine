/*
 Copyright (c) 2017-2020 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated engine source code (the "Software"), a limited,
  worldwide, royalty-free, non-assignable, revocable and non-exclusive license
 to use Cocos Creator solely to develop games on your target platforms. You shall
  not use Cocos Creator software for developing other software or tools that's
  used for developing games. You are not granted to publish, distribute,
  sublicense, and/or sell copies of Cocos Creator.

 The software or tools in this License Agreement are licensed, not sold.
 Xiamen Yaji Software Co., Ltd. reserves all rights not expressly granted to you.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
*/

import {
    ccclass, executeInEditMode, executionOrder, help, menu, tooltip, type, serializable, editable,
} from 'cc.decorator';
import { SkinnedMeshRenderer } from '../skinned-mesh-renderer';
import { Mat4 } from '../../core/math';
import { DataPoolManager } from './data-pool-manager';
import { Node } from '../../core/scene-graph/node';
import { AnimationClip } from '../../core/animation/animation-clip';
import { Animation } from '../../core/animation/animation-component';
import { SkelAnimDataHub } from './skeletal-animation-data-hub';
import { SkeletalAnimationState } from './skeletal-animation-state';
import { getWorldTransformUntilRoot } from '../../core/animation/transform-utils';
import { legacyCC } from '../../core/global-exports';
import { js } from '../../core/utils/js';
import type { AnimationState } from '../../core/animation/animation-state';
import { assertIsTrue } from '../../core/data/utils/asserts';
import { getGlobalAnimationManager } from '../../core/animation/global-animation-manager';

/**
 * @en The socket to synchronize transform from skeletal joint to target node.
 * @zh ?????????????????????????????????????????????????????????????????????????????????????????????
 */
@ccclass('cc.SkeletalAnimation.Socket')
export class Socket {
    /**
     * @en Path of the target joint.
     * @zh ?????????????????????????????????
     */
    @serializable
    @editable
    public path = '';

    /**
     * @en Transform output node.
     * @zh ???????????????????????????????????????
     */
    @type(Node)
    public target: Node | null = null;

    constructor (path = '', target: Node | null = null) {
        this.path = path;
        this.target = target;
    }
}

js.setClassAlias(Socket, 'cc.SkeletalAnimationComponent.Socket');

const m4_1 = new Mat4();
const m4_2 = new Mat4();

function collectRecursively (node: Node, prefix = '', out: string[] = []) {
    for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        if (!child) { continue; }
        const path = prefix ? `${prefix}/${child.name}` : child.name;
        out.push(path);
        collectRecursively(child, path, out);
    }
    return out;
}

/**
 * @en
 * Skeletal animation component, offers the following features on top of [[Animation]]:
 * * Choice between baked animation and real-time calculation, to leverage efficiency and expressiveness.
 * * Joint socket system: Create any socket node directly under the animation component root node,
 *   find your target joint and register both to the socket list, so that the socket node would be in-sync with the joint.
 * @zh
 * ??????????????????????????????????????????????????????????????????????????????
 * * ??????????????????????????????????????????????????????????????????????????????????????????
 * * ???????????????????????????????????????????????????????????????????????????????????????????????????????????? socket ???????????????????????? Transform ??????????????????????????????
 */
@ccclass('cc.SkeletalAnimation')
@help('i18n:cc.SkeletalAnimation')
@executionOrder(99)
@executeInEditMode
@menu('Animation/SkeletalAnimation')
export class SkeletalAnimation extends Animation {
    public static Socket = Socket;

    /**
     * @en
     * The joint sockets this animation component maintains.<br>
     * Sockets have to be registered here before attaching custom nodes to animated joints.
     * @zh
     * ?????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
     */
    @type([Socket])
    @tooltip('i18n:animation.sockets')
    get sockets () {
        return this._sockets;
    }

    set sockets (val) {
        if (!this._useBakedAnimation) {
            const animMgr = getGlobalAnimationManager();
            animMgr.removeSockets(this.node, this._sockets);
            animMgr.addSockets(this.node, val);
        }
        this._sockets = val;
        this.rebuildSocketAnimations();
    }

    /**
     * @en
     * Whether to bake animations. Default to true,<br>
     * which substantially increases performance while making all animations completely fixed.<br>
     * Dynamically changing this property will take effect when playing the next animation clip.
     * @zh
     * ?????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????<br>
     * ???????????????????????????????????????????????????????????????????????????
     */
    @tooltip('i18n:animation.use_baked_animation')
    get useBakedAnimation () {
        return this._useBakedAnimation;
    }

    set useBakedAnimation (val) {
        this._useBakedAnimation = val;

        for (const stateName in this._nameToState) {
            const state = this._nameToState[stateName] as SkeletalAnimationState;
            state.setUseBaked(val);
        }

        this._users.forEach((user) => {
            user.setUseBakedAnimation(val);
        });

        if (this._useBakedAnimation) {
            getGlobalAnimationManager().removeSockets(this.node, this._sockets);
        } else {
            getGlobalAnimationManager().addSockets(this.node, this._sockets);
            this._currentBakedState = null;
        }
    }

    @serializable
    protected _useBakedAnimation = true;

    @type([Socket])
    protected _sockets: Socket[] = [];

    public onLoad () {
        super.onLoad();
        // Actively search for potential users and notify them that an animation is usable.
        const comps = this.node.getComponentsInChildren(SkinnedMeshRenderer);
        for (let i = 0; i < comps.length; ++i) {
            const comp = comps[i];
            if (comp.skinningRoot === this.node) {
                this.notifySkinnedMeshAdded(comp);
            }
        }
    }

    public onDestroy () {
        super.onDestroy();
        (legacyCC.director.root.dataPoolManager as DataPoolManager).jointAnimationInfo.destroy(this.node.uuid);
        getGlobalAnimationManager().removeSockets(this.node, this._sockets);
        this._removeAllUsers();
    }

    public onEnable () {
        super.onEnable();
        this._currentBakedState?.resume();
    }

    public onDisable () {
        super.onDisable();
        this._currentBakedState?.pause();
    }

    public start () {
        this.sockets = this._sockets;
        this.useBakedAnimation = this._useBakedAnimation;
        super.start();
    }

    public pause () {
        if (!this._useBakedAnimation) {
            super.pause();
        } else {
            this._currentBakedState?.pause();
        }
    }

    public resume () {
        if (!this._useBakedAnimation) {
            super.resume();
        } else {
            this._currentBakedState?.resume();
        }
    }

    public stop () {
        if (!this._useBakedAnimation) {
            super.stop();
        } else if (this._currentBakedState) {
            this._currentBakedState.stop();
            this._currentBakedState = null;
        }
    }

    /**
     * @en Query all socket paths
     * @zh ?????????????????????????????????
     * @returns @en All socket paths @zh ???????????????????????????
     */
    public querySockets () {
        const animPaths = (this._defaultClip && Object.keys(SkelAnimDataHub.getOrExtract(this._defaultClip).joints).sort()
            .reduce((acc, cur) => (cur.startsWith(acc[acc.length - 1]) ? acc : (acc.push(cur), acc)), [] as string[])) || [];
        if (!animPaths.length) { return ['please specify a valid default animation clip first']; }
        const out: string[] = [];
        for (let i = 0; i < animPaths.length; i++) {
            const path = animPaths[i];
            const node = this.node.getChildByPath(path);
            if (!node) { continue; }
            out.push(path);
            collectRecursively(node, path, out);
        }
        return out;
    }

    /**
     * @en Rebuild animations to synchronize immediately all sockets to their target node.
     * @zh ????????????????????????????????????????????????????????????????????????????????????
     */
    public rebuildSocketAnimations () {
        for (const socket of this._sockets) {
            const joint = this.node.getChildByPath(socket.path);
            const { target } = socket;
            if (joint && target) {
                target.name = `${socket.path.substring(socket.path.lastIndexOf('/') + 1)} Socket`;
                target.parent = this.node;
                getWorldTransformUntilRoot(joint, this.node, m4_1);
                Mat4.fromRTS(m4_2, target.rotation, target.position, target.scale);
                if (!Mat4.equals(m4_2, m4_1)) { target.matrix = m4_1; }
            }
        }
        for (const stateName of Object.keys(this._nameToState)) {
            const state = this._nameToState[stateName] as SkeletalAnimationState;
            state.rebuildSocketCurves(this._sockets);
        }
    }

    /**
     * @en Create or get the target node from a socket.
     * If a socket haven't been created for the corresponding path, this function will register a new socket.
     * @zh ???????????????????????????????????????????????????
     * ????????????????????????????????????????????????????????????????????????????????????
     * @param path @en Path of the target joint. @zh ???????????????????????????
     * @returns @en The target node of the socket. @zh ?????????????????????
     */
    public createSocket (path: string) {
        const socket = this._sockets.find((s) => s.path === path);
        if (socket) { return socket.target; }
        const joint = this.node.getChildByPath(path);
        if (!joint) { console.warn('illegal socket path'); return null; }
        const target = new Node();
        target.parent = this.node;
        this._sockets.push(new Socket(path, target));
        this.rebuildSocketAnimations();
        return target;
    }

    /**
     * @internal This method only friends to skinned mesh renderer.
     */
    public notifySkinnedMeshAdded (skinnedMeshRenderer: SkinnedMeshRenderer) {
        const { _useBakedAnimation: useBakedAnimation } = this;
        const formerBound = skinnedMeshRenderer.associatedAnimation;
        if (formerBound) {
            formerBound._users.delete(skinnedMeshRenderer);
        }
        skinnedMeshRenderer.associatedAnimation = this;
        skinnedMeshRenderer.setUseBakedAnimation(useBakedAnimation, true);
        if (useBakedAnimation) {
            const { _currentBakedState: playingState } = this;
            if (playingState) {
                skinnedMeshRenderer.uploadAnimation(playingState.clip);
            }
        }
        this._users.add(skinnedMeshRenderer);
    }

    /**
     * @internal This method only friends to skinned mesh renderer.
     */
    public notifySkinnedMeshRemoved (skinnedMeshRenderer: SkinnedMeshRenderer) {
        assertIsTrue(skinnedMeshRenderer.associatedAnimation === this || skinnedMeshRenderer.associatedAnimation === null);
        skinnedMeshRenderer.setUseBakedAnimation(false);
        skinnedMeshRenderer.associatedAnimation = null;
        this._users.delete(skinnedMeshRenderer);
    }

    /**
     * Get all users.
     * @internal This method only friends to the skeleton animation state.
     */
    public getUsers () {
        return this._users;
    }

    protected _createState (clip: AnimationClip, name?: string) {
        return new SkeletalAnimationState(clip, name);
    }

    protected _doCreateState (clip: AnimationClip, name: string) {
        const state = super._doCreateState(clip, name) as SkeletalAnimationState;
        state.rebuildSocketCurves(this._sockets);
        return state;
    }

    protected doPlayOrCrossFade (state: AnimationState, duration: number) {
        if (this._useBakedAnimation) {
            if (this._currentBakedState) {
                this._currentBakedState.stop();
            }
            const skeletalAnimationState = state as SkeletalAnimationState;
            this._currentBakedState = skeletalAnimationState;
            skeletalAnimationState.play();
        } else {
            super.doPlayOrCrossFade(state, duration);
        }
    }

    private _users = new Set<SkinnedMeshRenderer>();

    private _currentBakedState: SkeletalAnimationState | null = null;

    private _removeAllUsers () {
        Array.from(this._users).forEach((user) => {
            this.notifySkinnedMeshRemoved(user);
        });
    }
}

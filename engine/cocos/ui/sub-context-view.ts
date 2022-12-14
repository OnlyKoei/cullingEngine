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

import { ccclass, help, menu, executionOrder, requireComponent, tooltip, serializable } from 'cc.decorator';
import { EDITOR, WECHAT } from 'internal:constants';
import { minigame } from 'pal/minigame';
import { screenAdapter } from 'pal/screen-adapter';
import { Component } from '../core/components/component';
import { view } from '../core/platform/view';
import { Sprite } from '../2d/components/sprite';
import { Node } from '../core/scene-graph';
import { UITransform } from '../2d/framework/ui-transform';
import { SpriteFrame } from '../2d/assets';
import { ImageAsset } from '../core/assets/image-asset';
import {  Size } from '../core/math';

import { legacyCC } from '../core/global-exports';
import { NodeEventType } from '../core/scene-graph/node-event';
import { CCObject, Texture2D } from '../core';

/**
 * @en SubContextView is a view component which controls open data context viewport in WeChat game platform.<br/>
 * The component's node size decide the viewport of the sub context content in main context,
 * the entire sub context texture will be scaled to the node's bounding box area.<br/>
 * This component provides multiple important features:<br/>
 * 1. Sub context could use its own resolution size and policy.<br/>
 * 2. Sub context could be minized to smallest size it needed.<br/>
 * 3. Resolution of sub context content could be increased.<br/>
 * 4. User touch input is transformed to the correct viewport.<br/>
 * 5. Texture update is handled by this component. User don't need to worry.<br/>
 * One important thing to be noted, whenever the node's bounding box change,
 * you need to manually reset the viewport of sub context using updateSubContextViewport.
 * @zh SubContextView ???????????????????????????????????????????????????????????????????????????????????????<br/>
 * ???????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????<br/>
 * ??????????????????????????????????????????????????????????????????????????????<br/>
 * 1. ????????????????????????????????????????????????????????????<br/>
 * 2. ??????????????????????????????????????????????????????<br/>
 * 3. ???????????????????????????????????????????????????????????????????????????<br/>
 * 4. ???????????????????????????????????????????????????????????????<br/>
 * 5. ??????????????????????????????????????????????????????????????????<br/>
 * ????????????????????????????????????????????????????????????????????????????????????????????? `updateSubContextViewport` ??????????????????????????????
 */
@ccclass('cc.SubContextView')
@help('i18n:cc.SubContextView')
@executionOrder(110)
@requireComponent(UITransform)
@menu('Miscellaneous/SubContextView')
export class SubContextView extends Component {
    /**
     * @en Specify a reference value of canvas size for style editing in Open Data Context.
     * The width and height setting of CSS style should not exceed this size, otherwise the rendered content will exceed the canvas.
     * NOTE: This property is read-only at runtime. Please configure the design resolution in the Editor.
     *
     * @zh ????????????????????????????????????????????????????????????????????????CSS ??????????????????????????????????????????????????????????????????????????????????????????
     * ????????????????????????????????????????????????????????????????????????????????????????????????
     */
    @tooltip('i18n:subContextView.design_size')
    get designResolutionSize () {
        return this._designResolutionSize;
    }
    set designResolutionSize (value) {
        if (!EDITOR || value.equals(this._designResolutionSize)) {
            return;
        }
        this._designResolutionSize.set(value);
    }

    /**
     * @en Setting frame rate in Open Data Context.
     *
     * @zh ???????????????????????????????????????
     */
    @tooltip('i18n:subContextView.fps')
    get fps () {
        return this._fps;
    }
    set fps (value) {
        if (this._fps === value) {
            return;
        }
        this._fps = value;
        this._updateInterval = 1000 / value;
    }

    @serializable
    private _fps = 60;
    private _sprite: Sprite | null;
    private _imageAsset: ImageAsset;
    private _texture: Texture2D;
    private _updatedTime = 0;
    private _updateInterval = 0;
    private _openDataContext: any;
    private _content: Node;
    @serializable
    private _designResolutionSize: Size = new Size(640, 960);

    constructor () {
        super();
        this._content = new Node('content');
        this._content.hideFlags |= CCObject.Flags.DontSave | CCObject.Flags.HideInHierarchy;
        this._sprite = null;
        this._imageAsset = new ImageAsset();
        this._openDataContext = null;
        this._updatedTime = performance.now();
        this._texture = new Texture2D();
    }

    public onLoad () {
        if (minigame.getOpenDataContext) {
            this._updateInterval = 1000 / this._fps;
            this._openDataContext = minigame.getOpenDataContext();
            this._initSharedCanvas();
            this._initContentNode();
            this._updateSubContextView();
            this._updateContentLayer();
        } else {
            this.enabled = false;
        }
    }

    public onEnable () {
        this._registerNodeEvent();
    }

    public onDisable () {
        this._unregisterNodeEvent();
    }

    private _initSharedCanvas () {
        if (this._openDataContext) {
            const sharedCanvas = this._openDataContext.canvas;
            let designWidth = this._designResolutionSize.width;
            let designHeight = this._designResolutionSize.height;
            if (WECHAT) {
                // HACK: on WeChat platform, at least one side of the width and height of sharedCanvas is greater than 513
                // When the sharedCanvas is smaller than this size, the rendering doesn't work.
                const minimumSize = 513;
                if (designWidth <= minimumSize && designHeight <= minimumSize) {
                    const scaleWidth = minimumSize / designWidth;
                    const scaleHeight = minimumSize / designHeight;
                    const targetScale = scaleWidth < scaleHeight ? scaleWidth : scaleHeight;
                    designWidth *= targetScale;
                    designHeight *= targetScale;
                }
            }
            sharedCanvas.width = designWidth;
            sharedCanvas.height = designHeight;
        }
    }

    private _initContentNode () {
        if (this._openDataContext) {
            const sharedCanvas = this._openDataContext.canvas;

            const image = this._imageAsset;
            image.reset(sharedCanvas);
            this._texture.image = image;
            this._texture.create(sharedCanvas.width, sharedCanvas.height);

            this._sprite = this._content.getComponent(Sprite);
            if (!this._sprite) {
                this._sprite = this._content.addComponent(Sprite);
            }

            if (this._sprite.spriteFrame) {
                this._sprite.spriteFrame.texture = this._texture;
            } else {
                const sp = new SpriteFrame();
                sp.texture = this._texture;
                this._sprite.spriteFrame = sp;
            }

            this._content.parent = this.node;
        }
    }

    private _updateSubContextView () {
        if (!this._openDataContext) {
            return;
        }

        // update subContextView size
        // use SHOW_ALL policy to adapt subContextView
        const nodeTrans = this.node.getComponent(UITransform) as UITransform;
        const contentTrans = this._content.getComponent(UITransform) as UITransform;

        const scaleX = nodeTrans.width / contentTrans.width;
        const scaleY = nodeTrans.height / contentTrans.height;
        const scale = scaleX > scaleY ? scaleY : scaleX;
        contentTrans.width *= scale;
        contentTrans.height *= scale;

        // update viewport in subContextView
        const viewportRect = view.getViewportRect();
        const box = contentTrans.getBoundingBoxToWorld();
        const visibleSize = view.getVisibleSize();
        const dpr = screenAdapter.devicePixelRatio;

        // TODO: the visibleSize need to be the size of Canvas node where the content node is.
        const x = (viewportRect.width * (box.x / visibleSize.width) + viewportRect.x) / dpr;
        const y = (viewportRect.height * (box.y / visibleSize.height) + viewportRect.y) / dpr;
        const width = viewportRect.width * (box.width / visibleSize.width) / dpr;
        const height = viewportRect.height * (box.height / visibleSize.height) / dpr;

        this._openDataContext.postMessage({
            fromEngine: true,  // compatible deprecated property
            type: 'engine',
            event: 'viewport',
            x,
            y,
            width,
            height,
        });
    }

    private _updateSubContextTexture () {
        const img = this._imageAsset;
        if (!img || !this._openDataContext) {
            return;
        }

        if (img.width <= 0 || img.height <= 0) {
            return;
        }

        const sharedCanvas = this._openDataContext.canvas;
        img.reset(sharedCanvas);
        if (sharedCanvas.width > img.width || sharedCanvas.height > img.height) {
            this._texture.create(sharedCanvas.width, sharedCanvas.height);
        }

        this._texture.uploadData(sharedCanvas);
    }

    private _registerNodeEvent () {
        this.node.on(NodeEventType.TRANSFORM_CHANGED, this._updateSubContextView, this);
        this.node.on(NodeEventType.SIZE_CHANGED, this._updateSubContextView, this);
        this.node.on(NodeEventType.LAYER_CHANGED, this._updateContentLayer, this);
    }

    private _unregisterNodeEvent () {
        this.node.off(NodeEventType.TRANSFORM_CHANGED, this._updateSubContextView, this);
        this.node.off(NodeEventType.SIZE_CHANGED, this._updateSubContextView, this);
        this.node.off(NodeEventType.LAYER_CHANGED, this._updateContentLayer, this);
    }

    private _updateContentLayer () {
        this._content.layer = this.node.layer;
    }

    public update (dt?: number) {
        const calledUpdateManually = (dt === undefined);
        if (calledUpdateManually) {
            this._updateSubContextTexture();
            return;
        }
        const now = performance.now();
        const deltaTime = (now - this._updatedTime);
        if (deltaTime >= this._updateInterval) {
            this._updatedTime += this._updateInterval;
            this._updateSubContextTexture();
        }
    }

    public onDestroy () {
        this._content.destroy();
        this._texture.destroy();
        if (this._sprite) { this._sprite.destroy(); }
        this._imageAsset.destroy();
        this._openDataContext = null;
    }
}

legacyCC.SubContextView = SubContextView;

/*
 Copyright (c) 2020 Xiamen Yaji Software Co., Ltd.

 https://www.cocos.com/

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
import { JSB } from 'internal:constants';
import { screenAdapter } from 'pal/screen-adapter';
import { Orientation } from '../../../../pal/screen-adapter/enum-type';
import {
    TextureType, TextureUsageBit, Format, RenderPass, Texture, Framebuffer,
    RenderPassInfo, Device, TextureInfo, FramebufferInfo, Swapchain, SurfaceTransform,
} from '../../gfx';
import { Root } from '../../root';
import { Camera } from '../scene';

export interface IRenderWindowInfo {
    title?: string;
    width: number;
    height: number;
    renderPassInfo: RenderPassInfo;
    swapchain?: Swapchain;
}

const orientationMap: Record<Orientation, SurfaceTransform> = {
    [Orientation.PORTRAIT]: SurfaceTransform.IDENTITY,
    [Orientation.LANDSCAPE_RIGHT]: SurfaceTransform.ROTATE_90,
    [Orientation.PORTRAIT_UPSIDE_DOWN]: SurfaceTransform.ROTATE_180,
    [Orientation.LANDSCAPE_LEFT]: SurfaceTransform.ROTATE_270,
};

/**
 * @en The render window represents the render target, it could be an off screen frame buffer or the on screen buffer.
 * @zh ????????????????????????????????????????????????????????????????????????????????????????????????
 */
export class RenderWindow {
    /**
     * @en Get window width. Pre-rotated (i.e. rotationally invariant, always in identity/portrait mode) if possible.
     * If you want to get oriented size instead, you should use [[renderer.scene.Camera.width]] which corresponds to the current screen rotation.
     * @zh ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????? [[renderer.scene.Camera.width]]???
     */
    get width (): number {
        return this._width;
    }

    /**
     * @en Get window height. Pre-rotated (i.e. rotationally invariant, always in identity/portrait mode) if possible.
     * If you want to get oriented size instead, you should use [[renderer.scene.Camera.width]] which corresponds to the current screen rotation.
     * @zh ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????? [[renderer.scene.Camera.height]]???
     */
    get height (): number {
        return this._height;
    }

    /**
     * @en Get the swapchain for this window, if there is one
     * @zh ????????????????????????????????????????????????
     */
    get swapchain () {
        return this._swapchain;
    }

    /**
     * @en Get window frame buffer.
     * @zh ??????????????????
     */
    get framebuffer (): Framebuffer {
        return this._framebuffer!;
    }

    get cameras () {
        return this._cameras;
    }

    protected _title = '';
    protected _width = 1;
    protected _height = 1;
    protected _swapchain: Swapchain = null!;
    protected _renderPass: RenderPass | null = null;
    protected _colorTextures: Texture[] = [];
    protected _depthStencilTexture: Texture | null = null;
    protected _cameras: Camera[] = [];
    protected _hasOnScreenAttachments = false;
    protected _hasOffScreenAttachments = false;
    protected _framebuffer: Framebuffer | null = null;

    /**
     * @private
     */
    public static registerCreateFunc (root: Root) {
        root._createWindowFun = (_root: Root): RenderWindow => new RenderWindow(_root);
    }

    private constructor (root: Root) {}

    public initialize (device: Device, info: IRenderWindowInfo): boolean {
        if (info.title !== undefined) {
            this._title = info.title;
        }

        if (info.swapchain !== undefined) {
            this._swapchain = info.swapchain;
        }

        this._width = info.width;
        this._height = info.height;
        this._renderPass = device.createRenderPass(info.renderPassInfo);

        if (info.swapchain) {
            this._swapchain = info.swapchain;
            this._colorTextures.push(info.swapchain.colorTexture);
            this._depthStencilTexture = info.swapchain.depthStencilTexture;
        } else {
            for (let i = 0; i < info.renderPassInfo.colorAttachments.length; i++) {
                this._colorTextures.push(device.createTexture(new TextureInfo(
                    TextureType.TEX2D,
                    TextureUsageBit.COLOR_ATTACHMENT | TextureUsageBit.SAMPLED | TextureUsageBit.TRANSFER_SRC,
                    info.renderPassInfo.colorAttachments[i].format,
                    this._width,
                    this._height,
                )));
            }
            if (info.renderPassInfo.depthStencilAttachment.format !== Format.UNKNOWN) {
                this._depthStencilTexture = device.createTexture(new TextureInfo(
                    TextureType.TEX2D,
                    TextureUsageBit.DEPTH_STENCIL_ATTACHMENT | TextureUsageBit.SAMPLED,
                    info.renderPassInfo.depthStencilAttachment.format,
                    this._width,
                    this._height,
                ));
                this._hasOffScreenAttachments = true;
            }
        }
        this._framebuffer = device.createFramebuffer(new FramebufferInfo(
            this._renderPass,
            this._colorTextures,
            this._depthStencilTexture,
        ));

        return true;
    }

    public destroy () {
        this.clearCameras();

        if (this._framebuffer) {
            this._framebuffer.destroy();
            this._framebuffer = null;
        }

        if (this._depthStencilTexture) {
            this._depthStencilTexture.destroy();
            this._depthStencilTexture = null;
        }

        for (let i = 0; i < this._colorTextures.length; i++) {
            const colorTexture = this._colorTextures[i];
            if (colorTexture) {
                colorTexture.destroy();
            }
        }
        this._colorTextures.length = 0;
    }

    /**
     * @en Resize window.
     * @zh ?????????????????????
     * @param width The new width.
     * @param height The new height.
     */
    public resize (width: number, height: number) {
        if (this._swapchain) {
            this._swapchain.resize(width, height, orientationMap[screenAdapter.orientation]);
            this._width = this._swapchain.width;
            this._height = this._swapchain.height;
        } else {
            for (let i = 0; i < this._colorTextures.length; i++) {
                this._colorTextures[i].resize(width, height);
            }
            if (this._depthStencilTexture) {
                this._depthStencilTexture.resize(width, height);
            }
            this._width = width;
            this._height = height;
        }

        if (this.framebuffer) {
            this.framebuffer.destroy();
            this.framebuffer.initialize(new FramebufferInfo(
                this._renderPass!,
                this._colorTextures,
                this._depthStencilTexture,
            ));
        }

        for (const camera of this._cameras) {
            camera.resize(width, height);
        }
    }

    /**
     * @en Extract all render cameras attached to the render window to the output cameras list
     * @zh ??????????????????????????????????????????????????????????????????????????????
     * @param cameras @en The output cameras list, should be empty before invoke this function
     *                @zh ????????????????????????????????????????????????
     */
    public extractRenderCameras (cameras: Camera[]) {
        for (let j = 0; j < this._cameras.length; j++) {
            const camera = this._cameras[j];
            if (camera.enabled) {
                camera.update();
                cameras.push(camera);
            }
        }
    }

    /**
     * @en Attach a new camera to the render window
     * @zh ??????????????????
     * @param camera @en The camera to attach @zh ??????????????????
     */
    public attachCamera (camera: Camera) {
        for (let i = 0; i < this._cameras.length; i++) {
            if (this._cameras[i] === camera) {
                return;
            }
        }
        this._cameras.push(camera);
        this.sortCameras();
    }

    /**
     * @en Detach a camera from the render window
     * @zh ??????????????????????????????
     * @param camera @en The camera to detach @zh ??????????????????
     */
    public detachCamera (camera: Camera) {
        for (let i = 0; i < this._cameras.length; ++i) {
            if (this._cameras[i] === camera) {
                this._cameras.splice(i, 1);
                return;
            }
        }
    }

    /**
     * @en Clear all attached cameras
     * @zh ????????????????????????
     */
    public clearCameras () {
        this._cameras.length = 0;
    }

    /**
     * @en Sort all attached cameras with priority
     * @zh ?????????????????????????????????????????????
     */
    public sortCameras () {
        this._cameras.sort((a: Camera, b: Camera) => a.priority - b.priority);
    }
}

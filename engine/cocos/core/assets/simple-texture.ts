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

import { ccclass } from 'cc.decorator';
import { DEV } from 'internal:constants';
import { TextureFlagBit, TextureUsageBit, API, Texture, TextureInfo, TextureViewInfo, Device, BufferTextureCopy } from '../gfx';
import { assertID, error } from '../platform/debug';
import { Filter } from './asset-enum';
import { ImageAsset } from './image-asset';
import { TextureBase } from './texture-base';
import { legacyCC } from '../global-exports';
import { macro } from '../platform/macro';
import dependUtil from '../asset-manager/depend-util';
import { fastRemoveAt } from '../utils/array';

const _regions: BufferTextureCopy[] = [new BufferTextureCopy()];

export type PresumedGFXTextureInfo = Pick<TextureInfo, 'usage' | 'flags' | 'format' | 'levelCount'>;
export type PresumedGFXTextureViewInfo = Pick<TextureViewInfo, 'texture' | 'format' | 'baseLevel' | 'levelCount'>;

function getMipLevel (width: number, height: number) {
    let size = Math.max(width, height);
    let level = 0;
    while (size) { size >>= 1; level++; }
    return level;
}

function isPOT (n: number) { return n && (n & (n - 1)) === 0; }
function canGenerateMipmap (device: Device, w: number, h: number) {
    const needCheckPOT = device.gfxAPI === API.WEBGL;
    if (needCheckPOT) { return isPOT(w) && isPOT(h); }
    return true;
}

/**
 * @en The simple texture base class.
 * It create the GFX Texture and can set mipmap levels.
 * @zh ?????????????????????
 * ??????????????????????????? GFX ???????????????????????? GFX ???????????????
 * ????????????????????????????????? Mipmap ?????????
 */
@ccclass('cc.SimpleTexture')
export class SimpleTexture extends TextureBase {
    protected _gfxTexture: Texture | null = null;
    protected _gfxTextureView: Texture | null = null;
    private _mipmapLevel = 1;
    // Cache these data to reduce JSB invoking.
    private _textureWidth = 0;
    private _textureHeight = 0;

    protected _baseLevel = 0;
    protected _maxLevel = 1000;

    /**
     * @en The mipmap level of the texture
     * @zh ???????????? Mipmap ????????????
     */
    get mipmapLevel () {
        return this._mipmapLevel;
    }

    /**
     * @en The GFX Texture resource
     * @zh ???????????????????????? GFX ???????????????
     */
    public getGFXTexture () {
        return this._gfxTextureView;
    }

    public destroy () {
        this._tryDestroyTextureView();
        this._tryDestroyTexture();
        return super.destroy();
    }

    /**
     * @en Update the level 0 mipmap image.
     * @zh ?????? 0 ??? Mipmap???
     */
    public updateImage () {
        this.updateMipmaps(0);
    }

    /**
     * @en Update the given level mipmap image.
     * @zh ?????????????????????????????? Mipmap?????? Mipmap ?????????????????????????????????????????????????????????
     * ???????????????????????????????????????????????????????????????????????????????????????????????????????????????
     * @param firstLevel First level to be updated
     * @param count Mipmap level count to be updated
     */
    public updateMipmaps (firstLevel = 0, count?: number) {

    }

    /**
     * @en Upload data to the given mipmap level.
     * The size of the image will affect how the mipmap is updated.
     * - When the image is an ArrayBuffer, the size of the image must match the mipmap size.
     * - If the image size matches the mipmap size, the mipmap data will be updated entirely.
     * - If the image size is smaller than the mipmap size, the mipmap will be updated from top left corner.
     * - If the image size is larger, an error will be raised
     * @zh ???????????????????????????????????? Mipmap ??????
     * ????????????????????? Mipmap ??????????????????
     * - ???????????? `ArrayBuffer` ?????????????????????????????? Mipmap ???????????????????????????
     * - ????????????????????? Mipmap ????????????????????????????????? Mipmap ????????????????????????????????????
     * - ???????????????????????????????????? Mipmap ?????????????????????????????????????????????????????????????????????????????????????????? Mipmap ???????????????
     * - ??????????????????????????????????????? Mipmap ?????????????????????????????????????????????????????????
     * @param source The source image or image data
     * @param level Mipmap level to upload the image to
     * @param arrayIndex The array index
     */
    public uploadData (source: HTMLCanvasElement | HTMLImageElement | ArrayBufferView | ImageBitmap, level = 0, arrayIndex = 0) {
        if (!this._gfxTexture || this._mipmapLevel <= level) {
            return;
        }

        const gfxDevice = this._getGFXDevice();
        if (!gfxDevice) {
            return;
        }

        const region = _regions[0];
        region.texExtent.width = this._textureWidth >> level;
        region.texExtent.height = this._textureHeight >> level;
        region.texSubres.mipLevel = level;
        region.texSubres.baseArrayLayer = arrayIndex;

        if (DEV) {
            if (source instanceof HTMLElement) {
                if (source.height > region.texExtent.height
                    || source.width > region.texExtent.width) {
                    error(`Image source(${this.name}) bounds override.`);
                }
            }
        }

        if (ArrayBuffer.isView(source)) {
            gfxDevice.copyBuffersToTexture([source], this._gfxTexture, _regions);
        } else {
            gfxDevice.copyTexImagesToTexture([source], this._gfxTexture, _regions);
        }
    }

    protected _assignImage (image: ImageAsset, level: number, arrayIndex?: number) {
        const data = image.data;
        if (!data) {
            return;
        }
        this.uploadData(data, level, arrayIndex);
        this._checkTextureLoaded();

        if (macro.CLEANUP_IMAGE_CACHE) {
            const deps = dependUtil.getDeps(this._uuid);
            const index = deps.indexOf(image._uuid);
            if (index !== -1) {
                fastRemoveAt(deps, index);
                image.decRef();
            }
        }
    }

    protected _checkTextureLoaded () {
        this._textureReady();
    }

    protected _textureReady () {
        this.loaded = true;
        this.emit('load');
    }

    /**
     * @en
     * Set mipmap level of this texture.
     * The value is passes as presumed info to `this._getGfxTextureCreateInfo()`.
     * @zh
     * ?????????????????? mipmap ??????
     * @param value The mipmap level.
     */
    protected _setMipmapLevel (value: number) {
        this._mipmapLevel = value < 1 ? 1 : value;
    }

    protected _setMipRange (baseLevel: number, maxLevel: number) {
        this._baseLevel = baseLevel < 1 ? 0 : baseLevel;
        this._maxLevel = maxLevel < 1 ? 0 : maxLevel;
    }

    /**
     * @en Set mipmap level range for this texture.
     * @zh ????????????????????? mipmap ?????????
     * @param baseLevel The base mipmap level.
     * @param maxLevel The maximum mipmap level.
     */
    public setMipRange (baseLevel: number, maxLevel: number) {
        assertID(baseLevel <= maxLevel, 3124);

        this._setMipRange(baseLevel, maxLevel);

        const device = this._getGFXDevice();
        if (!device) {
            return;
        }
        // create a new texture view before the destruction of the previous one to bypass the bug that
        // vulkan destroys textureview in use. This is a temporary solution, should be fixed later.
        const textureView = this._createTextureView(device);
        this._tryDestroyTextureView();
        this._gfxTextureView = textureView;
    }

    /**
     * @en This method is override by derived classes to provide GFX texture info.
     * @zh ??????????????????????????????????????? GFX ???????????????
     * @param presumed The presumed GFX texture info.
     */
    protected _getGfxTextureCreateInfo (presumed: PresumedGFXTextureInfo): TextureInfo | null {
        return null;
    }

    /**
     * @en This method is overrided by derived classes to provide GFX TextureViewInfo.
     * @zh ??????????????????????????????????????? GFX ?????????????????????
     * @param presumed The presumed GFX TextureViewInfo.
     */
    protected _getGfxTextureViewCreateInfo (presumed: PresumedGFXTextureViewInfo): TextureViewInfo | null {
        return null;
    }

    protected _tryReset () {
        this._tryDestroyTextureView();
        this._tryDestroyTexture();
        if (this._mipmapLevel === 0) {
            return;
        }
        const device = this._getGFXDevice();
        if (!device) {
            return;
        }
        this._createTexture(device);
        this._gfxTextureView = this._createTextureView(device);
    }

    /**
     * @en Whether mipmaps are baked convolutional maps.
     * @zh mipmaps????????????????????????????????????
     */
    public isUsingOfflineMipmaps (): boolean {
        return false;
    }

    protected _createTexture (device: Device) {
        if (this._width === 0 || this._height === 0) { return; }
        let flags = TextureFlagBit.NONE;
        if (this._mipFilter !== Filter.NONE && canGenerateMipmap(device, this._width, this._height)) {
            this._mipmapLevel = getMipLevel(this._width, this._height);
            if (!this.isUsingOfflineMipmaps()) {
                flags = TextureFlagBit.GEN_MIPMAP;
            }
        }
        const textureCreateInfo = this._getGfxTextureCreateInfo({
            usage: TextureUsageBit.SAMPLED | TextureUsageBit.TRANSFER_DST,
            format: this._getGFXFormat(),
            levelCount: this._mipmapLevel,
            flags,
        });
        if (!textureCreateInfo) {
            return;
        }

        const texture = device.createTexture(textureCreateInfo);
        this._textureWidth = textureCreateInfo.width;
        this._textureHeight = textureCreateInfo.height;

        this._gfxTexture = texture;
    }

    protected _createTextureView (device: Device): Texture | null {
        if (!this._gfxTexture) {
            return null;
        }
        const maxLevel = this._maxLevel < this._mipmapLevel ? this._maxLevel : this._mipmapLevel - 1;
        const textureViewCreateInfo = this._getGfxTextureViewCreateInfo({
            texture: this._gfxTexture,
            format: this._getGFXFormat(),
            baseLevel: this._baseLevel,
            levelCount: maxLevel - this._baseLevel + 1,
        });
        if (!textureViewCreateInfo) {
            return null;
        }

        return device.createTexture(textureViewCreateInfo);
    }

    protected _tryDestroyTexture () {
        if (this._gfxTexture) {
            this._gfxTexture.destroy();
            this._gfxTexture = null;
        }
    }

    protected _tryDestroyTextureView () {
        if (this._gfxTextureView) {
            this._gfxTextureView.destroy();
            this._gfxTextureView = null;
        }
    }
}

legacyCC.SimpleTexture = SimpleTexture;

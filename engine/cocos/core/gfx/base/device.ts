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

import {
    API, Feature, MemoryStatus,
    CommandBufferInfo, BufferInfo, BufferViewInfo, TextureInfo, TextureViewInfo, SamplerInfo, DescriptorSetInfo,
    ShaderInfo, InputAssemblerInfo, RenderPassInfo, FramebufferInfo, DescriptorSetLayoutInfo, PipelineLayoutInfo,
    QueueInfo, BufferTextureCopy, DeviceInfo, DeviceCaps, GeneralBarrierInfo, TextureBarrierInfo, BufferBarrierInfo,
    SwapchainInfo, BindingMappingInfo, Format, FormatFeature,
} from './define';
import { Buffer } from './buffer';
import { CommandBuffer } from './command-buffer';
import { DescriptorSet } from './descriptor-set';
import { DescriptorSetLayout } from './descriptor-set-layout';
import { PipelineLayout } from './pipeline-layout';
import { Framebuffer } from './framebuffer';
import { InputAssembler } from './input-assembler';
import { PipelineState, PipelineStateInfo } from './pipeline-state';
import { Queue } from './queue';
import { RenderPass } from './render-pass';
import { Sampler } from './states/sampler';
import { Shader } from './shader';
import { Texture } from './texture';
import { GeneralBarrier } from './states/general-barrier';
import { TextureBarrier } from './states/texture-barrier';
import { BufferBarrier } from './states/buffer-barrier';
import { Swapchain } from './swapchain';

/**
 * @en GFX Device.
 * @zh GFX ?????????
 */
export abstract class Device {
    /**
     * @en Current rendering API.
     * @zh ?????? GFX ??????????????? API???
     */
    get gfxAPI (): API {
        return this._gfxAPI;
    }

    /**
     * @en GFX default queue.
     * @zh GFX ???????????????
     */
    get queue (): Queue {
        return this._queue as Queue;
    }

    /**
     * @en GFX default command buffer.
     * @zh GFX ?????????????????????
     */
    get commandBuffer (): CommandBuffer {
        return this._cmdBuff as CommandBuffer;
    }

    /**
     * @en Renderer description.
     * @zh ??????????????????
     */
    get renderer (): string {
        return this._renderer;
    }

    /**
     * @en Vendor description.
     * @zh ???????????????
     */
    get vendor (): string {
        return this._vendor;
    }

    /**
     * @en Number of draw calls currently recorded.
     * @zh ?????????????????????
     */
    get numDrawCalls (): number {
        return this._numDrawCalls;
    }

    /**
     * @en Number of instances currently recorded.
     * @zh ?????? Instance ?????????
     */
    get numInstances (): number {
        return this._numInstances;
    }

    /**
     * @en Number of triangles currently recorded.
     * @zh ????????????????????????
     */
    get numTris (): number {
        return this._numTris;
    }

    /**
     * @en Total memory size currently allocated.
     * @zh ???????????????
     */
    get memoryStatus (): MemoryStatus {
        return this._memoryStatus;
    }

    /**
     * @en Current device capabilities.
     * @zh ???????????????????????????
     */
    get capabilities (): DeviceCaps {
        return this._caps;
    }

    /**
     * @en Current device binding mappings.
     * @zh ??????????????????????????????????????????
     */
    get bindingMappingInfo () {
        return this._bindingMappingInfo;
    }

    protected _gfxAPI = API.UNKNOWN;
    protected _renderer = '';
    protected _vendor = '';
    protected _features = new Array<boolean>(Feature.COUNT);
    protected _formatFeatures = new Array<FormatFeature>(Format.COUNT);
    protected _queue: Queue | null = null;
    protected _cmdBuff: CommandBuffer | null = null;
    protected _numDrawCalls = 0;
    protected _numInstances = 0;
    protected _numTris = 0;
    protected _memoryStatus = new MemoryStatus();
    protected _caps = new DeviceCaps();
    protected _bindingMappingInfo: BindingMappingInfo = new BindingMappingInfo();
    protected _samplers = new Map<number, Sampler>();
    protected _generalBarrierss = new Map<number, GeneralBarrier>();
    protected _textureBarriers = new Map<number, TextureBarrier>();
    protected _bufferBarriers = new Map<number, BufferBarrier>();

    public static canvas: HTMLCanvasElement; // Hack for WebGL device initialization process

    public abstract initialize (info: Readonly<DeviceInfo>): boolean;

    public abstract destroy (): void;

    /**
     * @en Acquire next swapchain image.
     * @zh ?????????????????????????????????
     */
    public abstract acquire (swapchains: Readonly<Swapchain[]>): void;

    /**
     * @en Present current swapchain image.
     * @zh ??????????????????????????????
     */
    public abstract present (): void;

    /**
     * @en Flush the specified command buffers.
     * @zh ????????????????????????????????????
     */
    public abstract flushCommands (cmdBuffs: Readonly<CommandBuffer[]>): void;

    /**
     * @en Create command buffer.
     * @zh ?????????????????????
     * @param info GFX command buffer description info.
     */
    public abstract createCommandBuffer (info: Readonly<CommandBufferInfo>): CommandBuffer;

    /**
     * @en Create swapchain.
     * @zh ??????????????????
     * @param info GFX swapchain description info.
     */
    public abstract createSwapchain (info: Readonly<SwapchainInfo>): Swapchain;

    /**
     * @en Create buffer.
     * @zh ???????????????
     * @param info GFX buffer description info.
     */
    public abstract createBuffer (info: Readonly<BufferInfo> | BufferViewInfo): Buffer;

    /**
     * @en Create texture.
     * @zh ???????????????
     * @param info GFX texture description info.
     */
    public abstract createTexture (info: Readonly<TextureInfo> | TextureViewInfo): Texture;

    /**
     * @en Create descriptor sets.
     * @zh ????????????????????????
     * @param info GFX descriptor sets description info.
     */
    public abstract createDescriptorSet (info: Readonly<DescriptorSetInfo>): DescriptorSet;

    /**
     * @en Create shader.
     * @zh ??????????????????
     * @param info GFX shader description info.
     */
    public abstract createShader (info: Readonly<ShaderInfo>): Shader;

    /**
     * @en Create input assembler.
     * @zh ???????????????
     * @param info GFX input assembler description info.
     */
    public abstract createInputAssembler (info: Readonly<InputAssemblerInfo>): InputAssembler;

    /**
     * @en Create render pass.
     * @zh ?????????????????????
     * @param info GFX render pass description info.
     */
    public abstract createRenderPass (info: Readonly<RenderPassInfo>): RenderPass;

    /**
     * @en Create frame buffer.
     * @zh ??????????????????
     * @param info GFX frame buffer description info.
     */
    public abstract createFramebuffer (info: Readonly<FramebufferInfo>): Framebuffer;

    /**
     * @en Create descriptor set layout.
     * @zh ???????????????????????????
     * @param info GFX descriptor set layout description info.
     */
    public abstract createDescriptorSetLayout (info: Readonly<DescriptorSetLayoutInfo>): DescriptorSetLayout;

    /**
     * @en Create pipeline layout.
     * @zh ?????????????????????
     * @param info GFX pipeline layout description info.
     */
    public abstract createPipelineLayout (info: Readonly<PipelineLayoutInfo>): PipelineLayout;

    /**
     * @en Create pipeline state.
     * @zh ?????????????????????
     * @param info GFX pipeline state description info.
     */
    public abstract createPipelineState (info: Readonly<PipelineStateInfo>): PipelineState;

    /**
     * @en Create queue.
     * @zh ???????????????
     * @param info GFX queue description info.
     */
    public abstract createQueue (info: Readonly<QueueInfo>): Queue;

    /**
     * @en Create sampler.
     * @zh ??????????????????
     * @param info GFX sampler description info.
     */
    public abstract getSampler (info: Readonly<SamplerInfo>): Sampler;

    /**
     * @en Get swapchains.
     * @zh ????????????????????????
     */
    public abstract getSwapchains (): Readonly<Swapchain[]>;

    /**
     * @en Create global barrier.
     * @zh ???????????????????????????
     * @param info GFX global barrier description info.
     */
    public abstract getGeneralBarrier (info: Readonly<GeneralBarrierInfo>): GeneralBarrier;

    /**
     * @en Create texture barrier.
     * @zh ???????????????????????????
     * @param info GFX texture barrier description info.
     */
    public abstract getTextureBarrier (info: Readonly<TextureBarrierInfo>): TextureBarrier;

    /**
     * @en Create buffer barrier.
     * @zh ??????buffer???????????????
     * @param info GFX buffer barrier description info.
     */
    public abstract getBufferBarrier (info: Readonly<BufferBarrierInfo>): BufferBarrier;

    /**
     * @en Copy buffers to texture.
     * @zh ????????????????????????
     * @param buffers The buffers to be copied.
     * @param texture The texture to copy to.
     * @param regions The region descriptions.
     */
    public abstract copyBuffersToTexture (buffers: Readonly<ArrayBufferView[]>, texture: Texture, regions: Readonly<BufferTextureCopy[]>): void;

    /**
     * @en Copy texture to buffers
     * @zh ?????????????????????
     * @param texture The texture to be copied.
     * @param buffers The buffer to copy to.
     * @param regions The region descriptions
     */
    public abstract copyTextureToBuffers (texture: Readonly<Texture>, buffers: ArrayBufferView[], regions: Readonly<BufferTextureCopy[]>): void;

    /**
     * @en Copy texture images to texture.
     * @zh ????????????????????????
     * @param texImages The texture to be copied.
     * @param texture The texture to copy to.
     * @param regions The region descriptions.
     */
    public abstract copyTexImagesToTexture (texImages: Readonly<TexImageSource[]>, texture: Texture, regions: Readonly<BufferTextureCopy[]>): void;

    /**
     * @en Whether the device has specific feature.
     * @zh ?????????????????????
     * @param feature The GFX feature to be queried.
     */
    public hasFeature (feature: Feature): boolean {
        return this._features[feature];
    }

    /**
     * @en The extent a specific format is supported by the backend.
     * @zh ???????????????????????????????????????
     * @param format The GFX format to be queried.
     */
    public getFormatFeatures (format: Format): FormatFeature {
        return this._formatFeatures[format];
    }
}

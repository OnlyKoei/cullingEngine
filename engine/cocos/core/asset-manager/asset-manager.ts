/*
 Copyright (c) 2019-2020 Xiamen Yaji Software Co., Ltd.

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

import { BUILD, EDITOR, PREVIEW, TEST } from 'internal:constants';
import { Asset } from '../assets/asset';
import { legacyCC } from '../global-exports';
import { error } from '../platform/debug';
import { sys } from '../platform/sys';
import { Settings, settings } from '../settings';
import { basename, extname } from '../utils/path';
import Bundle from './bundle';
import Cache, { ICache } from './cache';
import CacheManager from './cache-manager';
import dependUtil from './depend-util';
import downloader from './downloader';
import factory from './factory';
import fetch from './fetch';
import * as helper from './helper';
import load from './load';
import packManager from './pack-manager';
import parser from './parser';
import { IPipe, Pipeline } from './pipeline';
import preprocess from './preprocess';
import releaseManager from './release-manager';
import RequestItem from './request-item';
import {
    CompleteCallbackWithData,
    ProgressCallback,
    IBundleOptions,
    IOptions,
    IRemoteOptions,
    presets,
    Request,
    references,
    IJsonAssetOptions,
    assets, BuiltinBundleName, bundles, fetchPipeline, files, parsed, pipeline, transformPipeline } from './shared';

import Task from './task';
import { combine, parse } from './url-transformer';
import { asyncify, parseParameters } from './utilities';

/**
 * @zh
 * AssetManager ?????????
 * @en
 * AssetManager configuration.
 */
export interface IAssetManagerOptions {
    /* Only valid on Editor */
    importBase?: string;
    /* Only valid on Editor */
    nativeBase?: string;
    /* Only valid on native */
    jsbDownloaderMaxTasks?: number;
    /* Only valid on native */
    jsbDownloaderTimeout?: number;

    /**
     * @zh
     * ?????? bundle ???????????????
     * @en
     * Version for all bundles
     */
    bundleVers?: Record<string, string>;

    /**
     * @zh
     * ?????????????????????
     * @en
     * Remote server address
     */
    server?: string;

    /**
     * @zh
     * ?????????????????? bundle
     * @en
     * All subpackages
     */
    subpackages?: string[];

    /**
     * @zh
     * ????????????????????? bundle
     * @en
     * All remote bundles
     */
    remoteBundles?: string[];

}

/**
 * @en
 * This module controls asset's behaviors and information, include loading, releasing etc. it is a singleton
 * All member can be accessed with `assetManager`.
 *
 * @zh
 * ?????????????????????????????????????????????????????????????????????????????????????????????????????????????????? `assetManager` ??????
 *
 */
export class AssetManager {
    /**
     * @en
     * Normal loading pipeline
     *
     * @zh
     * ??????????????????
     *
     */
    public pipeline: Pipeline = pipeline.append(preprocess).append(load);

    /**
     * @en
     * Fetching pipeline
     *
     * @zh
     * ????????????
     *
     */
    public fetchPipeline: Pipeline = fetchPipeline.append(preprocess).append(fetch);

    /**
     * @en
     * Url transformer
     *
     * @zh
     * Url ?????????
     *
     */
    public transformPipeline: Pipeline = transformPipeline.append(parse).append(combine);

    /**
     * @en
     * The collection of bundle which is already loaded, you can remove cache with [[removeBundle]]
     *
     * @zh
     * ????????? bundle ???????????? ???????????? [[removeBundle]] ???????????????
     *
     */
    public bundles: ICache<Bundle> = bundles;

    /**
     * @en
     * The collection of asset which is already loaded, you can remove cache with [[releaseAsset]]
     *
     * @zh
     * ??????????????????????????? ???????????? [[releaseAsset]] ???????????????
     */
    public assets: ICache<Asset> = assets;

    public generalImportBase = '';
    public generalNativeBase = '';

    /**
     * @en
     * Manage relationship between asset and its dependencies
     *
     * @zh
     * ????????????????????????
     */
    public dependUtil = dependUtil;

    /**
     * @en
     * Whether or not load asset forcibly, if it is true, asset will be loaded regardless of error
     *
     * @zh
     * ????????????????????????, ????????? true ?????????????????????????????????
     *
     */
    public force = EDITOR || PREVIEW;

    /**
     * @en
     * Whether to use image bitmap to load image first. If enabled, images loading will become faster but memory usage will increase.
     *
     * @zh
     * ?????????????????? image bitmap ????????????????????????????????????????????????????????????, ???????????????????????????
     *
     */
    public allowImageBitmap = !sys.isMobile;

    /**
     * @en
     * Some useful function
     *
     * @zh
     * ?????????????????????
     *
     */
    public utils = helper;

    /**
     * @en
     * Manage all downloading task
     *
     * @zh
     * ????????????????????????
     *
     */
    public downloader = downloader;

    /**
     * @en
     * Manage all parsing task
     *
     * @zh
     * ????????????????????????
     *
     */
    public parser = parser;

    /**
     * @en
     * Manage all packed asset
     *
     * @zh
     * ??????????????????????????????
     *
     */
    public packManager = packManager;

    /**
     * @en
     * Whether or not cache the loaded asset
     *
     * @zh
     * ??????????????????????????????
     *
     */
    public cacheAsset = true;

    /**
     * @en
     * Cache manager is a module which controls all caches downloaded from server in non-web platform.
     *
     * @zh
     * ??????????????????????????????????????? WEB ??????????????????????????????????????????????????????????????????
     *
     */
    public cacheManager: CacheManager | null = null;

    /**
     * @en
     * The preset of options
     *
     * @zh
     * ????????????????????????
     *
     */
    public presets = presets;

    public factory = factory;

    public preprocessPipe: IPipe = preprocess;

    public fetchPipe: IPipe = fetch;

    public loadPipe: IPipe = load;

    public references = references;

    private _releaseManager = releaseManager;

    private _files = files;

    private _parsed = parsed;
    private _parsePipeline = BUILD ? null : new Pipeline('parse existing json', [this.loadPipe]);
    private _projectBundles: string[] = [];

    /**
     * @en
     * The builtin 'main' bundle
     *
     * @zh
     * ?????? main ???
     */
    public get main (): Bundle | null {
        return bundles.get(BuiltinBundleName.MAIN) || null;
    }

    /**
     * @en
     * The builtin 'resources' bundle
     *
     * @zh
     * ?????? resources ???
     *
     */
    public get resources (): Bundle | null {
        return bundles.get(BuiltinBundleName.RESOURCES) || null;
    }

    /**
     * @en
     * Initialize assetManager with options
     *
     * @zh
     * ????????????????????????
     *
     * @param options - the configuration
     *
     */
    public init (options: IAssetManagerOptions = {}) {
        const server = options.server || settings.querySettings(Settings.Category.ASSETS, 'server') || '';
        const bundleVers = options.bundleVers || settings.querySettings(Settings.Category.ASSETS, 'bundleVers') || {};
        const remoteBundles = options.remoteBundles || settings.querySettings(Settings.Category.ASSETS, 'remoteBundles') || [];
        this._files.clear();
        this._parsed.clear();
        this._releaseManager.init();
        this.assets.clear();
        this.bundles.clear();
        this.packManager.init();
        this.downloader.init(server, bundleVers, remoteBundles);
        this.parser.init();
        this.dependUtil.init();
        let importBase = options.importBase || settings.querySettings(Settings.Category.ASSETS, 'importBase') || '';
        if (importBase && importBase.endsWith('/')) {
            importBase = importBase.substr(0, importBase.length - 1);
        }
        let nativeBase = options.nativeBase || settings.querySettings(Settings.Category.ASSETS, 'nativeBase') || '';
        if (nativeBase && nativeBase.endsWith('/')) {
            nativeBase = nativeBase.substr(0, nativeBase.length - 1);
        }
        this.generalImportBase = importBase;
        this.generalNativeBase = nativeBase;
        this._projectBundles = settings.querySettings(Settings.Category.ASSETS, 'projectBundles') || [];
    }

    /**
     * @en
     * Get the bundle which has been loaded
     *
     * @zh
     * ????????????????????????
     *
     * @param name - The name of bundle
     * @return - The loaded bundle
     *
     * @example
     * // ${project}/assets/test1
     * assetManager.getBundle('test1');
     *
     * assetManager.getBundle('resources');
     *
     */
    public getBundle (name: string): Bundle | null {
        return bundles.get(name) || null;
    }

    /**
     * @en
     * Remove this bundle. NOTE: The asset within this bundle will not be released automatically,
     * you can call [[AssetManager.Bundle.releaseAll]] manually before remove it if you need
     *
     * @zh
     * ????????????, ????????????????????????????????????????????????, ?????????????????????????????????????????????????????? [[AssetManager.Bundle.releaseAll]] ????????????
     *
     * @param bundle - The bundle to be removed
     *
     * @typescript
     * removeBundle(bundle: AssetManager.Bundle): void
     */
    public removeBundle (bundle: Bundle) {
        bundle._destroy();
        bundles.remove(bundle.name);
    }

    /**
     * @en
     * General interface used to load assets with a progression callback and a complete callback. You can achieve almost all
     * effect you want with combination of `requests` and `options`.It is highly recommended that you use more simple API,
     * such as `load`, `loadDir` etc. Every custom parameter in `options` will be distribute to each of `requests`. if request
     * already has same one, the parameter in request will be given priority. Besides, if request has dependencies, `options`
     * will distribute to dependencies too. Every custom parameter in `requests` will be transferred to handler of `downloader`
     * and `parser` as `options`. You can register you own handler downloader or parser to collect these custom parameters for some effect.
     *
     * Reserved Keyword: `uuid`, `url`, `path`, `dir`, `scene`, `type`, `priority`, `preset`, `audioLoadMode`, `ext`,
     * `bundle`, `onFileProgress`, `maxConcurrency`, `maxRequestsPerFrame`, `maxRetryCount`, `version`, `xhrResponseType`,
     * `xhrWithCredentials`, `xhrMimeType`, `xhrTimeout`, `xhrHeader`, `reloadAsset`, `cacheAsset`, `cacheEnabled`,
     * Please DO NOT use these words as custom options!
     *
     * @zh
     * ????????????????????????????????????????????????????????????????????????????????? `request` ??? `options` ??????????????????????????????????????????????????????????????????????????????
     * ?????????????????????API????????? `load`???`loadDir` ??????`options` ???????????????????????????????????? `requests` ????????????????????????request?????????????????????
     * ???????????? `requests` ??????????????????????????????????????????????????? `options` ?????????????????????????????????????????????request?????????????????????????????? `options`
     * ?????????????????????????????? `downloader`, `parser` ????????????, ??????????????? `downloader`, `parser` ???????????????????????????????????????
     *
     * ???????????????: `uuid`, `url`, `path`, `dir`, `scene`, `type`, `priority`, `preset`, `audioLoadMode`, `ext`, `bundle`, `onFileProgress`,
     *  `maxConcurrency`, `maxRequestsPerFrame`, `maxRetryCount`, `version`, `xhrResponseType`, `xhrWithCredentials`, `xhrMimeType`, `xhrTimeout`, `xhrHeader`,
     *  `reloadAsset`, `cacheAsset`, `cacheEnabled`, ?????????????????????????????????????????????!
     *
     * @param requests - The request you want to load
     * @param options - Optional parameters
     * @param onProgress - Callback invoked when progression change
     * @param onProgress.finished - The number of the items that are already completed
     * @param onProgress.total - The total number of the items
     * @param onProgress.item - The current request item
     * @param onComplete - Callback invoked when finish loading
     * @param onComplete.err - The error occurred in loading process.
     * @param onComplete.data - The loaded content
     *
     * @example
     * assetManager.loadAny({url: 'http://example.com/a.png'}, (err, img) => log(img));
     * assetManager.loadAny(['60sVXiTH1D/6Aft4MRt9VC'], (err, assets) => log(assets));
     * assetManager.loadAny([{ uuid: '0cbZa5Y71CTZAccaIFluuZ'}, {url: 'http://example.com/a.png'}], (err, assets) => log(assets));
     * assetManager.downloader.register('.asset', (url, options, onComplete) => {
     *      url += '?userName=' + options.userName + "&password=" + options.password;
     *      assetManager.downloader.downloadFile(url, null, onComplete);
     * });
     * assetManager.parser.register('.asset', (file, options, onComplete) => {
     *      var json = JSON.parse(file);
     *      var skin = json[options.skin];
     *      var model = json[options.model];
     *      onComplete(null, {skin, model});
     * });
     * assetManager.loadAny({ url: 'http://example.com/my.asset', skin: 'xxx', model: 'xxx', userName: 'xxx', password: 'xxx' });
     *
     */
    public loadAny (requests: Request, options: IOptions | null, onProgress: ProgressCallback | null, onComplete: CompleteCallbackWithData | null): void;
    public loadAny (requests: Request, onProgress: ProgressCallback | null, onComplete: CompleteCallbackWithData | null): void;
    public loadAny (requests: Request, options: IOptions | null, onComplete?: CompleteCallbackWithData | null): void;
    public loadAny<T extends Asset> (requests: string, onComplete?: CompleteCallbackWithData<T> | null): void;
    public loadAny<T extends Asset> (requests: string[], onComplete?: CompleteCallbackWithData<T[]> | null): void;
    public loadAny (requests: Request, onComplete?: CompleteCallbackWithData | null): void;
    public loadAny (
        requests: Request,
        options?: IOptions | ProgressCallback | CompleteCallbackWithData | null,
        onProgress?: ProgressCallback | CompleteCallbackWithData | null,
        onComplete?: CompleteCallbackWithData | null,
    ) {
        const { options: opts, onProgress: onProg, onComplete: onComp } = parseParameters(options, onProgress, onComplete);
        opts.preset = opts.preset || 'default';
        requests = Array.isArray(requests) ? requests.slice() : requests;
        const task = Task.create({ input: requests, onProgress: onProg, onComplete: asyncify(onComp), options: opts });
        pipeline.async(task);
    }

    /**
     * @en
     * General interface used to preload assets with a progression callback and a complete callback.It is highly recommended that you use
     * more simple API, such as `preloadRes`, `preloadResDir` etc. Everything about preload is just likes `assetManager.loadAny`, the
     * difference is `assetManager.preloadAny` will only download asset but not parse asset. You need to invoke `assetManager.loadAny(preloadTask)`
     * to finish loading asset
     *
     * @zh
     * ????????????????????????????????????????????????????????????????????????????????????????????????????????? API ????????? `preloadRes`, `preloadResDir` ??????`preloadAny` ??? `loadAny`
     * ??????????????????????????? `preloadAny` ???????????????????????????????????????????????????????????? `assetManager.loadAny(preloadTask)` ????????????????????????
     *
     * @param requests - The request you want to preload
     * @param options - Optional parameters
     * @param onProgress - Callback invoked when progression change
     * @param onProgress.finished - The number of the items that are already completed
     * @param onProgress.total - The total number of the items
     * @param onProgress.item - The current request item
     * @param onComplete - Callback invoked when finish preloading
     * @param onComplete.err - The error occurred in preloading process.
     * @param onComplete.items - The preloaded content
     *
     * @example
     * assetManager.preloadAny('0cbZa5Y71CTZAccaIFluuZ', (err) => assetManager.loadAny('0cbZa5Y71CTZAccaIFluuZ'));
     *
     */
    public preloadAny (
        requests: Request,
        options: IOptions | null,
        onProgress: ProgressCallback | null,
        onComplete: CompleteCallbackWithData<RequestItem[]>|null): void;
    public preloadAny (requests: Request, onProgress: ProgressCallback | null, onComplete: CompleteCallbackWithData<RequestItem[]> | null): void;
    public preloadAny (requests: Request, options: IOptions | null, onComplete?: CompleteCallbackWithData<RequestItem[]> | null): void;
    public preloadAny (requests: Request, onComplete?: CompleteCallbackWithData<RequestItem[]> | null): void;
    public preloadAny (
        requests: Request,
        options?: IOptions | ProgressCallback | CompleteCallbackWithData<RequestItem[]> | null,
        onProgress?: ProgressCallback | CompleteCallbackWithData<RequestItem[]> | null,
        onComplete?: CompleteCallbackWithData<RequestItem[]> | null,
    ) {
        const { options: opts, onProgress: onProg, onComplete: onComp } = parseParameters(options, onProgress, onComplete);
        opts.preset = opts.preset || 'preload';
        requests = Array.isArray(requests) ? requests.slice() : requests;
        const task = Task.create({ input: requests, onProgress: onProg, onComplete: asyncify(onComp), options: opts });
        fetchPipeline.async(task);
    }

    /**
     * @en
     * Load remote asset with url, such as audio, image, text and so on.
     *
     * @zh
     * ?????? url ????????????????????????????????????????????????????????????
     *
     * @param url - The url of asset
     * @param options - Some optional parameters
     * @param options.audioLoadMode - Indicate which mode audio you want to load
     * @param options.ext - If the url does not have a extension name, you can specify one manually.
     * @param onComplete - Callback invoked when finish loading
     * @param onComplete.err - The error occurred in loading process.
     * @param onComplete.asset - The loaded texture
     *
     * @example
     * assetManager.loadRemote('http://www.cloud.com/test1.jpg', (err, texture) => console.log(err));
     * assetManager.loadRemote('http://www.cloud.com/test2.mp3', (err, audioClip) => console.log(err));
     * assetManager.loadRemote('http://www.cloud.com/test3', { ext: '.png' }, (err, texture) => console.log(err));
     *
     */
    public loadRemote<T extends Asset> (url: string, options: IRemoteOptions | null, onComplete?: CompleteCallbackWithData<T> | null): void;
    public loadRemote<T extends Asset> (url: string, onComplete?: CompleteCallbackWithData<T> | null): void;
    public loadRemote<T extends Asset> (url: string, options?: IRemoteOptions | CompleteCallbackWithData<T> | null, onComplete?: CompleteCallbackWithData<T> | null) {
        const { options: opts, onComplete: onComp } = parseParameters<CompleteCallbackWithData<T>>(options, undefined, onComplete);

        if (!opts.reloadAsset && this.assets.has(url)) {
            asyncify(onComp)(null, this.assets.get(url));
            return;
        }

        opts.__isNative__ = true;
        opts.preset = opts.preset || 'remote';
        this.loadAny({ url }, opts, null, (err, data) => {
            if (err) {
                error(err.message, err.stack);
                if (onComp) { onComp(err, data); }
            } else {
                factory.create(url, data, opts.ext || extname(url), opts, (p1, p2) => {
                    if (onComp) { onComp(p1, p2 as T); }
                });
            }
        });
    }

    /**
     * @en
     * load bundle
     *
     * @zh
     * ???????????????
     *
     * @param nameOrUrl - The name or root path of bundle
     * @param options - Some optional paramter, same like downloader.downloadFile
     * @param options.version - The version of this bundle, you can check config.json in this bundle
     * @param onComplete - Callback when bundle loaded or failed
     * @param onComplete.err - The occurred error, null indicates success
     * @param onComplete.bundle - The loaded bundle
     *
     * @example
     * loadBundle('http://localhost:8080/test', null, (err, bundle) => console.log(err));
     *
     */
    public loadBundle (nameOrUrl: string, options: IBundleOptions | null, onComplete?: CompleteCallbackWithData<Bundle> | null): void;
    public loadBundle (nameOrUrl: string, onComplete?: CompleteCallbackWithData<Bundle> | null): void;
    public loadBundle (nameOrUrl: string, options?: IBundleOptions | CompleteCallbackWithData<Bundle> | null, onComplete?: CompleteCallbackWithData<Bundle> | null) {
        const { options: opts, onComplete: onComp } = parseParameters<CompleteCallbackWithData<Bundle>>(options, undefined, onComplete);

        const bundleName = basename(nameOrUrl);

        if (this.bundles.has(bundleName)) {
            asyncify(onComp)(null, this.getBundle(bundleName));
            return;
        }

        opts.preset = opts.preset || 'bundle';
        opts.ext = 'bundle';
        opts.__isNative__ = true;
        this.loadAny({ url: nameOrUrl }, opts, null, (err, data) => {
            if (err) {
                error(err.message, err.stack);
                if (onComp) { onComp(err, data); }
            } else {
                factory.create(nameOrUrl, data, 'bundle', opts, (p1, p2) => {
                    if (onComp) { onComp(p1, p2 as Bundle); }
                });
            }
        });
    }

    /**
     * @en
     * Release asset and it's dependencies.
     * This method will not only remove the cache of the asset in assetManager, but also clean up its content.
     * For example, if you release a texture, the texture asset and its gl texture data will be freed up.
     * Notice, this method may cause the texture to be unusable, if there are still other nodes use the same texture,
     * they may turn to black and report gl errors.
     *
     * @zh
     * ?????????????????????????????????, ???????????????????????? assetManager ??????????????????????????????????????????????????????????????????
     * ?????????????????????????????? texture ??????????????? texture ????????? gl ??????????????????????????????
     * ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????? GL ?????????
     *
     * @param asset - The asset to be released
     *
     * @example
     * // release a texture which is no longer need
     * assetManager.releaseAsset(texture);
     *
     */
    public releaseAsset (asset: Asset): void {
        releaseManager.tryRelease(asset, true);
    }

    /**
     * @en
     * Release all unused assets. Refer to [[releaseAsset]] for detailed information.
     *
     * @zh
     * ????????????????????????????????????????????????????????? [[releaseAsset]]
     *
     * @engineInternal
     *
     */
    public releaseUnusedAssets () {
        assets.forEach((asset) => {
            releaseManager.tryRelease(asset);
        });
    }

    /**
     * @en
     * Release all assets. Refer to [[releaseAsset]] for detailed information.
     *
     * @zh
     * ?????????????????????????????????????????? [[releaseAsset]]
     *
     */
    public releaseAll () {
        assets.forEach((asset) => {
            releaseManager.tryRelease(asset, true);
        });
    }

    /**
     * For internal usage.
     * @param json
     * @param options
     * @param onComplete
     * @private
     */
    public loadWithJson<T extends Asset> (
        json: Record<string, any>,
        options: IJsonAssetOptions | null,
        onProgress: ProgressCallback | null,
        onComplete: CompleteCallbackWithData<T> | null): void;
    public loadWithJson<T extends Asset> (json: Record<string, any>, onProgress: ProgressCallback | null, onComplete: CompleteCallbackWithData<T> | null): void;
    public loadWithJson<T extends Asset> (json: Record<string, any>, options: IJsonAssetOptions | null, onComplete?: CompleteCallbackWithData<T> | null): void;
    public loadWithJson<T extends Asset> (json: Record<string, any>, onComplete?: CompleteCallbackWithData<T> | null): void;
    public loadWithJson<T extends Asset> (
        json: Record<string, any>,
        options?: IJsonAssetOptions | CompleteCallbackWithData<T> | null,
        onProgress?: ProgressCallback | CompleteCallbackWithData<T> | null,
        onComplete?: CompleteCallbackWithData<T> | null,
    ) {
        if (BUILD) { throw new Error('Only valid in Editor'); }

        const { options: opts, onProgress: onProg, onComplete: onComp } = parseParameters<CompleteCallbackWithData<T>>(options, onProgress, onComplete);

        const item = RequestItem.create();
        item.isNative = false;
        item.uuid = opts.assetId || (`${new Date().getTime()}${Math.random()}`);
        item.file = json;
        item.ext = '.json';

        const task = Task.create({
            input: [item],
            onProgress: onProg,
            options: opts,
            onComplete: asyncify((err, data: T) => {
                if (!err) {
                    if (!opts.assetId) {
                        data._uuid = '';
                    }
                }
                if (onComp) { onComp(err, data); }
            }),
        });
        this._parsePipeline!.async(task);
    }
}

AssetManager.Pipeline = Pipeline;
AssetManager.Task = Task;
AssetManager.Cache = Cache;
AssetManager.RequestItem = RequestItem;
AssetManager.Bundle = Bundle;
AssetManager.BuiltinBundleName = BuiltinBundleName;

export declare namespace AssetManager {
    export { Pipeline };
    export { Task };
    export { Cache };
    export { RequestItem };
    export { Bundle };
    export { BuiltinBundleName };
}

export default legacyCC.assetManager = new AssetManager();
legacyCC.AssetManager = AssetManager;

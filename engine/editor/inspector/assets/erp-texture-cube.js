exports.template = /* html */ `
<section class="asset-erp-texture-cube">
    <div class="content">
        <ui-prop>
            <ui-label slot="label" value="i18n:ENGINE.assets.erpTextureCube.anisotropy" tooltip="i18n:ENGINE.assets.erpTextureCube.anisotropyTip"></ui-label>
            <ui-num-input slot="content" id="anisotropy"></ui-num-input>
        </ui-prop>
        <ui-prop>
            <ui-label slot="label" value="i18n:ENGINE.assets.erpTextureCube.faceSize.name" tooltip="i18n:ENGINE.assets.erpTextureCube.faceSize.title"></ui-label>
            <ui-num-input slot="content" id="faceSize"></ui-num-input>
        </ui-prop>
        <ui-prop>
            <ui-label slot="label" value="i18n:ENGINE.assets.erpTextureCube.filterMode" tooltip="i18n:ENGINE.assets.erpTextureCube.filterModeTip"></ui-label>
            <ui-select slot="content" id="filterMode"></ui-select>
        </ui-prop>
        <section id="filterAdvancedSection">
            <ui-prop>
                <ui-label slot="label" value="i18n:ENGINE.assets.erpTextureCube.minFilter" tooltip="i18n:ENGINE.assets.erpTextureCube.minFilterTip"></ui-label>
                <ui-select slot="content" id="minfilter"></ui-select>
            </ui-prop>
            <ui-prop>
                <ui-label slot="label" value="i18n:ENGINE.assets.erpTextureCube.magFilter" tooltip="i18n:ENGINE.assets.erpTextureCube.magFilterTip"></ui-label>
                <ui-select slot="content" id="magfilter"></ui-select>
            </ui-prop>
            <ui-prop>
                <ui-label slot="label" value="i18n:ENGINE.assets.erpTextureCube.generateMipmaps" tooltip="i18n:ENGINE.assets.erpTextureCube.generateMipmapsTip"></ui-label>
                <ui-checkbox slot="content" id="generateMipmaps"></ui-checkbox>
            </ui-prop>
            <section id="generateMipmapsSection">
                <ui-prop>
                    <ui-label slot="label" tooltip="i18n:ENGINE.assets.erpTextureCube.mipFilterTip" value="i18n:ENGINE.assets.erpTextureCube.mipFilter"></ui-label>
                    <ui-select slot="content" id="mipfilter"></ui-select>
                </ui-prop>
            </section>
        </section>
        <ui-prop>
            <ui-label slot="label" value="i18n:ENGINE.assets.erpTextureCube.wrapMode" tooltip="i18n:ENGINE.assets.erpTextureCube.wrapModeTip"></ui-label>
            <ui-select slot="content" id="wrapMode"></ui-select>
        </ui-prop>
        <section id="wrapAdvancedSection">
            <ui-prop>
                <ui-label slot="label" value="i18n:ENGINE.assets.erpTextureCube.wrapModeS" tooltip="i18n:ENGINE.assets.erpTextureCube.wrapModeSTip"></ui-label>
                <ui-select slot="content" id="wrapModeS"></ui-select>
            </ui-prop>
            <ui-prop>
                <ui-label slot="label" value="i18n:ENGINE.assets.erpTextureCube.wrapModeT" tooltip="i18n:ENGINE.assets.erpTextureCube.wrapModeTTip"></ui-label>
                <ui-select slot="content" id="wrapModeT"></ui-select>
            </ui-prop>
        </section>
        <ui-prop>
            <ui-label slot="label" value="i18n:ENGINE.assets.erpTextureCube.bakeReflectionConvolution" tooltip="i18n:ENGINE.assets.erpTextureCube.bakeReflectionConvolution"></ui-label>
            <ui-checkbox id="mipBakeMode" slot="content" value="false"></ui-checkbox>
        </ui-prop>
    </div>
</section>
`;

exports.style = `
.asset-erp-texture-cube  ui-prop{
    margin-top: 4px;
}
.asset-erp-texture-cube #filterAdvancedSection,
.asset-erp-texture-cube #wrapAdvancedSection,
.asset-erp-texture-cube #generateMipmapsSection {
    margin-left: 1.2em;
    display: none;
}
`;

exports.$ = {
    anisotropy: '#anisotropy',
    faceSize: '#faceSize',
    filterMode: '#filterMode',
    filterAdvancedSection: '#filterAdvancedSection',
    minfilter: '#minfilter',
    magfilter: '#magfilter',
    generateMipmaps: '#generateMipmaps',
    generateMipmapsSection: '#generateMipmapsSection',
    mipfilter: '#mipfilter',
    wrapMode: '#wrapMode',
    wrapAdvancedSection: '#wrapAdvancedSection',
    wrapModeS: '#wrapModeS',
    wrapModeT: '#wrapModeT',
    mipBakeMode: '#mipBakeMode',
};

exports.ready = function() {
    for (const key in Elements) {
        if (typeof Elements[key].ready === 'function') {
            Elements[key].ready.call(this);
        }
    }
};

exports.update = function(assetList, metaList) {
    this.assetList = assetList;
    this.metaList = metaList;
    this.asset = assetList[0];
    this.meta = metaList[0];

    for (const key in Elements) {
        if (typeof Elements[key].update === 'function') {
            Elements[key].update.call(this);
        }
    }
};

const ModeMap = {
    filter: {
        'Nearest (None)': {
            minfilter: 'nearest',
            magfilter: 'nearest',
            mipfilter: 'none',
        },
        Bilinear: {
            minfilter: 'linear',
            magfilter: 'linear',
            mipfilter: 'none',
        },
        'Bilinear with Mipmaps': {
            minfilter: 'linear',
            magfilter: 'linear',
            mipfilter: 'nearest',
        },
        'Trilinear with Mipmaps': {
            minfilter: 'linear',
            magfilter: 'linear',
            mipfilter: 'linear',
        },
    },
    wrap: {
        Repeat: {
            wrapModeS: 'repeat',
            wrapModeT: 'repeat',
        },
        Clamp: {
            wrapModeS: 'clamp-to-edge',
            wrapModeT: 'clamp-to-edge',
        },
        Mirror: {
            wrapModeS: 'mirrored-repeat',
            wrapModeT: 'mirrored-repeat',
        },
    },
};

const Elements = {
    anisotropy: {
        ready() {
            this.$.anisotropy.addEventListener('change', this.dataChange.bind(this, 'anisotropy'));
        },
        update() {
            this.$.anisotropy.value = this.meta.userData.anisotropy;
            this.updateInvalid(this.$.anisotropy, 'anisotropy');
            this.updateReadonly(this.$.anisotropy);
        },
    },
    faceSize: {
        ready() {
            this.$.faceSize.addEventListener('change', this.dataChange.bind(this, 'faceSize'));
        },
        update() {
            this.$.faceSize.value = this.meta.userData.faceSize;
            this.updateInvalid(this.$.faceSize, 'faceSize');
            this.updateReadonly(this.$.faceSize);
        },
    },
    filterMode: {
        ready() {
            this.$.filterMode.addEventListener('change', this.dataChange.bind(this, 'filterMode'));
        },
        update() {
            let optionsHtml = '';
            // FilterMode ??????
            const types = Object.keys(ModeMap.filter).concat('Advanced');
            types.forEach((type) => {
                optionsHtml += `<option value="${type}">${type}</option>`;
            });
            this.$.filterMode.innerHTML = optionsHtml;

            // ?????? filterMode ????????????????????????????????????????????? Advanced
            let value = 'Advanced';
            for (const filterKey of Object.keys(ModeMap.filter)) {
                const filterItem = ModeMap.filter[filterKey];
                let flag = true;
                for (const key of Object.keys(filterItem)) {
                    if (this.meta.userData[key] !== filterItem[key]) {
                        flag = false;
                        break;
                    }
                }
                if (flag) {
                    value = filterKey;
                    break;
                }
            }
            this.$.filterMode.value = value;

            // ?????????????????????????????????????????????
            value === 'Advanced'
                ? (this.$.filterAdvancedSection.style.display = 'block')
                : (this.$.filterAdvancedSection.style.display = 'none');

            this.updateInvalid(this.$.filterMode, 'filterMode');
            this.updateReadonly(this.$.filterMode);
        },
    },
    minfilter: {
        ready() {
            this.$.minfilter.addEventListener('change', this.dataChange.bind(this, 'minfilter'));
        },
        update() {
            let optionsHtml = '';
            const types = ['nearest', 'linear'];
            types.forEach((type) => {
                optionsHtml += `<option value="${type}">${type.toUpperCase()}</option>`;
            });
            this.$.minfilter.innerHTML = optionsHtml;

            this.$.minfilter.value = this.meta.userData.minfilte || 'nearest';
            this.updateInvalid(this.$.minfilter, 'minfilter');
            this.updateReadonly(this.$.minfilter);
        },
    },
    magfilter: {
        ready() {
            this.$.magfilter.addEventListener('change', this.dataChange.bind(this, 'magfilter'));
        },
        update() {
            let optionsHtml = '';
            const types = ['nearest', 'linear'];
            types.forEach((type) => {
                optionsHtml += `<option value="${type}">${type.toUpperCase()}</option>`;
            });
            this.$.magfilter.innerHTML = optionsHtml;

            this.$.magfilter.value = this.meta.userData.magfilter || 'nearest';
            this.updateInvalid(this.$.magfilter, 'magfilter');
            this.updateReadonly(this.$.magfilter);
        },
    },
    generateMipmaps: {
        ready() {
            this.$.generateMipmaps.addEventListener('change', this.dataChange.bind(this, 'generateMipmaps'));
        },
        update() {
            this.$.generateMipmaps.value = this.meta.userData.mipfilter ? this.meta.userData.mipfilter !== 'none' : false;

            // ??????????????????????????? mipfilter ??????
            this.$.generateMipmaps.value
                ? (this.$.generateMipmapsSection.style.display = 'block')
                : (this.$.generateMipmapsSection.style.display = 'none');

            this.updateInvalid(this.$.generateMipmaps, 'generateMipmaps');
            this.updateReadonly(this.$.generateMipmaps);
        },
    },
    mipfilter: {
        ready() {
            this.$.mipfilter.addEventListener('change', this.dataChange.bind(this, 'mipfilter'));
        },
        update() {
            let optionsHtml = '';
            const types = ['nearest', 'linear'];
            types.forEach((type) => {
                optionsHtml += `<option value="${type}">${type.toUpperCase()}</option>`;
            });
            this.$.mipfilter.innerHTML = optionsHtml;

            this.$.mipfilter.value = this.meta.userData.mipfilter || 'nearest';
            this.updateInvalid(this.$.mipfilter, 'mipfilter');
            this.updateReadonly(this.$.mipfilter);
        },
    },
    wrapMode: {
        ready() {
            this.$.wrapMode.addEventListener('change', this.dataChange.bind(this, 'wrapMode'));
        },
        update() {
            let optionsHtml = '';
            // WrapMode ??????
            const types = Object.keys(ModeMap.wrap).concat('Advanced');
            types.forEach((type) => {
                optionsHtml += `<option value="${type}">${type}</option>`;
            });
            this.$.wrapMode.innerHTML = optionsHtml;

            // ?????? wrapMode ????????????????????????????????????????????? Advanced
            let value = 'Advanced';
            for (const wrapKey of Object.keys(ModeMap.wrap)) {
                const wrapItem = ModeMap.wrap[wrapKey];
                let flag = true;
                for (const key of Object.keys(wrapItem)) {
                    if (this.meta.userData[key] !== wrapItem[key]) {
                        flag = false;
                        break;
                    }
                }
                if (flag) {
                    value = wrapKey;
                    break;
                }
            }
            this.$.wrapMode.value = value;

            // ?????????????????????????????????????????????
            value === 'Advanced'
                ? (this.$.wrapAdvancedSection.style.display = 'block')
                : (this.$.wrapAdvancedSection.style.display = 'none');

            this.updateInvalid(this.$.wrapMode, 'wrapMode');
            this.updateReadonly(this.$.wrapMode);
        },
    },
    wrapModeS: {
        ready() {
            this.$.wrapModeS.addEventListener('change', this.dataChange.bind(this, 'wrapModeS'));
        },
        update() {
            let optionsHtml = '';
            const types = {
                Repeat: 'repeat',
                Clamp: 'clamp-to-edge',
                Mirror: 'mirrored-repeat',
            };
            for (const type in types) {
                optionsHtml += `<option value="${types[type]}">${type}</option>`;
            }
            this.$.wrapModeS.innerHTML = optionsHtml;

            this.$.wrapModeS.value = this.meta.userData.wrapModeS || 'repeat';
            this.updateInvalid(this.$.wrapModeS, 'wrapModeS');
            this.updateReadonly(this.$.wrapModeS);
        },
    },
    wrapModeT: {
        ready() {
            this.$.wrapModeT.addEventListener('change', this.dataChange.bind(this, 'wrapModeT'));
        },
        update() {
            let optionsHtml = '';
            const types = {
                Repeat: 'repeat',
                Clamp: 'clamp-to-edge',
                Mirror: 'mirrored-repeat',
            };
            for (const type in types) {
                optionsHtml += `<option value="${types[type]}">${type}</option>`;
            }
            this.$.wrapModeT.innerHTML = optionsHtml;

            this.$.wrapModeT.value = this.meta.userData.wrapModeT || 'repeat';
            this.updateInvalid(this.$.wrapModeT, 'wrapModeT');
            this.updateReadonly(this.$.wrapModeT);
        },
    },
    mipBakeMode: {
        ready() {
            this.$.mipBakeMode.addEventListener('change', this.dataChange.bind(this, 'mipBakeMode'));
        },
        update() {
            this.$.mipBakeMode.value = this.meta.userData.mipBakeMode === 2 ? true : false;
            this.updateInvalid(this.$.mipBakeMode, 'mipBakeMode');
            this.updateReadonly(this.$.mipBakeMode);
        },
    },
};

exports.methods = {
    updateInvalid(element, prop) {
        let invalid;
        // filterMode??? wrapMode ??? generateMipmaps ????????????????????????
        switch (prop) {
            case 'filterMode':
                invalid = this.metaList.some((meta) => {
                    for (const key of Object.keys(ModeMap.filter.Bilinear)) {
                        if (meta.userData[key] !== this.meta.userData[key]) {
                            return true;
                        }
                    }
                    return false;
                });
                break;
            case 'wrapMode':
                invalid = this.metaList.some((meta) => {
                    for (const key of Object.keys(ModeMap.wrap.Repeat)) {
                        if (meta.userData[key] !== this.meta.userData[key]) {
                            return true;
                        }
                    }
                    return false;
                });
                break;
            case 'generateMipmaps':
                invalid = this.metaList.some((meta) => {
                    return meta.userData['mipfilter'] !== this.meta.userData['mipfilter'];
                });
                break;
            default:
                invalid = this.metaList.some((meta) => {
                    return meta.userData[prop] !== this.meta.userData[prop];
                });
                break;
        }
        element.invalid = invalid;
    },
    updateReadonly(element) {
        if (this.asset.readonly) {
            element.setAttribute('disabled', true);
        } else {
            element.removeAttribute('disabled');
        }
    },
    dataChange(key, event) {
        let value = event.target.value;
        if (key === 'mipBakeMode') {
            value = event.target.value ? 2 : 1;
        }
        this.metaList.forEach((meta) => {
            if (key === 'filterMode') {
                if (ModeMap.filter[value]) {
                    const data = ModeMap.filter[value];
                    for (const key of Object.keys(data)) {
                        meta.userData[key] = data[key];
                    }
                    this.$.filterAdvancedSection.style.display = 'none';
                } else {
                    // ?????? advanced ??????????????????
                    this.$.filterAdvancedSection.style.display = 'block';
                }
            } else if (key === 'generateMipmaps') {
                if (!value) {
                    // ????????? ?????? mipmaps???????????? mipfilter ??????
                    meta.userData.mipfilter = 'none';
                    this.$.generateMipmapsSection.style.display = 'none';
                } else {
                    this.$.generateMipmapsSection.style.display = 'block';
                    if (this.$.mipfilter.value === 'none') {
                        this.$.mipfilter.value = 'nearest';
                        // TODO: ?????? ui-select ?????? .value ?????????????????????????????? change ???????????????????????????
                        this.$.mipfilter.dispatch('change');
                    }
                }
            } else if (key === 'wrapMode') {
                if (ModeMap.wrap[value]) {
                    const data = ModeMap.wrap[value];
                    for (const key of Object.keys(data)) {
                        meta.userData[key] = data[key];
                    }
                    this.$.wrapAdvancedSection.style.display = 'none';
                } else {
                    // ?????? advanced ????????????????????????
                    this.$.wrapAdvancedSection.style.display = 'block';
                }
            } else {
                meta.userData[key] = value || undefined;
            }
        });

        this.dispatch('change');
    },
};

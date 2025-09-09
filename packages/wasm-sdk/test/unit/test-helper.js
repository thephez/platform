const { readFileSync } = require('fs');
const { fileURLToPath } = require('url');
const { dirname, join } = require('path');
const { webcrypto } = require('crypto');
const { expect } = require('chai');

// Set up globals for WASM
if (!global.crypto) {
    Object.defineProperty(global, 'crypto', {
        value: webcrypto,
        writable: true,
        configurable: true
    });
}

// Test helper class for managing SDK instances
class TestContext {
    constructor() {
        this.sdkInstances = [];
        this.wasmInitialized = false;
        this.wasmModule = null;
        this.wasmSdk = null;
    }

    async initializeWasm() {
        if (this.wasmInitialized) {
            return this.wasmModule;
        }

        // Dynamic import of ES module
        this.wasmSdk = await import('../../pkg/wasm_sdk.js');
        
        // Initialize WASM
        const wasmPath = join(__dirname, '../../pkg/wasm_sdk_bg.wasm');
        const wasmBuffer = readFileSync(wasmPath);
        
        this.wasmModule = await this.wasmSdk.default(wasmBuffer);
        this.wasmInitialized = true;
        
        return this.wasmModule;
    }

    async createSDK(network = 'testnet') {
        await this.initializeWasm();
        
        const builder = network === 'mainnet' 
            ? this.wasmSdk.WasmSdkBuilder.new_mainnet()
            : this.wasmSdk.WasmSdkBuilder.new_testnet();
        
        const sdk = await builder.build();
        this.sdkInstances.push(sdk);
        
        return sdk;
    }

    getWasmSdk() {
        if (!this.wasmSdk) {
            throw new Error('WASM SDK not initialized. Call initializeWasm() first.');
        }
        return this.wasmSdk;
    }

    cleanup() {
        this.sdkInstances.forEach(sdk => {
            try {
                sdk.free();
            } catch (error) {
                // SDK already freed or invalid
            }
        });
        this.sdkInstances = [];
    }

    // Custom assertion helpers
    expectValidSDK(sdk) {
        expect(sdk).to.exist;
        expect(sdk.__wbg_ptr).to.be.a('number');
        expect(sdk.__wbg_ptr).to.not.equal(0);
        expect(typeof sdk.version).to.equal('function');
        expect(typeof sdk.free).to.equal('function');
    }

    expectFreedSDK(sdk) {
        expect(sdk.__wbg_ptr).to.equal(0);
        expect(() => sdk.version()).to.throw();
    }

    expectValidVersion(version) {
        expect(version).to.be.a('number');
        expect(version).to.be.at.least(1);
    }
}

// Global test context
const testContext = new TestContext();

// Export test utilities
module.exports = {
    TestContext,
    testContext,
    expect
};
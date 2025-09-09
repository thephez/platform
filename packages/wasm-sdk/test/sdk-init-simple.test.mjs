#!/usr/bin/env node
// sdk-init-simple.test.mjs - Simplified SDK initialization tests

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { webcrypto } from 'crypto';

// Get directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Set up globals for WASM
if (!global.crypto) {
    Object.defineProperty(global, 'crypto', {
        value: webcrypto,
        writable: true,
        configurable: true
    });
}

// Import WASM SDK
import init, * as wasmSdk from '../pkg/wasm_sdk.js';

// Initialize WASM
console.log('Initializing WASM SDK...');
const wasmPath = join(__dirname, '../pkg/wasm_sdk_bg.wasm');
const wasmBuffer = readFileSync(wasmPath);
await init(wasmBuffer);

// Test results
let passed = 0;
let failed = 0;

async function test(name, fn) {
    try {
        await fn();
        console.log(`✅ ${name}`);
        passed++;
    } catch (error) {
        console.log(`❌ ${name}`);
        console.log(`   ${error.message}`);
        failed++;
    }
}

console.log('\nSDK Initialization Tests\n');

// Test 8: Test mnemonic generation
await test('Can generate mnemonic', () => {
    const mnemonic = wasmSdk.generate_mnemonic(12);
    const words = mnemonic.split(' ');
    
    if (words.length !== 12) {
        throw new Error(`Expected 12 words, got ${words.length}`);
    }
    
    if (!wasmSdk.validate_mnemonic(mnemonic)) {
        throw new Error('Generated mnemonic is invalid');
    }
});

// Test 9: Test key derivation
await test('Can derive keys from mnemonic', () => {
    const testMnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    const result = wasmSdk.derive_key_from_seed_with_path(
        testMnemonic,
        undefined,
        "m/44'/5'/0'/0/0",
        "mainnet"
    );
    
    if (!result.address) {
        throw new Error('No address in result');
    }
    if (!result.private_key_wif) {
        throw new Error('No private key in result');
    }
    if (!result.public_key) {
        throw new Error('No public key in result');
    }
});

// Test 10: Test address validation
await test('Can validate addresses', () => {
    // Use real valid Dash addresses
    const mainnetAddress = "XoJA8qE3N2Y3jMLEtZ3vcN42qseZ8LvFf5";  // Real mainnet address
    const testnetAddress = "yRd4FhXfVGHXpsuZXPNkMrfD9GVj46pnjt";  // Real testnet address
    
    if (!wasmSdk.validate_address(mainnetAddress, "mainnet")) {
        throw new Error('Failed to validate mainnet address');
    }
    
    if (!wasmSdk.validate_address(testnetAddress, "testnet")) {
        throw new Error('Failed to validate testnet address');
    }
    
    if (wasmSdk.validate_address(mainnetAddress, "testnet")) {
        throw new Error('Mainnet address should not be valid on testnet');
    }
});

console.log(`\n\nTest Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
process.exit(failed > 0 ? 1 : 0);
const { testContext, expect } = require('./test-helper');

describe('Key Generation and Crypto Functions', function() {
    let sdk;
    let wasmSdk;
    const testMnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    const testWif = "XCGKuZcKDjNhx8DaNKK4xwMMNzspaoToT6CafJAbBfQTi57buhLK";
    const testHex = "c28a9f80738afe1441120fc6ea6e0febbeddb6b4fd8c3c5e1e3e4b9a8c5c3a8c";
    const testPubkey = "027b6a7dd645507d83de40000bf5d8e54e9b17b24c946b7e3d8d5b9f8c7b6a2d6b";

    before(async function() {
        await testContext.initializeWasm();
        wasmSdk = testContext.getWasmSdk();
        sdk = await testContext.createSDK();
    });

    after(function() {
        testContext.cleanup();
    });

    describe('Mnemonic Generation and Validation', function() {
        it('should generate 12-word mnemonic by default', function() {
            const mnemonic = wasmSdk.generate_mnemonic();
            const words = mnemonic.split(' ');
            
            expect(words).to.have.length(12);
            expect(wasmSdk.validate_mnemonic(mnemonic)).to.be.true;
        });

        [15, 18, 21, 24].forEach(count => {
            it(`should generate ${count}-word mnemonic`, function() {
                const mnemonic = wasmSdk.generate_mnemonic(count);
                const words = mnemonic.split(' ');
                
                expect(words).to.have.length(count);
                expect(wasmSdk.validate_mnemonic(mnemonic)).to.be.true;
            });
        });

        [11, 13, 16, 25, 30].forEach(count => {
            it(`should reject ${count}-word count`, function() {
                expect(() => wasmSdk.generate_mnemonic(count))
                    .to.throw(/Word count must be/);
            });
        });

        ['en', 'es', 'fr', 'it', 'ja', 'ko', 'pt', 'cs', 'zh-cn', 'zh-tw'].forEach(lang => {
            it(`should generate valid mnemonic in ${lang}`, function() {
                const mnemonic = wasmSdk.generate_mnemonic(12, lang);
                const words = mnemonic.split(' ');
                
                expect(words).to.have.length(12);
                expect(wasmSdk.validate_mnemonic(mnemonic, lang)).to.be.true;
            });
        });

        it('should validate known test mnemonic', function() {
            expect(wasmSdk.validate_mnemonic(testMnemonic)).to.be.true;
        });

        it('should reject mnemonic with wrong words', function() {
            expect(wasmSdk.validate_mnemonic("invalid mnemonic phrase with wrong words")).to.be.false;
        });

        it('should reject mnemonic with invalid word', function() {
            expect(wasmSdk.validate_mnemonic("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon invalid")).to.be.false;
        });

        it('should reject empty mnemonic', function() {
            expect(wasmSdk.validate_mnemonic("")).to.be.false;
        });

        it('should reject single word mnemonic', function() {
            expect(wasmSdk.validate_mnemonic("single")).to.be.false;
        });

        it('should reject 11-word mnemonic', function() {
            expect(wasmSdk.validate_mnemonic("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon")).to.be.false;
        });

        it('should convert mnemonic to seed', function() {
            const seed = wasmSdk.mnemonic_to_seed(testMnemonic);
            
            expect(seed).to.be.instanceOf(Uint8Array);
            expect(seed).to.have.length.greaterThan(32);
        });

        it('should convert mnemonic to seed with passphrase', function() {
            const seedNoPass = wasmSdk.mnemonic_to_seed(testMnemonic);
            const seedWithPass = wasmSdk.mnemonic_to_seed(testMnemonic, "testpassphrase");
            
            expect(seedNoPass).to.not.deep.equal(seedWithPass);
        });
    });

    describe('Key Derivation from Mnemonic', function() {
        it('should derive key from mnemonic phrase', function() {
            const result = wasmSdk.derive_key_from_seed_phrase(testMnemonic, undefined, "mainnet");
            
            expect(result).to.have.property('private_key_wif');
            expect(result).to.have.property('private_key_hex');
            expect(result).to.have.property('public_key');
            expect(result).to.have.property('address');
            expect(result).to.have.property('network', 'mainnet');
            
            expect(result.private_key_hex).to.have.length(64);
            expect(result.public_key).to.have.length(66);
        });

        it('should derive key with custom BIP44 path', function() {
            const result = wasmSdk.derive_key_from_seed_with_path(
                testMnemonic,
                undefined,
                "m/44'/5'/0'/0/0",
                "mainnet"
            );
            
            expect(result).to.have.property('path', "m/44'/5'/0'/0/0");
            expect(result).to.have.property('private_key_wif');
            expect(result).to.have.property('private_key_hex');
            expect(result).to.have.property('public_key');
            expect(result).to.have.property('address');
            expect(result).to.have.property('network', 'mainnet');
        });

        it('should derive different keys for different paths', function() {
            const result1 = wasmSdk.derive_key_from_seed_with_path(
                testMnemonic, undefined, "m/44'/5'/0'/0/0", "mainnet"
            );
            const result2 = wasmSdk.derive_key_from_seed_with_path(
                testMnemonic, undefined, "m/44'/5'/0'/0/1", "mainnet"
            );
            
            expect(result1.private_key_wif).to.not.equal(result2.private_key_wif);
            expect(result1.address).to.not.equal(result2.address);
        });

        it('should derive different keys for mainnet vs testnet', function() {
            const mainnetResult = wasmSdk.derive_key_from_seed_with_path(
                testMnemonic, undefined, "m/44'/5'/0'/0/0", "mainnet"
            );
            const testnetResult = wasmSdk.derive_key_from_seed_with_path(
                testMnemonic, undefined, "m/44'/1'/0'/0/0", "testnet"
            );
            
            expect(mainnetResult.address).to.not.equal(testnetResult.address);
            expect(mainnetResult.network).to.equal('mainnet');
            expect(testnetResult.network).to.equal('testnet');
        });
    });

    describe('Key Pair Generation', function() {
        it('should generate random key pair for mainnet', function() {
            const result = wasmSdk.generate_key_pair("mainnet");
            
            expect(result).to.have.property('private_key_wif');
            expect(result).to.have.property('private_key_hex');
            expect(result).to.have.property('public_key');
            expect(result).to.have.property('address');
            expect(result).to.have.property('network', 'mainnet');
            
            expect(result.private_key_hex).to.have.length(64);
            expect(result.public_key).to.have.length(66);
            expect(result.address).to.match(/^X[0-9A-Za-z]+$/); // Mainnet address format
        });

        it('should generate random key pair for testnet', function() {
            const result = wasmSdk.generate_key_pair("testnet");
            
            expect(result).to.have.property('network', 'testnet');
            expect(result.address).to.match(/^[yn][0-9A-Za-z]+$/); // Testnet address format
        });

        it('should generate multiple unique key pairs', function() {
            const pairs = wasmSdk.generate_key_pairs("mainnet", 3);
            
            expect(pairs).to.have.length(3);
            
            // Verify all pairs are unique
            const addresses = pairs.map(p => p.address);
            expect(new Set(addresses)).to.have.length(3);
            
            // Verify each pair is valid
            for (const pair of pairs) {
                expect(pair).to.have.property('private_key_wif');
                expect(pair).to.have.property('address');
                expect(pair.network).to.equal('mainnet');
            }
        });

        it('should reject count of 0 for multiple generation', function() {
            expect(() => wasmSdk.generate_key_pairs("mainnet", 0))
                .to.throw(/Count must be between 1 and 100/);
        });

        it('should reject count over 100 for multiple generation', function() {
            expect(() => wasmSdk.generate_key_pairs("mainnet", 101))
                .to.throw(/Count must be between 1 and 100/);
        });

        it('should reject invalid network', function() {
            expect(() => wasmSdk.generate_key_pair("invalid"))
                .to.throw(/Invalid network/);
        });
    });

    describe('Key Conversion Functions', function() {
        it('should create key pair from WIF', function() {
            const result = wasmSdk.key_pair_from_wif(testWif);
            
            expect(result).to.have.property('private_key_wif', testWif);
            expect(result).to.have.property('private_key_hex');
            expect(result).to.have.property('public_key');
            expect(result).to.have.property('address');
            expect(result).to.have.property('network');
            
            expect(result.private_key_hex).to.have.length(64);
            expect(result.public_key).to.have.length(66);
        });

        it('should create key pair from hex', function() {
            const result = wasmSdk.key_pair_from_hex(testHex, "mainnet");
            
            expect(result).to.have.property('private_key_hex', testHex);
            expect(result).to.have.property('private_key_wif');
            expect(result).to.have.property('public_key');
            expect(result).to.have.property('address');
            expect(result).to.have.property('network', 'mainnet');
        });

        it('should reject invalid WIF', function() {
            expect(() => wasmSdk.key_pair_from_wif("invalid_wif"))
                .to.throw(/Invalid WIF/);
        });

        it('should reject hex with invalid characters', function() {
            expect(() => wasmSdk.key_pair_from_hex("g".repeat(64), "mainnet"))
                .to.throw(/Invalid hex/);
        });

        it('should reject hex with wrong length', function() {
            expect(() => wasmSdk.key_pair_from_hex("abc123", "mainnet"))
                .to.throw(/exactly 64 characters/);
        });

        it('should convert public key to address', function() {
            // First generate a valid key pair to get a valid public key
            const keyPair = wasmSdk.generate_key_pair("mainnet");
            const address = wasmSdk.pubkey_to_address(keyPair.public_key, "mainnet");
            
            expect(address).to.be.a('string');
            expect(address).to.match(/^X[0-9A-Za-z]+$/);
            // Should match the address from the key pair
            expect(address).to.equal(keyPair.address);
        });

        it('should reject invalid public key', function() {
            expect(() => wasmSdk.pubkey_to_address("invalid_pubkey", "mainnet"))
                .to.throw(/Invalid/);
        });
    });

    describe('Address Validation', function() {
        const validMainnetAddr = "XoJA8qE3N2Y3jMLEtZ3vcN42qseZ8LvFf5";
        const validTestnetAddr = "yRd4FhXfVGHXpsuZXPNkMrfD9GVj46pnjt";

        it('should validate mainnet addresses', function() {
            expect(wasmSdk.validate_address(validMainnetAddr, "mainnet")).to.be.true;
        });

        it('should validate testnet addresses', function() {
            expect(wasmSdk.validate_address(validTestnetAddr, "testnet")).to.be.true;
        });

        it('should reject mainnet address on testnet', function() {
            expect(wasmSdk.validate_address(validMainnetAddr, "testnet")).to.be.false;
        });

        it('should reject testnet address on mainnet', function() {
            expect(wasmSdk.validate_address(validTestnetAddr, "mainnet")).to.be.false;
        });

        it('should reject malformed address', function() {
            expect(wasmSdk.validate_address("invalid_address", "mainnet")).to.be.false;
            expect(wasmSdk.validate_address("invalid_address", "testnet")).to.be.false;
        });

        it('should reject empty address', function() {
            expect(wasmSdk.validate_address("", "mainnet")).to.be.false;
            expect(wasmSdk.validate_address("", "testnet")).to.be.false;
        });

        it('should reject Bitcoin address', function() {
            expect(wasmSdk.validate_address("1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2", "mainnet")).to.be.false;
            expect(wasmSdk.validate_address("1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2", "testnet")).to.be.false;
        });

        it('should reject short address', function() {
            expect(wasmSdk.validate_address("DsZrxGvqyqbRbxgJ5bAEeY8vqJW1d2e3F4", "mainnet")).to.be.false;
            expect(wasmSdk.validate_address("DsZrxGvqyqbRbxgJ5bAEeY8vqJW1d2e3F4", "testnet")).to.be.false;
        });

        it('should reject invalid network for validation', function() {
            expect(wasmSdk.validate_address(validMainnetAddr, "invalid")).to.be.false;
        });
    });

    describe('Message Signing', function() {
        it('should sign messages with private key', function() {
            const message = "Hello, Dash!";
            const signature = wasmSdk.sign_message(message, testWif);
            
            expect(signature).to.be.a('string');
            expect(signature).to.have.length(128); // 64 bytes as hex
            expect(signature).to.match(/^[0-9a-f]{128}$/i);
        });

        it('should produce different signatures for different messages', function() {
            const sig1 = wasmSdk.sign_message("Message 1", testWif);
            const sig2 = wasmSdk.sign_message("Message 2", testWif);
            
            expect(sig1).to.not.equal(sig2);
        });

        it('should reject invalid WIF for signing', function() {
            expect(() => wasmSdk.sign_message("test", "invalid_wif"))
                .to.throw(/Invalid WIF/);
        });
    });

    describe('Derivation Path Helpers', function() {
        it('should create BIP44 mainnet derivation paths', function() {
            const path = wasmSdk.derivation_path_bip44_mainnet(0, 0, 0);
            
            expect(path).to.have.property('purpose', 44);
            expect(path).to.have.property('coin_type', 5); // Dash mainnet
            expect(path).to.have.property('account', 0);
            expect(path).to.have.property('change', 0);
            expect(path).to.have.property('index', 0);
        });

        it('should create BIP44 testnet derivation paths', function() {
            const path = wasmSdk.derivation_path_bip44_testnet(1, 1, 5);
            
            expect(path).to.have.property('purpose', 44);
            expect(path).to.have.property('coin_type', 1); // Testnet
            expect(path).to.have.property('account', 1);
            expect(path).to.have.property('change', 1);
            expect(path).to.have.property('index', 5);
        });

        it('should create DIP9 mainnet derivation paths', function() {
            const path = wasmSdk.derivation_path_dip9_mainnet(9, 0, 0);
            
            expect(path).to.have.property('purpose', 9);
            expect(path).to.have.property('coin_type', 5);
            expect(path).to.have.property('account', 9); // feature_type
            expect(path).to.have.property('change', 0);
            expect(path).to.have.property('index', 0);
        });

        it('should create DIP9 testnet derivation paths', function() {
            const path = wasmSdk.derivation_path_dip9_testnet(5, 1, 2);
            
            expect(path).to.have.property('purpose', 9);
            expect(path).to.have.property('coin_type', 1);
            expect(path).to.have.property('account', 5);
            expect(path).to.have.property('change', 1);
            expect(path).to.have.property('index', 2);
        });

        it('should create DIP13 mainnet derivation paths', function() {
            const path = wasmSdk.derivation_path_dip13_mainnet(0);
            
            expect(path).to.have.property('path', "m/9'/5'/0'");
            expect(path).to.have.property('purpose', 9);
            expect(path).to.have.property('coin_type', 5);
            expect(path).to.have.property('account', 0);
            expect(path).to.have.property('description', 'DIP13 HD identity key path');
        });

        it('should create DIP13 testnet derivation paths', function() {
            const path = wasmSdk.derivation_path_dip13_testnet(1);
            
            expect(path).to.have.property('path', "m/9'/1'/1'");
            expect(path).to.have.property('purpose', 9);
            expect(path).to.have.property('coin_type', 1);
            expect(path).to.have.property('account', 1);
            expect(path).to.have.property('description', 'DIP13 HD identity key path (testnet)');
        });
    });

    describe('Extended Key Operations', function() {
        // Note: These tests require valid extended keys which we would get from actual derivation
        // For now, we'll test error conditions and basic functionality
        
        it('should reject hardened child derivation from xpub', function() {
            const dummyXpub = "xpub6D4BDPcP2Gz9F7Z7Q7N9Q7Z7Q7Z7Q7Z7Q7Z7Q7Z7Q7Z7Q7Z7Q7Z7Q7Z7Q";
            
            expect(() => wasmSdk.derive_child_public_key(dummyXpub, 0, true))
                .to.throw(/Cannot derive hardened child/);
        });

        it('should reject hardened range indices for non-hardened derivation', function() {
            const dummyXpub = "xpub6D4BDPcP2Gz9F7Z7Q7N9Q7Z7Q7Z7Q7Z7Q7Z7Q7Z7Q7Z7Q7Z7Q7Z7Q7Z7Q";
            const hardenedIndex = 0x80000000;
            
            expect(() => wasmSdk.derive_child_public_key(dummyXpub, hardenedIndex, false))
                .to.throw(/Index is in hardened range/);
        });

        it('should reject invalid extended public key', function() {
            expect(() => wasmSdk.derive_child_public_key("invalid_xpub", 0, false))
                .to.throw(/Invalid extended public key/);
        });
        
        it('should reject invalid extended private key', function() {
            expect(() => wasmSdk.xprv_to_xpub("invalid_xprv"))
                .to.throw(/Invalid extended private key/);
        });
    });
});
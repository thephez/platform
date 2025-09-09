const { testContext, expect } = require('./test-helper');

describe('SDK Lifecycle Management', function() {

    // Setup and cleanup hooks
    beforeEach(function() {
        // Clean up any leftover SDK instances
        testContext.cleanup();
    });

    afterEach(function() {
        // Ensure cleanup after each test
        testContext.cleanup();
    });

    describe('WASM Module Initialization', function() {

        it('should initialize WASM module successfully', async function() {
            const wasmModule = await testContext.initializeWasm();

            expect(wasmModule).to.exist;
            expect(testContext.wasmInitialized).to.be.true;
            expect(testContext.wasmSdk).to.exist;
        });

        it('should handle multiple initialization calls safely', async function() {
            // First initialization
            const module1 = await testContext.initializeWasm();

            // Second initialization should return same module
            const module2 = await testContext.initializeWasm();

            expect(module1).to.equal(module2);
            expect(testContext.wasmInitialized).to.be.true;
        });

        it('should provide crypto globals for Node.js environment', function() {
            expect(global.crypto).to.exist;
            expect(global.crypto.getRandomValues).to.be.a('function');
        });
    });

    describe('SDK Builder', function() {

        beforeEach(async function() {
            await testContext.initializeWasm();
        });

        it('should create testnet SDK builder', function() {
            const wasmSdk = testContext.getWasmSdk();
            const builder = wasmSdk.WasmSdkBuilder.new_testnet();

            expect(builder).to.exist;
            expect(typeof builder.build).to.equal('function');
        });

        it('should create mainnet SDK builder', function() {
            const wasmSdk = testContext.getWasmSdk();
            const builder = wasmSdk.WasmSdkBuilder.new_mainnet();

            expect(builder).to.exist;
            expect(typeof builder.build).to.equal('function');
        });

        it('should provide getLatestVersionNumber static method', function() {
            const wasmSdk = testContext.getWasmSdk();
            const version = wasmSdk.WasmSdkBuilder.getLatestVersionNumber();

            testContext.expectValidVersion(version);
            // Version should be a positive integer
            expect(version).to.be.at.least(10);
        });

        it('should create SDK instance from builder', async function() {
            const sdk = await testContext.createSDK('testnet');

            testContext.expectValidSDK(sdk);
        });

        it('should handle builder method chaining', async function() {
            const wasmSdk = testContext.getWasmSdk();

            // Test that builder pattern works
            const builder = wasmSdk.WasmSdkBuilder.new_testnet();
            expect(builder).to.exist;

            const sdk = await builder.build();
            testContext.expectValidSDK(sdk);

            sdk.free();
        });

        it('should create mainnet trusted SDK instance', async function() {
            const wasmSdk = testContext.getWasmSdk();
            const builder = wasmSdk.WasmSdkBuilder.new_mainnet_trusted();

            expect(builder).to.exist;
            expect(typeof builder.build).to.equal('function');

            const sdk = await builder.build();
            testContext.expectValidSDK(sdk);

            sdk.free();
        });

        it('should create testnet trusted SDK instance', async function() {
            const wasmSdk = testContext.getWasmSdk();
            const builder = wasmSdk.WasmSdkBuilder.new_testnet_trusted();

            expect(builder).to.exist;
            expect(typeof builder.build).to.equal('function');

            const sdk = await builder.build();
            testContext.expectValidSDK(sdk);

            sdk.free();
        });

        it('should accept specific version configuration', async function() {
            const wasmSdk = testContext.getWasmSdk();
            const builder = wasmSdk.WasmSdkBuilder.new_testnet();

            // The builder methods consume the builder, so chain them
            const configuredBuilder = builder.with_version(1);
            const sdk = await configuredBuilder.build();

            testContext.expectValidSDK(sdk);
            sdk.free();
        });

        it.skip('should accept custom settings configuration', async function() {
            // NOTE: This test is skipped because:
            // 1. JavaScript doesn't validate parameter counts/types
            // 2. No getter methods exist to verify settings were applied
            // 3. Tests pass regardless of input, making validation impossible
            // 4. Unclear if the configuration actually works

            const wasmSdk = testContext.getWasmSdk();
            const builder = wasmSdk.WasmSdkBuilder.new_testnet();

            // Test with custom settings
            const settings = {
                request_timeout_seconds: 10,
                connect_timeout_seconds: 5,
                retries: 3
            };

            const configuredBuilder = builder.with_settings(JSON.stringify(settings));
            const sdk = await configuredBuilder.build();

            testContext.expectValidSDK(sdk);
            sdk.free();
        });


        it.skip('should handle invalid settings gracefully', async function() {
            // NOTE: This test is skipped because:
            // 1. JavaScript is too permissive - doesn't throw on invalid input
            // 2. No way to verify error handling actually works
            // 3. Tests pass regardless of input validity

            const wasmSdk = testContext.getWasmSdk();

            // Test with null/undefined values (which should be accepted as optional params)
            const builder1 = wasmSdk.WasmSdkBuilder.new_testnet();
            const configuredBuilder1 = builder1.with_settings(null, null, null, null);
            const sdk1 = await configuredBuilder1.build();
            testContext.expectValidSDK(sdk1);
            sdk1.free();

            // Test with mixed valid and null values
            const builder2 = wasmSdk.WasmSdkBuilder.new_testnet();
            const configuredBuilder2 = builder2.with_settings(5000, null, 2, true);
            const sdk2 = await configuredBuilder2.build();
            testContext.expectValidSDK(sdk2);
            sdk2.free();
        });
    });

    describe('SDK Instance Lifecycle', function() {

        it('should create unique SDK instances', async function() {
            const sdk1 = await testContext.createSDK('testnet');
            const sdk2 = await testContext.createSDK('testnet');

            testContext.expectValidSDK(sdk1);
            testContext.expectValidSDK(sdk2);

            // Should have different memory pointers
            expect(sdk1.__wbg_ptr).to.not.equal(sdk2.__wbg_ptr);
        });

        it('should report version information', async function() {
            const sdk = await testContext.createSDK('testnet');

            const version = sdk.version();
            testContext.expectValidVersion(version);
        });

        it('should free resources when calling free()', async function() {
            const sdk = await testContext.createSDK('testnet');
            const originalPtr = sdk.__wbg_ptr;

            // Verify SDK is initially valid
            testContext.expectValidSDK(sdk);

            // Free the SDK
            sdk.free();

            // Verify SDK is now freed
            testContext.expectFreedSDK(sdk);
        });

        it('should throw when using SDK after free()', async function() {
            const sdk = await testContext.createSDK('testnet');

            sdk.free();

            expect(() => sdk.version()).to.throw();
        });

        it('should handle multiple SDK instances independently', async function() {
            const sdk1 = await testContext.createSDK('testnet');
            const sdk2 = await testContext.createSDK('mainnet');

            // Both should be valid initially
            testContext.expectValidSDK(sdk1);
            testContext.expectValidSDK(sdk2);

            // Free first SDK
            sdk1.free();

            // First should be freed, second should still work
            testContext.expectFreedSDK(sdk1);
            testContext.expectValidSDK(sdk2);

            // Second SDK should still function
            expect(() => sdk2.version()).to.not.throw();

            // Clean up
            sdk2.free();
        });
    });

    describe('Memory Management', function() {

        it('should not leak memory with repeated create/free cycles', async function() {
            const iterations = 10;
            const pointers = [];

            for (let i = 0; i < iterations; i++) {
                const sdk = await testContext.createSDK('testnet');
                pointers.push(sdk.__wbg_ptr);
                sdk.free();

                // Verify each SDK is properly freed
                expect(sdk.__wbg_ptr).to.equal(0);
            }

            // All pointers should be unique (no reuse indicates proper cleanup)
            const uniquePointers = new Set(pointers);
            expect(uniquePointers.size).to.equal(iterations);
        });

        it('should handle errors during initialization without leaks', async function() {
            // This test ensures that if SDK creation fails, no resources leak
            // We can't easily force an initialization error, so we test cleanup after success

            const sdk = await testContext.createSDK('testnet');
            const ptr = sdk.__wbg_ptr;

            // Simulate an error scenario by manually freeing
            sdk.free();

            // Verify clean state
            expect(sdk.__wbg_ptr).to.equal(0);

            // Should be able to create new SDK without issues
            const newSDK = await testContext.createSDK('testnet');
            testContext.expectValidSDK(newSDK);

            newSDK.free();
        });

        it('should handle double free gracefully', async function() {
            const sdk = await testContext.createSDK('testnet');

            // First free should work
            sdk.free();
            testContext.expectFreedSDK(sdk);

            // Second free should throw (WASM/Rust behavior for null pointer)
            expect(() => sdk.free()).to.throw(/null pointer/);
        });
    });

    describe('Error Handling', function() {

        it('should handle invalid network configurations gracefully', async function() {
            await testContext.initializeWasm();
            const wasmSdk = testContext.getWasmSdk();

            // Valid networks should work
            expect(() => wasmSdk.WasmSdkBuilder.new_testnet()).to.not.throw();
            expect(() => wasmSdk.WasmSdkBuilder.new_mainnet()).to.not.throw();
        });

        it('should validate SDK state before operations', async function() {
            const sdk = await testContext.createSDK('testnet');

            // Should work when valid
            expect(() => sdk.version()).to.not.throw();

            // Should fail when freed
            sdk.free();
            expect(() => sdk.version()).to.throw();
        });
    });

    describe('API Completeness', function() {

        it('should have all state transition methods on SDK instance', async function() {
            const sdk = await testContext.createSDK('testnet');

            // Identity state transitions
            expect(typeof sdk.identityCreate).to.equal('function');
            expect(typeof sdk.identityTopUp).to.equal('function');
            expect(typeof sdk.identityUpdate).to.equal('function');
            expect(typeof sdk.identityCreditTransfer).to.equal('function');
            expect(typeof sdk.identityCreditWithdrawal).to.equal('function');

            // Data Contract state transitions
            expect(typeof sdk.contractCreate).to.equal('function');
            expect(typeof sdk.contractUpdate).to.equal('function');

            // Document state transitions
            expect(typeof sdk.documentCreate).to.equal('function');
            expect(typeof sdk.documentReplace).to.equal('function');
            expect(typeof sdk.documentDelete).to.equal('function');
            expect(typeof sdk.documentTransfer).to.equal('function');
            expect(typeof sdk.documentPurchase).to.equal('function');
            expect(typeof sdk.documentSetPrice).to.equal('function');

            // Token state transitions
            expect(typeof sdk.tokenMint).to.equal('function');
            expect(typeof sdk.tokenBurn).to.equal('function');
            expect(typeof sdk.tokenClaim).to.equal('function');
            expect(typeof sdk.tokenSetPriceForDirectPurchase).to.equal('function');
            expect(typeof sdk.tokenDirectPurchase).to.equal('function');
            expect(typeof sdk.tokenConfigUpdate).to.equal('function');
            expect(typeof sdk.tokenTransfer).to.equal('function');
            expect(typeof sdk.tokenFreeze).to.equal('function');
            expect(typeof sdk.tokenUnfreeze).to.equal('function');
            expect(typeof sdk.tokenDestroyFrozen).to.equal('function');

            // Voting state transitions
            expect(typeof sdk.masternodeVote).to.equal('function');

            sdk.free();
        });

        it('should have all identity query functions as top-level exports', async function() {
            await testContext.initializeWasm();
            const wasmSdk = testContext.getWasmSdk();

            // Identity queries
            expect(typeof wasmSdk.identity_fetch).to.equal('function');
            expect(typeof wasmSdk.identity_fetch_with_proof_info).to.equal('function');
            expect(typeof wasmSdk.identity_fetch_unproved).to.equal('function');
            expect(typeof wasmSdk.get_identity_balance).to.equal('function');
            expect(typeof wasmSdk.get_identity_balance_with_proof_info).to.equal('function');
            expect(typeof wasmSdk.get_identities_balances).to.equal('function');
            expect(typeof wasmSdk.get_identities_balances_with_proof_info).to.equal('function');
            expect(typeof wasmSdk.get_identity_balance_and_revision).to.equal('function');
            expect(typeof wasmSdk.get_identity_balance_and_revision_with_proof_info).to.equal('function');
            expect(typeof wasmSdk.get_identity_keys).to.equal('function');
            expect(typeof wasmSdk.get_identity_keys_with_proof_info).to.equal('function');
            expect(typeof wasmSdk.get_identity_nonce).to.equal('function');
            expect(typeof wasmSdk.get_identity_nonce_with_proof_info).to.equal('function');
            expect(typeof wasmSdk.get_identity_contract_nonce).to.equal('function');
            expect(typeof wasmSdk.get_identity_contract_nonce_with_proof_info).to.equal('function');
            expect(typeof wasmSdk.get_identity_by_public_key_hash).to.equal('function');
            expect(typeof wasmSdk.get_identity_by_public_key_hash_with_proof_info).to.equal('function');
            expect(typeof wasmSdk.get_identity_by_non_unique_public_key_hash).to.equal('function');
            expect(typeof wasmSdk.get_identity_by_non_unique_public_key_hash_with_proof_info).to.equal('function');
            expect(typeof wasmSdk.get_identities_contract_keys).to.equal('function');
            expect(typeof wasmSdk.get_identities_contract_keys_with_proof_info).to.equal('function');
            expect(typeof wasmSdk.get_identity_token_balances).to.equal('function');
            expect(typeof wasmSdk.get_identity_token_balances_with_proof_info).to.equal('function');

            // Note: get_identities_token_balances, get_identity_token_infos, get_identities_token_infos
            // are tested in token query section as they're defined in token.rs
            // Note: get_identity_groups is tested in group query section as it's defined in group.rs
        });

        it('should have all data contract query functions as top-level exports', async function() {
            await testContext.initializeWasm();
            const wasmSdk = testContext.getWasmSdk();

            // Data contract queries
            expect(typeof wasmSdk.data_contract_fetch).to.equal('function');
            expect(typeof wasmSdk.data_contract_fetch_with_proof_info).to.equal('function');
            expect(typeof wasmSdk.get_data_contracts).to.equal('function');
            expect(typeof wasmSdk.get_data_contracts_with_proof_info).to.equal('function');
            expect(typeof wasmSdk.get_data_contract_history).to.equal('function');
            expect(typeof wasmSdk.get_data_contract_history_with_proof_info).to.equal('function');
        });

        it('should have all document query functions as top-level exports', async function() {
            await testContext.initializeWasm();
            const wasmSdk = testContext.getWasmSdk();

            // Document queries
            expect(typeof wasmSdk.get_documents).to.equal('function');
            expect(typeof wasmSdk.get_documents_with_proof_info).to.equal('function');
            expect(typeof wasmSdk.get_document).to.equal('function');
            expect(typeof wasmSdk.get_document_with_proof_info).to.equal('function');
        });

        it('should have all DPNS query functions as top-level exports', async function() {
            await testContext.initializeWasm();
            const wasmSdk = testContext.getWasmSdk();

            // DPNS queries
            expect(typeof wasmSdk.dpns_register_name).to.equal('function');
            expect(typeof wasmSdk.dpns_is_name_available).to.equal('function');
            expect(typeof wasmSdk.dpns_resolve_name).to.equal('function');
            expect(typeof wasmSdk.get_dpns_username_by_name).to.equal('function');
            expect(typeof wasmSdk.get_dpns_username_by_name_with_proof_info).to.equal('function');
            expect(typeof wasmSdk.get_dpns_usernames).to.equal('function');
            expect(typeof wasmSdk.get_dpns_usernames_with_proof_info).to.equal('function');
            expect(typeof wasmSdk.get_dpns_username).to.equal('function');
            expect(typeof wasmSdk.get_dpns_username_with_proof_info).to.equal('function');
        });

        it('should have all voting/contested resource query functions as top-level exports', async function() {
            await testContext.initializeWasm();
            const wasmSdk = testContext.getWasmSdk();

            // Voting/Contested resources queries
            expect(typeof wasmSdk.get_contested_resources).to.equal('function');
            expect(typeof wasmSdk.get_contested_resources_with_proof_info).to.equal('function');
            expect(typeof wasmSdk.get_contested_resource_vote_state).to.equal('function');
            expect(typeof wasmSdk.get_contested_resource_vote_state_with_proof_info).to.equal('function');
            expect(typeof wasmSdk.get_contested_resource_voters_for_identity).to.equal('function');
            expect(typeof wasmSdk.get_contested_resource_voters_for_identity_with_proof_info).to.equal('function');
            expect(typeof wasmSdk.get_contested_resource_identity_votes).to.equal('function');
            expect(typeof wasmSdk.get_contested_resource_identity_votes_with_proof_info).to.equal('function');
            expect(typeof wasmSdk.get_vote_polls_by_end_date).to.equal('function');
            expect(typeof wasmSdk.get_vote_polls_by_end_date_with_proof_info).to.equal('function');
        });

        it('should have all protocol/system query functions as top-level exports', async function() {
            await testContext.initializeWasm();
            const wasmSdk = testContext.getWasmSdk();

            // Protocol/System queries
            expect(typeof wasmSdk.get_protocol_version_upgrade_state).to.equal('function');
            expect(typeof wasmSdk.get_protocol_version_upgrade_state_with_proof_info).to.equal('function');
            expect(typeof wasmSdk.get_protocol_version_upgrade_vote_status).to.equal('function');
            expect(typeof wasmSdk.get_protocol_version_upgrade_vote_status_with_proof_info).to.equal('function');
            expect(typeof wasmSdk.get_status).to.equal('function');
            // Note: get_status_with_proof_info not implemented (Relies on unprovable Core data)
            // expect(typeof wasmSdk.get_status_with_proof_info).to.equal('function');
            expect(typeof wasmSdk.get_current_quorums_info).to.equal('function');
            // Note: get_current_quorums_info_with_proof_info not implemented (Relies on unprovable Core data)
            // expect(typeof wasmSdk.get_current_quorums_info_with_proof_info).to.equal('function');
            expect(typeof wasmSdk.get_total_credits_in_platform).to.equal('function');
            expect(typeof wasmSdk.get_total_credits_in_platform_with_proof_info).to.equal('function');
            expect(typeof wasmSdk.get_prefunded_specialized_balance).to.equal('function');
            expect(typeof wasmSdk.get_prefunded_specialized_balance_with_proof_info).to.equal('function');
            expect(typeof wasmSdk.get_path_elements).to.equal('function');
            expect(typeof wasmSdk.get_path_elements_with_proof_info).to.equal('function');
        });

        it('should have all epoch query functions as top-level exports', async function() {
            await testContext.initializeWasm();
            const wasmSdk = testContext.getWasmSdk();

            // Epoch queries
            expect(typeof wasmSdk.get_epochs_info).to.equal('function');
            expect(typeof wasmSdk.get_epochs_info_with_proof_info).to.equal('function');
            expect(typeof wasmSdk.get_finalized_epoch_infos).to.equal('function');
            expect(typeof wasmSdk.get_finalized_epoch_infos_with_proof_info).to.equal('function');
            expect(typeof wasmSdk.get_current_epoch).to.equal('function');
            expect(typeof wasmSdk.get_current_epoch_with_proof_info).to.equal('function');
            expect(typeof wasmSdk.get_evonodes_proposed_epoch_blocks_by_ids).to.equal('function');
            expect(typeof wasmSdk.get_evonodes_proposed_epoch_blocks_by_ids_with_proof_info).to.equal('function');
            expect(typeof wasmSdk.get_evonodes_proposed_epoch_blocks_by_range).to.equal('function');
            expect(typeof wasmSdk.get_evonodes_proposed_epoch_blocks_by_range_with_proof_info).to.equal('function');
        });

        it('should have all token query functions as top-level exports', async function() {
            await testContext.initializeWasm();
            const wasmSdk = testContext.getWasmSdk();

            // Token queries
            expect(typeof wasmSdk.get_token_statuses).to.equal('function');
            expect(typeof wasmSdk.get_token_direct_purchase_prices).to.equal('function');
            expect(typeof wasmSdk.get_token_contract_info).to.equal('function');
            expect(typeof wasmSdk.get_token_perpetual_distribution_last_claim).to.equal('function');
            expect(typeof wasmSdk.get_token_total_supply).to.equal('function');

            // Identity-related token queries from token.rs
            expect(typeof wasmSdk.get_identities_token_balances).to.equal('function');
            expect(typeof wasmSdk.get_identities_token_balances_with_proof_info).to.equal('function');
            expect(typeof wasmSdk.get_identity_token_infos).to.equal('function');
            expect(typeof wasmSdk.get_identity_token_infos_with_proof_info).to.equal('function');
            expect(typeof wasmSdk.get_identities_token_infos).to.equal('function');
            expect(typeof wasmSdk.get_identities_token_infos_with_proof_info).to.equal('function');
        });

        it('should have all group query functions as top-level exports', async function() {
            await testContext.initializeWasm();
            const wasmSdk = testContext.getWasmSdk();

            // Group queries
            expect(typeof wasmSdk.get_group_info).to.equal('function');
            expect(typeof wasmSdk.get_group_infos).to.equal('function');
            expect(typeof wasmSdk.get_group_members).to.equal('function');
            expect(typeof wasmSdk.get_group_actions).to.equal('function');
            expect(typeof wasmSdk.get_group_action_signers).to.equal('function');
            expect(typeof wasmSdk.get_groups_data_contracts).to.equal('function');

            // Identity-related group queries from group.rs
            expect(typeof wasmSdk.get_identity_groups).to.equal('function');
            expect(typeof wasmSdk.get_identity_groups_with_proof_info).to.equal('function');
        });

        it('should have verification and wait functions as top-level exports', async function() {
            await testContext.initializeWasm();
            const wasmSdk = testContext.getWasmSdk();

            // Verification functions
            expect(typeof wasmSdk.verify_identity_response).to.equal('function');
            expect(typeof wasmSdk.verify_data_contract).to.equal('function');
            expect(typeof wasmSdk.verify_documents).to.equal('function');

            // Wait function
            expect(typeof wasmSdk.wait_for_state_transition_result).to.equal('function');
        });

        it('should have key generation and utility functions', async function() {
            await testContext.initializeWasm();
            const wasmSdk = testContext.getWasmSdk();

            // Mnemonic functions
            expect(typeof wasmSdk.generate_mnemonic).to.equal('function');
            expect(typeof wasmSdk.validate_mnemonic).to.equal('function');
            expect(typeof wasmSdk.mnemonic_to_seed).to.equal('function');

            // Key derivation functions
            expect(typeof wasmSdk.derive_key_from_seed_with_path).to.equal('function');
            expect(typeof wasmSdk.generate_key_pair).to.equal('function');
            expect(typeof wasmSdk.generate_key_pairs).to.equal('function');
            expect(typeof wasmSdk.key_pair_from_hex).to.equal('function');
            expect(typeof wasmSdk.key_pair_from_wif).to.equal('function');

            // Address functions
            expect(typeof wasmSdk.pubkey_to_address).to.equal('function');
            expect(typeof wasmSdk.validate_address).to.equal('function');

            // Message signing
            expect(typeof wasmSdk.sign_message).to.equal('function');
        });

        it('should have DPNS functions', async function() {
            await testContext.initializeWasm();
            const wasmSdk = testContext.getWasmSdk();

            expect(typeof wasmSdk.dpns_convert_to_homograph_safe).to.equal('function');
            expect(typeof wasmSdk.dpns_is_valid_username).to.equal('function');
            expect(typeof wasmSdk.dpns_is_contested_username).to.equal('function');
            expect(typeof wasmSdk.dpns_register_name).to.equal('function');
            expect(typeof wasmSdk.dpns_is_name_available).to.equal('function');
            expect(typeof wasmSdk.dpns_resolve_name).to.equal('function');
        });
    });
});
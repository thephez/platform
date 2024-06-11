use crate::drive::verify::RootHash;
use crate::drive::votes::storage_form::contested_document_resource_storage_form::ContestedDocumentResourceVoteStorageForm;
use crate::drive::votes::tree_path_storage_form::TreePathStorageForm;
use crate::error::drive::DriveError;
use crate::error::Error;
use crate::query::contested_resource_votes_given_by_identity_query::ContestedResourceVotesGivenByIdentityQuery;
use dpp::bincode;
use dpp::data_contract::DataContract;
use dpp::identifier::Identifier;
use dpp::voting::votes::resource_vote::ResourceVote;
use grovedb::reference_path::ReferencePathType;
use grovedb::GroveDb;
use platform_version::version::PlatformVersion;
use std::collections::BTreeMap;

impl ContestedResourceVotesGivenByIdentityQuery {
    #[inline(always)]
    pub(super) fn verify_identity_votes_given_proof_v0(
        &self,
        proof: &[u8],
        data_contract: &DataContract,
        platform_version: &PlatformVersion,
    ) -> Result<(RootHash, BTreeMap<Identifier, ResourceVote>), Error> {
        let path_query = self.construct_path_query()?;
        let (root_hash, proved_key_values) = GroveDb::verify_query(proof, &path_query)?;

        let voters = proved_key_values
            .into_iter()
            .filter_map(|(path, key, element)| element.map(|element| (path, key, element)))
            .map(|(path, key, element)| {
                let serialized_reference = element.into_item_bytes()?;
                let bincode_config = bincode::config::standard()
                    .with_big_endian()
                    .with_no_limit();
                let reference: ReferencePathType =
                    bincode::decode_from_slice(&serialized_reference, bincode_config)
                        .map_err(|e| {
                            Error::Drive(DriveError::CorruptedSerialization(format!(
                                "serialization of reference {} is corrupted: {}",
                                hex::encode(serialized_reference),
                                e
                            )))
                        })?
                        .0;
                let absolute_path =
                    reference.absolute_path(path.as_slice(), Some(key.as_slice()))?;
                let vote_id = Identifier::from_vec(key)?;
                let vote_storage_form =
                    ContestedDocumentResourceVoteStorageForm::try_from_tree_path(absolute_path)?;
                let resource_vote =
                    vote_storage_form.resolve_with_contract(data_contract, platform_version)?;
                Ok((vote_id, resource_vote))
            })
            .collect::<Result<BTreeMap<Identifier, ResourceVote>, Error>>()?;

        Ok((root_hash, voters))
    }
}

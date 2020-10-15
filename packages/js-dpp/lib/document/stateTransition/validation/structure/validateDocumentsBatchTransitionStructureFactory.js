const ValidationResult = require('../../../../validation/ValidationResult');

const AbstractDocumentTransition = require('../../documentTransition/AbstractDocumentTransition');

const DataContractNotPresentError = require('../../../../errors/DataContractNotPresentError');
const InvalidDocumentTransitionIdError = require('../../../../errors/InvalidDocumentTransitionIdError');
const DuplicateDocumentTransitionsError = require('../../../../errors/DuplicateDocumentTransitionsError');
const MissingDocumentTypeError = require('../../../../errors/MissingDocumentTypeError');
const InvalidDocumentTypeError = require('../../../../errors/InvalidDocumentTypeError');
const InvalidDocumentTransitionActionError = require('../../../../errors/InvalidDocumentTransitionActionError');
const MissingDocumentTransitionActionError = require('../../../../errors/MissingDocumentTransitionActionError');
const MissingDataContractIdError = require('../../../../errors/MissingDataContractIdError');
const InvalidDataContractIdError = require('../../../../errors/InvalidDataContractIdError');

const DocumentsBatchTransition = require('../../DocumentsBatchTransition');

const baseTransitionSchema = require('../../../../../schema/document/stateTransition/documentTransition/base');
const createTransitionSchema = require('../../../../../schema/document/stateTransition/documentTransition/create');
const replaceTransitionSchema = require('../../../../../schema/document/stateTransition/documentTransition/replace');

const generateDocumentId = require('../../../generateDocumentId');
const convertBuffersToArrays = require('../../../../util/convertBuffersToArrays');

const documentsBatchTransitionSchema = require('../../../../../schema/document/stateTransition/documentsBatch');

/**
 * @param {findDuplicatesById} findDuplicatesById
 * @param {findDuplicatesByIndices} findDuplicatesByIndices
 * @param {validateStateTransitionSignature} validateStateTransitionSignature
 * @param {validateIdentityExistence} validateIdentityExistence
 * @param {StateRepository} stateRepository
 * @param {JsonSchemaValidator} jsonSchemaValidator
 * @param {enrichDataContractWithBaseSchema} enrichDataContractWithBaseSchema
 *
 * @return {validateDocumentsBatchTransitionStructure}
 */
function validateDocumentsBatchTransitionStructureFactory(
  findDuplicatesById,
  findDuplicatesByIndices,
  validateStateTransitionSignature,
  validateIdentityExistence,
  stateRepository,
  jsonSchemaValidator,
  enrichDataContractWithBaseSchema,
) {
  const { ACTIONS } = AbstractDocumentTransition;

  /**
   *
   * @param dataContract
   * @param {Buffer} ownerId
   * @param documentTransitions
   * @return {Promise<ValidationResult>}
   */
  async function validateDocumentTransitions(dataContract, ownerId, documentTransitions) {
    const result = new ValidationResult();

    if (!result.isValid()) {
      return result;
    }

    const enrichedBaseDataContract = enrichDataContractWithBaseSchema(
      dataContract,
      baseTransitionSchema,
    );

    const enrichedDataContractsByActions = {
      [ACTIONS.CREATE]: enrichDataContractWithBaseSchema(
        enrichedBaseDataContract,
        createTransitionSchema,
        enrichDataContractWithBaseSchema.PREFIX_BYTE_1,
      ),
      [ACTIONS.REPLACE]: enrichDataContractWithBaseSchema(
        enrichedBaseDataContract,
        replaceTransitionSchema,
        enrichDataContractWithBaseSchema.PREFIX_BYTE_2,
        ['$createdAt'],
      ),
    };

    documentTransitions.forEach((rawDocumentTransition) => {
      // Validate $type
      if (!Object.prototype.hasOwnProperty.call(rawDocumentTransition, '$type')) {
        result.addError(
          new MissingDocumentTypeError(rawDocumentTransition),
        );

        return;
      }

      if (!dataContract.isDocumentDefined(rawDocumentTransition.$type)) {
        result.addError(
          new InvalidDocumentTypeError(rawDocumentTransition.$type, dataContract),
        );

        return;
      }

      // Validate $action
      if (!Object.prototype.hasOwnProperty.call(rawDocumentTransition, '$action')) {
        result.addError(
          new MissingDocumentTransitionActionError(rawDocumentTransition),
        );

        return;
      }

      // Validate document schema
      switch (rawDocumentTransition.$action) {
        case ACTIONS.CREATE:
        case ACTIONS.REPLACE: {
          // eslint-disable-next-line max-len
          const enrichedDataContract = enrichedDataContractsByActions[rawDocumentTransition.$action];

          const documentSchemaRef = enrichedDataContract.getDocumentSchemaRef(
            rawDocumentTransition.$type,
          );

          const additionalSchemas = {
            [enrichedDataContract.getJsonSchemaId()]:
            enrichedDataContract.toJSON(),
          };

          const schemaResult = jsonSchemaValidator.validate(
            documentSchemaRef,
            convertBuffersToArrays(rawDocumentTransition),
            additionalSchemas,
          );

          if (!schemaResult.isValid()) {
            result.merge(schemaResult);

            break;
          }

          // Additional checks for CREATE transitions
          if (ACTIONS.CREATE === rawDocumentTransition.$action) {
            // validate id generation
            const documentId = generateDocumentId(
              dataContract.getId(),
              ownerId,
              rawDocumentTransition.$type,
              rawDocumentTransition.$entropy,
            );

            if (!rawDocumentTransition.$id.equals(documentId)) {
              result.addError(
                new InvalidDocumentTransitionIdError(rawDocumentTransition),
              );
            }
          }

          break;
        }
        case ACTIONS.DELETE:
          result.merge(
            jsonSchemaValidator.validate(
              baseTransitionSchema,
              convertBuffersToArrays(rawDocumentTransition),
            ),
          );

          break;
        default:
          result.addError(
            new InvalidDocumentTransitionActionError(
              rawDocumentTransition.$action,
              rawDocumentTransition,
            ),
          );
      }
    });

    if (!result.isValid()) {
      return result;
    }

    // Find duplicate documents by type and ID
    const duplicateTransitions = findDuplicatesById(documentTransitions);
    if (duplicateTransitions.length > 0) {
      result.addError(
        new DuplicateDocumentTransitionsError(duplicateTransitions),
      );
    }

    // Find duplicate transitions by unique indices
    const duplicateTransitionsByIndices = findDuplicatesByIndices(
      documentTransitions,
      dataContract,
    );

    if (duplicateTransitionsByIndices.length > 0) {
      result.addError(
        new DuplicateDocumentTransitionsError(duplicateTransitionsByIndices),
      );
    }

    return result;
  }

  /**
   * @typedef validateDocumentsBatchTransitionStructure
   * @param {RawDocumentsBatchTransition} rawStateTransition
   * @return {ValidationResult}
   */
  async function validateDocumentsBatchTransitionStructure(rawStateTransition) {
    const result = jsonSchemaValidator.validate(
      documentsBatchTransitionSchema,
      convertBuffersToArrays(rawStateTransition),
    );

    if (!result.isValid()) {
      return result;
    }

    // Group document transitions by data contracts
    const documentTransitionsByContracts = rawStateTransition.transitions
      .reduce((obj, rawDocumentTransition) => {
        if (!Object.prototype.hasOwnProperty.call(rawDocumentTransition, '$dataContractId')) {
          result.addError(
            new MissingDataContractIdError(rawDocumentTransition),
          );

          return obj;
        }

        if (!Buffer.isBuffer(rawDocumentTransition.$dataContractId)) {
          result.addError(
            new InvalidDataContractIdError(rawDocumentTransition.$dataContractId),
          );

          return obj;
        }

        const dataContractIdString = rawDocumentTransition.$dataContractId.toString('hex');

        if (!obj[dataContractIdString]) {
          // eslint-disable-next-line no-param-reassign
          obj[dataContractIdString] = [];
        }

        obj[dataContractIdString].push(rawDocumentTransition);

        return obj;
      }, {});

    const dataContracts = [];

    const documentTransitionResultsPromises = Object.entries(documentTransitionsByContracts)
      .map(async ([dataContractIdString, documentTransitions]) => {
        const perDocumentResult = new ValidationResult();

        const dataContractIdBuffer = Buffer.from(dataContractIdString, 'hex');

        const dataContract = await stateRepository.fetchDataContract(dataContractIdBuffer);

        if (!dataContract) {
          perDocumentResult.addError(
            new DataContractNotPresentError(dataContractIdBuffer),
          );
        }

        if (!perDocumentResult.isValid()) {
          return perDocumentResult;
        }

        dataContracts.push(dataContract);

        perDocumentResult.merge(
          await validateDocumentTransitions(
            dataContract,
            rawStateTransition.ownerId,
            documentTransitions,
          ),
        );

        return perDocumentResult;
      });

    const documentTransitionResults = await Promise.all(documentTransitionResultsPromises);
    documentTransitionResults.forEach(result.merge.bind(result));

    if (!result.isValid()) {
      return result;
    }

    // User must exist and confirmed
    result.merge(
      await validateIdentityExistence(
        rawStateTransition.ownerId,
      ),
    );

    if (!result.isValid()) {
      return result;
    }

    // Verify ST signature
    const stateTransition = new DocumentsBatchTransition(rawStateTransition, dataContracts);

    result.merge(
      await validateStateTransitionSignature(
        stateTransition,
        stateTransition.getOwnerId(),
      ),
    );

    return result;
  }

  return validateDocumentsBatchTransitionStructure;
}

module.exports = validateDocumentsBatchTransitionStructureFactory;

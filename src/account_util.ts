import assert from 'assert';
import { Environment } from 'aws-cdk-lib';
import { AHA_DEFAULT_REGION, SERVICE, StackCreationInfo, STAGE, STAGELESS_SERVICE } from './constant';
import {
  AccountInfo,
  alphaEnvironmentConfiguration,
  sharedStageEnvironmentConfiguration, stagelessEnvironmentConfiguration,
} from './environment-configuration';


/**
 * Returns the stack creation info
 *
 * @remarks
 * This method is used in each stack creation across envs
 *
 * @param account - the AWS account ID
 * @param region - the AWS region that stacks should be deployed to. Defaulted to {@link AHA_DEFAULT_REGION}
 * @param stage - the deployment stage. When not provided, defaults to stage-less
 * @returns a {@link StackCreationInfo} object
 *
 */
export function createStackCreationInfo(account: string, region: string = AHA_DEFAULT_REGION, stage?: STAGE): StackCreationInfo {
  return {
    account: account,
    region: region,
    stage: stage ?? STAGE.ALPHA,
    stackPrefix: `Aha-${ region }${ stage ? '-' + stage : '' }`,
  };
}

export function getEnvFromStackCreationInfo(stackCreationInfo: StackCreationInfo): Environment {
  const {
    account,
    region,
  } = stackCreationInfo;

  return {
    account: account,
    region: region,
  };
}


/**
 * Returns the accountIds that a service has @link{stageEnvironmentConfiguration} configured
 *
 * @returns list of accountIds
 *
 * @param service {@link SERVICE}
 */
export function getSharedStageAccountIds(): string[] {
  const accountIds = [];

  for (const key of Object.keys(sharedStageEnvironmentConfiguration)) {
    accountIds.push(sharedStageEnvironmentConfiguration[<STAGE>(key)].accountId);
  }

  return accountIds;
}

/**
 * Returns the @link{AccountInfo} that a stage-service has configured
 *
 * @returns AccountInfo
 *
 * @param service {@link SERVICE}
 * @param stage {@link STAGE}
 */
export function getAccountInfo(service: SERVICE, stage: STAGE): AccountInfo {
  if (stage === STAGE.ALPHA) {
    assert.ok(alphaEnvironmentConfiguration[service], `AccountInfo for ${ service }-${ stage } is undefined`);
    return alphaEnvironmentConfiguration[service];
  }

  return getSharedStageAccountInfo(stage);
}

/**
 * Returns the @link{AccountInfo} that a stage-service has configured
 *
 * @remarks only work for beta-prod as they are service-shared
 *
 * @returns AccountInfo
 *
 * @param stage {@link STAGE}
 */
export function getSharedStageAccountInfo(stage: STAGE): AccountInfo {
  assert.ok(stage !== STAGE.ALPHA, `AccountInfo for ${ stage } is service-specific`);
  assert.ok(sharedStageEnvironmentConfiguration[stage], `AccountInfo for shared ${ stage } is undefined`);

  return sharedStageEnvironmentConfiguration[stage];
}

/**
 * Returns the account ID that a stage-service has configured
 *
 * @returns accountId
 *
 * @param service {@link SERVICE}
 * @param stage {@link STAGE}
 */
export function getAccountId(service: SERVICE, stage: STAGE): string {
  return getAccountInfo(service, stage).accountId;
}

/**
 * Returns the account ID that a stageless-service has configured
 *
 * @returns accountId
 *
 * @param stagelessService
 */
export function getStagelessServiceAccountId(stagelessService: STAGELESS_SERVICE): string {
  assert.ok(stagelessEnvironmentConfiguration[stagelessService], `AccountInfo for ${ stagelessService } is undefined`);

  return stagelessEnvironmentConfiguration[stagelessService].accountId;
}

/**
 * Converts {@link STAGE} enum to array
 *
 * @returns list of {@link STAGE}s
 *
 */
export function getAllStages(): STAGE[] {
  return Object.values(STAGE);
}
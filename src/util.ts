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
import { AHA_DEFAULT_REGION, SERVICE, StackCreationInfo, STAGE } from "./constant";
import { AccountInfo, environmentConfiguration, StageInfo } from "./environment-configuration";
import assert from "assert";
import { Environment } from "aws-cdk-lib";

export function createStackCreationInfo(account: string, region: string = AHA_DEFAULT_REGION, stage?: STAGE): StackCreationInfo {
  return {
    account: account,
    region: region,
    stage: stage ?? STAGE.ALPHA,
    stackPrefix: `Aha-${ region }${ stage ? '-' + stage : '' }`,
  };
}

export function getEnvFromStackCreationInfo(stackCreationInfo: StackCreationInfo): Environment {
  const { account, region } = stackCreationInfo;

  return {
    account: account,
    region: region,
  };
}

export function getStages(): STAGE[] {
  return <STAGE[]>(
      Object.keys(environmentConfiguration)
  );
}

/**
 * Returns the stages that a service has @link{environmentConfiguration} configured
 *
 * @returns list of {@link STAGE} object
 *
 * @param service {@link SERVICE}
 */
export function getStagesForService(service: SERVICE): STAGE[] {
  let stages: STAGE[] = [];
  for (let key of Object.keys(environmentConfiguration)) {
    if (service in environmentConfiguration[<STAGE>(key)]) {
      stages.push(<STAGE>(key))
    }
  }

  return stages;
}
//
// /**
//  * Returns true if a service has a stage configured in @link{environmentConfiguration}
//  *
//  * @returns a list of {@link STAGE} object
//  *
//  * @param service {@link SERVICE}
//  * @param stage {@link STAGE}
//  */
// export function isStageExistForService(service: SERVICE, stage: STAGE): boolean {
//   return getStagesForService(service).some(aStage => {
//     return aStage === stage;
//   });
// }

export function getAccountInfo(service: SERVICE, stage: STAGE): AccountInfo {
  const stageInfo = getStageInfo(stage);
  const accountInfo = stageInfo[service];

  assert.ok(stageInfo[service], `AccountInfo for ${ service }-${ stage } is undefined`)
  return accountInfo;
}

export function getStageInfo(stage: STAGE): StageInfo {
  return environmentConfiguration[stage];
}

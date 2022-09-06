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

export function createStackCreationInfo(account: string, region: string = AHA_DEFAULT_REGION, stage?: STAGE): StackCreationInfo {
  return {
    account: account,
    region: region,
    stage: stage ?? STAGE.ALPHA,
    stackPrefix: `Aha-${ region }${ stage ? '-' + stage : '' }`,
  };
}

export function getStages(): STAGE[] {
  return <STAGE[]>(
      Object.keys(environmentConfiguration)
  );
}

export function getAccountInfo(service: SERVICE, stage: STAGE): AccountInfo {
  const stageInfo = getStageInfo(stage);
  const accountInfo = stageInfo[service];

  assert.ok(stageInfo[service], `AccountInfo for ${ service }-${ stage } is undefined`)
  return accountInfo;
}

export function getStageInfo(stage: STAGE): StageInfo {
  return environmentConfiguration[stage];
}

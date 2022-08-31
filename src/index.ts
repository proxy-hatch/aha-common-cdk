export const AHA_DEFAULT_REGION = 'ap-northeast-1';
export const AHA_ORGANIZATION_ACCOUNT = '083784680548';

export const STAGES = {
  Alpha: 'alpha',
  Beta: 'beta',
  Gamma: 'gamma',
  Prod: 'prod',
} as const;

export const SERVICES = {
  ApiCore: 'api-core',
  // ApiAuth: 'api-auth',
} as const;

export interface StackCreationInfo {
  readonly account: string;
  readonly region: string;
  readonly stage: string;
  readonly stackPrefix: string;
}

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
export function createStackCreationInfo(account: string, region: string = AHA_DEFAULT_REGION, stage?: string): StackCreationInfo {
  return {
    account: account,
    region: region,
    stage: stage ?? '',
    stackPrefix: `Aha-${ region }${ stage ? '-' + stage : '' }`,
  };
}


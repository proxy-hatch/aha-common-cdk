export const AHA_DEFAULT_REGION = 'ap-northeast-1';
export const GITHUB_ORGANIZATION_NAME = 'EarnAha';

export enum REGION {
  APN1 = 'ap-northeast-1',
  USW2 = 'us-west-2',
  USE1 = 'us-east-1',
}

export enum STAGE {
  ALPHA = 'alpha',
  BETA = 'beta',
  GAMMA = 'gamma',
  PROD = 'prod',
}

export enum SERVICE {
  API_CORE = 'api-core',
  API_AUTH = 'api-auth',
}

export interface StackCreationInfo {
  readonly account: string;
  readonly region: string;
  readonly stage: STAGE;
  readonly stackPrefix: string;
}

export const AHA_DEFAULT_REGION = 'ap-northeast-1';

export enum STAGE {
  ALPHA = 'alpha',
  BETA = 'beta',
  GAMMA = 'gamma',
  PROD = 'prod',
}

export enum SERVICE {
  API_CORE = 'api-core',
  // API_AUTH: 'api-auth',
}

export interface StackCreationInfo {
  readonly account: string;
  readonly region: string;
  readonly stage: string;
  readonly stackPrefix: string;
}

export const AHA_DEFAULT_REGION = 'ap-northeast-1';
export const GITHUB_ORGANIZATION_NAME = 'EarnAha';
export const GITHUB_CONNECTION_ARN = 'arn:aws:codestar-connections:ap-northeast-1:756713672993:connection/c345ae61-ea3e-4e91-99fb-36c881a75545';

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
  readonly stage: STAGE;
  readonly stackPrefix: string;
}

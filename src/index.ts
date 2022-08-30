import { Environment } from 'aws-cdk-lib';

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


export interface DeploymentEnvironment extends Environment {
  readonly account: string;
  readonly region: string;
  readonly stage: string;
  readonly appPrefix: string;
}

export interface StackCreationInfo {
  readonly account: string;
  readonly region: string;
  readonly stage?: string;
  readonly stackPrefix: string;
}

export function createStackCreationInfo(account: string, region: string, stage?: string): StackCreationInfo {
  return {
    account: account,
    region: region,
    stackPrefix: `Aha-${ region }${ stage ? '-' + stage : '' }`,
  };
}

export const AHA_DEFAULT_REGION = 'ap-northeast-1';

export const AHA_ORGANIZATION_ACCOUNT = '083784680548';
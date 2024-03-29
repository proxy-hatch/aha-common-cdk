export const AHA_DEFAULT_REGION = 'ap-northeast-1';
export const GITHUB_ORGANIZATION_NAME = 'EarnAha';
export const GITHUB_SSH_PRIVATE_KEY_SECRET_ID = 'github-ssh-private-key';
export const GITHUB_SSH_PRIVATE_KEY_SECRET_ARN = 'arn:aws:secretsmanager:ap-northeast-1:742084164729:secret:github-ssh-private-key-Sogqtg';
export const GITHUB_STATUS_TRACKING_TOKEN_SECRET_ID = 'github-commit-status-token';
export const GITHUB_STATUS_TRACKING_TOKEN_SECRET_ARN = 'arn:aws:secretsmanager:ap-northeast-1:742084164729:secret:github-commit-status-token-KHIxwC';


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
  NFT_MGMT_SERVICE = 'NftManagementService',
}

export enum STAGELESS_SERVICE {
  DNS_MANAGEMENT = 'DnsManagement',
  OPS = 'ops',
}

export interface StackCreationInfo {
  readonly account: string;
  readonly region: string;
  readonly stage: STAGE;
  readonly stackPrefix: string;
}

export const AHA_ORGANIZATION_ID = 'o-0d8fgac99h';
export const TOP_LEVEL_DOMAIN = 'aws.earnaha.com';
export const DELEGATION_PARENT_DOMAIN = 'api.'.concat(TOP_LEVEL_DOMAIN);
export const HOSTED_ZONE_DELEGATION_ROLE_NAME = 'AhaHostedZoneCrossAccountDelegationRole';

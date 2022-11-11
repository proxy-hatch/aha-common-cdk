import { SERVICE, STAGE, STAGELESS_SERVICE } from './constant';

export interface AccountInfo {
  readonly accountId: string;

  // githubConnectionArn must be provided for pipeline-hosting accounts
  // To generate github connectionArn in the pipeline-hosting account from AWS Console https://console.aws.amazon.com/codesuite/settings/connections
  readonly githubConnectionArn?: string;
}

// cannot specify `[key in SERVICE]`, or else TS forces every service must be in each stage
export type StageEnvironmentConfiguration = {
  readonly [key: string]: AccountInfo;
};

// cannot specify `[key in SERVICE]`, or else TS forces every service must be in each stage
export type StageInfo = {
  readonly [key: string]: AccountInfo;
}

export const AHA_ORGANIZATION_ACCOUNT = '083784680548';

export const sharedStageEnvironmentConfiguration: StageEnvironmentConfiguration = {
  [STAGE.BETA]: {
    accountId: '742084164729',
  },
  [STAGE.GAMMA]: {
    accountId: '336932466870',
  },
  [STAGE.PROD]: {
    accountId: '944723853722',
  },
};

export const alphaEnvironmentConfiguration: StageInfo = {
  [SERVICE.API_CORE]: {
    accountId: '275636488910',
  },
  [SERVICE.API_AUTH]: {
    accountId: '427287191619',
  },
  [SERVICE.NFT_MGMT_SERVICE]: {
    accountId: '097554862356',
  },
};

export const stagelessEnvironmentConfiguration: StageInfo = {
  [STAGELESS_SERVICE.DNS_MANAGEMENT]: {
    accountId: '992993174366',
  },
  [STAGELESS_SERVICE.OPS]: {
    accountId: '462602131761',
  },
};

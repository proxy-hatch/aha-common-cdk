import { SERVICE, STAGE, STAGELESS_SERVICE } from './constant';

export interface AccountInfo {
  readonly accountId: string;

  // githubConnectionArn must be provided for pipeline-hosting accounts
  // To generate github connectionArn in the pipeline-hosting account from AWS Console https://console.aws.amazon.com/codesuite/settings/connections
  readonly githubConnectionArn?: string;
}

export type EnvInfo = {
  readonly [key: string]: AccountInfo;
}

export const AHA_ORGANIZATION_ACCOUNT = '083784680548';

export const sharedStageEnvironmentConfiguration: EnvInfo = {
  [STAGE.BETA]: {
    accountId: '742084164729',
    githubConnectionArn: 'arn:aws:codestar-connections:ap-northeast-1:742084164729:connection/343dd82e-81eb-4868-b09c-672ff3f28100',
  },
  [STAGE.GAMMA]: {
    accountId: '336932466870',
  },
  [STAGE.PROD]: {
    accountId: '944723853722',
  },
};

export const alphaEnvironmentConfiguration: EnvInfo = {
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

export const stagelessEnvironmentConfiguration: EnvInfo = {
  [STAGELESS_SERVICE.DNS_MANAGEMENT]: {
    accountId: '992993174366',
  },
  [STAGELESS_SERVICE.OPS]: {
    accountId: '462602131761',
  },
};

export const serviceDnsShortname = {
  [SERVICE.API_CORE]: 'core',
  [SERVICE.API_AUTH]: 'auth',
  [SERVICE.NFT_MGMT_SERVICE]: 'nft-mgmt',
};

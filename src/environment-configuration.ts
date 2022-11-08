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

export const stageEnvironmentConfiguration: StageEnvironmentConfiguration = {
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

/*
------------------------------------------------------------------------------------
BELOW ARE LEGACY ENVIRONMENTS - To be migrated and terminated
 */
export type EnvironmentConfiguration = {
  readonly [key in STAGE]: StageInfo;
};

export const environmentConfiguration: EnvironmentConfiguration = {
  [STAGE.ALPHA]: {
    [SERVICE.API_CORE]: {
      accountId: '275636488910',
      githubConnectionArn: 'arn:aws:codestar-connections:ap-northeast-1:275636488910:connection/3891f5fb-5d61-4e89-9bc7-3690798b049e',
    },
    [SERVICE.API_AUTH]: {
      accountId: '427287191619',
    },
  },
  [STAGE.BETA]: {
    [SERVICE.API_CORE]: {
      accountId: '756713672993',
      githubConnectionArn: 'arn:aws:codestar-connections:ap-northeast-1:756713672993:connection/c345ae61-ea3e-4e91-99fb-36c881a75545',
    },
    [SERVICE.API_AUTH]: {
      accountId: '698022483365',
    },
  },
  [STAGE.GAMMA]: {
    [SERVICE.API_CORE]: {
      accountId: '522648679392',
    },
    [SERVICE.API_AUTH]: {
      accountId: '727449454366',
    },
  },
  [STAGE.PROD]: {
    [SERVICE.API_CORE]: {
      accountId: '984822508163',
      githubConnectionArn: 'arn:aws:codestar-connections:ap-northeast-1:984822508163:connection/5ff43d42-1be8-41d7-a29b-8f469da6cb40',
    },
    [SERVICE.API_AUTH]: {
      accountId: '142013183369',
    },
  },
};


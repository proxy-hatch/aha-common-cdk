import { SERVICE, STAGE } from "./constant";

export const AHA_ORGANIZATION_ACCOUNT = '083784680548';

export interface AccountInfo {
  readonly accountId: string;

  // githubConnectionArn must be provided for pipeline-hosting accounts
  // To generate github connectionArn in the pipeline-hosting account from AWS Console https://console.aws.amazon.com/codesuite/settings/connections
  readonly githubConnectionArn?: string;
}

// cannot specify `key in SERVICE`, or else TS forces every service must be in each stage
export type StageInfo = {
  readonly [key: string]: AccountInfo;
}

export type EnvironmentConfiguration = {
  readonly [key in STAGE]: StageInfo;
};

export const environmentConfiguration: EnvironmentConfiguration = {
  [STAGE.ALPHA]: {
    [SERVICE.API_CORE]: {
      accountId: "275636488910",
      // githubConnectionArn: 'arn:aws:codestar-connections:ap-northeast-1:275636488910:connection/3891f5fb-5d61-4e89-9bc7-3690798b049e',
      // TODO: change back
      githubConnectionArn: 'arn:aws:codestar-connections:us-west-2:083784680548:connection/3d6d87d9-1141-4616-9660-872de10ecee2',
},
  },
  [STAGE.BETA]: {
    [SERVICE.API_CORE]: {
      accountId: "756713672993",
      githubConnectionArn: 'arn:aws:codestar-connections:ap-northeast-1:756713672993:connection/c345ae61-ea3e-4e91-99fb-36c881a75545',
    },
  },
  [STAGE.GAMMA]: {
    [SERVICE.API_CORE]: {
      accountId: "522648679392",
    },
  },
  [STAGE.PROD]: {
    // [SERVICE.API_CORE]: {
    //   accountId: "984822508163",
    // },
  },
}


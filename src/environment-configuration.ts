import { SERVICE, STAGE } from "./constant";

export const AHA_ORGANIZATION_ACCOUNT = '083784680548';

export interface AccountInfo {
  readonly accountId : string;
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
    },
  },
  [STAGE.BETA]: {
    [SERVICE.API_CORE]: {
      accountId: "756713672993",
    },
  },
  [STAGE.GAMMA]: {
    [SERVICE.API_CORE]: {
      accountId: "522648679392",
    },
  },
  [STAGE.PROD]: {
    [SERVICE.API_CORE]: {
      accountId: "984822508163",
    },
  },
}


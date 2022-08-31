export declare const AHA_DEFAULT_REGION = "ap-northeast-1";
export declare const AHA_ORGANIZATION_ACCOUNT = "083784680548";
export declare const STAGES: {
    readonly Alpha: "alpha";
    readonly Beta: "beta";
    readonly Gamma: "gamma";
    readonly Prod: "prod";
};
export declare const SERVICES: {
    readonly ApiCore: "api-core";
};
export interface StackCreationInfo {
    readonly account: string;
    readonly region: string;
    readonly stage: string;
    readonly stackPrefix: string;
}
/**
 * Returns the stack creation info
 *
 * @remarks
 * This method is used in each stack creation across envs
 *
 * @param account - the AWS account ID
 * @param region - the AWS region that stacks should be deployed to. Defaulted to {@link AHA_DEFAULT_REGION}
 * @param stage - the deployment stage. When not provided, defaults to stage-less
 * @returns a {@link StackCreationInfo} object
 *
 */
export declare function createStackCreationInfo(account: string, region?: string, stage?: string): StackCreationInfo;

import { Construct } from "constructs";
import { Stack, StackProps } from "aws-cdk-lib";
import { CodePipeline, CodePipelineSource, ShellStep } from "aws-cdk-lib/pipelines";
import { AHA_DEFAULT_REGION, SERVICE, StackCreationInfo, STAGE } from "../constant";
import { createStackCreationInfo, getAccountInfo, getStages } from "../util";


export type TrackingPackage = {
  readonly package: string;
  readonly branch?: string; // default to main
}


/**
 *  Complete Pipeline Configuration is passed in the form of BMPipelineConfigurationProps.
 */
export interface AhaPipelineProps extends StackProps {
  readonly pipelineInfo: AhaPipelineInfo;
  readonly packagesToTrack: TrackingPackage[];  // the 1st must be service package
}

/**
 * Object containing the required data to set up a pipeline
 */
export interface AhaPipelineInfo {
  readonly service: SERVICE;
  // readonly disambiguator?: string; //Used while building stackPrefix to disambiguate stack names
  readonly pipelineName: string;
  // readonly description: string;
  readonly pipelineAccount: string;
  readonly skipProdStages?: boolean;
}

export interface DeploymentGroupCreationProps {
  readonly stackCreationInfo: StackCreationInfo;
}

export class AhaPipelineStack extends Stack {
  public readonly deploymentGroupCreationProps: DeploymentGroupCreationProps[] = [];
  public readonly pipeline: CodePipeline;

  // declare const source: IFileSetProducer;
  // TODO: integrate w/ CodeBuild https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.pipelines-readme.html#synth-and-sources:~:text=Migrating%20from%20buildspec.yml%20files

  constructor(scope: Construct, id: string, props: AhaPipelineProps) {
    super(scope, id, props);

    this.pipeline = new CodePipeline(this, 'Pipeline', {
      crossAccountKeys: true,
      selfMutation: false,  // TODO: enalbe when no more changes to pipeline
      synth: new ShellStep('Synth', {
        // generate github connectionArn in the account hosting pipeline
        // from AWS Console https://console.aws.amazon.com/codesuite/settings/connections
        // ref: https://tinyurl.com/setting-github-connection
        input: CodePipelineSource.connection('EarnAha/aha-poc-express-server', 'main', {
          connectionArn: 'arn:aws:codestar-connections:ap-northeast-1:756713672993:connection/c345ae61-ea3e-4e91-99fb-36c881a75545',
        }),
        additionalInputs: {
          './': CodePipelineSource.connection('EarnAha/aha-poc-ts-lib', 'main', {
            connectionArn: 'arn:aws:codestar-connections:ap-northeast-1:756713672993:connection/c345ae61-ea3e-4e91-99fb-36c881a75545',
          }),
        },
        commands: [
          'npm ci',
          'npm run build',
          'npx cdk synth',
        ],
      }),
    });

    this.setDeploymentGroupCreationProps(props);
  }

  private setDeploymentGroupCreationProps(props: AhaPipelineProps): void {
    const { service, skipProdStages } = props.pipelineInfo;

    getStages().forEach(stage => {
      if (skipProdStages && stage == STAGE.PROD) {
        return;
      }

      this.deploymentGroupCreationProps.push({
        stackCreationInfo: createStackCreationInfo(
            getAccountInfo(service, stage).accountId,
            AHA_DEFAULT_REGION,
            stage),
      });

    });
  }

}

//
// /**
//  * Your application
//  *
//  * May consist of one or more Stacks (here, two)
//  *
//  * By declaring our DatabaseStack and our ComputeStack inside a Stage,
//  * we make sure they are deployed together, or not at all.
//  */
// class StageStacks extends Stage {
//   constructor(scope: Construct, id: string, props?: StageProps) {
//     super(scope, id, props);
//
//     const stackCreationInfo: StackCreationInfo = createStackCreationInfo(
//         process.env.DEV_ACCOUNT!,
//         AHA_DEFAULT_REGION,
//         STAGE.ALPHA);
//
//     const env: Environment = {
//       account: stackCreationInfo.account,
//       region: stackCreationInfo.region,
//     };
//
//     createDeploymentStacks(scope, stackCreationInfo, env);
//   }
// }

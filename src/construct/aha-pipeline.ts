import { Construct } from "constructs";
import { RemovalPolicy, Stack, StackProps, Stage } from "aws-cdk-lib";
import { CodePipeline, CodePipelineSource, ShellStep } from "aws-cdk-lib/pipelines";
import { AHA_DEFAULT_REGION, SERVICE, StackCreationInfo, STAGE } from "../constant";
import { createStackCreationInfo, getAccountInfo, getStagesForService } from "../util";
import { Repository } from "aws-cdk-lib/aws-ecr";
import assert from "node:assert";


export type TrackingPackage = {
  readonly package: string;
  readonly branch?: string; // default to main
}

/**
 *  Complete Pipeline Configuration is passed in the form of BMPipelineConfigurationProps.
 */
export interface AhaPipelineProps extends StackProps {
  readonly pipelineInfo: AhaPipelineInfo;
  readonly trackingPackages: TrackingPackage[];  // the 1st must be service package
}

/**
 * Object containing the required data to set up a pipeline
 */
export interface AhaPipelineInfo {
  readonly service: SERVICE;
  readonly pipelineName: string;
  readonly pipelineAccount: string;
  readonly skipProdStages?: boolean;
}

export interface DeploymentGroupCreationProps {
  readonly stackCreationInfo: StackCreationInfo;
}

/**
 * Creates a CDK-managed pipeline for Aha back-end service, built with CodeBuild
 *
 * @remarks also creates ECR image repo for each stage of service.
 *
 * @param stage - The Aha stage this deployment is for
 * @param deploymentStage - The collection of infrastructure stacks for this env
 *
 */
export class AhaPipelineStack extends Stack {
  public readonly deploymentGroupCreationProps: DeploymentGroupCreationProps[] = [];
  public readonly pipeline: CodePipeline;
  private readonly props: AhaPipelineProps;

  constructor(scope: Construct, id: string, props: AhaPipelineProps) {
    super(scope, id, props);
    this.props = props;

    this.setDeploymentGroupCreationProps(props);
    this.createEcrs();

    this.pipeline = new CodePipeline(this, 'Pipeline', {
      crossAccountKeys: true,
      selfMutation: false,  // TODO: enalbe when no more changes to pipeline
      synth: this.addNodeProjectBuildStep(props.trackingPackages),
    });
  }

  /**
   * Adds the deployment stacks in a single stage to the pipeline env.
   *
   * @remarks also adds a CodeBuild stage to publish src code to ECR named `${ props.stackCreationInfo.stackPrefix }-Ecr`
   *
   * @param stage - The Aha stage this deployment is for
   * @param deploymentStage - The collection of infrastructure stacks for this env
   *
   */
  public addDeploymentStage(stage: STAGE, deploymentStage: Stage): void {
    if (stage !== STAGE.ALPHA) {
      this.addNodeProjectBuildStep(this.props.trackingPackages);
    }

    this.pipeline.addStage(deploymentStage);
  }

  private setDeploymentGroupCreationProps(props: AhaPipelineProps): void {
    const { service, skipProdStages } = props.pipelineInfo;

    getStagesForService(service).forEach(stage => {
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

  private createEcrs(): void {
    this.deploymentGroupCreationProps.forEach(props => {
      const stageEcrName = `${ props.stackCreationInfo.stackPrefix }-Ecr` as const;
      new Repository(this, stageEcrName, {
            repositoryName: stageEcrName,
            removalPolicy: RemovalPolicy.DESTROY,
            lifecycleRules: [ {
              description: 'limit max image count',
              maxImageCount: 100,
            } ],
          },
      );
    });
  }

  // TODO: ShellStep is a CodeBuild project. Objective: build Docker Image for the 1st stage and publish to ECR
  // ref: ShellStep https://docs.aws.amazon.com/cdk/api/v1/docs/pipelines-readme.html#customizing-codebuild-projects:~:text=Click%20here.)-,Customizing%20CodeBuild%20Projects,-CDK%20pipelines%20will
  // ref: CodeBuildStep https://docs.aws.amazon.com/cdk/api/v1/docs/@aws-cdk_pipelines.CodeBuildStep.html
  // ref: building Docker image and publish to ECR with CodeBuild https://docs.aws.amazon.com/codebuild/latest/userguide/sample-docker.html
  private addNodeProjectBuildStep(trackingPackages: TrackingPackage[]): ShellStep {
    assert.ok(trackingPackages.length > 0, "number of tracking packages cannot be 0");

    if(trackingPackages.length > 1){
      trackingPackages.shift(); // in-place remove 1st elem
       // trackingPackages... additional processing
    }

    return new ShellStep('Synth', {
      // generate github connectionArn in the account hosting pipeline
      // from AWS Console https://console.aws.amazon.com/codesuite/settings/connections
      // ref: https://tinyurl.com/setting-github-connection
      input: CodePipelineSource.connection(trackingPackages[0].package, trackingPackages[0].branch ?? 'main', {
        connectionArn: 'arn:aws:codestar-connections:ap-northeast-1:756713672993:connection/c345ae61-ea3e-4e91-99fb-36c881a75545',
      }),
      // additionalInputs: {
      //   './': CodePipelineSource.connection('EarnAha/aha-poc-ts-lib', 'main', {
      //     connectionArn: 'arn:aws:codestar-connections:ap-northeast-1:756713672993:connection/c345ae61-ea3e-4e91-99fb-36c881a75545',
      //   }),
      // },
      commands: [
        'npm ci',
        'npm run build',
        'npx cdk synth',
      ],
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

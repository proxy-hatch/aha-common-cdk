import { Construct } from "constructs";
import { RemovalPolicy, Stack, StackProps, Stage } from "aws-cdk-lib";
import { CodePipeline, CodePipelineSource, ShellStep } from "aws-cdk-lib/pipelines";
import {
  AHA_DEFAULT_REGION,
  GITHUB_CONNECTION_ARN,
  GITHUB_ORGANIZATION_NAME,
  SERVICE,
  StackCreationInfo,
  STAGE,
} from "../constant";
import { createStackCreationInfo, getAccountInfo, getStagesForService } from "../util";
import { Repository } from "aws-cdk-lib/aws-ecr";
import assert from "node:assert";
import { IFileSetProducer } from "aws-cdk-lib/pipelines/lib/blueprint/file-set";


/**
 * When branch is not provided, defaults to track main branch
 */
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
 * Returns the ECR repository name for the service stage
 *
 *
 * @param stackPrefix {@link StackCreationInfo.stackPrefix}
 * @param service {@link SERVICE}
 */
export function getEcrRepositoryName(stackPrefix: string, service: SERVICE) {
  return `${ stackPrefix }-${ service }-ecr`.toLowerCase();
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
    this.createEcrRepositories();

    this.pipeline = new CodePipeline(this, 'Pipeline', {
      crossAccountKeys: true,
      selfMutation: false,  // TODO: enable when no more changes to pipeline
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

  private createEcrRepositories(): void {
    this.deploymentGroupCreationProps.forEach(props => {
      const stageEcrName = getEcrRepositoryName(props.stackCreationInfo.stackPrefix, this.props.pipelineInfo.service);
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

    // track additional packages
    let additionalInputs: Record<string, IFileSetProducer> = {};
    let primaryPackage: TrackingPackage;
    if (trackingPackages.length > 1) {
      primaryPackage = trackingPackages.shift()!; // in-place remove 1st elem
      trackingPackages.forEach(pkg => {
        additionalInputs[pkg.package] = CodePipelineSource.connection(`${ GITHUB_ORGANIZATION_NAME }/${ pkg.package }`, pkg.branch ?? 'main', {
          connectionArn: GITHUB_CONNECTION_ARN,
        })
      });
    } else {
      primaryPackage = trackingPackages[0]
    }

    return new ShellStep('Synth', {
      // generate github connectionArn in the account hosting pipeline
      // from AWS Console https://console.aws.amazon.com/codesuite/settings/connections
      // ref: https://tinyurl.com/setting-github-connection
      input: CodePipelineSource.connection(`${ GITHUB_ORGANIZATION_NAME }/${ primaryPackage.package }`, primaryPackage.branch ?? 'main', {
        connectionArn: GITHUB_CONNECTION_ARN,
      }),
      additionalInputs: additionalInputs,
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

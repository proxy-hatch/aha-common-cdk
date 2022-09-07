import { Construct } from "constructs";
import { RemovalPolicy, Stack, StackProps, Stage } from "aws-cdk-lib";
import { CodePipeline } from "aws-cdk-lib/pipelines";
import {
  AHA_DEFAULT_REGION,
  REGION,
  STAGE,
} from "../constant";
import { createStackCreationInfo, getAccountInfo } from "../util";
import { Repository } from "aws-cdk-lib/aws-ecr";
import assert from "node:assert";
import {
  BaseAhaPipelineInfo,
  buildAndPublishServiceImage,
  buildSynthStep, DeploymentGroupCreationProps,
  getEcrRepositoryName,
  TrackingPackage,
} from "./pipeline-common";
import { AssertionError } from "assert";


/**
 *  Complete single-env pipeline configuration
 */
export interface AhaSingleEnvPipelineProps extends StackProps {
  readonly pipelineInfo: AhaSingleEnvPipelineInfo;
  readonly trackingPackages: TrackingPackage[];  // the 1st must be service package
}

export interface AhaSingleEnvPipelineInfo extends BaseAhaPipelineInfo {
  readonly stage: STAGE;
}

/**
 * Creates a CDK-managed pipeline for a single env, built with CodeBuild. Used to manage alpha/prod independently
 *
 * @remarks also creates ECR image repo in the same account
 *
 * @param stage - The Aha stage this deployment is for
 * @param deploymentStage - The collection of infrastructure stacks for this env
 *
 */
export class AhaSingleEnvPipelineStack extends Stack {
  public readonly deploymentGroupCreationProps!: DeploymentGroupCreationProps;
  public readonly pipeline: CodePipeline;
  private readonly props: AhaSingleEnvPipelineProps;
  private isDeploymentStageSet: boolean = false;

  constructor(scope: Construct, id: string, props: AhaSingleEnvPipelineProps) {
    super(scope, id, { env: { region: REGION.APN1, account: props.pipelineInfo.pipelineAccount } });
    this.props = props;

    this.deploymentGroupCreationProps = this.buildDeploymentGroupCreationProps(props);
    this.createEcrRepository();

    this.pipeline = new CodePipeline(this, 'Pipeline', {
      crossAccountKeys: true, // allow multi-account envs
      selfMutation: props.pipelineInfo.pipelineSelfMutation ?? true,
      dockerEnabledForSynth: true,  // allow CodeBuild to use Docker
      synth: buildSynthStep(props.trackingPackages),
    });
  }

  /**
   * Adds the deployment stacks in a single stage to the pipeline env.
   *
   * @remarks also adds a CodeBuild stage to publish src code to ECR named `${ props.stackCreationInfo.stackPrefix }-Ecr`
   *
   * @param deploymentStage - The collection of infrastructure stacks for this env
   *
   */
  public addDeploymentStage(deploymentStage: Stage): void {
    assert.ok(!this.isDeploymentStageSet, "deployment stage already created! Only 1 deployment stage allowed for single env pipeline");
    this.isDeploymentStageSet = true;

    buildAndPublishServiceImage();

    this.pipeline.addStage(deploymentStage);
  }

  private buildDeploymentGroupCreationProps(props: AhaSingleEnvPipelineProps): DeploymentGroupCreationProps {
    const { service, stage } = props.pipelineInfo;

    let accountId: string;
    try {
      accountId = getAccountInfo(service, stage).accountId;
    } catch (e: unknown) {
      if (e instanceof AssertionError) {
        throw new ReferenceError(`stage ${ stage } for ${ service } not found: ${ e.message }`);
      } else {
        throw new Error(`Unknown error while retrieving accountInfo for stage ${ service } ${ stage }: ${ e }`);
      }
    }

    return {
      stackCreationInfo: createStackCreationInfo(
          accountId,
          AHA_DEFAULT_REGION,
          stage),
    }
  }

  private createEcrRepository(): void {
    const stageEcrName = getEcrRepositoryName(
        this.deploymentGroupCreationProps.stackCreationInfo.stackPrefix, this.props.pipelineInfo.service);
    new Repository(this, stageEcrName, {
          repositoryName: stageEcrName,
          removalPolicy: RemovalPolicy.DESTROY,
          lifecycleRules: [ {
            description: 'limit max image count',
            maxImageCount: 100,
          } ],
        },
    );
  }

}
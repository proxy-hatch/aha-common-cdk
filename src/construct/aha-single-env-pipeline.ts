import { Construct } from "constructs";
import { RemovalPolicy, Stack, StackProps, Stage } from "aws-cdk-lib";
import { CodePipeline, ShellStep } from "aws-cdk-lib/pipelines";
import {
  AHA_DEFAULT_REGION,
  REGION, StackCreationInfo,
  STAGE,
} from "../constant";
import { createStackCreationInfo, getAccountInfo } from "../util";
import { Repository } from "aws-cdk-lib/aws-ecr";
import assert from "node:assert";
import {
  BaseAhaPipelineInfo,
  buildSynthStep, createBuildServiceImageShellStep, DeploymentGroupCreationProps,
  getEcrName,
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
  private readonly synth: ShellStep;

  constructor(scope: Construct, id: string, props: AhaSingleEnvPipelineProps) {
    super(scope, id, { env: { region: REGION.APN1, account: props.pipelineInfo.pipelineAccount } });
    this.props = props;

    this.deploymentGroupCreationProps = this.buildDeploymentGroupCreationProps(props);
    this.createEcrRepository();

    this.synth = buildSynthStep(props.trackingPackages);
    this.pipeline = new CodePipeline(this, 'Pipeline', {
      crossAccountKeys: true, // allow multi-account envs
      selfMutation: props.pipelineInfo.pipelineSelfMutation ?? true,
      dockerEnabledForSynth: true,  // allow CodeBuild to use Docker
      synth: this.synth,
    });
  }

  /**
   * Adds the deployment stacks in a single stage to the pipeline env.
   *
   * @remarks also adds a CodeBuild stage prior to deployment stage, to publish src code to ECR named `${ props.stackCreationInfo.stackPrefix }-Ecr`
   *
   * @param stackCreationInfo - the env that infrastructure stacks is being deployed to
   * @param deploymentStage - The collection of infrastructure stacks for this env
   *
   */
  public addDeploymentStage(stackCreationInfo: StackCreationInfo, deploymentStage: Stage): void {
    assert.strictEqual(this.isDeploymentStageSet, false, "deployment stage already created! Only 1 deployment stage allowed for single env pipeline");

    this.pipeline.addStage(<Stage>deploymentStage,
        {
          post: [
            createBuildServiceImageShellStep(
                this.synth,
                stackCreationInfo.account,
                stackCreationInfo.region,
                getEcrName(stackCreationInfo.stackPrefix, this.props.pipelineInfo.service),
            ),
            // TODO: step function to wait for app healthy
            // TODO: run integ test step
          ],
        },
    );

    this.isDeploymentStageSet = true;
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
    const stageEcrName = getEcrName(
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
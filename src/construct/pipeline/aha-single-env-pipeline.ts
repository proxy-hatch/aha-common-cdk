import { Construct } from "constructs";
import { RemovalPolicy, Stack, StackProps, Stage } from "aws-cdk-lib";
import { CodePipeline, ShellStep, Step } from "aws-cdk-lib/pipelines";
import {
  AHA_DEFAULT_REGION,
  REGION, StackCreationInfo,
  STAGE,
} from "../../constant";
import { Repository } from "aws-cdk-lib/aws-ecr";
import assert from "node:assert";
import {
  BaseAhaPipelineInfo,
  buildSynthStep,
  createServiceImageBuildCodeBuildStep,
  DeploymentGroupCreationProps,
  getEcrName,
  TrackingPackage,
} from "./pipeline-common";
import { createStackCreationInfo } from '../../util';
import { BuildEnvironmentVariableType, BuildSpec } from 'aws-cdk-lib/aws-codebuild';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';

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
  private isDeploymentStageSet: boolean = false;
  private readonly synthStep: ShellStep;

  // private readonly deploymentWaitStateMachine: StateMachine;

  constructor(scope: Construct, id: string,
              private readonly props: AhaSingleEnvPipelineProps) {
    super(scope, id, { env: { region: REGION.APN1, account: props.pipelineInfo.pipelineAccount } });

    this.deploymentGroupCreationProps = this.buildSingleStageDeploymentGroupCreationProps(this.props.pipelineInfo.pipelineAccount, props.pipelineInfo.stage);
    this.createEcrRepository();

    this.synthStep = buildSynthStep(props.trackingPackages, props.pipelineInfo.service, props.pipelineInfo.stage);
    this.pipeline = new CodePipeline(this, 'Pipeline', {
      crossAccountKeys: true, // allow multi-account envs
      selfMutation: props.pipelineInfo.pipelineSelfMutation ?? true,
      synth: this.synthStep,
      synthCodeBuildDefaults: {
        partialBuildSpec: BuildSpec.fromObject({
          // env: {

          // TODO: use cross-account parameter-store or make new for each env
          // 'parameter-store': {
          //   'build_ssh_key': "/poc-test/github-key",
          // },
          // },
          phases: {
            install: {
              "runtime-versions": {
                nodejs: "14",
              },
              commands: [ 'n 16' ],
            },
          },
        }),
      },
      codeBuildDefaults: {
        buildEnvironment: {
          environmentVariables: {
            "SSH_PRIVATE_KEY": {
              type: BuildEnvironmentVariableType.PLAINTEXT,
              value: this.props.pipelineInfo.githubSshPrivateKey,
            },
          },
        },
        rolePolicy: [
          new PolicyStatement({
            actions: [ 'ssm:GetParameters' ],
            resources: [ '*' ],
          }),
          new PolicyStatement({
            actions: [ 'ecr:*' ],
            resources: [ '*' ],
          }),
        ],
      },
    });

    // this.deploymentWaitStateMachine = createDeploymentWaitStateMachine(this, props.pipelineInfo.service, props.pipelineInfo.deploymentWaitTimeMins);
  }

  /**
   * Adds the deployment stacks in a single stage to the pipeline env.
   *
   * @remarks also add steps post-stack deployment: 1. publish src code to ECR named `${ props.stackCreationInfo.stackPrefix }-Ecr` 2. insert deployment wait time 3. run integration test
   *
   * @param stackCreationInfo - the env that infrastructure stacks is being deployed to
   * @param deploymentStage - The collection of infrastructure stacks for this env
   *
   */
  public addDeploymentStage(stackCreationInfo: StackCreationInfo, deploymentStage: Stage): void {
    assert.strictEqual(this.isDeploymentStageSet, false, "deployment stage already created! Only 1 deployment stage allowed for single env pipeline");

    this.pipeline.addStage(deploymentStage,
        {
          pre:
              Step.sequence([
                createServiceImageBuildCodeBuildStep(
                    this.synthStep,
                    stackCreationInfo.account,
                    stackCreationInfo.region,
                    getEcrName(stackCreationInfo.stackPrefix, this.props.pipelineInfo.service),
                ),
              ]),
          // post:
          //     Step.sequence([
          //       createServiceImageBuildCodeBuildStep(
          //           this.synthStep,
          //           stackCreationInfo.account,
          //           stackCreationInfo.region,
          //           getEcrName(stackCreationInfo.stackPrefix, this.props.pipelineInfo.service),
          //       ),
          //       // used to wait for deployment completion
          //       // TODO: use deployment health check instead https://app.zenhub.com/workspaces/back-edtech-623a878cdf3d780017775a34/issues/earnaha/api-core/1709
          //       new DeploymentSfnStep(this.deploymentWaitStateMachine),
          //       // TODO: Timmy - test Jenkins integration
          //       // new AhaJenkinsIntegrationTestStep(this.props.pipelineInfo.service, this.props.pipelineInfo.stage),
          //     ]),
        });

    this.isDeploymentStageSet = true;
  }

  private buildSingleStageDeploymentGroupCreationProps(accountId: string, stage: STAGE): DeploymentGroupCreationProps {
    return {
      stackCreationInfo: createStackCreationInfo(
          accountId,
          AHA_DEFAULT_REGION,
          stage),
    };
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
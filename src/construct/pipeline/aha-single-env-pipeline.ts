import { Construct } from 'constructs';
import { Stack, StackProps, Stage } from 'aws-cdk-lib';
import { CodePipeline, ShellStep, Step } from 'aws-cdk-lib/pipelines';
import {
  AHA_DEFAULT_REGION,
  REGION, StackCreationInfo,
  STAGE,
} from '../../constant';
import assert from 'node:assert';
import {
  BaseAhaPipelineInfo,
  buildSynthStep, createDeploymentWaitStateMachine, createEcrRepository,
  createServiceImageBuildCodeBuildStep,
  DeploymentGroupCreationProps, DeploymentSfnStep,
  getEcrName,
  TrackingPackage,
} from './pipeline-common';
import { createStackCreationInfo } from '../../util';
import { BuildEnvironmentVariableType, BuildSpec } from 'aws-cdk-lib/aws-codebuild';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { StateMachine } from 'aws-cdk-lib/aws-stepfunctions';

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
  
  private readonly deploymentWaitStateMachine: StateMachine;
  
  constructor(scope: Construct, id: string,
              private readonly props: AhaSingleEnvPipelineProps) {
    super(scope, id, {
      env: {
        region: REGION.APN1,
        account: props.pipelineInfo.pipelineAccount,
      },
    });
    
    this.deploymentGroupCreationProps = this.buildSingleStageDeploymentGroupCreationProps(this.props.pipelineInfo.pipelineAccount, props.pipelineInfo.stage);
    
    createEcrRepository(this, this.deploymentGroupCreationProps.stackCreationInfo.stackPrefix, props.pipelineInfo.service);
    
    // githubSshPrivateKey is retrieved from pipeline account parameter store.
    // new pipeline account must create this manually at https://ap-northeast-1.console.aws.amazon.com/systems-manager/parameters/?region=ap-northeast-1
    // TODO: should be retrieved from central account secrets manager https://app.zenhub.com/workspace/o/earnaha/api-core/issues/1763
    const githubSshPrivateKey = StringParameter.valueForStringParameter(this, 'github-ssh-private-key');
    
    this.synthStep = buildSynthStep(props.trackingPackages, props.pipelineInfo.service, props.pipelineInfo.stage);
    this.pipeline = new CodePipeline(this, 'Pipeline', {
      crossAccountKeys: false, // allow multi-account envs by KMS encrypting artifact bucket
      selfMutation: props.pipelineInfo.pipelineSelfMutation ?? true,
      synthCodeBuildDefaults: {
        buildEnvironment: {
          environmentVariables: {
            'DEV_ACCOUNT': {
              type: BuildEnvironmentVariableType.PLAINTEXT,
              value: props.pipelineInfo.pipelineAccount,
            },
          },
        },
      },
      synth: this.synthStep,
      codeBuildDefaults: {
        partialBuildSpec: BuildSpec.fromObject({
          phases: {
            // TODO: directly use nodejs 16 when CodeBuild with CodePipeline has official support
            // https://github.com/aws/aws-codebuild-docker-images/issues/490
            install: {
              'runtime-versions': {
                nodejs: '14',
              },
              commands: ['n 16'],
            },
          },
        }),
        buildEnvironment: {
          environmentVariables: {
            'SSH_PRIVATE_KEY': {
              type: BuildEnvironmentVariableType.PLAINTEXT,
              value: githubSshPrivateKey,
            },
          },
        },
        rolePolicy: [
          new PolicyStatement({
            actions: ['ssm:GetParameters'],
            resources: ['*'],
          }),
          new PolicyStatement({
            actions: ['ecr:*'],
            resources: ['*'],
          }),
        ],
      },
    });
    
    this.deploymentWaitStateMachine = createDeploymentWaitStateMachine(this, props.pipelineInfo.service, props.pipelineInfo.deploymentWaitTimeMins);
  }
  
  /**
   * Adds the deployment stacks in a single stage to the pipeline env.
   *
   * @remarks also add steps:
   * pre-stack deployment: publish src code docker image to ECR named `${ props.stackCreationInfo.stackPrefix }-Ecr`
   * TODO: post-stack deployment: 1. insert deployment wait time 2. run integration test
   *
   * @param stackCreationInfo - the env that infrastructure stacks is being deployed to
   * @param deploymentStage - The collection of infrastructure stacks for this env
   *
   */
  public addDeploymentStage(stackCreationInfo: StackCreationInfo, deploymentStage: Stage): void {
    assert.strictEqual(this.isDeploymentStageSet, false, 'deployment stage already created! Only 1 deployment stage allowed for single env pipeline');
    
    this.pipeline.addStage(deploymentStage,
      {
        pre: [createServiceImageBuildCodeBuildStep(
          this.synthStep,
          this.props.pipelineInfo.pipelineAccount,
          stackCreationInfo.region,
          getEcrName(stackCreationInfo.stackPrefix, this.props.pipelineInfo.service),
          this.props.pipelineInfo.containerImageBuildCmds)],
        post:
          Step.sequence([
            // used to wait for deployment completion
            // TODO: use deployment health check instead https://app.zenhub.com/workspaces/back-edtech-623a878cdf3d780017775a34/issues/earnaha/api-core/1709
            new DeploymentSfnStep(this.deploymentWaitStateMachine),
            // TODO: Timmy - test Jenkins integration
            // new AhaJenkinsIntegrationTestStep(this.props.pipelineInfo.service, this.props.pipelineInfo.stage),
          ]),
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
  
}
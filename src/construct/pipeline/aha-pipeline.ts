import assert from 'node:assert';
import { RemovalPolicy, Stack, StackProps, Stage } from 'aws-cdk-lib';
import { BuildEnvironmentVariableType, BuildSpec, Cache, LinuxBuildImage } from 'aws-cdk-lib/aws-codebuild';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { CodePipeline, ManualApprovalStep, ShellStep, Step } from 'aws-cdk-lib/pipelines';
import { Construct } from 'constructs';
import { createStackCreationInfo, getAccountInfo, getAllStages } from '../../account_util';
import {
  AHA_DEFAULT_REGION,
  GITHUB_SSH_PRIVATE_KEY_SECRET_ID,
  REGION,
  SERVICE,
  StackCreationInfo,
  STAGE,
} from '../../constant';
import { sharedStageEnvironmentConfiguration } from '../../environment-configuration';
import { AhaIntegrationTestStep } from './aha-integration-test-step';
import {
  buildSynthStep,
  createCompleteDeploymentStep,
  importGithubSshCmds,
} from './pipeline-helper';


/**
 * Props to set up an Aha ECS pipeline
 *
 * @remarks Pipeline is placed in service's beta account
 *
 * @remarks Assumption: Github SSH private key (used by NPM to pull private repo code) exists in secrets manager of beta account
 *
 *
 * @remarks pipelineSelfMutation defaults to true. For new pipeline, disabling this may make development easier
 * ref: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.pipelines-readme.html#:~:text=after%20doing%20this.-,Working%20on%20the%20pipeline,-The%20self%2Dmutation
 *
 */

export interface AhaPipelineProps extends StackProps {
  readonly service: SERVICE;
  readonly pipelineSelfMutation?: boolean;
  readonly completeDeploymentCmds?: string[]; // CodeBuild cmds to exec after deployment succeeds
  readonly skipProdStages?: boolean; // false by default
  readonly prodManualApproval?: boolean; // false by default
  readonly trackingPackages: TrackingPackage[]; // the 1st must be service package
  readonly integrationTestProps?: IntegrationTestProps;
}

/**
 * Props to add an Integration test Codebuild step, attached at the end of each pipeline deployment stage
 *
 * @remarks integrationTestPackageName must exist in trackingPackages
 * @remarks testRunCmds covers both repo build and run cmds
 *
 */
export interface IntegrationTestProps {
  readonly integrationTestPackageName: string;
  readonly executionRolePolicies: PolicyStatement[];
  readonly testRunCmds: string[];
}

/**
 * When branch is not provided, defaults to track main branch
 *
 * @remarks if gitClone is false, repo will be missing .git/
 */
export type TrackingPackage = {
  readonly package: string;
  readonly branch?: string; // default to main
  readonly gitClone?: boolean; // default to false.
  readonly triggerOnPush?: boolean; // default to true
}

export interface DeploymentGroupCreationProps {
  readonly stackCreationInfo: StackCreationInfo;
}

/**
 * Creates a CDK-managed pipeline for Aha service, built with CodeBuild
 *
 * @remarks Skips alpha @link{STAGE}, also able to skip prod stage via @link{AhaPipelineProps.skipProdStages}
 * @remarks assumes Docker image is identical x-envs and deploy all envs from single ECR
 *
 * @param stage - The Aha stage this deployment is for
 * @param deploymentStage - The collection of infrastructure stacks for this env
 *
 */
export class AhaPipelineStack extends Stack {
  public readonly deploymentGroupCreationProps: DeploymentGroupCreationProps[] = [];
  public readonly pipeline: CodePipeline;
  public readonly synthStep: ShellStep;
  private readonly props: AhaPipelineProps;

  constructor(scope: Construct, id: string, props: AhaPipelineProps) {
    const pipelineAccountInfo = sharedStageEnvironmentConfiguration[STAGE.BETA];
    const pipelineAccountId = pipelineAccountInfo.accountId;

    super(scope, id, {
      env: {
        region: REGION.APN1,
        account: pipelineAccountId,
      },
    });
    this.props = props;

    // Pipeline instantiation
    const pipelineCacheBucket = this.createCacheBucket();
    this.synthStep = buildSynthStep(props.trackingPackages);
    this.pipeline = new CodePipeline(this, `${ props.service }-Pipeline`, {
      synth: this.synthStep,
      crossAccountKeys: true, // allow multi-account envs by KMS encrypting artifact bucket
      selfMutation: props.pipelineSelfMutation ?? true,
      // shared config amongst all codeBuild runs
      codeBuildDefaults: {
        buildEnvironment: {
          environmentVariables: {
            SSH_PRIVATE_KEY: {
              type: BuildEnvironmentVariableType.SECRETS_MANAGER,
              value: GITHUB_SSH_PRIVATE_KEY_SECRET_ID,
            },
          },
          buildImage: LinuxBuildImage.AMAZON_LINUX_2_4,
        },
        cache: Cache.bucket(pipelineCacheBucket),
        partialBuildSpec: BuildSpec.fromObject({
          version: '0.2',
          phases: {
            install: {
              'runtime-versions': {
                nodejs: '16',
              },
            },
            pre_build: {
              commands: importGithubSshCmds,
            },
          },
          cache: {
            paths: [
              '/root/.yarn-cache/**/*',
              '/root/.npm-cache/**/*',
              'node_modules/**/*',
              'node_modules/*',
              'openssh-9.1p1/**/*', // see importGithubSshCmds
            ],
          },
        }),
        rolePolicy: [
          new PolicyStatement({
            sid: 'getGithubSshPrivateKeyPolicy',
            actions: ['secretsmanager:GetSecretValue'],
            resources: ['*'],
          }),
          new PolicyStatement({
            sid: 'uploadImagePolicy',
            actions: ['ecr:*'],
            resources: ['*'],
          }),
          new PolicyStatement({
            sid: 'kmsPolicy',
            actions: ['kms:GenerateDataKey', 'kms:Decrypt'],
            resources: ['*'],
          }),
        ],
      },
      synthCodeBuildDefaults: {
        partialBuildSpec: BuildSpec.fromObject({
          cache: {
            paths: [
              'cdk/node_modules/**/*',
            ],
          },
        }),
      },
    });

    // create service stage props for pipeline user
    this.buildDeploymentGroupCreationProps(props);
  }

  /**
   * Adds the deployment stacks in a single stage to the pipeline env. User of this construct must call this method for all stages.
   *
   * @remarks also add steps:
   * post-stack deployment: run integration test
   *
   * @param deploymentStacksStage - The collection of infrastructure stacks for this env
   * @param stackCreationInfo - the env that infrastructure stacks is being deployed
   */
  public addDeploymentStage(stackCreationInfo: StackCreationInfo, deploymentStacksStage: Stage): void {
    const { stackPrefix } = stackCreationInfo;

    const {
      prodManualApproval,
      integrationTestProps,
      completeDeploymentCmds,
    } = this.props;

    const preSteps: Step[] = [];
    if (stackCreationInfo.stage == STAGE.PROD && prodManualApproval) {
      preSteps.push(new ManualApprovalStep('PromoteToProd'));
    }

    const stagePostSteps: Step[] = [];

    // add integration test step
    if (integrationTestProps) {
      const {
        testRunCmds,
        integrationTestPackageName,
        executionRolePolicies,
      } = integrationTestProps;

      const integTest = new AhaIntegrationTestStep(
        this,
        `${ stackPrefix }-AhaIntegrationTest`,
        {
          integrationTestPackageFileSet:
            this.synthStep.addOutputDirectory(
              `./${ integrationTestPackageName }`,
            ),
          testRunCmds,
          stackCreationInfo,
          executionRolePolicies: executionRolePolicies,
        },
      );

      stagePostSteps.push(integTest.integrationTestStep);
    }

    if (completeDeploymentCmds) {
      assert.ok(completeDeploymentCmds.length > 0, 'completeDeploymentCmds cannot be empty');

      stagePostSteps.push(createCompleteDeploymentStep(
        this.synthStep.addOutputDirectory('./'),
        stackCreationInfo,
        completeDeploymentCmds));
    }

    this.pipeline.addStage(deploymentStacksStage,
      {
        pre: Step.sequence(preSteps),
        post:
          Step.sequence(stagePostSteps),
      });
  }

  private buildDeploymentGroupCreationProps(props: AhaPipelineProps): void {
    const {
      service,
      skipProdStages,
    } = props;

    getAllStages().forEach(stage => {
      if (stage == STAGE.ALPHA) {
        return;
      }
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

  private createCacheBucket(): Bucket {
    return new Bucket(this, `${ this.props.service }-PipelineCacheBucket`, {
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
  }
}
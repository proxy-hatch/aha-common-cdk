import {
  GITHUB_ACCESS_TOKEN,
  GITHUB_ORGANIZATION_NAME,
  SERVICE,
  StackCreationInfo,
  STAGE,
} from "../../constant";
import {
  CodeBuildStep, CodePipelineActionFactoryResult,
  CodePipelineSource,
  ICodePipelineActionFactory,
  ProduceActionOptions,
  ShellStep,
  Step,
} from "aws-cdk-lib/pipelines";
import assert from "node:assert";
import { IFileSetProducer } from "aws-cdk-lib/pipelines/lib/blueprint/file-set";
import { BuildSpec } from "aws-cdk-lib/aws-codebuild";
import { getAccountInfo } from "../../util";
import * as cpactions from "aws-cdk-lib/aws-codepipeline-actions";
import { IStage } from "aws-cdk-lib/aws-codepipeline";
import { StateMachine, Succeed, Wait, WaitTime } from "aws-cdk-lib/aws-stepfunctions";
import { Duration, Stack } from "aws-cdk-lib";

/**
 * When branch is not provided, defaults to track main branch
 */
export type TrackingPackage = {
  readonly package: string;
  readonly branch?: string; // default to main
}

/**
 * Object containing the required data to set up a pipeline.
 *
 * @remarks pipelineSelfMutation defaults to true. For new pipeline, disabling this may make development easier;
 * deploymentWaitTimeMins. This is the time between ECR image publish and integration test begins
 * // TODO: introduce health check instead https://app.zenhub.com/workspaces/back-edtech-623a878cdf3d780017775a34/issues/earnaha/api-core/1709
 *
 * ref: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.pipelines-readme.html#:~:text=after%20doing%20this.-,Working%20on%20the%20pipeline,-The%20self%2Dmutation
 */
export interface BaseAhaPipelineInfo {
  readonly service: SERVICE;
  readonly pipelineName: string;
  readonly pipelineAccount: string;
  readonly pipelineSelfMutation?: boolean;
  readonly deploymentWaitTimeMins: number;
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
export function getEcrName(stackPrefix: string, service: SERVICE) {
  return `${ stackPrefix }-${ service }-ecr`.toLowerCase();
}

export function createServiceImageBuildCodeBuildStep(synth: ShellStep, accountId: string, region: string, ecrName: string) {
  return new CodeBuildStep(`Build and publish service image`, {
    input: synth.addOutputDirectory('./'),
    commands: [],
    partialBuildSpec: BuildSpec.fromObject({
      version: '0.2',
      env: {
        variables: {
          'AWS_ACCOUNT_ID': {
            value: accountId,
          },
          'IMAGE_REPO_NAME': {
            value: ecrName,
          },
          'AWS_REGION': {
            value: region,
          },
          'GITHUB_TOKEN': {
            value: GITHUB_ACCESS_TOKEN,
          },
        },
      },
      phases: {
        install: {
          'runtime-versions': {
            nodejs: 16,
          },
          commands: 'npm install -g typescript"',
        },
        pre_build: {
          commands: '$(aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com)',
        },
        build: {
          commands: [
            'git config url."https://$GITHUB_TOKEN@github.com/".insteadOf https://github.com/:',
            'npm ci',
            'npm run build',
            'docker build -t $IMAGE_REPO_NAME .',
            'docker tag $IMAGE_REPO_NAME:$IMAGE_TAG $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$IMAGE_REPO_NAME:$IMAGE_TAG',
          ],
        },
        post_build: {
          commands: 'docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$IMAGE_REPO_NAME:latest',
        },
      },
    }),

  });
}

export function buildSynthStep(trackingPackages: TrackingPackage[], service: SERVICE, stage: STAGE): ShellStep {
  assert.ok(trackingPackages.length > 0, "number of tracking packages cannot be 0");

  const githubConnectionArn = getAccountInfo(service, stage).githubConnectionArn!;
  assert.ok(githubConnectionArn, `Github Connection Arn not found for ${ service }, ${ stage }. Is your pipeline hosted here?`);

  // track additional packages
  let additionalInputs: Record<string, IFileSetProducer> = {};
  let primaryPackage: TrackingPackage;
  if (trackingPackages.length > 1) {
    primaryPackage = trackingPackages.shift()!; // in-place remove 1st elem
    trackingPackages.forEach(pkg => {
      additionalInputs[pkg.package] = CodePipelineSource.connection(`${ GITHUB_ORGANIZATION_NAME }/${ pkg.package }`, pkg.branch ?? 'main', {
        connectionArn: githubConnectionArn,
      });
    });
  } else {
    primaryPackage = trackingPackages[0];
  }

  return new ShellStep('Synth', {
    input: CodePipelineSource.connection(`${ GITHUB_ORGANIZATION_NAME }/${ primaryPackage.package }`, primaryPackage.branch ?? 'main', {
      connectionArn: githubConnectionArn,
    }),
    // additionalInputs: additionalInputs,
    primaryOutputDirectory: 'cdk/cdk.out',
    env: {
      ['GITHUB_TOKEN']: GITHUB_ACCESS_TOKEN,
    },
    commands: [
      'cd cdk',
      'git init',
      'mkdir -p ~/.ssh',
      'echo "$build_ssh_key" > ~/.ssh/id_ed25519',
      'chmod 600 ~/.ssh/id_ed25519',
      'ssh-keygen -F github.com || ssh-keyscan github.com >>~/.ssh/known_hosts',
      'git config --global url."git@github.com:".insteadOf "https://github.com/"',
      'npm install',
      'ls -al',
      'pwd',
      'export DEV_ACCOUNT=083784680548',
      'echo $DEV_ACCOUNT',
      'npm run build',
      'ls -al cdk.out',
    ],
  });
}

export function createDeploymentWaitStateMachine(scope: Stack, service: SERVICE, waitTimeMins: number): StateMachine {
  return new StateMachine(scope, `${ service }-Pipeline-WaitStateMachine`, {
    timeout: Duration.minutes(waitTimeMins + 5),
    definition: new Wait(scope, 'Wait', {
      time: WaitTime.duration(Duration.minutes(waitTimeMins)),
      comment: `wait ${ waitTimeMins }mins for deployment`,
    }).next(new Succeed(scope, "Completed waiting for deployment")),
  });
}

// ref: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.pipelines-readme.html#arbitrary-codepipeline-actions
export class DeploymentSfnStep extends Step implements ICodePipelineActionFactory {
  constructor(
      private readonly stateMachine: StateMachine,
  ) {
    super('DeploymentSfnStep');
  }

  public produceAction(stage: IStage, options: ProduceActionOptions): CodePipelineActionFactoryResult {
    stage.addAction(new cpactions.StepFunctionInvokeAction({
      // Copy 'actionName' and 'runOrder' from the options
      actionName: options.actionName,
      runOrder: options.runOrder,

      stateMachine: this.stateMachine,
    }));

    return { runOrdersConsumed: 1 };
  }
}

// TODO: Timmy - add Jenkins test
// ref: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.pipelines-readme.html#arbitrary-codepipeline-actions
// export class AhaJenkinsIntegrationTestStep extends Step implements ICodePipelineActionFactory {
//   constructor(
//       private readonly service: SERVICE,
//       private readonly stage: STAGE,
//       // private readonly input: FileSet, // No need if no input required
//   ) {
//     super('MyJenkinsStep');
//
//     let provider: cpactions.JenkinsProvider;
//     // TODO: Timmy - determine Jenkins provider and any other necessary Jenkins param from service and stage
//
//     // This is necessary if your step accepts parametres, like environment variables,
//     // that may contain outputs from other steps. It doesn't matter what the
//     // structure is, as long as it contains the values that may contain outputs.
//     // this.discoverReferencedOutputs({
//     //   env: { /* ... */ }
//     // });
//   }
//
//   public produceAction(stage: IStage, options: ProduceActionOptions): CodePipelineActionFactoryResult {
//
//     // This is where you control what type of Action gets added to the
//     // CodePipeline
//     stage.addAction(new cpactions.JenkinsAction({
//       // Copy 'actionName' and 'runOrder' from the options
//       actionName: options.actionName,
//       runOrder: options.runOrder,
//
//       // Jenkins-specific configuration
//       type: cpactions.JenkinsActionType.TEST,
//       jenkinsProvider: this.provider,
//       projectName: 'MyJenkinsProject',
//
//       // Translate the FileSet into a codepipeline.Artifact
//       inputs: [options.artifacts.toCodePipeline(this.input)],
//     }));
//
//     return { runOrdersConsumed: 1 };
//   }
// }

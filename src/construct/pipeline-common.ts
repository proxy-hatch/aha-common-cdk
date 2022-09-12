import { GITHUB_CONNECTION_ARN, GITHUB_ORGANIZATION_NAME, SERVICE, StackCreationInfo } from "../constant";
import { CodeBuildStep, CodePipelineSource, ShellStep } from "aws-cdk-lib/pipelines";
import assert from "node:assert";
import { IFileSetProducer } from "aws-cdk-lib/pipelines/lib/blueprint/file-set";
import { BuildSpec } from "aws-cdk-lib/aws-codebuild";

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
 * pipelineSelfMutation defaults to true. For new pipeline, disabling this may make development easier
 * ref: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.pipelines-readme.html#:~:text=after%20doing%20this.-,Working%20on%20the%20pipeline,-The%20self%2Dmutation
 */
export interface BaseAhaPipelineInfo {
  readonly service: SERVICE;
  readonly pipelineName: string;
  readonly pipelineAccount: string;
  readonly pipelineSelfMutation?: boolean;
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

export function createBuildServiceImageShellStep(synth: ShellStep, accountId: string, ecrName: string) {
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
          commands: '$(aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com)',
        },
        build: {
          commands: [
            'git config --local url."https://${GITHUB_TOKEN}@github.com/".insteadOf https://github.com/:',
            'npm install',
            'npm run build',
            'docker build -t $IMAGE_REPO_NAME .',
            'docker tag $IMAGE_REPO_NAME:$IMAGE_TAG $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$IMAGE_REPO_NAME:$IMAGE_TAG',
          ],
        },
        post_build: {
          commands: 'docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$IMAGE_REPO_NAME:latest',
        },
      },
    }),

  });
}


export function buildSynthStep(trackingPackages: TrackingPackage[]): ShellStep {
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
    // To generate github connectionArn in the pipeline-hosting account from AWS Console https://console.aws.amazon.com/codesuite/settings/connections
    // ref: https://tinyurl.com/setting-github-connection
    input: CodePipelineSource.connection(`${ GITHUB_ORGANIZATION_NAME }/${ primaryPackage.package }`, primaryPackage.branch ?? 'main', {
      connectionArn: GITHUB_CONNECTION_ARN,
    }),
    additionalInputs: additionalInputs,
    primaryOutputDirectory: 'cdk/cdk.out',
    commands: [
      'npm ci',
      'npm run build',
      'npx cdk synth',
    ],

  });
}
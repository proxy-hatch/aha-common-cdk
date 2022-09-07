import { GITHUB_CONNECTION_ARN, GITHUB_ORGANIZATION_NAME, SERVICE, StackCreationInfo } from "../constant";
import { CodePipelineSource, ShellStep } from "aws-cdk-lib/pipelines";
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
export function getEcrRepositoryName(stackPrefix: string, service: SERVICE) {
  return `${ stackPrefix }-${ service }-ecr`.toLowerCase();
}

// TODO: Timmy - ShellStep is a CodeBuild project. Function objective: build Docker Image for each stage and publish to ECR
// ref: ShellStep https://docs.aws.amazon.com/cdk/api/v1/docs/pipelines-readme.html#customizing-codebuild-projects:~:text=Click%20here.)-,Customizing%20CodeBuild%20Projects,-CDK%20pipelines%20will
// ref: CodeBuildStep https://docs.aws.amazon.com/cdk/api/v1/docs/@aws-cdk_pipelines.CodeBuildStep.html
// ref: building Docker image and publish to ECR with CodeBuild https://docs.aws.amazon.com/codebuild/latest/userguide/sample-docker.html
export function buildAndPublishServiceImage(){

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
    primaryOutputDirectory: 'cdk/cdk.out',
    additionalInputs: additionalInputs,
    commands: [
      'npm ci',
      'npm run build',
      'npx cdk synth',
    ],
  });
}
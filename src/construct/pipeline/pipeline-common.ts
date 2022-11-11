// import assert from 'node:assert';
// import { Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
// import { BuildSpec } from 'aws-cdk-lib/aws-codebuild';
// import { IStage } from 'aws-cdk-lib/aws-codepipeline';
// import * as cpactions from 'aws-cdk-lib/aws-codepipeline-actions';
// import { Repository } from 'aws-cdk-lib/aws-ecr';
// import { AccountPrincipal, Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
// import { StateMachine, Succeed, Wait, WaitTime } from 'aws-cdk-lib/aws-stepfunctions';
// import {
//   CodeBuildStep, CodePipelineActionFactoryResult,
//   CodePipelineSource, FileSet,
//   ICodePipelineActionFactory, IFileSetProducer,
//   ProduceActionOptions,
//   ShellStep,
//   Step,
// } from 'aws-cdk-lib/pipelines';
// import {
//   GITHUB_ORGANIZATION_NAME,
//   SERVICE,
//   StackCreationInfo,
//   STAGE,
// } from '../../constant';
// import { AHA_ORGANIZATION_ACCOUNT } from '../../environment-configuration';
// import { getAccountIdsForService, getAccountInfo, getEcrName } from '../../account_util';
//
// /**
//  * When branch is not provided, defaults to track main branch
//  */
// export type TrackingPackage = {
//   readonly package: string;
//   readonly branch?: string; // default to main
//   readonly triggerOnPush?: boolean; // default to true
// }
//
// /**
//  * Object containing the required data to set up a pipeline.
//  *
//  * @remarks pipelineSelfMutation defaults to true. For new pipeline, disabling this may make development easier;
//  *
//  * deploymentWaitTimeMins. This is the time between ECR image publish and integration test begins
//  * // TODO: introduce health check instead https://app.zenhub.com/workspaces/back-edtech-623a878cdf3d780017775a34/issues/earnaha/api-core/1709
//  *
//  * ref: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.pipelines-readme.html#:~:text=after%20doing%20this.-,Working%20on%20the%20pipeline,-The%20self%2Dmutation
//  */
// export interface BaseAhaPipelineInfo {
//   readonly service: SERVICE;
//   readonly pipelineName: string;
//   readonly pipelineAccount: string;
//   readonly pipelineSelfMutation?: boolean;
//   readonly deploymentWaitTimeMins: number;
//   readonly containerImageBuildCmds: string[];
//   readonly completeDeploymentCmds?: string[];
// }
//
// export interface DeploymentGroupCreationProps {
//   readonly stackCreationInfo: StackCreationInfo;
// }
//




//
// export function createServiceImageBuildCodeBuildStep(inputFileSet: FileSet, stackCreationInfo: StackCreationInfo, service: SERVICE,
//   containerImageBuildCmds: string[]) {
//   const {
//     region,
//     account,
//     stackPrefix,
//   } = stackCreationInfo;
//
//   return new CodeBuildStep('Build and publish service image', {
//     input: inputFileSet,
//     commands: [],
//     buildEnvironment: {
//       privileged: true,
//     },
//     partialBuildSpec: BuildSpec.fromObject({
//       version: '0.2',
//       env: {
//         variables: {
//           AWS_ACCOUNT_ID: account,
//           IMAGE_REPO_NAME: getEcrName(stackPrefix, service),
//           AWS_REGION: region,
//           IMAGE_TAG: 'latest',
//         },
//       },
//       phases: {
//         pre_build: {
//           commands: 'aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com',
//         },
//         build: {
//           commands:
//             containerImageBuildCmds.concat([
//               'docker build -t ${IMAGE_REPO_NAME} .',
//               'docker tag ${IMAGE_REPO_NAME}:${IMAGE_TAG} ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${IMAGE_REPO_NAME}:${IMAGE_TAG}',
//             ]),
//         },
//         post_build: {
//           commands: 'docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${IMAGE_REPO_NAME}:${IMAGE_TAG}',
//         },
//       },
//     }),
//     // TODO: restrict to only necessary permissions in service stage account
//     rolePolicyStatements: [new PolicyStatement({
//       sid: 'ECRPush',
//       actions: ['ecr:*'],
//       resources: ['*'],
//     })],
//   });
// }
//
// // a Codebuild step inserted at the end of deployment stage. Can be anything the service decides to do
// export function createCompleteDeploymentStep(inputFileSet: FileSet, stackCreationInfo: StackCreationInfo, completeDeploymentCmds: string[]) {
//   const { stage } = stackCreationInfo;
//
//   return new CodeBuildStep('Complete deployment', {
//     input: inputFileSet,
//     commands: [],
//     buildEnvironment: {
//       privileged: true,
//     },
//     partialBuildSpec: BuildSpec.fromObject({
//       version: '0.2',
//       env: {
//         variables: {
//           STAGE: stage,
//         },
//       },
//       phases: {
//         build: {
//           commands: completeDeploymentCmds,
//         },
//       },
//     }),
//   });
// }
//
// export function buildSynthStep(trackingPackages: TrackingPackage[], service: SERVICE, stage: STAGE): ShellStep {
//   assert.ok(trackingPackages.length > 0, 'number of tracking packages cannot be 0');
//
//   const githubConnectionArn = getAccountInfo(service, stage).githubConnectionArn!;
//   assert.ok(githubConnectionArn, `Github Connection Arn not found for ${service}, ${stage}. Is your pipeline hosted here?`);
//
//   // track additional packages
//   const additionalInputs: Record<string, IFileSetProducer> = {};
//   let primaryPackage: TrackingPackage;
//   if (trackingPackages.length > 1) {
//     primaryPackage = trackingPackages.shift()!; // in-place remove 1st elem
//     trackingPackages.forEach(pkg => {
//       additionalInputs[pkg.package] = CodePipelineSource.connection(`${GITHUB_ORGANIZATION_NAME}/${pkg.package}`, pkg.branch ?? 'main', {
//         connectionArn: githubConnectionArn,
//         codeBuildCloneOutput: true,
//         triggerOnPush: pkg.triggerOnPush ?? true,
//       });
//     });
//   } else {
//     primaryPackage = trackingPackages[0];
//   }
//
//   return new ShellStep('Synth', {
//     input: CodePipelineSource.connection(`${GITHUB_ORGANIZATION_NAME}/${primaryPackage.package}`, primaryPackage.branch ?? 'main', {
//       connectionArn: githubConnectionArn,
//       codeBuildCloneOutput: true,
//       triggerOnPush: primaryPackage.triggerOnPush ?? true,
//     }),
//     additionalInputs: additionalInputs,
//     primaryOutputDirectory: 'cdk/cdk.out',
//     commands: [
//       'cd cdk',
//       'mkdir -p ~/.ssh',
//       'echo "${SSH_PRIVATE_KEY}" > ~/.ssh/id_ed25519',
//       'chmod 600 ~/.ssh/id_ed25519',
//       'ssh-keygen -F github.com || ssh-keyscan github.com >>~/.ssh/known_hosts',
//       'git config --global url."git@github.com:".insteadOf "https://github.com/"',
//       'npm install',
//       'npm install aha-common-cdk', // github dependency seems to effectively do npm ci upon npm install, installing it explicitly refreshes it to latest
//       'echo "detecting pipeline account ${DEV_ACCOUNT}"',
//       'npm run build',
//     ],
//   });
// }
//
// export function createDeploymentWaitStateMachine(scope: Stack, service: SERVICE, waitTimeMins: number): StateMachine {
//   return new StateMachine(scope, `${service}-Pipeline-WaitStateMachine`, {
//     timeout: Duration.minutes(waitTimeMins + 5),
//     definition: new Wait(scope, 'Wait', {
//       time: WaitTime.duration(Duration.minutes(waitTimeMins)),
//       comment: `wait ${waitTimeMins}mins for deployment`,
//     }).next(new Succeed(scope, 'Completed waiting for deployment')),
//   });
// }
//
// // ref: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.pipelines-readme.html#arbitrary-codepipeline-actions
// export class DeploymentSfnStep extends Step implements ICodePipelineActionFactory {
//   constructor(
//     private readonly stateMachine: StateMachine,
//   ) {
//     super('DeploymentSfnStep');
//   }
//
//   public produceAction(stage: IStage, options: ProduceActionOptions): CodePipelineActionFactoryResult {
//     stage.addAction(new cpactions.StepFunctionInvokeAction({
//       // Copy 'actionName' and 'runOrder' from the options
//       actionName: options.actionName,
//       runOrder: options.runOrder,
//
//       stateMachine: this.stateMachine,
//     }));
//
//     return { runOrdersConsumed: 1 };
//   }
// }
//
// export class AhaJenkinsIntegrationTestStep extends Step implements ICodePipelineActionFactory {
//   provider: cpactions.JenkinsProvider;
//
//   constructor(
//     private readonly scope: Stack,
//     private readonly service: SERVICE,
//     private readonly stage: STAGE,
//     private readonly input: FileSet,
//   ) {
//     super('JenkinsIntegrationTest');
//
//     this.provider = new cpactions.JenkinsProvider(this.scope, `${service}-${stage}-JenkinsProvider`, {
//       providerName: AhaJenkinsIntegrationTestStep.getJenkinsData(this.stage),
//       serverUrl: 'https://it.earnaha.com',
//       version: '1', // optional, default: '1'
//     });
//   }
//
//   public produceAction(stage: IStage, options: ProduceActionOptions): CodePipelineActionFactoryResult {
//     if (this.service !== SERVICE.API_CORE) {
//       return { runOrdersConsumed: 0 };
//     }
//
//     stage.addAction(new cpactions.JenkinsAction({
//       // Copy 'actionName' and 'runOrder' from the options
//       actionName: options.actionName,
//       runOrder: options.runOrder,
//
//       // Jenkins-specific configuration
//       type: cpactions.JenkinsActionType.TEST,
//       jenkinsProvider: this.provider,
//       projectName: AhaJenkinsIntegrationTestStep.getJenkinsData(this.stage),
//
//       // Translate the FileSet into a codepipeline.Artifact
//       inputs: [options.artifacts.toCodePipeline(this.input)],
//     }));
//
//     return { runOrdersConsumed: 1 };
//   }
//
//   private static getJenkinsData(stage: STAGE): string {
//     switch (stage) {
//       case 'prod':
//         return 'AWSTest_Prod';
//       case 'gamma':
//         return 'AWSTest_Gamma';
//       case 'beta':
//         return 'AWSTest_Beta';
//       default:
//         return 'AWSTest_Alpha';
//     }
//   }
//
// }

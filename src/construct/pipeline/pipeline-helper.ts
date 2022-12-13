import assert from 'node:assert';
import { Stack } from 'aws-cdk-lib';
import { BuildSpec } from 'aws-cdk-lib/aws-codebuild';
import { IStage } from 'aws-cdk-lib/aws-codepipeline';
import * as cpactions from 'aws-cdk-lib/aws-codepipeline-actions';

import { Repository } from 'aws-cdk-lib/aws-ecr';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';

import {
  CodeBuildStep,
  CodePipelineActionFactoryResult,
  CodePipelineSource,
  FileSet,
  ICodePipelineActionFactory,
  IFileSetProducer,
  ProduceActionOptions,
  ShellStep,
  Step,
} from 'aws-cdk-lib/pipelines';
import { getSharedStageAccountInfo } from '../../account_util';
import { AHA_DEFAULT_REGION, GITHUB_ORGANIZATION_NAME, SERVICE, StackCreationInfo, STAGE } from '../../constant';
import { TrackingPackage } from './aha-pipeline';

export function createServiceImageBuildCodeBuildStep(inputFileSet: FileSet, containerImageBuildCmds: string[], ecr: Repository) {
  const repoUri = ecr.repositoryUri;
  // repositoryUri format: ACCOUNT.dkr.ecr.REGION.amazonaws.com/REPOSITORY
  // note: it is substituted from
  // ${Token[TOKEN.393]}.dkr.ecr.${Token[TOKEN.392]}.${Token[AWS.URLSuffix.10]}/${Token[TOKEN.382]}
  // at some point, so parsing on '.' will not work
  const repoDomain = repoUri.split('/')[0];

  return new CodeBuildStep('Build and publish service image', {
    input: inputFileSet,
    commands: [],
    buildEnvironment: {
      privileged: true,
    },
    partialBuildSpec: BuildSpec.fromObject({
      env: {
        variables: {
          AWS_REGION: AHA_DEFAULT_REGION,
          DOCKER_TAG: `${ ecr.repositoryUri }:latest`,
          ECR_DOMAIN: repoDomain,
        },
      },
      phases: {
        pre_build: {
          commands: [
            'aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_DOMAIN}',
          ],
        },
        build: {
          commands:
              containerImageBuildCmds.concat([
                'docker build -t ${DOCKER_TAG} .',
              ]),
        },
        post_build: {
          commands: 'docker push ${DOCKER_TAG}',
        },
      },
    }),

    rolePolicyStatements: [new PolicyStatement({
      sid: 'ServiceImageECRPush',
      actions: ['ecr:*'],
      resources: [ecr.repositoryArn],
    })],
  });
}

// a Codebuild step inserted at the end of deployment stage. Can be anything the service decides to do
export function createCompleteDeploymentStep(inputFileSet: FileSet, stackCreationInfo: StackCreationInfo, completeDeploymentCmds: string[]) {
  const { stage } = stackCreationInfo;

  return new CodeBuildStep('Complete deployment', {
    input: inputFileSet,
    commands: [],
    buildEnvironment: {
      privileged: true,
    },
    partialBuildSpec: BuildSpec.fromObject({
      version: '0.2',
      env: {
        variables: {
          STAGE: stage,
        },
      },
      phases: {
        build: {
          commands: completeDeploymentCmds,
        },
      },
    }),
  });
}

export const importGithubSshCmds = [
  // AL2 comes with node 16, but OpenSSL is too old that npm git repo is blocked https://github.com/npm/git/issues/31
  // update OpenSSH https://gist.github.com/roommen/18cd78d07b0fbc962de4e79c1d468f92
  'sudo yum install gcc -y -q',
  'sudo yum install openssl-devel -y -q',
  'sudo yum install zlib-devel -y -q',
  'sudo yum install mlocate -y -q',
  'sudo yum install autoconf -y -q',
  '[ ! -d "openssh-9.1p1" ] && wget https://cdn.openbsd.org/pub/OpenBSD/OpenSSH/portable/openssh-9.1p1.tar.gz || true > /dev/null 2>&1',
  '[ ! -d "openssh-9.1p1" ] && tar zxvf openssh-9.1p1.tar.gz  || true > /dev/null 2>&1',
  '{ cd openssh-9.1p1 && ./configure && make && sudo make install ; } > /dev/null 2>&1',
  'cd ..',

  'echo "${SSH_PRIVATE_KEY}" > ~/.ssh/id_ed25519',
  'chmod 600 ~/.ssh/id_ed25519',
  'ssh-keygen -F github.com || ssh-keyscan github.com >> ~/.ssh/known_hosts',
  'git config --global url."git@github.com:".insteadOf "https://github.com/"',
];

export function buildSynthStep(trackingPackages: TrackingPackage[]): ShellStep {
  assert.ok(trackingPackages.length > 0, 'number of tracking packages cannot be 0');

  const githubConnectionArn = getSharedStageAccountInfo(STAGE.BETA).githubConnectionArn;
  assert.ok(githubConnectionArn, `Github Connection Arn not found for ${ STAGE.BETA }.
   You must manually configure this at https://ap-northeast-1.console.aws.amazon.com/codesuite/settings/connections?region=ap-northeast-1 --> Connections`);

  const additionalInputs: Record<string, IFileSetProducer> = {};
  trackingPackages.slice(1).forEach(pkg => {
    additionalInputs[pkg.package] = buildInput(pkg, githubConnectionArn);
  });

  return new ShellStep('Synth', {
    input: buildInput(trackingPackages[0], githubConnectionArn),
    additionalInputs: additionalInputs,
    primaryOutputDirectory: 'cdk/cdk.out',
    commands: [
      'cd cdk',
      'npm ci --omit-dev',
      'npm update aha-common-cdk',
      'npm run build',
    ],
  });
}

function buildInput(trackingPackage: TrackingPackage, githubConnectionArn: string): CodePipelineSource {
  return CodePipelineSource.connection(`${ GITHUB_ORGANIZATION_NAME }/${ trackingPackage.package }`, trackingPackage.branch ?? 'main', {
    connectionArn: githubConnectionArn,
    codeBuildCloneOutput: trackingPackage.gitClone ?? false,
    triggerOnPush: trackingPackage.triggerOnPush ?? true,
  });
}

export class AhaJenkinsIntegrationTestStep extends Step implements ICodePipelineActionFactory {
  provider: cpactions.JenkinsProvider;

  constructor(
    private readonly scope: Stack,
    private readonly service: SERVICE,
    private readonly stage: STAGE,
    private readonly input: FileSet,
  ) {
    super('JenkinsIntegrationTest');

    this.provider = new cpactions.JenkinsProvider(this.scope, `${ service }-${ stage }-JenkinsProvider`, {
      providerName: AhaJenkinsIntegrationTestStep.getJenkinsData(this.stage),
      serverUrl: 'https://it.earnaha.com',
      version: '1', // optional, default: '1'
    });
  }

  public produceAction(stage: IStage, options: ProduceActionOptions): CodePipelineActionFactoryResult {
    if (this.service !== SERVICE.API_CORE) {
      return { runOrdersConsumed: 0 };
    }

    stage.addAction(new cpactions.JenkinsAction({
      // Copy 'actionName' and 'runOrder' from the options
      actionName: options.actionName,
      runOrder: options.runOrder,

      // Jenkins-specific configuration
      type: cpactions.JenkinsActionType.TEST,
      jenkinsProvider: this.provider,
      projectName: AhaJenkinsIntegrationTestStep.getJenkinsData(this.stage),

      // Translate the FileSet into a codepipeline.Artifact
      inputs: [options.artifacts.toCodePipeline(this.input)],
    }));

    return { runOrdersConsumed: 1 };
  }

  private static getJenkinsData(stage: STAGE): string {
    switch (stage) {
      case 'prod':
        return 'AWSTest_Prod';
      case 'gamma':
        return 'AWSTest_Gamma';
      case 'beta':
        return 'AWSTest_Beta';
      default:
        return 'AWSTest_Alpha';
    }
  }

}

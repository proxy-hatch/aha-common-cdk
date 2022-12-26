import assert from 'node:assert';
import { BuildSpec } from 'aws-cdk-lib/aws-codebuild';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { CodeBuildStep, FileSet } from 'aws-cdk-lib/pipelines';
import { Construct } from 'constructs';
import { StackCreationInfo } from '../../constant';

/**
 * Props to set up an Aha Integration test Codebuild step, attached at the end of each pipeline deployment stage
 *
 * @remarks testRunCmds covers both repo build and run cmds
 *
 */
export interface AhaIntegrationTestStepProps {
  readonly stackCreationInfo: StackCreationInfo;
  readonly integrationTestPackageFileSet: FileSet;
  readonly executionRoleName: string;
  readonly testRunCmds: string[];
}

/**
 * Create a CodeBuildStep to run integration test,using provided execution commands and permission policy
 *
 */
export class AhaIntegrationTestStep extends Construct {
  public readonly integrationTestStep: CodeBuildStep;

  constructor(scope: Construct, id: string, props: AhaIntegrationTestStepProps) {
    super(scope, id);

    const {
      stackCreationInfo,
      integrationTestPackageFileSet,
      testRunCmds,
      executionRoleName,
    } = props;
    const { stage, account } = stackCreationInfo;

    assert.ok(testRunCmds.length > 0, 'There are no commands for integration test!');

    const integrationTestExecutionRoleArn = `arn:aws:iam::${account}:role/${executionRoleName}`;

    this.integrationTestStep = new CodeBuildStep('IntegrationTest', {
      input: integrationTestPackageFileSet,
      commands: [],
      rolePolicyStatements: [
        new PolicyStatement({
          effect: Effect.ALLOW,
          resources: ['*'],
          actions: ['sts:AssumeRole'],
        }),
      ],
      partialBuildSpec: BuildSpec.fromObject({
        env: {
          variables: {
            STAGE: stage,
          },
        },
        phases: {
          pre_build: {
            commands: [
              `sts=$(aws sts assume-role --role-arn ${integrationTestExecutionRoleArn} --role-session-name "test-profile" --query "Credentials.[AccessKeyId,SecretAccessKey,SessionToken]" --output text)`,
              "export AWS_ACCESS_KEY_ID=$(echo $sts | awk '{print $1}')",
              "export AWS_SECRET_ACCESS_KEY=$(echo $sts | awk '{print $2}')",
              "export AWS_SESSION_TOKEN=$(echo $sts | awk '{print $3}')",
            ],
          },
          build: {
            commands: testRunCmds,
          },
        },
      }),
    });
  }
}

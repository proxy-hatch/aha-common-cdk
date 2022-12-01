import assert from 'node:assert';
import { BuildSpec } from 'aws-cdk-lib/aws-codebuild';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
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
  readonly executionRolePolicies: PolicyStatement[];
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
      executionRolePolicies,
    } = props;
    const { stage } = stackCreationInfo;

    assert.ok(testRunCmds.length > 0, 'There are no commands for integration test!');

    this.integrationTestStep = new CodeBuildStep('IntegrationTest', {
      input: integrationTestPackageFileSet,
      commands: [],
      rolePolicyStatements: executionRolePolicies,
      partialBuildSpec: BuildSpec.fromObject({
        env: {
          variables: {
            STAGE: stage,
          },
        },
        phases: {
          build: {
            commands: testRunCmds,
          },
        },
      }),
    });
  }
}

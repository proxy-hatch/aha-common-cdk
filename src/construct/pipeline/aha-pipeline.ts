import { Construct } from "constructs";
import { RemovalPolicy, Stack, StackProps, Stage } from "aws-cdk-lib";
import { CodePipeline, ShellStep, Step } from "aws-cdk-lib/pipelines";
import {
  AHA_DEFAULT_REGION,
  REGION, StackCreationInfo,
  STAGE,
} from "../../constant";
import { createStackCreationInfo, getAccountInfo, getStagesForService } from "../../util";
import { Repository } from "aws-cdk-lib/aws-ecr";
import {
  BaseAhaPipelineInfo,
  buildSynthStep,
  createDeploymentWaitStateMachine,
  createServiceImageBuildCodeBuildStep,
  DeploymentGroupCreationProps,
  DeploymentSfnStep,
  getEcrName,
  TrackingPackage,
} from "./pipeline-common";
import { StateMachine } from 'aws-cdk-lib/aws-stepfunctions';

/**
 * skipProdStages defaults to false.
 */
export interface AhaPipelineInfo extends BaseAhaPipelineInfo {
  readonly skipProdStages?: boolean;
}

/**
 *  Complete pipeline configuration
 */
export interface AhaPipelineProps extends StackProps {
  readonly pipelineInfo: AhaPipelineInfo;
  readonly trackingPackages: TrackingPackage[];  // the 1st must be service package
}


/**
 * Creates a CDK-managed pipeline for Aha back-end service, built with CodeBuild
 *
 * @remarks Skips alpha stage, also able to skip prod stage via
 * @remarks also creates ECR image repo for each stage of service.
 *
 * @param stage - The Aha stage this deployment is for
 * @param deploymentStage - The collection of infrastructure stacks for this env
 *
 */
export class AhaPipelineStack extends Stack {
  public readonly deploymentGroupCreationProps: DeploymentGroupCreationProps[] = [];
  public readonly pipeline: CodePipeline;
  private readonly props: AhaPipelineProps;
  private readonly synthStep: ShellStep;
  private readonly deploymentWaitStateMachine: StateMachine;

  constructor(scope: Construct, id: string, props: AhaPipelineProps) {
    super(scope, id, { env: { region: REGION.APN1, account: props.pipelineInfo.pipelineAccount } });
    this.props = props;

    this.setDeploymentGroupCreationProps(props);
    this.createEcrRepositories();

    this.synthStep = buildSynthStep(props.trackingPackages, props.pipelineInfo.service, STAGE.BETA);
    this.pipeline = new CodePipeline(this, 'Pipeline', {
      crossAccountKeys: true, // allow multi-account envs
      selfMutation: props.pipelineInfo.pipelineSelfMutation ?? true,
      dockerEnabledForSynth: true,  // allow CodeBuild to use Docker
      synth: this.synthStep,
    });

    this.deploymentWaitStateMachine = createDeploymentWaitStateMachine(this, props.pipelineInfo.service, props.pipelineInfo.deploymentWaitTimeMins);
  }

  /**
   * Adds the deployment stacks in a single stage to the pipeline env. User of this construct is expected to call this method for all stages.
   *
   * @remarks also adds a CodeBuild stage to publish src code to ECR named `${ props.stackCreationInfo.stackPrefix }-Ecr`
   *
   * @param deploymentStage - The collection of infrastructure stacks for this env
   * @param stackCreationInfo - the env that infrastructure stacks is being deployed to
   */
  public addDeploymentStage(deploymentStage: Stage, stackCreationInfo: StackCreationInfo): void {

    this.pipeline.addStage(deploymentStage,
        {
          post:
              Step.sequence([
                createServiceImageBuildCodeBuildStep(
                    this.synthStep,
                    stackCreationInfo.account,
                    stackCreationInfo.region,
                    getEcrName(stackCreationInfo.stackPrefix, this.props.pipelineInfo.service),
                ),
                // used to wait for deployment completion
                // TODO: use deployment health check instead https://app.zenhub.com/workspaces/back-edtech-623a878cdf3d780017775a34/issues/earnaha/api-core/1709
                new DeploymentSfnStep(this.deploymentWaitStateMachine),
                // TODO: Timmy - test Jenkins integration
                // new AhaJenkinsIntegrationTestStep(this.props.pipelineInfo.service, stackCreationInfo.stage),
              ]),
        });

  }

  private setDeploymentGroupCreationProps(props: AhaPipelineProps): void {
    const { service, skipProdStages } = props.pipelineInfo;

    getStagesForService(service).forEach(stage => {
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

  private createEcrRepositories(): void {
    this.deploymentGroupCreationProps.forEach(props => {
      const stageEcrName = getEcrName(props.stackCreationInfo.stackPrefix, this.props.pipelineInfo.service);
      new Repository(this, stageEcrName, {
            repositoryName: stageEcrName,
            removalPolicy: RemovalPolicy.DESTROY,
            lifecycleRules: [ {
              description: 'limit max image count',
              maxImageCount: 100,
            } ],
          },
      );
    });
  }

}
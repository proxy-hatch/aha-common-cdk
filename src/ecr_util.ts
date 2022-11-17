import { AHA_DEFAULT_REGION, SERVICE, STAGE } from './constant';
import { Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { AccountPrincipal, Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { AHA_ORGANIZATION_ACCOUNT } from './environment-configuration';
import { createStackCreationInfo, getAccountId, getSharedStageAccountIds } from './account_util';

/**
 * Returns the pipeline ECR repository name for the service
 *
 *
 * @param service {@link SERVICE}
 */
export function getPipelineEcrName(service: SERVICE) {
  const stackCreationInfo = createStackCreationInfo(getAccountId(service, STAGE.BETA), AHA_DEFAULT_REGION, STAGE.BETA);

  return constructEcrName(stackCreationInfo.stackPrefix, service);
}

/**
 * Returns the ECR repository name for the service stage
 *
 *
 * @param stage
 * @param service {@link SERVICE}
 */
export function getEcrName(service: SERVICE, stage: STAGE) {
  const stackCreationInfo = createStackCreationInfo(getAccountId(service, stage), AHA_DEFAULT_REGION, stage);

  return constructEcrName(stackCreationInfo.stackPrefix, service);
}

/**
 * Returns the ECR repository name for the service stage
 *
 *
 * @param stackPrefix {@link StackCreationInfo.stackPrefix}
 * @param service {@link SERVICE}
 */
export function constructEcrName(stackPrefix: string, service: SERVICE) {
  return `${ stackPrefix }-${ service }-ecr`.toLowerCase();
}

/**
 * Create the ECR repository for a service pipeline
 *
 * @param scope
 * @param service {@link SERVICE}
 */
export function createPipelineEcrRepository(scope: Stack, service: SERVICE): Repository {
  const ecrName = getPipelineEcrName(service);

  return createCrossAccountEcr(scope, ecrName, service);
}

/**
 * Create an ECR repository for the service stage
 *
 * @param scope
 * @param service {@link SERVICE}
 * @param stage {@link STAGE}
 */
export function createEcrRepository(scope: Stack, service: SERVICE, stage: STAGE): Repository {
  const ecrName = getEcrName(service, stage);

  return createCrossAccountEcr(scope, ecrName, service);
}

function createCrossAccountEcr(scope: Stack, ecrName: string, service: SERVICE): Repository {
  const ecr = new Repository(scope, ecrName, {
        repositoryName: ecrName,
        removalPolicy: RemovalPolicy.DESTROY,
        lifecycleRules: [ {
          description: 'limit max image count',
          maxImageAge: Duration.days(90),
        } ],
      },
  );

  ecr.addToResourcePolicy(buildCrossAccountEcrResourcePolicy(service));

  return ecr;
}

function buildCrossAccountEcrResourcePolicy(service: SERVICE) {
  const accountIdPrincipals: AccountPrincipal[] = [];

  accountIdPrincipals.push(new AccountPrincipal(getAccountId(service, STAGE.ALPHA)));
  getSharedStageAccountIds().forEach(accountId => {
    accountIdPrincipals.push(new AccountPrincipal(accountId));
  });

  // allow IAM users (in management account) to troubleshoot docker image
  accountIdPrincipals.push(new AccountPrincipal(AHA_ORGANIZATION_ACCOUNT));

  return new PolicyStatement({
    effect: Effect.ALLOW,
    actions: [ 'ecr:*' ],
    principals: accountIdPrincipals,
  });
}

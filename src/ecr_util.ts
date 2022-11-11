import { SERVICE, StackCreationInfo, STAGE } from './constant';
import { Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { AccountPrincipal, Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { AHA_ORGANIZATION_ACCOUNT } from './environment-configuration';
import { getAccountId, getSharedStageAccountIds } from './account_util';

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

export function createEcrRepository(scope: Stack, service: SERVICE, stackCreationInfo: StackCreationInfo): Repository {
  const { stackPrefix, stage } = stackCreationInfo;

  const stageEcrName = getEcrName(
      stackPrefix, service);
  const ecr = new Repository(scope, stageEcrName, {
        repositoryName: stageEcrName,
        removalPolicy: RemovalPolicy.DESTROY,
        lifecycleRules: [ {
          description: 'limit max image count',
          maxImageAge: Duration.days(90),
        } ],
      },
  );

  ecr.addToResourcePolicy(buildCrossAccountEcrResourcePolicy(service, stage));

  return ecr;
}

function buildCrossAccountEcrResourcePolicy(service: SERVICE, stage: STAGE) {
  const accountIdPrincipals: AccountPrincipal[] = [];
  if (stage === STAGE.ALPHA) {
    accountIdPrincipals.push(new AccountPrincipal(getAccountId(service, STAGE.ALPHA)));
  } else {
    getSharedStageAccountIds().forEach(accountId => {
      accountIdPrincipals.push(new AccountPrincipal(accountId));
    });
  }

  // allow IAM users (in management account) to troubleshoot docker image
  accountIdPrincipals.push(new AccountPrincipal(AHA_ORGANIZATION_ACCOUNT));

  return new PolicyStatement({
    effect: Effect.ALLOW,
    actions: [ 'ecr:*' ],
    principals: accountIdPrincipals,
  });
}

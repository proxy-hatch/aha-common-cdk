import { Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { AHA_ORGANIZATION_ACCOUNT } from '../../environment-configuration';
import { AHA_DEFAULT_REGION } from '../../constant';


export interface SsmStackProps {
  readonly terminationProtection?: boolean;
}

// Retrieve the Github SSH private key from Aha Management Account
// TODO: migrate this key to use AWS Secrets Manager, that natively support cross-account
// https://app.zenhub.com/workspaces/back-edtech-623a878cdf3d780017775a34/issues/earnaha/api-core/1763
export class SsmStack extends Stack {
  public readonly githubSshPrivateKey: string;

  constructor(scope: Construct, id: string, props: SsmStackProps) {
    super(scope, id, {
      ...props, env: {
        account: AHA_ORGANIZATION_ACCOUNT,
        region: AHA_DEFAULT_REGION,
      },
    });

    this.githubSshPrivateKey = StringParameter.valueForStringParameter(
        this, '/poc-test/github-key');
  }
}
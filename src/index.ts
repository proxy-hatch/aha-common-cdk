export interface DeploymentEnvironment {
  readonly region: string;
  readonly stage: string;
  readonly accountId: number;
  readonly appPrefix: string;
}

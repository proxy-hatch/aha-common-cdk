export type DeploymentEnvironment = {
  region: string;
  stage: string;
  accountId: number;
  appPrefix: string;
}


//
// export class Abc implements DeploymentEnvironment {
//   readonly accountId!: number;
//   readonly appPrefix!: string;
//   readonly region!: string;
//   readonly stage!: string;
//
//   Abc(){
//
//   }
// }
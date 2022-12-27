# Aha Common CDK library

Collection of constants, helper methods, and CDK constructs to use in CDK infrastructure packages.

See [api-core](https://github.com/EarnAha/api-core/) for usage examples.

### Testing
Unlike business logic codebase, infrastructure-as-code generally have trivial logic, but instead rely on extensive 3rd party libraries.

Thus, unit test is omitted in favour for manual integration test - i.e., deploy to alpha (testing) AWS account and observe resource constructions.


### Adding new dependencies
Be sure to add both devDependencies and peerDependencies for any cdk library that your package needs to consume to maintain version consistency.
Reference: [Managing dependencies for construct library](https://tinyurl.com/manage-construct-dependencies)

## Major Versions
Major versions are incremented when breaking change occurs.

### 2.0.0
- shared stage accounts across services
### 1.0.0
- service-specific stage accounts 
- aha pipeline and aha-single-env pipelines with App Runner, supporting api-core

### releasing new major version
1. tag latest commit
    ```
    git checkout main
    git pull
    git tag -a x.0.0 -m "latest commit of major version x.0.0"
    ```

2. modify package.json
    ```
    "version": "x+1.0.0",
    ```

3. Depend on latest version in your CDK infrastructure pkg with
    ```
    "aha-common-cdk": "EarnAha/aha-common-cdk#main",
    ```
    
    Depend on earlier versions in your CDK infrastructure pkg with
    ```
    "aha-common-cdk": "EarnAha/aha-common-cdk#1.0.0",
    ```

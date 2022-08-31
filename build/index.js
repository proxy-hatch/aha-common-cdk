"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStackCreationInfo = exports.SERVICES = exports.STAGES = exports.AHA_ORGANIZATION_ACCOUNT = exports.AHA_DEFAULT_REGION = void 0;
exports.AHA_DEFAULT_REGION = 'ap-northeast-1';
exports.AHA_ORGANIZATION_ACCOUNT = '083784680548';
exports.STAGES = {
    Alpha: 'alpha',
    Beta: 'beta',
    Gamma: 'gamma',
    Prod: 'prod',
};
exports.SERVICES = {
    ApiCore: 'api-core',
    // ApiAuth: 'api-auth',
};
/**
 * Returns the stack creation info
 *
 * @remarks
 * This method is used in each stack creation across envs
 *
 * @param account - the AWS account ID
 * @param region - the AWS region that stacks should be deployed to. Defaulted to {@link AHA_DEFAULT_REGION}
 * @param stage - the deployment stage. When not provided, defaults to stage-less
 * @returns a {@link StackCreationInfo} object
 *
 */
function createStackCreationInfo(account, region = exports.AHA_DEFAULT_REGION, stage) {
    return {
        account: account,
        region: region,
        stage: stage !== null && stage !== void 0 ? stage : '',
        stackPrefix: `Aha-${region}${stage ? '-' + stage : ''}`,
    };
}
exports.createStackCreationInfo = createStackCreationInfo;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQWEsUUFBQSxrQkFBa0IsR0FBRyxnQkFBZ0IsQ0FBQztBQUN0QyxRQUFBLHdCQUF3QixHQUFHLGNBQWMsQ0FBQztBQUUxQyxRQUFBLE1BQU0sR0FBRztJQUNwQixLQUFLLEVBQUUsT0FBTztJQUNkLElBQUksRUFBRSxNQUFNO0lBQ1osS0FBSyxFQUFFLE9BQU87SUFDZCxJQUFJLEVBQUUsTUFBTTtDQUNKLENBQUM7QUFFRSxRQUFBLFFBQVEsR0FBRztJQUN0QixPQUFPLEVBQUUsVUFBVTtJQUNuQix1QkFBdUI7Q0FDZixDQUFDO0FBU1g7Ozs7Ozs7Ozs7O0dBV0c7QUFDSCxTQUFnQix1QkFBdUIsQ0FBQyxPQUFlLEVBQUUsU0FBaUIsMEJBQWtCLEVBQUUsS0FBYztJQUMxRyxPQUFPO1FBQ0wsT0FBTyxFQUFFLE9BQU87UUFDaEIsTUFBTSxFQUFFLE1BQU07UUFDZCxLQUFLLEVBQUUsS0FBSyxhQUFMLEtBQUssY0FBTCxLQUFLLEdBQUksRUFBRTtRQUNsQixXQUFXLEVBQUUsT0FBUSxNQUFPLEdBQUksS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFHLEVBQUU7S0FDNUQsQ0FBQztBQUNKLENBQUM7QUFQRCwwREFPQyIsInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBjb25zdCBBSEFfREVGQVVMVF9SRUdJT04gPSAnYXAtbm9ydGhlYXN0LTEnO1xuZXhwb3J0IGNvbnN0IEFIQV9PUkdBTklaQVRJT05fQUNDT1VOVCA9ICcwODM3ODQ2ODA1NDgnO1xuXG5leHBvcnQgY29uc3QgU1RBR0VTID0ge1xuICBBbHBoYTogJ2FscGhhJyxcbiAgQmV0YTogJ2JldGEnLFxuICBHYW1tYTogJ2dhbW1hJyxcbiAgUHJvZDogJ3Byb2QnLFxufSBhcyBjb25zdDtcblxuZXhwb3J0IGNvbnN0IFNFUlZJQ0VTID0ge1xuICBBcGlDb3JlOiAnYXBpLWNvcmUnLFxuICAvLyBBcGlBdXRoOiAnYXBpLWF1dGgnLFxufSBhcyBjb25zdDtcblxuZXhwb3J0IGludGVyZmFjZSBTdGFja0NyZWF0aW9uSW5mbyB7XG4gIHJlYWRvbmx5IGFjY291bnQ6IHN0cmluZztcbiAgcmVhZG9ubHkgcmVnaW9uOiBzdHJpbmc7XG4gIHJlYWRvbmx5IHN0YWdlOiBzdHJpbmc7XG4gIHJlYWRvbmx5IHN0YWNrUHJlZml4OiBzdHJpbmc7XG59XG5cbi8qKlxuICogUmV0dXJucyB0aGUgc3RhY2sgY3JlYXRpb24gaW5mb1xuICpcbiAqIEByZW1hcmtzXG4gKiBUaGlzIG1ldGhvZCBpcyB1c2VkIGluIGVhY2ggc3RhY2sgY3JlYXRpb24gYWNyb3NzIGVudnNcbiAqXG4gKiBAcGFyYW0gYWNjb3VudCAtIHRoZSBBV1MgYWNjb3VudCBJRFxuICogQHBhcmFtIHJlZ2lvbiAtIHRoZSBBV1MgcmVnaW9uIHRoYXQgc3RhY2tzIHNob3VsZCBiZSBkZXBsb3llZCB0by4gRGVmYXVsdGVkIHRvIHtAbGluayBBSEFfREVGQVVMVF9SRUdJT059XG4gKiBAcGFyYW0gc3RhZ2UgLSB0aGUgZGVwbG95bWVudCBzdGFnZS4gV2hlbiBub3QgcHJvdmlkZWQsIGRlZmF1bHRzIHRvIHN0YWdlLWxlc3NcbiAqIEByZXR1cm5zIGEge0BsaW5rIFN0YWNrQ3JlYXRpb25JbmZvfSBvYmplY3RcbiAqXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTdGFja0NyZWF0aW9uSW5mbyhhY2NvdW50OiBzdHJpbmcsIHJlZ2lvbjogc3RyaW5nID0gQUhBX0RFRkFVTFRfUkVHSU9OLCBzdGFnZT86IHN0cmluZyk6IFN0YWNrQ3JlYXRpb25JbmZvIHtcbiAgcmV0dXJuIHtcbiAgICBhY2NvdW50OiBhY2NvdW50LFxuICAgIHJlZ2lvbjogcmVnaW9uLFxuICAgIHN0YWdlOiBzdGFnZSA/PyAnJyxcbiAgICBzdGFja1ByZWZpeDogYEFoYS0keyByZWdpb24gfSR7IHN0YWdlID8gJy0nICsgc3RhZ2UgOiAnJyB9YCxcbiAgfTtcbn1cblxuIl19
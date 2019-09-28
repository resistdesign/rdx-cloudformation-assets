# RDX CloudFormation Assets

Various AWS CloudFormation assets used by RDX.

## Notes for RDX-With-CloudFront-And-Lambda-API-And-Cognito.yaml

1. You need package the custom resources, see the `stack:package`, `stack:deploy` and `stack` scripts.
1. You will want to replace `stack-data.example.com` with your own bucket for storing template related code.
1. If you just want to package the template and use the AWS Console to deploy the stack, use:
    1. `npm run stack:package`
        1. This will upload customer resource code to your S3 bucket and output the `stack.yaml` file.
    1. Load the `stack.yaml` file into the CloudFormation console.

## License

MIT

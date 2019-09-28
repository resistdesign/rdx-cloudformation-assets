const AWS = require('aws-sdk');

exports.handler = async (event) => {
  try {
    var cognitoIdentityServiceProvider = new AWS.CognitoIdentityServiceProvider();

    let responseData;

    switch (event.RequestType) {
      case 'Create':
        console.log('Creating User Pool Domain:', event.ResourceProperties.Domain);
        responseData = await cognitoIdentityServiceProvider.createUserPoolDomain({
          UserPoolId: event.ResourceProperties.UserPoolId,
          Domain: event.ResourceProperties.Domain,
          CustomDomainConfig: {
            CertificateArn: event.ResourceProperties.CertificateArn
          }
        }).promise();

        await manageDNSAlias(
          'CREATE',
          event.ResourceProperties.RecordSetProperties,
          responseData.CloudFrontDomain
        );

        break;

      case 'Update':
        await deleteUserPoolDomain(cognitoIdentityServiceProvider, event.OldResourceProperties.Domain);

        await manageDNSAlias(
          'DELETE',
          event.OldResourceProperties.RecordSetProperties
        );

        console.log('Updating User Pool Domain:', event.ResourceProperties.Domain);
        responseData = await cognitoIdentityServiceProvider.createUserPoolDomain({
          UserPoolId: event.ResourceProperties.UserPoolId,
          Domain: event.ResourceProperties.Domain,
          CustomDomainConfig: {
            CertificateArn: event.ResourceProperties.CertificateArn
          }
        }).promise();

        await manageDNSAlias(
          'CREATE',
          event.ResourceProperties.RecordSetProperties,
          responseData.CloudFrontDomain
        );

        break;

      case 'Delete':
        await deleteUserPoolDomain(cognitoIdentityServiceProvider, event.ResourceProperties.Domain);

        await manageDNSAlias(
          'DELETE',
          event.ResourceProperties.RecordSetProperties
        );

        break;
    }

    await sendCloudFormationResponse(event, 'SUCCESS', responseData);
    console.info(`CognitoUserPoolDomain Success for request type ${event.RequestType}`);
    console.log('Sent data:', responseData);
  } catch (error) {
    console.error(`CognitoUserPoolDomain Error for request type ${event.RequestType}:`, error);
    await sendCloudFormationResponse(event, 'FAILED');
  }
};

async function manageDNSAlias(action, recordSetProperties = {}, dnsName) {
  const {
    HostedZoneId,
    Name
  } = recordSetProperties;
  const r53 = new AWS.Route53();

  let DNSName = dnsName;

  if (!DNSName) {
    const {
      ResourceRecordSets = []
    } = await r53.listResourceRecordSets({HostedZoneId}).promise();
    const {
      AliasTarget: {
        DNSName: AliasDNSName
      } = {}
    } = ResourceRecordSets
      .filter(({Name: name, Type: type = ''} = {}) => name === Name && type.toUpperCase() === 'A')[0] || {};

    DNSName = AliasDNSName;
  }

  return r53
    .changeResourceRecordSets({
      ChangeBatch: {
        Changes: [
          {
            Action: action,
            ResourceRecordSet: {
              Name,
              Type: 'A',
              AliasTarget: {
                DNSName,
                EvaluateTargetHealth: false,
                HostedZoneId: 'Z2FDTNDATAQYW2'
              }
            }
          }
        ],
        Comment: `${action} Cognito User Pool Domain Resource Record Set from CloudFormation.`
      },
      HostedZoneId
    })
    .promise();
}

async function deleteUserPoolDomain(cognitoIdentityServiceProvider, domain) {
  var response = await cognitoIdentityServiceProvider.describeUserPoolDomain({
    Domain: domain
  }).promise();

  if (response.DomainDescription.Domain) {
    await cognitoIdentityServiceProvider.deleteUserPoolDomain({
      UserPoolId: response.DomainDescription.UserPoolId,
      Domain: domain
    }).promise();
  }
}

async function sendCloudFormationResponse(event, responseStatus, responseData) {
  var params = {
    FunctionName: 'CloudFormationSendResponse',
    InvocationType: 'RequestResponse',
    Payload: JSON.stringify({
      StackId: event.StackId,
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
      ResponseURL: event.ResponseURL,
      ResponseStatus: responseStatus,
      ResponseData: responseData
    })
  };

  var lambda = new AWS.Lambda();
  var response = await lambda.invoke(params).promise();

  if (response.FunctionError) {
    var responseError = JSON.parse(response.Payload);
    throw new Error(responseError.errorMessage);
  }
}

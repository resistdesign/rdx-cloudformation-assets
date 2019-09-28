const url = require('url');

exports.handler = async (event, context) => {
  var reason = event.ResponseStatus == 'FAILED' ? ('See the details in CloudWatch Log Stream: ' + context.logStreamName) : undefined;

  var responseBody = JSON.stringify({
    Status: event.ResponseStatus,
    Reason: reason,
    PhysicalResourceId: context.logStreamName,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: event.ResponseData
  });

  var {
    protocol = '',
    host,
    port,
    pathname: path = '',
    search = ''
  } = url.parse(event.ResponseURL);
  const http = protocol === 'https:' ? require('https') : require('http');

  var responseOptions = {
    protocol,
    host,
    port,
    path: `${path}${search}`,
    method: 'PUT',
    headers: {
      'content-type': '',
      'content-length': responseBody.length
    }
  };

  console.info('Response body:\n', responseBody);

  try {
    await new Promise((resolve, reject) => {
      let req = http.request(
        responseOptions,
        res => {
          let buffers = [];
          res.on('error', reject);
          res.on('data', buffer => buffers.push(buffer));
          res.on(
            'end',
            () =>
              res.statusCode === 200
                ? resolve(Buffer.concat(buffers))
                : reject(Buffer.concat(buffers))
          );
        }
      );
      req.write(responseBody);
      req.end();
    });

    console.info('CloudFormationSendResponse Success');
  } catch (error) {
    console.error('CloudFormationSendResponse Error:');

    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error(error.response.data);
      console.error(error.response.status);
      console.error(error.response.headers);
    } else if (error.request) {
      // The request was made but no response was received
      // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
      // http.ClientRequest in node.js
      console.error(error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error', error.message);
    }

    console.error(error.config);

    // A UnhandledPromiseRejectionWarning will be emitted here. See https://forums.aws.amazon.com/thread.jspa?threadID=283258 for details.
    throw new Error('Could not send CloudFormation response');
  }
};

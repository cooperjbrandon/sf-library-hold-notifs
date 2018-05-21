const request = require('request');

const fetch = async (options) => {
  return new Promise(function(resolve, reject) {
    request(options, function(err, response, body) {
      if (err) {
        reject(err);
      } else {
        resolve({response, body});
      }
    });
  });
}

module.exports = fetch;
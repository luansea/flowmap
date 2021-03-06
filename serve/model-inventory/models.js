'use strict';

var AWS = require('aws-sdk');
var s3 = new AWS.S3();
var _ = require('lodash');

const s3Url = 'https://s3-eu-west-1.amazonaws.com/model-inventory/movies/';

function listObjects (prefix) {
  return new Promise(function(resolve, reject) {
    var params = {
      Bucket: "model-inventory",
      Prefix: prefix
    };
    s3.listObjectsV2(params, function(err, data) {
      if (err) {
        console.log('error during list objects', err);
        reject(err);
      } // an error occurred
      else {
        resolve(data.Contents);
      }
    });
  });
};

function getObject(key) {
  return new Promise(function(resolve, reject) {
    var params = {
      Bucket: "model-inventory",
      Key: key
    };
    s3.getObject(params, function(err, data) {
      if (err) {
        reject(err);
      } // an error occurred
      else {
        var body = data.Body.toString('utf-8');
        var model = JSON.parse(body);
        resolve(model);
      }
    });
  });
};

module.exports.index = (event, context, callback) => {
  Promise.all([
    listObjects("meta/"),
    listObjects("movies/")
  ])
    .then((result) => {
      var metas = result[0];
      var movies = result[1];
      var models = [];
      var modelPromises = _.map(
        // only the non empty files
        _.filter(
          metas,
          (meta) => meta.Size > 0
        ),
        (meta) => {
          // get each object
          return getObject(meta.Key);
        }
      );

      Promise.all(modelPromises)
        .then(
          (models) => {
            _.each(
              models,
              (model) => {
                if (_.has(model, 'uv.src')) {
                  model.uv.src = s3Url + model.uv.src;
                  // hirlam northsea
                  if (_.includes(model.uv.src, 'dcsm_v6_kf_hirlam')) {
                    model.metadata.summary = 'The Dutch Continental Shelf Model provides daily sea level forecasts.';
                    model.metadata.title = 'DCSM';
                  }

                  if (_.includes(model.uv.src, 'dcsmv6_zunov4_zuno_kf_hirlam')) {
                    model.metadata.summary = 'The ZUNO model provides daily sea level forecasts for the southern part of the North Sea.';
                    model.metadata.title = 'ZUNO';
                  }
                  console.log('model', model, _.includes(model.uv.src, 'dcsm_v6_kf_hirlam'));
                }


              }
            );

            const response = {
              statusCode: 200,
              body: JSON.stringify({
                "models": models
              }),
              headers: {
                // Required for CORS support to work (options request not supported)
                "Access-Control-Allow-Origin" : "*"
              }
            };
            callback(null, response);
          }
        )
        .catch(
          (reason) => {
            console.log('Could not get objects: ', reason);
          }
        );
    })
    .catch(
      (reason) => {
        console.log('Could not list objects', reason);
      }

    );
};

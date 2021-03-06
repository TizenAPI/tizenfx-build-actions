const fs = require('fs');
const glob = require('glob');
const path = require('path');
const core = require('@actions/core');
const AWS = require('aws-sdk');

async function run() {
  try {
    // Inputs
    const file = core.getInput('file');
    const region = core.getInput('region');
    const bucket = core.getInput('bucket');
    const folder = core.getInput('folder');
    const key = core.getInput('key');

    const uploadFiles = glob.sync(file);

    if (uploadFiles.length == 0) {
      throw new Error(`File not found : ${file}`);
    }

    if (uploadFiles.length > 1 && key) {
      throw new Error('key argument is availabe when upload a single file');
    }

    // Config AWS
    AWS.config.update({
      region,
    });

    uploadFiles.forEach(async (matchedFile) => {
      let targetKey = key ? key : path.basename(matchedFile);
      targetKey = folder ? path.join(folder, targetKey) : targetKey;
      const data = await uploadToBucket(matchedFile, bucket, targetKey);
      core.setOutput('data', JSON.stringify(data));
    });
  } catch (error) {
    console.error(error);
    core.setFailed(error.message);
  }
}

async function uploadToBucket(filepath, bucket, key) {
  const s3 = new AWS.S3({apiVersion: '2006-03-01'});
  return new Promise((resolve, reject) => {
    fs.readFile(filepath, (err, data) => {
      const params = {
        Bucket: bucket,
        Key: key,
        Body: data,
      };
      s3.upload(params, (err, data) => {
        if (err) {
          reject(err);
        }
        resolve(data);
      });
    });
  });
}

run();

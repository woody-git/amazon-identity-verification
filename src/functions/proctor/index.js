const AWS = require("aws-sdk");
const uuid = require("uuid").v4;

const {
  COLLECTION_ID,
  FACES_TABLENAME,
  MIN_CONFIDENCE,
  REGION,
} = process.env;

const rekognition = new AWS.Rekognition({ region: REGION });
const dynamo = new AWS.DynamoDB({ region: REGION });
const textract = new AWS.Textract({region: REGION});
const s3 = new AWS.S3({region: REGION});

const respond = (statusCode, response) => ({
  statusCode,
  body: JSON.stringify(response),
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  },
});

exports.indexHandler = async (event) => {
  const ExternalImageId = uuid();
  const body = JSON.parse(event.body);

  const faceValidate = { TestName: "Face Match Verification" };
  
  //getItem using userId from Dynamo . Then using Dunamo ImageURl to the docuemnt image from S3
  const getMetadata = () =>
    dynamo
      .putItem({
        Item: {
          CollectionId: { S: COLLECTION_ID },
          ExternalImageId: { S: ExternalImageId },
          FullName: { S: body.userId },
        },
        TableName: FACES_TABLENAME,
      })
      .promise();

  const getIDDocumentFromS3 = () =>
    s3
      .getItem({
        //TODO
      })
      .promise();

   const matchFaces = () => 
   rekognition
      .compareFaces({
        Image: { Bytes: imageBytes },
        MinConfidence: MIN_CONFIDENCE,
      })
      .promise();
  
      faceValidate.Success = true;
      faceValidate.Details = "Face matched with document successfully!";

  try {
    //await getMetadata();
    //await getIDDocumentFromS3();
    //awaut matchFaces();
    return respond(200, faceValidate.flat());
  } catch (e) {
    console.log(e);
    return respond(500, { error: e });
  }
};

const extractDocumentInformation = async (imageBytes) => {
/* 
  Read information from ID picture using Textract.
*/const userId = uuid();

  const returnedDocumentInformationName = { TestName: "ID Document Name" };
  const returnedDocumentInformationDate = { TestName: "ID Document Expiring Date" };
  const personalDocumentDetect = { TestName: "Personal ID Document" };

  /* Promise for Rekognition Object and Scene detection - DetectObjects API*/
  const detectLabels = () =>
    rekognition
      .detectLabels({
        Image: { Bytes: imageBytes },
        MinConfidence: MIN_CONFIDENCE,
      })
      .promise();

  /* Promise for Textract Sync document Analysis with key-value extraction*/
  const extractDocumentInfo = () =>
    rekognition
      .detectText({
        Image: { Bytes: imageBytes }
      }).promise();

        /*
        textract
        .analyzeDocument({
          Document: {Bytes: imageBytes},
          FeatureTypes: ["FORMS", "TABLES"]
        })
        .promise();
        */


  const persistMetadata = () =>
  dynamo
    .putItem({
      Item: {
        UserId: { S: userId },
        userInfo: { S: userId} //TO BE IMPROVED
      },
      TableName: FACES_TABLENAME,
    })
    .promise();    

  const persistDocumentPicture = () =>
  s3
    .upload({
      Body: imageBytes, 
      //Bucket: COLLECTION_ID, 
      Bucket: 'identity-verification-iddocument-storage',
      Key: '' + uuid
    })
    .promise();

    try {
    
    //Calling object detection
    const labels = await detectLabels();
    
    //Looking for documents
    const personalID = labels.Labels.find((x) => x.Name === "Id Cards");
    const personalIDDetected = personalID ? personalID.Instances.length : 0;
    
    personalDocumentDetect.Success = personalIDDetected === 1;
    personalDocumentDetect.Details = personalIDDetected;

    if (personalIDDetected > 0) {
    
      const documentInfo = await extractDocumentInfo();

      console.log("Document Info JSON reposne: " + JSON.stringify(documentInfo));

      if (documentInfo.TextDetections.length > 0) {
        
        /*
        const keys = Object.keys(documentInfo.TextDetections.DetectedText);
        const personalSurname = documentInfo.TextDetections.DetectedText[keys[keys.indexOf("COGNOME SURNAME")]+1];
        const personalName = documentInfo.TextDetections.DetectedText[keys[keys.indexOf("CPSP")]+1];
        */
       // This logic must be changed based on the document type you want to read (additional conditional validation rules can be placed here).
       const personalSurname  = documentInfo.TextDetections[5].DetectedText;
       const personalName     = documentInfo.TextDetections[7].DetectedText;
       const expiryDate     = documentInfo.TextDetections[18].DetectedText;
        
        const fullName = personalName + " " + personalSurname;

        if (fullName.length > 0) { 
          returnedDocumentInformationName.Details = personalName + " " + personalSurname;
          returnedDocumentInformationName.Success = true;

          returnedDocumentInformationDate.Success = true;
          returnedDocumentInformationDate.Details = expiryDate;
        }
        else {
          returnedDocumentInformationName.Success = false;
          returnedDocumentInformationName.Details = "";

          returnedDocumentInformationDate.Success = false;
          returnedDocumentInformationDate.Details = '';
        }

        // const storedMetadataReponse = await persistMetadata();
        //const storedPictureResponse = await persistDocumentPicture();

      } else{
        returnedDocumentInformationName.Success = false;
        returnedDocumentInformationName.Details = "";

        returnedDocumentInformationDate.Success = false;
        returnedDocumentInformationDate.Details = '';
      }
    }
  
  } catch (e) {
    console.log(e);

    personalDocumentDetect.Success = false;
    personalDocumentDetect.Details = 0;

    returnedDocumentInformationDate.Success = false;
    returnedDocumentInformationDate.Details = '';

    returnedDocumentInformationName.Success = false;
    returnedDocumentInformationName.Details = '';
    
  }

  return [personalDocumentDetect, returnedDocumentInformationName, returnedDocumentInformationDate];
}



/*Handler for ID document analysis */
exports.processHandler = async (event) => {
  const body = JSON.parse(event.body);
  const imageBytes = Buffer.from(body.image, "base64");

  const result = await Promise.all([
    extractDocumentInformation(imageBytes)
  ]);

  return respond(200, result.flat());
};
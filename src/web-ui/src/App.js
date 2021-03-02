import React, { useEffect, useRef, useState } from "react";
import { AmplifyAuthenticator, AmplifySignIn } from "@aws-amplify/ui-react";
import { onAuthUIStateChange } from "@aws-amplify/ui-components";
import Webcam from "react-webcam";
import { Col, Row } from "react-bootstrap";

import gateway from "./utils/gateway";

import CameraHelp from "./components/CameraHelp";
import EngagementSummary from "./components/EngagementsSummary";
import IDRegistrationSummary from "./components/IdentityRegistrationSummary";
import IDVerificationSummary from "./components/IdentityVerificationSummary";
import Header from "./components/Header";
import SettingsHelp from "./components/SettingsHelp";
import { loadingSceneName } from "aws-amplify";

const App = () => {
  const [authState, setAuthState] = useState(undefined);
  const [readyToStream, setReadyToStream] = useState(false);
  const [testResults, setTestResults] = useState([]);
  const [verificationResults, setVerificationResults] = useState([]);
  
  const iterating = useRef(false);
  const webcam = useRef(undefined);
  const docAcquired = useRef(false);
  const faceParams = useState(undefined);

  const addUser = (params) => gateway.addUser(params);

  function sleep(milliseconds) {
    const date = Date.now();
    let currentDate = null;
    do {
      currentDate = Date.now();
    } while (currentDate - date < milliseconds);
  }

  /*  Call Lambda function for document acquisition by processing live webcam images. 
      when document information are retieved correctly (first element has success = true)
      the interface is mantained in state with document information and face analysis is triggered 
      with the function (getFaceSnapshot) for face match on docID and face on camera */
  const getDocumentSnapshot = () => {
    const image = webcam.current.getScreenshot();
    const b64Encoded = image.split(",")[1];
    gateway.processImage(b64Encoded).then((response) => {
      if (response) setTestResults(response);
      if (response[0].Success) {
        docAcquired.current = true;
        setTimeout(getFaceSnapshot, 300);
      }
      else {
        if (iterating.current) setTimeout(getDocumentSnapshot, 300);
        else if (!docAcquired.current) setTestResults([]);
      }
    });
  };

  //call Lambda function for user registration by running face match challange passing live webcam frames
  const getFaceSnapshot = () => {
    const image = webcam.current.getScreenshot();
    const b64Encoded = image.split(",")[1];

    faceParams.image = b64Encoded;
    faceParams.userId = '123';
    //TODO Add passing idUser

    /* Mock verification results */
    sleep(5000);
    setVerificationResults([{TestName:"Face Match Verification", Success:true, Details:"Face matched with document successfully!"}]);
    /* END Mock */

    /*
    gateway.addUser(faceParams).then((response) => {
      alert('phase3');
      if (response) setVerificationResults(response);
      
      if (!response[0].Success) {
        alert('face not match');
        if (iterating.current) setTimeout(getFaceSnapshot, 300);
        else setVerificationResults([]);
      } else {alert('face OK!');}
    });
    */
  };

  const setupWebcam = (instance) => {
    webcam.current = instance;

    const checkIfReady = () => {
      if (
        webcam.current &&
        webcam.current.state &&
        webcam.current.state.hasUserMedia
      ) {
        setReadyToStream(true);
      } else setTimeout(checkIfReady, 250);
    };

    checkIfReady();
  };

  const toggleRekognition = () => {
    iterating.current = !iterating.current;
    //If document is already taken, check for face coverage and not document, and go to person registration. -> register only if the document face and webcam are the same person
    if (iterating.current) {
          getDocumentSnapshot();
          //getFaceSnapshot();
    } else {
      setTestResults([]);
      setVerificationResults([]);
      docAcquired.current=false;
    }
  };

  useEffect(() => {
    return onAuthUIStateChange((s) => setAuthState(s));
  }, []);

  const signedIn = authState === "signedin";

  return (
    <div className="App">
      <Header
        addUser={addUser}
        readyToStream={readyToStream}
        signedIn={signedIn}
        toggleRekognition={toggleRekognition}
      />
      {signedIn ? (
        <>
          <SettingsHelp show={!window.rekognitionSettings} />
          <CameraHelp show={!readyToStream} />
          <Row>
            <Col md={8} sm={6}>
              <Webcam
                ref={setupWebcam}
                screenshotFormat="image/jpeg"
                videoConstraints={{
                  width: 1280,
                  height: 640,
                  facingMode: "user",
                }}
                style={{ width: "100%", marginTop: "10px" }}
              />
            </Col>
            <Col md={4} sm={6}>
              <IDRegistrationSummary testResults={testResults} />
              <IDVerificationSummary verificationResults={verificationResults} />
            </Col>
          </Row>
        </>
      ) : (
        <div className="amplify-auth-container">
          <AmplifyAuthenticator usernameAlias="email">
            <AmplifySignIn
              slot="sign-in"
              usernameAlias="email"
              formFields={[
                {
                  type: "email",
                  label: "Username *",
                  placeholder: "Enter your username",
                  required: true,
                  inputProps: { autoComplete: "off" },
                },
                {
                  type: "password",
                  label: "Password *",
                  placeholder: "Enter your password",
                  required: true,
                  inputProps: { autoComplete: "off" },
                },
              ]}
            >
              <div slot="secondary-footer-content"></div>
            </AmplifySignIn>
          </AmplifyAuthenticator>
        </div>
      )}
    </div>
  );
};

export default App;

import React, { useState } from "react";
import { Button } from "react-bootstrap";

const IdentityRegistrationButton = ({ enabled, onClick }) => {
  const [started, setStarted] = useState(false);

  return (
    <Button
      variant={started ? "danger" : "success"}
      onClick={(e) => {
        setStarted(!started);
        onClick(e);
      }}
      disabled={!enabled}
      size="sm"
    >
      {started ? "Stop" : "Start"} Identity Registration
    </Button>
  );
};

export default IdentityRegistrationButton;

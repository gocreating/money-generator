const sendAuthInput = (wss, type, inputDetails) => {
  const inputPayload = [0, type, null, inputDetails] // Note how the payload is constructed here. It consists of an array starting with the CHANNEL_ID, TYPE, and PLACEHOLDER and is followed by the inputDetails object.
  wss.send(JSON.stringify(inputPayload)); // Submit payload for input
};

module.exports = sendAuthInput;

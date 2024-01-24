let myId = "";
let connected = false;
let peerIceCandidate = "";
let iceC = [];
let peerId = "";
let socket = io("https://filetransfer-ym3b.onrender.com");
const CHUNK_SIZE = 16 * 1024;
let fileChunks = [];
const fileInput = document.getElementById("file");
const selectedFileDisplay = document.getElementById("selectedFileDisplay");
let receivedChunks = [];
let file;
fileReader = new FileReader();
let offset = 0;
let receiveBuffer = [];
const BUFFER_FULL_THRESHOLD = 20 * 1024 * 1024;
const progressBar = document.getElementsByClassName("progressBar")[0];
let peerConnection ;
let computedStyle;
let width;
let dataConnection;
let webRTCbuffer = [];
let receivedFileData = [];
function createPeerConnection(){
  return new RTCPeerConnection({
    iceServers: [
      {
        urls: "stun:stun.l.google.com:19302",
      },
    ],
  });
  return peerConnection;
}
async function generateOffer() {
  peerConnection=createPeerConnection()
  peerConnection.onicecandidate = (e) => {
    console.log('Ice Candidate generated',e.candidate)
    if (e.candidate) {
      socket.emit("iceCandidate", e.candidate);
    }
  };
  dataConnection = peerConnection.createDataChannel("channel");
  dataConnection.onopen = () => {
    socket.emit("connectionEstablished", 1);
    console.log("data connection opened");
  };
  dataConnection.onmessage = async (e) => {
    receiveData(e);
  };
  dataConnection.onclose = () => {
    console.log("data connection closed");
  }
  dataConnection.binaryType = "arraybuffer";
  dataConnection.bufferedAmountLowThreshold = 5 * 1024 * 1024;
  const offer = await peerConnection.createOffer();
  peerConnection.setLocalDescription(new RTCSessionDescription(offer));
  return offer;
}

function sendOffer(id, offer) {
  var data = {
    peer: id,
    iceCandidate: offer,
  };
  socket.emit("peerConnect", data);
}

async function generateAnswer() {
  peerConnection=createPeerConnection()
  peerConnection.onicecandidate = (e) => {
    console.log('Ice Candidate generated',e.candidate)
    if (e.candidate) {
      socket.emit("iceCandidate", e.candidate);
    }
  };
  peerConnection.ondatachannel = (e) => {
    peerConnection.dataChannel = e.channel;
    peerConnection.dataChannel.onmessage = async (e) => {
      receiveData(e);
    };
    peerConnection.dataChannel.onopen = () => {
      dataConnection=peerConnection.dataChannel;
      console.log("data connection opened");
    };
    peerConnection.dataChannel.binaryType = "arraybuffer";
    peerConnection.dataChannel.bufferedAmountLowThreshold = 5 * 1024 * 1024;
  };
  peerConnection.setRemoteDescription(
    new RTCSessionDescription(peerIceCandidate),
  );
  const answer = await peerConnection.createAnswer();
  peerConnection.setLocalDescription(new RTCSessionDescription(answer));
  return answer;
}

function sendAnswer(ans) {
  var data = {
    peer: peerId,
    myId: myId,
    iceCandidate: ans,
  };
  socket.emit("sendAnswer", data);
}

socket.on("connect", () => {
  console.log("connected");
});
socket.on("myId", (id) => {
  document.getElementById("myId").innerHTML = `My Id:${id}`;
  myId = id;
});
socket.on("connectionStatus", (e) => {
  if (e.code == 1) {
    if (e.message=='Connecting...'){
      connected='Connecting...'
      document.getElementById("message").innerHTML = connected;
      return
    }
    document.getElementById("message").innerHTML = "";
    document.getElementById("connect").disabled = false;
    document.getElementById("connect").innerHTML = "Disconnect";
    connected = true;
    if (iceC.length > 0) {
      iceC.forEach((e) => {
        if (e.peer == peerId) {
          peerConnection
            .addIceCandidate(new RTCIceCandidate(e.iceCandidate.candidate))
            .then(() => console.log("added ice candidate"));
        }
      });
    }
  } else {
    if (e.message == "Disconnect") {
      connected = false;
      iceCandidate = "";
      peerId = "";
      peerIceCandidate='';
      iceC = [];
      dataConnection.close()
      peerConnection.close()
      dataConnection = null;
      document.getElementById("connect").disabled = false;
      document.getElementById("connect").innerHTML = "Connect";
    } else {
      if (e.code == 2) {
        document.getElementById("message").innerHTML = e.message;
        return;
      }
      document.getElementById("message").innerHTML = e.message;
      document.getElementById("connect").disabled = false;
      document.getElementById("connect").innerHTML = "Connect";
    }
  }
});
socket.on("wantToConnect", (e) => {
  if (connected == false) {
    document.getElementById("peersId").value = e.peer;
    peerIceCandidate = e.iceCandidate;
    peerId = e.peer;
  }
});
socket.on("setAnswer", (e) => {
  try {
    peerConnection.setRemoteDescription(e).then((e) => {
    });
  } catch (error) {
    console.log("something went wrong", error);
  }
});
socket.on("newIceCandidate", (e) => {
  console.log('received ice candidate',e)
  if (connected == false) {
    iceC.push(e);
  } else {
    if (e.peer == peerId) {
      console.log(e.peer==peerId)
      peerConnection
        .addIceCandidate(new RTCIceCandidate(e.iceCandidate.candidate))
        .then(() => console.log("added ice candidate"));
    }
  }
});

let fileName;
let filesize;
let receivedSize = 0;

function receiveData(e) {
  if (!fileName) {
    var data = JSON.parse(e.data);
    fileName = data.file;
    filesize = data.size;
    selectedFileDisplay.textContent = `Selected file: ${fileName}`;
    document.getElementById("send").hidden = true;
    document.getElementsByClassName("progressIndicator")[0].style.display =
      "flex";
    computedStyle = getComputedStyle(progressBar);
    width = parseFloat(computedStyle.getPropertyValue("--width")) || 0;
  } else {
    receivedSize += e.data.byteLength;
    progressBar.style.setProperty(
      "--width",
      `${(receivedSize / filesize) * 100}`,
    );
    var receivedMB = receivedSize / (1024 * 1024);
    var fileMB = filesize / (1024 * 1024);
    progressBar.setAttribute(
      "data",
      `Downloading...   ${receivedMB.toFixed(1)}MB/${fileMB.toFixed(1)}MB`,
    );
    receivedFileData.push(e.data);
    if (receivedSize >= filesize) {
      var blob = new Blob(receivedFileData, {
        type: "application/octet-stream",
      });
      var link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = fileName;
      link.click();
      document.getElementById("send").hidden = false;
      document.getElementsByClassName("progressIndicator")[0].style.display =
        "none";
      fileName = null;
      filesize = null;
      receivedSize = 0;
      receivedFileData = [];
      selectedFileDisplay.textContent = "File Downloaded Successfully!!!";
    }
  }
}

function sendData() {
  let message = webRTCbuffer.shift();

  while (message) {
    if (
      dataConnection.bufferedAmount &&
      dataConnection.bufferedAmount > BUFFER_FULL_THRESHOLD
    ) {
      webRTCbuffer.unshift(message);

      const listener = () => {
        dataConnection.removeEventListener("bufferedamountlow", listener);
        sendData();
      };

      dataConnection.addEventListener("bufferedamountlow", listener);
      return;
    }
    try {
      dataConnection.send(message);
      message = webRTCbuffer.shift();
    } catch (error) {
      throw new Error(
        `Error send message, reason: ${error.name} - ${error.message}`,
      );
    }
  }
}

const OFF_SET = 16 * 1024;
const MAX_OFFSET = 10 * 1024 * 1024;
async function readFileAsArrayBuffer(f) {
  let result_arraybuffer = await new Promise((resolve) => {
    let fileReader = new FileReader();
    fileReader.onload = (e) => resolve(fileReader.result);
    fileReader.readAsArrayBuffer(f);
  });
  return result_arraybuffer;
}
const sendFile = async () => {
  file = fileInput.files[0];
  var data = {
    file: file.name,
    size: file.size,
  };
  dataConnection.send(JSON.stringify(data));
  let currentChunk = 0;
  while (currentChunk * OFF_SET <= file.size) {
    let start = currentChunk * OFF_SET;
    let end = Math.min(file.size, start + OFF_SET);
    let arrayBuffer = await readFileAsArrayBuffer(file.slice(start, end));
    progressBar.style.setProperty("--width", `${(end / file.size) * 100}`);
    var sendMB = end / (1024 * 1024);
    var fileMB = file.size / (1024 * 1024);
    progressBar.setAttribute(
      "data",
      `Sending...   ${sendMB.toFixed(1)}MB/${fileMB.toFixed(1)}MB`,
    );
    // console.log(arrayBuffer);
    webRTCbuffer.push(arrayBuffer);
    currentChunk += 1;
    sendData();
  }
  selectedFileDisplay.textContent = "File sent Successfully!!!";
  document.getElementById("send").hidden = false;
  document.getElementsByClassName("progressIndicator")[0].style.display =
    "none";
  file = "";
  fileInput = document.getElementById("file");
};

document
  .getElementById("send")
  .addEventListener("click", function handleClick() {
    if (!fileInput.files[0]) {
      alert("Please select a file");
      return;
    }
    if (connected!==true) {
      alert('Connect to peer to transfer data!!!')
      return
    }
    document.getElementById("send").hidden = true;
    document.getElementsByClassName("progressIndicator")[0].style.display =
      "flex";
    computedStyle = getComputedStyle(progressBar);
    width = parseFloat(computedStyle.getPropertyValue("--width")) || 0;
    sendFile();
  });

fileInput.addEventListener("change", function () {
  const selectedFile = fileInput.files[0];

  if (selectedFile) {
    selectedFileDisplay.textContent = `Selected file: ${selectedFile.name}`;
  } else {
    selectedFileDisplay.textContent = "";
  }
});

document.getElementById("connect").addEventListener("click", async () => {
  if (document.getElementById("peersId").value==''){
    document.getElementById("message").innerHTML='Enter Peers Id!!!'
    return
  }
  if(document.getElementById("peersId").value==myId){
    document.getElementById("message").innerHTML='Cannot connect to your self!!!'
    return
  }
  document.getElementById("message").innerHTML = "";
  if (document.getElementById("connect").innerHTML == "Disconnect") {
    socket.emit("breakConnection", myId);
  } else {
    document.getElementById("connect").disabled = true;
    document.getElementById("connect").innerHTML = "Connecting";
    if (peerIceCandidate == '') {
      peerId = document.getElementById("peersId").value;
      console.log("peers id is:", peerId);
      var offer = await generateOffer(); 
      sendOffer(peerId, offer);
    } else {
      peerId=document.getElementById("peersId").value;
      socket.emit('offerAccepted');
      connected='Connecting'
      var answer = await generateAnswer();
      sendAnswer(answer);
    }
  }
});
window.addEventListener("beforeunload", () => {
  socket.emit("closing", "fd");
  try {
    dataConnection.close();
  } catch (error) {
    console.log("error while closing data connection");
  }
  
});

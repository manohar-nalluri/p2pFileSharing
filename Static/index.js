let myId=''
let connected=false
let peerIceCandidate=''
let peerId=''
let socket=io('http://localhost:3000');
const CHUNK_SIZE = 16 * 1024;
let fileChunks = [];
const fileInput = document.getElementById('file')
const selectedFileDisplay = document.getElementById('selectedFileDisplay');
let receivedChunks = [];
let file;
fileReader = new FileReader();
let offset = 0;
let receiveBuffer = [];
const peerConnection = new RTCPeerConnection();
let dataConnection;




function initialwebRtc(){
  dataConnection = peerConnection.createDataChannel('dataChannel');
  dataConnection.onopen = () => console.log('peer connection open');
  dataConnection.onmessage = (e) => document.getElementById('data').innerHTML = "Just got the message" + e.data;
  peerConnection.onicecandidate = e => {console.log('ice candidate generate')};
}
async function localConnection(){
  initialwebRtc()
let offer=await peerConnection.createOffer()
peerConnection.setLocalDescription(offer)
return offer
}
function sendOffer (Id,offer) {
  var data={
    peer:Id,
    iceCandidate:offer
  }
  console.log(data)
  socket.emit('peerConnect',data);
}

async function generateAnswer(){
  try {
    let answer =await peerConnection.createAnswer()
    peerConnection.setLocalDescription(answer)
    return answer
  } catch (error) {
    console.log('error while setting local description')
  }
  
}
function sendAnswer(ans){
  data={
    myId:myId,
    peer:peerId,
    iceCandidate:ans

  }
  socket.emit('sendAnswer',data);
  console.log('answer sent')
}

socket.on('connect',()=>{ console.log('connected')})
socket.on("myId",(id)=>{
  console.log(id)
  document.getElementById('myId').innerHTML=`My Id:${id}`
  myId=id
})
socket.on('connectionStatus',(e)=>{
  console.log('connection came',e)
  if (e.code==1){
    document.getElementById('message').innerHTML=''
    document.getElementById('connect').disabled=false
    document.getElementById('connect').innerHTML='Disconnect'
    connected=true
  }
  else{
    if (e.message=='Disconnect'){
      connected=false;
      iceCandidate='';
      peerId='';
      dataConnection=null;
      document.getElementById('connect').disabled=false;
      document.getElementById('connect').innerHTML='Connect';
    }
    else{
      console.log('no user found');
      document.getElementById('message').innerHTML=e.message;
      document.getElementById('connect').disabled=false;
      document.getElementById('connect').innerHTML='Connect';
    }
}

})
socket.on('wantToConnect',(e)=>{
  console.log('received offer')
  if (connected==false){
    document.getElementById('peersId').value=e.peer;
    console.log(e);
    peerIceCandidate=e.iceCandidate;
    peerId=e.peer;
  }
})
socket.on('setAnswer',(e)=>{
  console.log('received answer')
  try {
      peerConnection.setRemoteDescription(e).then((e) => socket.emit('connectionEstablished',1));
      console.log('established')
  } catch (error) {
    console.log('something went wrong',error)
  }
})













// function generateAnswer() {
//   offer = JSON.parse(document.getElementById('offer').value)
//   peerConnection.ondatachannel = e => {
//     peerConnection.dc = e.channel;
//     peerConnection.dc.onmessage = e => rearrangeData(e);
//     peerConnection.dc.onopen = e => document.getElementById('ans').innerHTML = 'This is receiver connected to sender with dataChannel';
//   }
//   peerConnection.setRemoteDescription(offer)
//   peerConnection.createAnswer().then((data) => peerConnection.setLocalDescription(data).then((e) => document.getElementById('answer').innerHTML = JSON.stringify(peerConnection.localDescription)));
// }

function sendData() {
    let message = webRTCbuffer.shift();

    while (message) {
      if (sendChannel.bufferedAmount && sendChannel.bufferedAmount > BUFFER_FULL_THRESHOLD) {
        webRTCbuffer.unshift(message);
  
        const listener = () => {
          dataConnection.removeEventListener('bufferedamountlow', listener);
          sendMessageQueued();
        };
  
        dataConnection.addEventListener('bufferedamountlow', listener);
        return;
      }
      try {
        sendChannel.send(message);
        sendprogressbar.value += BYTES_PER_CHUNK;
        if (sendprogressbar.value >= sendprogressbar.max) {
          sendprogressbar.value = 0;
          clearInterval(statsUpdateInterval);
          sendButton.disabled = false;
          sendInProgress = false;
        }
        message = webRTCMessageQueue.shift();
      } catch (error) {
        throw new Error(`Error send message, reason: ${error.name} - ${error.message}`);
      }
    }
}


// document.getElementById('Send').addEventListener("click", () => { readSlice(0) });
webRTCbuffer = []
const OFF_SET = 16 * 1024
const MAX_OFFSET = 10 * 1024 * 1024
async function readFileAsArrayBuffer(f) {
    let result_arraybuffer = await new Promise((resolve) => {
        let fileReader = new FileReader();
        fileReader.onload = (e) => resolve(fileReader.result);
        fileReader.readAsArrayBuffer(f);
    });
    return result_arraybuffer;
  }
const sendFile = async() => {
    file = fileInput.files[0];
    
    let currentChunk=0;
    while(currentChunk*OFF_SET<=file.size){
        let start=currentChunk*OFF_SET;
        let end=Math.min(file.size,start+OFF_SET);
        console.log(start,end);
        let arrayBuffer=await readFileAsArrayBuffer(file.slice(start,end));
        // console.log(arrayBuffer);
        webRTCbuffer.push(arrayBuffer);
        currentChunk+=1;
        sendData();
    }
 

}
document.getElementById("send").addEventListener("click", function handleClick() {
  if (!fileInput.files[0]){
    alert('Please select a file');
    return
  }
  this.removeEventListener('click',handleClick);
  console.log('clicked');
  
  document.getElementById("send").setAttribute('src','../assets/disabledSend.png');
}
);
fileInput.addEventListener('change', function () {
  const selectedFile = fileInput.files[0];

  if (selectedFile) {
      selectedFileDisplay.textContent = `Selected file: ${selectedFile.name}`;
  } else {
      selectedFileDisplay.textContent = '';
  }
});

//
// fileReader.addEventListener('load', e => {
//   const file = fileInput.files[0];
//   sendData(e.target.result);
//   offset += e.target.result.byteLength;
//   document.getElementById('data').innerHTML = `$${offset * CHUNK_SIZE} Completed remaining $${file.size}`;
//   if (offset < file.size) {
//     readSlice(offset);
//   }
//   else {
//     document.getElementById('data').innerHTML = 'Transfer Complete';
//   }
// });
//
//
// const readSlice = o => {
//   const file = fileInput.files[0];
//   const slice = file.slice(offset, o + CHUNK_SIZE);
//   fileReader.readAsArrayBuffer(slice);
// };
//
// function receivingData(data) {
//
//   receivedChunks.push(data);
// }
// function rearrangeData(event) {
//   console.log(event);
//   receiveBuffer.push(event.data);
// }
//
// document.getElementById('download').addEventListener("click", () => {
//   const received = new Blob(receiveBuffer);
//   const downloadLink = document.createElement('a');
//   downloadLink.href = URL.createObjectURL(received);
//   downloadLink.download = 'assembled_file.pdf';
//   document.body.appendChild(downloadLink);
//   downloadLink.click();
//   document.body.removeChild(downloadLink);
// })

document.getElementById('connect').addEventListener('click',async()=>{
  document.getElementById('message').innerHTML=''
  if (document.getElementById('connect').innerHTML=='Disconnect'){
    socket.emit('breakConnection',myId) 
  }else{
    
  document.getElementById('connect').disabled=true
  document.getElementById('connect').innerHTML='Connecting'
  if(peerIceCandidate==''){
    var peersId=document.getElementById('peersId').value
    console.log('peers id is:',peersId)
    var offer=await localConnection()
    sendOffer(peersId,offer)
}
else{
  initialwebRtc()
  peerConnection.setRemoteDescription(peerIceCandidate)
  var answer=await generateAnswer()
  sendAnswer(answer)
}
  }
})
let myId=''
let connected=false
let peerIceCandidate=''
let iceC=[]
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
const BUFFER_FULL_THRESHOLD=20*1024*1024;
const peerConnection = new RTCPeerConnection(
  {
    iceServers: [{
      urls: "stun:stun.l.google.com:19302"
    }]
  }
);
const progressBar=document.getElementsByClassName('progressBar')[0]
let computedStyle=getComputedStyle(progressBar)
let width=parseFloat(computedStyle.getPropertyValue('--width')) || 0
let dataConnection;
let webRTCbuffer = []


async function generateOffer(){
  peerConnection.onicecandidate = (e)=>{
    if (e.candidate){
      socket.emit('iceCandidate',e.candidate)
      console.log('ice candidate sent')
    }
  
  }
  dataConnection=peerConnection.createDataChannel('channel')
  dataConnection.onopen=()=>{console.log('data connection opened')}
  dataConnection.onmessage=async (e)=>{receiveData(e)}
  // dataConnection.binaryType='arraybuffer';
  dataConnection.bufferedAmountLowThreshold=5*1024*1024;
  const offer=await peerConnection.createOffer()
  peerConnection.setLocalDescription(new RTCSessionDescription(offer))
  return offer
}

function sendOffer(id,offer){
  var data={
    peer:id,
    iceCandidate:offer
  }
  socket.emit('peerConnect',data)
}

async function generateAnswer(){
  peerConnection.ondatachannel=e=>{
    peerConnection.dataChannel=e.channel
    peerConnection.dataChannel.onmessage=async (e)=>{receiveData(e)}
    peerConnection.dataChannel.onopen=()=>{console.log('data connection opened')}
    // peerConnection.dataChannel.binaryType='arraybuffer';
    peerConnection.dataChannel.bufferedAmountLowThreshold=5*1024*1024;
  }
    peerConnection.setRemoteDescription(new RTCSessionDescription(peerIceCandidate))
    const answer=await peerConnection.createAnswer()
    peerConnection.setLocalDescription(new RTCSessionDescription(answer))
    return answer
}

function sendAnswer(ans){
  var data={
    peer:peerId,
    myId:myId,
    iceCandidate:ans
  }
  socket.emit('sendAnswer',data)
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
    if (iceC.length>0){
      iceC.forEach(e=>{
        console.log(e)
        if(e.peer==peerId){
          peerConnection.addIceCandidate(new RTCIceCandidate(e.iceCandidate)).then(
            ()=>console.log('added ice candidate')
          )
        }
      })
    }
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
      if (e.code==2){
        document.getElementById('message').innerHTML=e.message;
        return
      }
      document.getElementById('message').innerHTML=e.message;
      document.getElementById('connect').disabled=false;
      document.getElementById('connect').innerHTML='Connect';
    }
}

})
socket.on('wantToConnect',(e)=>{
  console.log('I got an offer')
  if (connected==false){
    document.getElementById('peersId').value=e.peer;
    console.log(e);
    peerIceCandidate=e.iceCandidate;
    peerId=e.peer;
    console.log(peerIceCandidate)
  }
})
socket.on('setAnswer',(e)=>{
  console.log('I got the answer')
  try {
      peerConnection.setRemoteDescription(e).then((e) =>{
        socket.emit('connectionEstablished',1)
      });
      console.log('established')
  } catch (error) {
    console.log('something went wrong',error)
  }
})
socket.on('newIceCandidate',(e)=>{
  console.log('New Ice Candidates Came')
  if (connected==false){
    console.log(e)
    iceC.push(e)
  }else{
    if (e.peer==peerId){
      peerConnection.addIceCandidate(new RTCIceCandidate(e.iceCandidate)).then(
        ()=>console.log('added ice candidate')
      )
    }
  }
  
})

let fileName;
let filesize;
let receivedSize=0;

function receiveData(e){
  if (!fileName){
    var data=JSON.parse(e.data)
    fileName=data.file;
    filesize=data.size;
    selectedFileDisplay.textContent = `Selected file: ${fileName}`;
    document.getElementById('send').hidden=true
  }
  else{
    receivedSize+=CHUNK_SIZE
    progressBar.style.setProperty('--width',`${(receivedSize/filesize)*100}`)
    progressBar.dataset.data=`Downloading...   ${receivedSize/(1024*1024)}MB/${filesize/(1024*1024)}MB`
    console.log(e)
  }
}


function sendData() {
  let message = webRTCbuffer.shift();

  while (message) {
    if (dataConnection.bufferedAmount && dataConnection.bufferedAmount > BUFFER_FULL_THRESHOLD) {
      webRTCbuffer.unshift(message);

      const listener = () => {
        dataConnection.removeEventListener('bufferedamountlow', listener);
        sendData();
      };

      dataConnection.addEventListener('bufferedamountlow', listener);
      return;
    }
    try {
      dataConnection.send(message);
      // sendprogressbar.value += BYTES_PER_CHUNK;
      // if (sendprogressbar.value >= sendprogressbar.max) {
      //   sendprogressbar.value = 0;
      //   clearInterval(statsUpdateInterval);
      //   sendButton.disabled = false;
      //   sendInProgress = false;
      // }
      message = webRTCbuffer.shift();
    } catch (error) {
      throw new Error(`Error send message, reason: ${error.name} - ${error.message}`);
    }
  }
}


// document.getElementById('Send').addEventListener("click", () => { readSlice(0) });

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
  var data={
    file:file.name,
    size:file.size,
  }
  dataConnection.send(JSON.stringify(data))
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
  if(!dataConnection){
    dataConnection=peerConnection.dataChannel
  }
  document.getElementById('send').hidden=true
  this.removeEventListener('click',handleClick);
  console.log('clicked');
  sendFile()
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
    var offer=await generateOffer()
    sendOffer(peersId,offer)
}
else{
  var answer=await generateAnswer()
  sendAnswer(answer)
}
  }
})
window.addEventListener('beforeunload',()=>{
  socket.emit('closing','fd')

})



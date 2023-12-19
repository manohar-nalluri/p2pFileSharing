const CHUNK_SIZE=16*1024;
let fileChunks=[];
const fileInput=document.getElementById('fileInput')
let receivedChunks =[];
let  file;
fileReader = new FileReader();
let offset = 0;
let receiveBuffer=[];
const peerConnection=new RTCPeerConnection();
var dataConnection;
function generateOffer(){
    dataConnection=peerConnection.createDataChannel('channel');
    dataConnection.onopen = e=> document.getElementById('ans').innerHTML='This is sender connected to receiver with dataChannel';
    dataConnection.onmessage = e =>document.getElementById('data').innerHTML="Just got the message"+e.data;
    peerConnection.onicecandidate = e => document.getElementById('offer').innerHTML=JSON.stringify(peerConnection.localDescription);
    peerConnection.createOffer().then((offer)=>peerConnection.setLocalDescription(offer))
}
function  generateAnswer() {
    offer=JSON.parse(document.getElementById('offer').value)
    peerConnection.ondatachannel = e =>{
        peerConnection.dc=e.channel;
        peerConnection.dc.onmessage = e=> rearrangeData(e);
        peerConnection.dc.onopen = e => document.getElementById('ans').innerHTML='This is receiver connected to sender with dataChannel';
    }
    peerConnection.setRemoteDescription(offer)
    peerConnection.createAnswer().then((data)=>peerConnection.setLocalDescription(data).then((e)=>document.getElementById('answer').innerHTML=JSON.stringify(peerConnection.localDescription)));
}
function addAnswer(){
    ans=JSON.parse(document.getElementById('answer').value)
    if (!peerConnection.currentRemoteDescription){
        peerConnection.setRemoteDescription(ans).then((e)=>document.getElementById('ans').innerHTML='Connection Established');
    }
}

function sendData(data){
    if(dataConnection){
    dataConnection.send(data);
    }
    else{
        peerConnection.dc.send(data);
    }
}
document.getElementById('createOffer').addEventListener("click",generateOffer);

document.getElementById('receiveOffer').addEventListener("click",generateAnswer);

document.getElementById('acceptAnswer').addEventListener("click",addAnswer);

document.getElementById('Send').addEventListener("click",()=>{readSlice(0)});

fileReader.addEventListener('load', e => {
    const file = fileInput.files[0];
    sendData(e.target.result);
    offset += e.target.result.byteLength;
    document.getElementById('data').innerHTML=`$${offset*CHUNK_SIZE} Completed remaining $${file.size}`;
    if (offset < file.size) {
      readSlice(offset);
    }
    else{
        document.getElementById('data').innerHTML='Transfer Complete';
    }
  });


const readSlice = o => {
    const file=fileInput.files[0];
    const slice = file.slice(offset, o + CHUNK_SIZE);
    fileReader.readAsArrayBuffer(slice);
  };

function receivingData(data){
    
    receivedChunks.push(data);
}
function rearrangeData(event){
    console.log(event);
    receiveBuffer.push(event.data);
}

document.getElementById('download').addEventListener("click",()=>{
    const received = new Blob(receiveBuffer);
    const downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(received);
    downloadLink.download = 'assembled_file.pdf';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
})
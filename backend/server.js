import express from "express"
import http from "http"
import { Server } from "socket.io"
import debug from "debug";
import { customAlphabet } from 'nanoid'
import * as e from 'express';



let users={}
let socketToUser={}
const app=express()
const server=http.createServer(app,{
    path:'/Static/'
})
const io=new Server(server,{
    cors:{
        origin:"https://directdrop-ymtd5.ondigitalocean.app/"
    }
})
debug('socket.io')(io);

const alphabets='1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ'

io.on("connection",(socket)=>{
    console.log("new user connected",socket.id)
    const nanoid = customAlphabet(alphabets, 6)
    let id=nanoid()
    while(users[id]){
        id=nanoid()
    }
    socket.emit("myId",id)
    socketToUser[socket.id]=id
    users[id]={
        connected:false,
        iceCandidate:'',
        offer:'',
        socket:socket,
        connectedTo:''
    }
    socket.on('peerConnect',(e)=>{
        try{
        console.log('wanting to connect to',e.peer)
        if (!users[e.peer]){
            console.log('No user found')
            socket.emit('connectionStatus',{
                code:0,
                message:'No user Found'
            })
        }else{
             let initiator=socketToUser[socket.id]
             if(users[initiator].connected==true){
                socket.emit('connectionStatus',{
                             code:0,
                             message:'Already connected to another user'
                         })
             }else{
                users[initiator].iceCandidate=e.iceCandidate;
                let data={
                    peer:initiator,
                    iceCandidate:e.iceCandidate
                }
                users[e.peer].socket.emit('wantToConnect',data);
                console.log('sent offer to',e.peer)
                users[initiator].connected='Connecting';
                users[initiator].connectedTo=e.peer;
                users[e.peer].connected='Connecting';
                users[e.peer].connectedTo=initiator;
                users[initiator].socket.emit('connectionStatus',{
                    code:2,
                    message:'Waiting for peer to accept connection'
                })
             }
    }}
    catch(error){
        console.log('error while connecting to peer')
    }}
)
socket.on('connectionEstablished',(e)=>{
    try{
    let peer=socketToUser[socket.id]
    users[peer].connected=true;
    let peer2=users[peer].connectedTo
    users[peer2].connected=true;
    users[peer].socket.emit('connectionStatus',{
        code:1,
        message:'Connection established'
    })
    users[peer2].socket.emit('connectionStatus',{
        code:1,
        message:'Connection established'
    })
    console.log('connection established')
}catch(error){
    console.log('error while establishing connection')

}
})
socket.on('sendAnswer',(e)=>{
    try {
        if(users[e.myId].connectedTo==e.peer && users[e.peer].connectedTo==e.myId){
            console.log('received answer from and sending it too other')
            users[e.peer].socket.emit('setAnswer',e.iceCandidate)
        }
    } catch (error) {
        console.log('error while sending answer',error)
    }
})
socket.on('breakConnection',(id)=>{
    try {
        var peer=users[id].connectedTo
        users[peer].connected=false;
        users[peer].connectedTo='';
        users[peer].iceCandidate='';
        users[peer].offer='';
        users[peer].socket.emit('connectionStatus',{
            code:0,
            message:'Disconnect'
        })
        users[id]={
            connected:false,
            iceCandidate:'',
            offer:'',
            socket:socket,
            connectedTo:''
        }
        users[id].socket.emit('connectionStatus',{
            code:0,
            message:'Disconnect'
        })
    } catch (error) {
        console.log('Error while disconnecting')
    }
})

socket.on('closing',()=>{
    
    try {
        let user=socketToUser[socket.id]
        var peer=users[user].connectedTo
        if(users[peer]){
            users[peer].connected=false
            users[peer].connectedTo=''
            users[peer].iceCandidate=''
            users[peer].socket.emit('connectionStatus',{
                code:0,
                message:'Disconnect',
            })
        }
        delete users[user];
        console.log('user disconnected and length is:',Object.keys(users).length)
        console.log(users)
    } catch (error) {
        console.log('Error while closing')
    }
})
socket.on('iceCandidate',(e)=>{
    var user=socketToUser[socket.id]
    users[user].iceCandidate=e
    if(users[user].connected!==false){
        let peer=users[user].connectedTo
        users[peer].socket.emit('newIceCandidate',{
            peer:user,
            iceCandidate:e})
    }
})
})






server.listen(3000,()=>{
    console.log("server is running")
})
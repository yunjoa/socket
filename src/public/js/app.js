
const socket = io();

const myFace = document.querySelector("#myFace");
const muteBtn = document.querySelector("#mute");
const cameraBtn = document.querySelector("#camera");
const cameraSelect = document.querySelector("#cameras");
const call = document.querySelector("#call");

let myStream;
let muted = false;
let cameraOff = false;
let roomName;
let myPeerConnection;
let myDataChannel;


call.hidden = true;


async function getCameras(){
    try{
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(device => device.kind === "videoinput");
        const currentCamera = myStream.getVideoTracks()[0];
        cameras.forEach(camera => {
            const option = document.createElement("option")
            option.value = camera.deviceId;
            option.innerText = camera.label;
            if(currentCamera.label === camera.labe){
                option.selected = true
            }
            cameraSelect.appendChild(option)
        })
        console.log(cameras)
    }catch(e){
        console.log(e)
    }
}

async function getMedia(deviceId){
    const initialConstrains = {
        audio: true,
        video: {facingMode: "user"},
    };
    const cameraConstraints = {
        audio: true,
        video: {deviceId : {exact: deviceId}},
    };
    try {
        myStream = await navigator.mediaDevices.getUserMedia(
            deviceId? cameraConstraints : initialConstrains
        );
        myFace.srcObject = myStream;
        if(!deviceId){
            await getCameras();
        }
    } catch(e) { 
        console.log(e);
    }
}




function handleMuteClick (){
    myStream.getAudioTracks().forEach(track => track.enabled = !track.enabled)
    //반대로 만들어주는거야
    if(!muted){
        muteBtn.innerText = "Unmute";
        muted = true;
    } else { 
        muteBtn.innerText = "Mute";
        muted = false;
    }
}
function handleCameraClick (){
    myStream.getVideoTracks().forEach(track => track.enabled = !track.enabled)
    if(cameraOff){
        cameraBtn.innerText = "Turn Camera Off";
        cameraOff = false;
    } else {
        cameraBtn.innerText = "Turn Camera On";
        cameraOff = true;
    }
}

async function handleCameraChange(){
    await getMedia(cameraSelect.value);
    if(myPeerConnection){
        const videoTrack = myStream.getVideoTracks()[0];
        const videoSender = myPeerConnection.getSenders().find(sender => sender.track.kind === "video");
        videoSender.replaceTrack(videoSender);
        
    }
} 


muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
cameraSelect.addEventListener("input", handleCameraChange);




// welcome Form (join a room)
const welcome = document.querySelector("#welcome");
const welcomeForm = welcome.querySelector("form");

async function initCall(){
    welcome.hidden = true;
    call.hidden = false;
    await getMedia();
    makeConnection();
}

async function handleWelcomeSubmit(event){
    event.preventDefault();
    const input = welcomeForm.querySelector("input");
    await initCall();
    socket.emit("join_room", input.value);
    roomName = input.value;
    input.value="";
}

welcomeForm.addEventListener("submit", handleWelcomeSubmit);


// socket Code
socket.on("welcome", async ()=> {
    myDataChannel = myPeerConnection.createDataChannel("chat");
    myDataChannel.addEventListener("message", (event)=> console.log(event.data));
    console.log("made data channel");

    const offer = await myPeerConnection.createOffer();
    myPeerConnection.setLocalDescription(offer);
    console.log("sent the offer");
    socket.emit("offer", offer, roomName);
})
// offer를 만들어 setLocalDescription 한다

socket.on("offer", async offer => {
    myPeerConnection.addEventListener("datachannel", (event) => {
        myDataChannel = event.channel;
        myDataChannel.addEventListener("message", (event)=> console.log(event.data));
    });

    console.log("received the offer");
    myPeerConnection.setRemoteDescription(offer);
    const answer = await myPeerConnection.createAnswer();
    myPeerConnection.setLocalDescription(answer);
    socket.emit("answer", answer, roomName);
    console.log("sent the answer")

})
// offer를 받아서 setRemoteDescription 한다
// answer에 setLocalDescription을 한다.


socket.on("answer", answer =>{
    console.log("received the answer")
    myPeerConnection.setRemoteDescription(answer);
})
// answer을 다시 돌려보내 setRemoteDescription 시킨다.

socket.on("ice", ice =>{
    console.log("received the ice")
    myPeerConnection.addIceCandidate(ice)
})



// RTC Code
function makeConnection(){
    myPeerConnection = new RTCPeerConnection({
        iceServers : [
            {
                urls: [
                    "stun:stun.l.google.com:19302",
                    "stun:stun1.l.google.com:19302",
                    "stun:stun2.l.google.com:19302",
                    "stun:stun3.l.google.com:19302",
                    "stun:stun4.l.google.com:19302",
                ]
            }
        ]
    });
    myPeerConnection.addEventListener("icecandidate", handleIce);
    // myPeerConnection.addEventListener("addstream", handleAddstream);
    myPeerConnection.addEventListener("track", handleTrack)
    myStream
        .getTracks()
        .forEach(track => myPeerConnection.addTrack(track, myStream));
        // .forEach(track => myPeerConnection.addTrack(track, myStream));
}

function handleIce(data){ 
    console.log("sent the ice");
    socket.emit("ice", data.candidate, roomName);
}


// function handleAddstream(data){
//     const peerFace = document.querySelector("#peerFace");
//     peerFace.srcObject = data.stream;

//     // console.log("got an event from my peer")
//     // console.log("Peer's Stream", data.stream)
//     // console.log("My Stream", myStream)
// }



function handleTrack(data) {
    console.log("handle track");
    const peerFace = document.querySelector("#peerFace");
    peerFace.srcObject = data.streams[0];
}

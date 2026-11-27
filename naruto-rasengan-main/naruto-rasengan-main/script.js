// ===== GET HTML ELEMENTS =====

const welcomeScreen = document.getElementById('welcomeScreen');
const experienceScreen = document.getElementById('experienceScreen');

const startExperienceBtn = document.getElementById('startExperienceBtn');
const backBtn = document.getElementById('backBtn');

const cameraOnBtn = document.getElementById('cameraOnBtn');
const cameraOffBtn = document.getElementById('cameraOffBtn');

const cameraStatus = document.getElementById('cameraStatus');
const cameraPlaceholder = document.getElementById('cameraPlaceholder');

const trackingLabel = document.getElementById('trackingLabel');
const message = document.getElementById('message');

const camVideo = document.getElementById('cam');
const canvas = document.getElementById('skeleton');

const pen = canvas.getContext('2d');

const orbs = Array.from(
    document.querySelectorAll('.rasengan')
);


// ===== COLORS =====

const PALETTES = {

    Left: {
        bone: '#ff8a3d',
        joint: '#fff36a',
        glow: '#ff5e1a'
    },

    Right: {
        bone: '#62f0ff',
        joint: '#ff66e0',
        glow: '#1aa6ff'
    }

};


// ===== FINGER POINTS =====

const FINGER_TIPS = [8, 12, 16, 20];

const FINGER_KNUCKLES = [6, 10, 14, 18];


// ===== RASENGAN STATES =====

const orbState = [

    { charge: 0, wasOpen: false },

    { charge: 0, wasOpen: false }

];


// ===== VARIABLES =====

let hands = null;
let camera = null;

let cameraRunning = false;


// ===== NAVIGATION =====

// Go to experience page

function showExperience() {

    welcomeScreen.hidden = true;

    experienceScreen.hidden = false;

}


// Go back to welcome page

function showWelcome() {

    stopCamera();

    experienceScreen.hidden = true;

    welcomeScreen.hidden = false;

}


// ===== CAMERA STATUS =====

function setStatus(isOn) {

    cameraStatus.classList.toggle('online', isOn);

    cameraStatus.innerHTML = `
        <span class="status-dot"></span>
        ${isOn ? 'CAMERA ON' : 'CAMERA OFF'}
    `;

}


// ===== CHECK OPEN PALM =====

function isPalmOpen(lm) {

    const wrist = lm[0];

    let extended = 0;

    for (let i = 0; i < FINGER_TIPS.length; i++) {

        const tip = lm[FINGER_TIPS[i]];

        const knuckle = lm[FINGER_KNUCKLES[i]];

        const tipDistance = Math.hypot(
            tip.x - wrist.x,
            tip.y - wrist.y
        );

        const knuckleDistance = Math.hypot(
            knuckle.x - wrist.x,
            knuckle.y - wrist.y
        );

        if (tipDistance > knuckleDistance) {

            extended++;

        }

    }

    return extended >= 3;

}


// ===== DRAW HAND SKELETON =====

function paintSkeleton(lm, colors) {

    // Draw bones

    pen.save();

    pen.shadowBlur = 18;

    pen.shadowColor = colors.glow;

    drawConnectors(
        pen,
        lm,
        HAND_CONNECTIONS,
        {
            color: colors.bone,
            lineWidth: 3
        }
    );

    pen.restore();


    // Draw joints

    pen.save();

    pen.shadowBlur = 10;

    pen.shadowColor = colors.glow;

    pen.fillStyle = colors.joint;

    for (const point of lm) {

        pen.beginPath();

        pen.arc(
            point.x * canvas.width,
            point.y * canvas.height,
            3.5,
            0,
            Math.PI * 2
        );

        pen.fill();

    }

    pen.restore();

}


// ===== POSITION RASENGAN =====

function placeOrb(slot, lm, charge) {

    const wrist = lm[0];

    const middleKnuckle = lm[9];

    const centerX = (wrist.x + middleKnuckle.x) / 2;

    const centerY = (wrist.y + middleKnuckle.y) / 2;

    const handSize = Math.hypot(
        middleKnuckle.x - wrist.x,
        middleKnuckle.y - wrist.y
    );

    const lift = handSize * 1.8;

    const orb = orbs[slot];

    orb.style.left =
        `${(1 - centerX) * canvas.clientWidth}px`;

    orb.style.top =
        `${(centerY - lift) * canvas.clientHeight}px`;

    orb.style.opacity = charge.toFixed(3);

}


// ===== MEDIAPIPE RESULTS =====

function onResults(results) {

    if (!cameraRunning) return;


    // Canvas dimensions

    const width = camVideo.videoWidth || camVideo.clientWidth;

    const height = camVideo.videoHeight || camVideo.clientHeight;


    if (canvas.width !== width || canvas.height !== height) {

        canvas.width = width;

        canvas.height = height;

    }


    pen.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    const seen = [false, false];


    // Check detected hands

    if (
        results.multiHandLandmarks &&
        results.multiHandedness
    ) {

        results.multiHandLandmarks.forEach((lm, index) => {

            const label =
                results.multiHandedness[index].label;


            const slot = label === 'Right' ? 1 : 0;

            const colors =
                PALETTES[label] || PALETTES.Left;


            seen[slot] = true;


            // Draw skeleton

            paintSkeleton(lm, colors);


            // Check palm

            const open = isPalmOpen(lm);

            const state = orbState[slot];


            // Charge Rasengan

            state.charge = Math.max(
                0,
                Math.min(
                    1,
                    state.charge + (open ? 0.06 : -0.18)
                )
            );


            // Start Rasengan when palm opens

            if (open && !state.wasOpen) {

                const video = orbs[slot];

                video.currentTime = 0;

                video.play().catch(error => {

                    console.warn(
                        'Rasengan video could not play:',
                        error
                    );

                });

            }


            state.wasOpen = open;


            // Show Rasengan

            if (state.charge > 0.01) {

                placeOrb(
                    slot,
                    lm,
                    state.charge
                );

            } else {

                orbs[slot].style.opacity = 0;

            }

        });

    }


    // Hide missing hands gradually

    for (let i = 0; i < 2; i++) {

        if (seen[i]) continue;

        orbState[i].charge = Math.max(
            0,
            orbState[i].charge - 0.18
        );

        orbState[i].wasOpen = false;

        orbs[i].style.opacity =
            orbState[i].charge.toFixed(3);

    }


    // Update tracking status

    trackingLabel.textContent =
        seen.some(Boolean)
            ? 'HAND DETECTED'
            : 'SHOW YOUR HAND';

}


// ===== START CAMERA =====

async function startCamera() {

    if (cameraRunning) return;


    // Check browser camera support

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {

        message.textContent =
            'Camera access needs localhost or HTTPS. Open using Live Server.';

        return;

    }


    cameraOnBtn.disabled = true;

    message.textContent = 'Requesting camera permission...';


    try {

        // Create MediaPipe Hands

        if (!hands) {

            hands = new Hands({

                locateFile: file =>

                    `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`

            });


            hands.setOptions({

                maxNumHands: 2,

                modelComplexity: 1,

                minDetectionConfidence: 0.65,

                minTrackingConfidence: 0.65

            });


            hands.onResults(onResults);

        }


        // Create camera

        camera = new Camera(camVideo, {

            onFrame: async () => {

                if (
                    cameraRunning &&
                    camVideo.readyState >= 2
                ) {

                    await hands.send({

                        image: camVideo

                    });

                }

            },

            width: 1280,

            height: 720

        });


        cameraRunning = true;


        await camera.start();


        // Update interface

        camVideo.style.display = 'block';

        cameraPlaceholder.style.display = 'none';


        cameraOnBtn.disabled = true;

        cameraOffBtn.disabled = false;


        setStatus(true);


        message.textContent =
            'Camera is on. Show one or both hands to the camera.';


    } catch (error) {

        cameraRunning = false;

        cameraOnBtn.disabled = false;

        cameraOffBtn.disabled = true;


        setStatus(false);


        message.textContent =
            `Could not start camera: ${error.message || error}. Check browser permission.`;


        console.error(error);

    }

}


// ===== STOP CAMERA =====

function stopCamera() {

    cameraRunning = false;


    // Stop MediaPipe camera

    if (camera) {

        try {

            camera.stop();

        } catch (error) {

            console.warn(error);

        }

        camera = null;

    }


    // Stop camera tracks

    const stream = camVideo.srcObject;

    if (stream && stream.getTracks) {

        stream.getTracks().forEach(track => {

            track.stop();

        });

    }


    camVideo.srcObject = null;

    camVideo.pause();

    camVideo.style.display = 'none';


    // Clear skeleton

    pen.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    cameraPlaceholder.style.display = 'flex';


    // Hide Rasengan videos

    orbs.forEach(orb => {

        orb.style.opacity = '0';

        orb.pause();

        try {

            orb.currentTime = 0;

        } catch (_) {}

    });


    // Reset states

    orbState.forEach(state => {

        state.charge = 0;

        state.wasOpen = false;

    });


    // Update buttons

    cameraOnBtn.disabled = false;

    cameraOffBtn.disabled = true;


    setStatus(false);


    trackingLabel.textContent =
        'WAITING FOR CAMERA';


    message.textContent =
        'Camera is off. Press Turn on camera when you are ready.';

}


// ===== BUTTON EVENTS =====

startExperienceBtn.addEventListener(
    'click',
    showExperience
);


backBtn.addEventListener(
    'click',
    showWelcome
);


cameraOnBtn.addEventListener(
    'click',
    startCamera
);


cameraOffBtn.addEventListener(
    'click',
    stopCamera
);


// ===== CLOSE PAGE =====

window.addEventListener(
    'beforeunload',
    stopCamera
);
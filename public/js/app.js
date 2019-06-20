// //
// // DemoUnidosXFIS
//
//    Theme  : Firebase & Face Recognition on Real Time
//    Author : Luis Uculmana Lara
//             Full Stack Developer & GDG Lead
//    Email  : ithecode.ica@gmail.com
//
// //

// Global faces trained. Starts with empty string
let labeledFaceDescriptors = ''

async function run() {


  // Setting up the config for load models from a URL, if you use the same models dont touch it.
  const MODEL_URL = '/models'

  // Load 3 models from the url.
  await faceapi.loadSsdMobilenetv1Model(MODEL_URL)
  await faceapi.loadFaceLandmarkModel(MODEL_URL)
  await faceapi.loadFaceRecognitionModel(MODEL_URL)


  // Making some effects for fun.
  $(".loader").fadeOut(1000)
  $("#send").removeAttr('disabled')

  // try to access users webcam and stream the images
  // to the video element
  const input = document.getElementById('inputVideo')
  navigator.getUserMedia(
    { video: {} },
    stream => input.srcObject = stream,
    err => console.error(err)
  )

  // Now we loada Firebase Function with all saved photos in original
  // And landmarked mode with a hover effect for see it.
  var loadPhotos = firebase.functions().httpsCallable('loadPhotos');
  loadPhotos({}).then(function(result) {
    // Read result of the Cloud Function.
    var data = result.data

    // Showing screenshot saved
    result.data.forEach(data => {
      $("#screenshots").prepend('<img src="'+ data.image_original +'" onmouseover="this.src=\''+ data.image_landmark +'\'" onmouseout="this.src=\''+ data.image_original +'\'" alt="' + data.label+ '">')
    })


  }).catch((e) => {
      console.log(e)
  })

  // When trying to take a screenshot we need save it on firestore.
  $("form").submit((e) => {
    // Prevent many miss clicks.
    e.preventDefault()

    // Calling to the video element by id
    const input = document.getElementById('inputVideo')
    // Creating canvas from face api function.
    const canvas = faceapi.createCanvasFromMedia(input)
    // Calling the function for saving and process data.
    screenshot_save(input, canvas)


    return false
  })


  // We need get all face descriptors after training on Firebase function
  var processor = firebase.functions().httpsCallable('processor');
  processor({}).then(function(result) {
    // Read result of the Cloud Function.
    var result = result.data

    labeledFaceDescriptors = result.map( fd => {
      return new faceapi.LabeledFaceDescriptors(fd.label, fd.faceDescriptors)
    })


  })

}

async function drawing_faces(overlay, fullFaceDescriptions){
  // This functions is for face landmark and detection and be reused.

  //Face Api Drawing Detections in a box.
  faceapi.draw.drawDetections(overlay, fullFaceDescriptions, { lineWidth: 4, color: 'blue' })
  //Face Api Drawing Landmarks in the face.
  faceapi.draw.drawFaceLandmarks(overlay, fullFaceDescriptions, { lineWidth: 4, color: 'red' })
}
async function screenshot_save(input, canvas){

  // Making effects
  $("#send").text('Sending 3 photos for training model...').attr('disabled')

  // We need a label name for the face.
  var label = $('#label').val()

  // Create base64 from screenshot from the canvas receipt
  var dataURI = canvas.toDataURL('image/png')

  // Taking sizes from input receipt.
  const displaySize = { width: input.offsetWidth, height: input.offsetHeight }
  // Calling a Firebase Function for saving and process photo.
  var savingPhoto = firebase.functions().httpsCallable('savingPhoto');
  savingPhoto({label: label, photo: dataURI, displaySize: displaySize}).then(function(result) {
    // Read result of the Cloud Function.
    var data = result.data

    // Showing screenshot saved
    $("#screenshots").prepend('<img src="'+ data.image_original +'" onmouseover="this.src=\''+ data.image_landmark +'\'" onmouseout="this.src=\''+ data.image_original +'\'" alt="' + data.label+ '">')

    // Making effects
    $("#send").text('Train Model').removeAttr('disabled')

    return true

  })

  return false
}


async function onPlay(videoEl) {

  // Calling to the video element by id
  const input = document.getElementById('inputVideo')
  // Calling to the canvas element by id
  const overlay = document.getElementById('overlay')


  //Configuring the width and the height of the video.
  const displaySize = { width: input.offsetWidth, height: input.offsetHeight }

  //Face Api have a match Dimensions for drawing functions.
  faceapi.matchDimensions(overlay, displaySize)

  // Detecting all faces.
  let fullFaceDescriptions = await faceapi.detectAllFaces(videoEl).withFaceLandmarks().withFaceDescriptors()
  fullFaceDescriptions = faceapi.resizeResults(fullFaceDescriptions, displaySize)


  // Drawing faces by a condition.
  if(labeledFaceDescriptors !== ''){
    // If the faces are charged by processor photos
    // We'll do a match the face with the video and we show a box with a label.
    const maxDescriptorDistance = 0.6
    const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, maxDescriptorDistance)

    // Making a map with the best result for each face descriptor.
    const results = fullFaceDescriptions.map(fd => faceMatcher.findBestMatch(fd.descriptor))

    // For each better face match we gonna show a box.
    results.forEach((bestMatch, i) => {
      const box = fullFaceDescriptions[i].detection.box
      const text = bestMatch.toString()
      const drawBox = new faceapi.draw.DrawBox(box, { label: text })
      drawBox.draw(overlay)
    })

  }else{
    // If dont have the face descriptors we'll do the face landmarks and detections.
    faceapi.draw.drawDetections(overlay, fullFaceDescriptions, { lineWidth: 4, color: 'blue' })
    faceapi.draw.drawFaceLandmarks(overlay, fullFaceDescriptions, { lineWidth: 4, color: 'red' })
  }

  // For each frame in the video webcam we use the function.
  setTimeout(() => onPlay(videoEl))
}

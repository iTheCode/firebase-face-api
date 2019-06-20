// //
// // DemoUnidosXFIS
//
//    Theme  : Firebase & Face Recognition on Real Time
//    Author : Luis Uculmana Lara
//             Full Stack Developer & GDG Lead
//    Email  : ithecode.ica@gmail.com
//
// //
const tfjs = require('@tensorflow/tfjs-node')
const firebase = require('firebase')
const functions = require('firebase-functions')
const admin = require('firebase-admin')
const faceapi = require('face-api.js')
const stream = require('stream')
const Buffer = require('buffer/').Buffer
const canvas = require('canvas')
const { Canvas, Image, ImageData } = canvas

// -- Configuration Settings for Firebase and Firebase-admin --

  // patch nodejs environment, we need to provide an implementation of
  // HTMLCanvasElement and HTMLImageElement, additionally an implementation
  // of ImageData is required, in case you want to use the MTCNN
  faceapi.env.monkeyPatch({ Canvas, Image, ImageData })

  // Get This credential from https://console.cloud.google.com/apis/credentials/serviceaccountkey
  const serviceAccount = require("./keys/serviceaccount.json")

  // File for load models from Disk, if you use the same models, dont touch it.
  const MODEL_DIR = './models'

  // Initialize Firebase-admin
  admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: "demounidosxfis.appspot.com",
      databaseURL: "https://demounidosxfis.firebaseio.com"
  })

  // Setting on the timestamps for the documents.
  admin.firestore().settings({ timestampsInSnapshots: true })

  // Your web app's Firebase configuration
  var firebaseConfig = {
    apiKey: "AIzaSyACYKQnJF1ofSqzhkC-D0adISQX2hZ2EBc",
    authDomain: "demounidosxfis.firebaseapp.com",
    databaseURL: "https://demounidosxfis.firebaseio.com",
    projectId: "demounidosxfis",
    storageBucket: "demounidosxfis.appspot.com",
    messagingSenderId: "519004356342",
    appId: "1:519004356342:web:5973887e27258c23"
  }

  // Initialize Firebase
  firebase.initializeApp(firebaseConfig)

// -- Configuration Settings for Firebase and Firebase-admin --






// // Functions to be exported.
// // Read more at https://firebase.google.com/docs/functions/write-firebase-functions

exports.processor = functions.https.onCall(async (data, context) => {

  // Load 3 models from the disk.
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_DIR)
  await faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_DIR)
  await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_DIR)

  // Load all images from firestore reusing the another function with null data.
  var labels = admin.firestore().collection('images').get()
                  .then(snap => snap.docs.map(doc => {
                      var obj = doc.data()
                      obj.key = doc.id
                      return obj
                  }))
                  .catch(e => e)

  const labeledFaceDescriptors = await Promise.all(
    labels.map(async label => {
      // fetch image data from urls and convert blob to HTMLImage element
      const img = await canvas.loadImage(label.image_original)

      // detect the face with the highest score in the image and compute it's landmarks and face descriptor
      const fullFaceDescription = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor()

      // If we dont detect any face we'll show a error.
      if (!fullFaceDescription) {
        throw new Error(`no faces detected for ${label}`)
      }

      // Returning for the map function data.
      return {
          descriptor : [fullFaceDescription.descriptor],
          label : label.name
      }

    })
  )

  // Returning all data maped.
  return labeledFaceDescriptors

})


exports.savingPhoto = functions.https.onCall(async (data, context) => {

  // Load 3 models from the disk
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_DIR)
  await faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_DIR)
  await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_DIR)

  // In NodeJS can't process directly the image, that's because we'll use firebase storage for photos.
  const uploadPicture = function(base64, label) {
    return new Promise((resolve, reject) => {
      if (!base64 || !label) {
        reject("Could not upload picture because at least one param is missing.")
      }

      let bufferStream = new stream.PassThrough()
      var timestamp = new Date().getTime()
      bufferStream.end(new Buffer.from(base64, 'base64'))

      // Retrieve default storage bucket
      let bucket = admin.storage().bucket()

      var file_name = `${label}_${timestamp}.png`
      var bucket_name = "demounidosxfis.appspot.com"

      // Create a reference to the new image file
      let file = bucket.file(file_name)

      bufferStream.pipe(file.createWriteStream({
        metadata: {
          contentType: 'image/png'
        }
      }))
      .on('error', error => {
        reject(`Error while uploading picture ${JSON.stringify(error)}`)
      })
      .on('finish', (file) => {
        // We need resolving with the url of png.
        var downloadUrl = "https://firebasestorage.googleapis.com/v0/b/" + bucket_name + "/o/" + file_name + "?alt=media"
        resolve(downloadUrl)

      })
    })
  }

  // I need to convert the base64 to firebase storage url bucket.
  var image_original_url = await uploadPicture(data.photo.replace(/^data:image\/png;base64,/, ""), data.label)

  // Loading image original from url.
  const image_original = await canvas.loadImage(image_original_url)

  // Detecting all faces.
  let fullFaceDescriptions = await faceapi.detectAllFaces(image_original).withFaceLandmarks().withFaceDescriptors()

  // Creating a Canvas element for draw the faces.
  const image_process = faceapi.createCanvasFromMedia(image_original)

  // Drawing Box & Landmarks
  faceapi.draw.drawDetections(image_process, fullFaceDescriptions, { lineWidth: 4, color: 'blue' })
  faceapi.draw.drawFaceLandmarks(image_process, fullFaceDescriptions, { lineWidth: 4, color: 'red' })

  // Getting base64 from new canvas processed.
  var dataURI = image_process.toDataURL('image/png')

  // Then we need to convert base64 to firebase storage url bucket.
  var image_landmark_url = await uploadPicture(dataURI.replace(/^data:image\/png;base64,/, ""), data.label)


  // Label name, original screenshot and image landmarked.
  var data = {
    'label' : data.label,
    'image_original' : image_original_url,
    'image_landmark' : image_landmark_url
  }

  // Saving the image in Firestore Realtime
  await admin.firestore().collection('images').add(data)

  // Returning data for be add on latest screenshot
  return data

})

exports.loadPhotos = functions.https.onCall(async (data, context) => {

  // Returning all images from the collection parsed as object.
  return admin.firestore().collection('images').get()
                .then(snap => snap.docs.map(doc => {
                    var obj = doc.data()
                    obj.key = doc.id
                    return obj
                }))
                .catch(e => e)


})

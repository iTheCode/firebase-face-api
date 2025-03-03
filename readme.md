# Firebase & Face Recognition on Real Time

This demo was made with [Firebase](https://github.com/firebase/) and  [Face-Api.js](https://github.com/justadudewhohacks/face-api.js)

## Demo Photo on Real Time FaceLandMark in a WebCam
![DemoUnidosXFIS](https://i.imgur.com/AwEEX3I.png)

## Firebase Functions!
Using Firebase Functions we optimize the time for processing all photos and save resources for client side.

  - Name: loadPhotos
  - description: Return all data of photos in Firestore & Firebase storage.
  - Name: processor
  - description: Return all face descriptors from all photos for matchmaking in client site.
  - Name: savingPhotos
  - description: Receipt a base64, save original and processed photo on Firebase storage then save it on Firestore.

## Requirements
- NPM or Yarn
- Firebase CLI
- Enthusiasm!

### Installation


Clone and install all dependencies for functions.

```sh
$ git clone https://github.com/iTheCode/firebase-face-api
$ cd firebase-face-api
$ firebase login
$ firebase init
$ cd functions
$ npm install
$ cd ../
```

### Local Deploy

```sh
$ firebase serve
```

### Firebase Deploy

```sh
$ firebase deploy
```



###

License
----

MIT

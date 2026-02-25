importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCKFgf_yl2LoQDF0q_j_zcHUbrI1TZjLL8',
  authDomain: 'subhavivah-d41fb.firebaseapp.com',
  projectId: 'subhavivah-d41fb',
  storageBucket: 'subhavivah-d41fb.appspot.com',
  messagingSenderId: '1056736337366',
  appId: '1:1056736337366:web:d323ec09ee8429b9e55877',
});

const messaging = firebase.messaging();

// Optional but recommended
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Background message ', payload);

  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: '/favicon.ico',
  });
});

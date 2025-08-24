// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: 'AIzaSyA5Vfvd4PYXlXj5X0YetLmYwDTVQZ6dpWE',
  authDomain: 'geopoint-f1d56.firebaseapp.com',
  projectId: 'geopoint-f1d56',
  storageBucket: 'geopoint-f1d56.firebasestorage.app',
  messagingSenderId: '815851668907',
  appId: '1:815851668907:web:48fbf0ee98bd8d329bfeee',
  measurementId: 'G-YHTVJ3JEH4',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

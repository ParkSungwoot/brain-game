// 게임에서 쓰는 Firebase 기능만 묶어서 window.FB 로 내보냄
import { initializeApp } from 'firebase/app';
import { initializeAuth, browserLocalPersistence, inMemoryPersistence, signInAnonymously, onAuthStateChanged, connectAuthEmulator } from 'firebase/auth';
import { getDatabase, ref, set, update, remove, onValue, onDisconnect, serverTimestamp, goOffline, goOnline, connectDatabaseEmulator } from 'firebase/database';
window.FB = { initializeApp, initializeAuth, browserLocalPersistence, inMemoryPersistence, signInAnonymously, onAuthStateChanged, connectAuthEmulator, getDatabase, ref, set, update, remove, onValue, onDisconnect, serverTimestamp, goOffline, goOnline, connectDatabaseEmulator };

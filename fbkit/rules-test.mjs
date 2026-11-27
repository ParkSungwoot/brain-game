import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signInAnonymously, connectAuthEmulator } from 'firebase/auth';
import { getDatabase, ref, set, get, remove, connectDatabaseEmulator, serverTimestamp, goOffline } from 'firebase/database';
const cfg = { apiKey: 'AIzaSyDxivjcRok5ssmYc5qlNDMTLQFahiirfAo', projectId: 'psw-brain-survival', databaseURL: 'https://psw-brain-survival-default-rtdb.asia-southeast1.firebasedatabase.app' };
async function user(name, anon = true) {
  const app = initializeApp(cfg, name); const db = getDatabase(app); connectDatabaseEmulator(db, '127.0.0.1', 9000);
  let uid = null;
  if (anon) { const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true }); uid = (await signInAnonymously(auth)).user.uid; }
  return { app, db, uid };
}
const T = async (label, p, expectOk) => { try { await p; console.log((expectOk ? 'ok  ' : 'BAD ') + label + ' → 허용됨'); } catch (e) { console.log((expectOk ? 'BAD ' : 'ok  ') + label + ' → 거부됨 (' + (e.code || e.message).toString().slice(0, 40) + ')'); } };
const a = await user('a'), b = await user('b'), anon = await user('x', false);
const node = (u, p = '{}') => ({ u, p, t: serverTimestamp() });
await T('A가 자기 칸 쓰기', set(ref(a.db, 'rooms/nemo-zz9q/peers/aaaaaaaa1'), node(a.uid)), true);
await T('B가 A 칸 덮어쓰기', set(ref(b.db, 'rooms/nemo-zz9q/peers/aaaaaaaa1'), node(b.uid)), false);
await T('B가 A 칸 지우기', remove(ref(b.db, 'rooms/nemo-zz9q/peers/aaaaaaaa1')), false);
await T('B가 u를 A로 속여 새 칸 쓰기', set(ref(b.db, 'rooms/nemo-zz9q/peers/bbbbbbbb2'), node(a.uid)), false);
await T('B가 방 읽기', get(ref(b.db, 'rooms/nemo-zz9q')), true);
await T('B가 방 목록 전체 읽기', get(ref(b.db, 'rooms')), false);
await T('로그인 안 한 사람이 방 읽기', get(ref(anon.db, 'rooms/nemo-zz9q')), false);
await T('로그인 안 한 사람이 쓰기', set(ref(anon.db, 'rooms/nemo-zz9q/peers/cccccccc3'), node('x')), false);
await T('너무 큰 데이터(7만 자)', set(ref(b.db, 'rooms/nemo-zz9q/peers/bbbbbbbb2'), node(b.uid, 'x'.repeat(70000))), false);
await T('허용 안 된 필드 추가', set(ref(b.db, 'rooms/nemo-zz9q/peers/bbbbbbbb2'), Object.assign(node(b.uid), { evil: 1 })), false);
await T('방 이름에 대문자/이상한 글자', set(ref(b.db, 'rooms/NEMO-x/peers/bbbbbbbb2'), node(b.uid)), false);
await T('방 바깥 경로에 쓰기', set(ref(b.db, 'junk/x'), 1), false);
await T('A가 자기 칸 지우기', remove(ref(a.db, 'rooms/nemo-zz9q/peers/aaaaaaaa1')), true);
for (const u of [a, b, anon]) { goOffline(u.db); await deleteApp(u.app); }
process.exit(0);

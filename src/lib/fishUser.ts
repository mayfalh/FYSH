import { doc, setDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import { getOrCreateStableFishUserId as getClientStableId, FISH_USER_ID_KEY } from './composioClient';

export async function getOrCreateStableFishUserId(): Promise<string> {
  const authUser = auth.currentUser;
  let uniqueId = '';

  if (authUser?.uid) {
    uniqueId = authUser.uid;
    try { localStorage.setItem(FISH_USER_ID_KEY, uniqueId); } catch {}
  } else {
    uniqueId = getClientStableId();
  }

  const stableUserId = `fish_user_${uniqueId}`;
  try { localStorage.setItem(FISH_USER_ID_KEY, uniqueId); } catch {}

  // Sync with Firestore only if authenticated and rules allow
  if (authUser?.uid) {
    try {
      const userDocRef = doc(db, 'users', authUser.uid);
      await setDoc(userDocRef, {
        uid: authUser.uid,
        email: authUser.email || '',
        displayName: authUser.displayName || '',
        stableUserId,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      // Suppress permission errors silently
    }
  }

  return stableUserId;
}


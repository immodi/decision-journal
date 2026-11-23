// Seeds the Firebase emulator with a demo account and realistic decisions.
//
//   cd firebase
//   npm run emulators      # in one terminal
//   npm run seed           # in another
//
// Every run wipes emulator state first, so it is safe to repeat. It refuses to
// run against anything that is not a `demo-` project.
import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  connectFirestoreEmulator,
  doc,
  getDocs,
  getFirestore,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';

const projectId = process.env.FIREBASE_PROJECT ?? 'demo-decision-journal';
if (!projectId.startsWith('demo-')) {
  console.error(`Refusing to seed non-demo project "${projectId}".`);
  process.exit(1);
}

const FIRESTORE_PORT = 8081;
const AUTH_PORT = 9099;
const EMAIL = 'demo@example.com';
const PASSWORD = 'demo-password';

const DAY_MS = 24 * 60 * 60 * 1000;
const inDays = (days) => Timestamp.fromDate(new Date(Date.now() + days * DAY_MS));

async function resetEmulators() {
  const firestoreReset = await fetch(
    `http://127.0.0.1:${FIRESTORE_PORT}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  if (!firestoreReset.ok) throw new Error(`Firestore reset failed: ${firestoreReset.status}`);

  const authReset = await fetch(
    `http://127.0.0.1:${AUTH_PORT}/emulator/v1/projects/${projectId}/accounts`,
    { method: 'DELETE' },
  );
  if (!authReset.ok) throw new Error(`Auth reset failed: ${authReset.status}`);
}

const app = initializeApp({ projectId, apiKey: 'demo-api-key', appId: 'demo-app' });
const auth = getAuth(app);
const db = getFirestore(app);
connectAuthEmulator(auth, `http://127.0.0.1:${AUTH_PORT}`, { disableWarnings: true });
connectFirestoreEmulator(db, '127.0.0.1', FIRESTORE_PORT);

const reviewed = [
  {
    title: 'Take the consultancy contract',
    options: ['Take it', 'Stay at the old client'],
    reasoning: 'The work is closer to what I want to learn, and the rate covers the gap.',
    prediction: 'I will find the work more interesting within a month',
    confidence: 75,
    state: 'calm',
    tags: ['work', 'money'],
    outcome: 'The work was more interesting, and the hours were longer than expected.',
    result: 'yes',
    rating: 'sound',
    lesson: 'Ask about the weekly hours before signing.',
  },
  {
    title: 'Move the savings into the index fund',
    options: ['Move it', 'Keep it in cash'],
    reasoning: 'The money will not be needed for at least five years, so volatility is tolerable.',
    prediction: 'I will not need to sell within a year',
    confidence: 70,
    state: 'tired',
    tags: ['money'],
    outcome: 'I sold part of it for the roof repair in month eight.',
    result: 'partly',
    rating: 'flawed',
    lesson: 'Keep a cash buffer for house surprises separate from investments.',
  },
  {
    title: 'Say yes to the on-call rotation',
    options: ['Yes', 'Ask to be exempt'],
    reasoning: 'It is my turn, and the team is small enough that refusing would be noticed.',
    prediction: 'I will be woken up at most twice in the month',
    confidence: 78,
    state: 'stressed',
    tags: ['work', 'health'],
    outcome: 'Five night calls, two of them after 2am.',
    result: 'no',
    rating: 'sound',
    lesson: 'Base predictions on the pager history, not the intention.',
  },
  {
    title: 'Start running before work',
    options: ['Morning', 'Evening'],
    reasoning: 'Evenings fill up, and the mornings are quiet.',
    prediction: 'I will still be running three times a week after a month',
    confidence: 72,
    state: 'calm',
    tags: ['health'],
    outcome: 'Still running, though twice a week rather than three.',
    result: 'partly',
    rating: 'sound',
  },
  {
    title: 'Book the cheap flight with the long layover',
    options: ['Cheap flight', 'Direct flight'],
    reasoning: 'The saving is worth a few hours and I have nothing urgent that day.',
    prediction: 'The layover will be annoying but fine',
    confidence: 55,
    state: 'rushed',
    tags: ['money'],
    outcome: 'The first leg was delayed and the connection was tight.',
    result: 'no',
    rating: 'flawed',
    lesson: 'Never book a connection under two hours on a cheap ticket.',
  },
  {
    title: 'Rewrite the onboarding email',
    options: ['Rewrite', 'Leave it'],
    reasoning: 'It is the first thing people read and it sounds like a legal notice.',
    prediction: 'Support questions will drop noticeably',
    confidence: 58,
    state: 'tired',
    tags: ['work'],
    outcome: 'Questions fell by about a fifth, not "noticeably".',
    result: 'partly',
    rating: 'sound',
  },
  {
    title: 'Tell the family about the move before the contract is signed',
    options: ['Tell them now', 'Wait for certainty'],
    reasoning: 'They will hear it eventually and should not hear it second-hand.',
    prediction: 'It will cause a difficult evening but no lasting damage',
    confidence: 52,
    state: 'anxious',
    tags: ['relationships'],
    outcome: 'Difficult evening, and a better conversation the next week.',
    result: 'yes',
    rating: 'unsure',
  },
  {
    title: 'Buy the standing desk',
    options: ['Buy', 'Keep the old one'],
    reasoning: 'My back has been complaining and the trial at the office helped.',
    prediction: 'I will use it most days',
    confidence: 85,
    state: 'excited',
    tags: ['health', 'money'],
    outcome: 'Used daily for the first month, most days since.',
    result: 'yes',
    rating: 'sound',
  },
  {
    title: 'Renew the hosting plan for three years',
    options: ['Three years', 'Monthly'],
    reasoning: 'The discount is real and the project is unlikely to disappear.',
    prediction: 'I will still be using it in a year',
    confidence: 90,
    state: 'calm',
    tags: ['money', 'work'],
    outcome: 'Still using it, and the price went up after I locked in.',
    result: 'yes',
    rating: 'sound',
  },
  {
    title: 'Skip the dentist appointment to finish the deadline',
    options: ['Skip', 'Go and work late'],
    reasoning: 'The deadline is fixed and the appointment can move.',
    prediction: 'I will rebook within a fortnight',
    confidence: 45,
    state: 'stressed',
    tags: ['health'],
    outcome: 'Rebooked six weeks later, with a filling in the meantime.',
    result: 'no',
    rating: 'flawed',
    lesson: 'Do not trade health appointments for deadlines that move anyway.',
  },
];

const openDue = [
  {
    title: 'Hire the second engineer',
    options: ['Hire', 'Wait a quarter'],
    reasoning: 'The backlog is real, but onboarding costs me two weeks of my own time.',
    prediction: 'The backlog will be half its current size in two months',
    confidence: 65,
    state: 'calm',
    tags: ['work'],
    dueInDays: -1,
  },
  {
    title: 'Switch the phone contract to the cheaper network',
    options: ['Switch', 'Stay'],
    reasoning: 'Coverage at home is the only thing that matters and it is fine.',
    prediction: 'I will not notice the difference',
    confidence: 80,
    state: 'rushed',
    tags: ['money'],
    dueInDays: -4,
  },
  {
    title: 'Agree to mentor the new intern',
    options: ['Agree', 'Decline'],
    reasoning: 'It is two hours a week and I learn by explaining.',
    prediction: 'It will take more time than promised',
    confidence: 60,
    state: 'tired',
    tags: ['work', 'relationships'],
    dueInDays: -12,
  },
  {
    title: 'Book the winter trip now',
    options: ['Book now', 'Wait for January'],
    reasoning: 'Prices climb after November and the dates are fixed.',
    prediction: 'Prices will be higher in January',
    confidence: 55,
    state: 'calm',
    tags: ['money', 'health'],
    dueInDays: -30,
  },
];

const openFuture = [
  {
    title: 'Start the monthly finance review',
    options: ['Monthly', 'Quarterly'],
    reasoning: 'Monthly is short enough to remember and catches drift early.',
    prediction: 'I will keep it up for three months',
    confidence: 68,
    state: 'calm',
    tags: ['money'],
    dueInDays: 7,
  },
  {
    title: 'Move the blog to the static site',
    options: ['Move', 'Keep the old stack'],
    reasoning: 'Nothing on the old stack is used and the build is slow.',
    prediction: 'The move takes one weekend',
    confidence: 62,
    state: 'tired',
    tags: ['work'],
    dueInDays: 21,
  },
  {
    title: 'Get the kitchen tap fixed properly',
    options: ['Replace it', 'Repair again'],
    reasoning: 'It has been repaired twice and the parts cost more each time.',
    prediction: 'Replacing it costs less over two years',
    confidence: 82,
    state: 'calm',
    tags: ['money'],
    dueInDays: 60,
  },
];

async function seedOpen(uid, spec) {
  const reference = await addDoc(collection(db, 'users', uid, 'decisions'), {
    title: spec.title,
    options: spec.options,
    reasoning: spec.reasoning,
    prediction: spec.prediction,
    confidence: spec.confidence,
    state: spec.state,
    tags: spec.tags,
    reviewDate: inDays(spec.dueInDays),
    review: null,
    postponedAt: null,
    status: 'open',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return reference;
}

async function seedReviewed(uid, spec) {
  const reference = await addDoc(collection(db, 'users', uid, 'decisions'), {
    title: spec.title,
    options: spec.options,
    reasoning: spec.reasoning,
    prediction: spec.prediction,
    confidence: spec.confidence,
    state: spec.state,
    tags: spec.tags,
    reviewDate: inDays(-20),
    review: null,
    postponedAt: null,
    status: 'open',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await updateDoc(reference, {
    status: 'reviewed',
    review: {
      reviewedAt: serverTimestamp(),
      outcome: spec.outcome,
      predictionResult: spec.result,
      reasoningRating: spec.rating,
      lesson: spec.lesson ?? '',
    },
    updatedAt: serverTimestamp(),
  });
}

async function main() {
  console.log('Resetting emulator data…');
  await resetEmulators();
  console.log('Creating demo account…');

  try {
    await createUserWithEmailAndPassword(auth, EMAIL, PASSWORD);
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      await signInWithEmailAndPassword(auth, EMAIL, PASSWORD);
    } else {
      throw error;
    }
  }

  console.log('Signed in.');
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Sign-in did not produce a user');

  console.log('Seeding reviewed decisions…');
  for (const spec of reviewed) await seedReviewed(uid, spec);
  console.log('Seeding open decisions…');
  for (const spec of openDue) await seedOpen(uid, spec);
  for (const spec of openFuture) await seedOpen(uid, spec);

  const postponed = await seedOpen(uid, {
    title: 'Reply to the landlord about the deposit',
    options: ['Reply today', 'Wait for the statement'],
    reasoning: 'The statement is due this week and would settle the amount.',
    prediction: 'The statement arrives and the amount is correct',
    confidence: 50,
    state: 'anxious',
    tags: ['money'],
    dueInDays: -3,
  });
  await updateDoc(postponed, {
    reviewDate: inDays(14),
    postponedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const all = await getDocs(collection(db, 'users', uid, 'decisions'));
  console.log(`Seeded ${all.size} decisions for ${EMAIL} (password: ${PASSWORD})`);
  console.log(`${reviewed.length} reviewed, ${openDue.length} due, ${openFuture.length} upcoming, 1 postponed`);
  console.log('Sign in at http://localhost:5173 with those credentials.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
